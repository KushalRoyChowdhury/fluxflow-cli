import * as vscode from 'vscode';
import { WebSocketServer, WebSocket } from 'ws';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import * as os from 'os';
import * as crypto from 'crypto';

let wss: WebSocketServer | undefined;
let lastDiffTimestamp = 0;
let lastCursorLine = 0;
const activeDecs: vscode.TextEditorDecorationType[] = [];
let statusBarItem: vscode.StatusBarItem;
let isCliConnected = false;
const pendingInlineRequests = new Map<string, { resolve: (v: string) => void; timer: NodeJS.Timeout }>();

// Gated debug log — silent by default, enabled via AUTOCOMPLETE_DEBUG env var.
let _out: vscode.OutputChannel | undefined;
function debugLog(...args: unknown[]): void {
    if (!process.env.AUTOCOMPLETE_DEBUG) return;
    try {
        if (!_out) _out = vscode.window.createOutputChannel('FluxFlow Auto-Completion');
        _out.appendLine(args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' '));
    } catch { }
}

/** Resolve every in-flight inline request with '' (e.g. when the CLI drops). */
function drainPendingInlineRequests(): void {
    for (const [, pending] of pendingInlineRequests) {
        clearTimeout(pending.timer);
        pending.resolve('');
    }
    pendingInlineRequests.clear();
}

// Last shown completion, so typing characters already present in the suggestion
// never triggers another model call.
let completionCache: { uri: string; anchor: vscode.Position; anchorText: string; completion: string } | null = null;

function comparePositions(a: vscode.Position, b: vscode.Position): number {
    if (a.line !== b.line) return a.line < b.line ? -1 : 1;
    if (a.character !== b.character) return a.character < b.character ? -1 : 1;
    return 0;
}

/**
 * If the user has typed (part of) the cached suggestion since it was generated,
 * return the still-untyped remainder — no API call needed. null = cache n/a.
 */
function getCachedRemainder(document: vscode.TextDocument, position: vscode.Position): string | null {
    if (!completionCache) return null;
    if (completionCache.uri !== document.uri.toString()) return null;
    // Cursor jumped more than ±2 lines → treat cache as stale.
    if (Math.abs(position.line - completionCache.anchor.line) > 2) return null;
    const anchor = completionCache.anchor;
    if (comparePositions(position, anchor) < 0) return null;
    // Drift guard: if text before the anchor changed (edits above shifted lines,
    // or same-line edits before the cursor), the cached anchor is stale.
    if (anchor.line >= document.lineCount) return null;
    const currentPrefix = document.lineAt(anchor.line).text.slice(0, anchor.character);
    if (currentPrefix !== completionCache.anchorText) return null;
    const typed = document.getText(new vscode.Range(anchor, position));
    if (completionCache.completion.startsWith(typed)) {
        return completionCache.completion.slice(typed.length);
    }
    return null;
}

/** Debounce that resolves early (and harmlessly) when the request is cancelled. */
function debounceWait(ms: number, token: vscode.CancellationToken): Promise<void> {
    return new Promise((resolve) => {
        if (token.isCancellationRequested) return resolve();
        let sub: vscode.Disposable | undefined;
        const timer = setTimeout(() => {
            if (sub) sub.dispose();
            resolve();
        }, ms);
        sub = token.onCancellationRequested(() => {
            clearTimeout(timer);
            if (sub) sub.dispose();
            resolve();
        });
    });
}
let fluxFlowTerminal: vscode.Terminal | undefined;

const lastKnownStates = new Map<string, string>();
const originalStates = new Map<string, string>();
const virtualDocs = new Map<string, string>();
const newFilesCreatedByBridge = new Set<string>();
const accumulatedEdits = new Map<string, Map<number, string>>();
const manualEditBaseContents = new Map<string, string[]>();

class FluxFlowDiffProvider implements vscode.TextDocumentContentProvider {
    provideTextDocumentContent(uri: vscode.Uri): string {
        return virtualDocs.get(uri.toString()) || '';
    }
}

/**
 * Generic OpenAI-compatible chat completion.
 * Lightweight: uses fetch() + manual SSE/TextDecoder streaming.
 * Reasoning/thinking deltas are intentionally ignored — we only collect content.
 * Returns the full assistant text (and optionally streams tokens via onToken).
 */
export async function openaiChatCompletion(options: {
    baseUrl: string;
    model: string;
    messages: Array<{ role: string; content: string }>;
    apiKey?: string;
    temperature?: number;
    maxTokens?: number;
    signal?: AbortSignal;
    onToken?: (token: string) => void;
    onUsage?: (usage: any) => void;
}): Promise<string> {
    const {
        baseUrl,
        model,
        messages,
        apiKey,
        temperature = 1,
        maxTokens = 1024,
        signal,
        onToken,
        onUsage
    } = options;

    // Normalize the endpoint to a full /chat/completions URL.
    let endpoint = (baseUrl || '').trim().replace(/\/+$/, '');
    if (!endpoint) return '';
    if (!/\/chat\/completions$/.test(endpoint)) {
        endpoint += /\/v1$/.test(endpoint) ? '/chat/completions' : '/v1/chat/completions';
    }

    try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

        const res = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens, stream: true, stream_options: { include_usage: true } }),
            signal
        });

        if (!res.ok) return '';
        if (!res.body) return '';

        const decoder = new TextDecoder('utf-8');
        const reader = (res.body as any).getReader();
        let buffer = '';
        let full = '';
        let capturedUsage: any = null;
        let reasoningChars = 0;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const raw of lines) {
                const line = raw.trim();
                if (!line || !line.startsWith('data:')) continue;
                const payload = line.slice(5).trim();
                if (payload === '[DONE]') continue;
                try {
                    const json = JSON.parse(payload);
                    if (json?.usage) capturedUsage = json.usage;
                    const delta = json?.choices?.[0]?.delta;
                    // Reasoning/thinking deltas are not inserted into the editor,
                    // but we still count their length for the usage ledger.
                    const reasoning = delta?.reasoning_content ?? delta?.reasoning ?? delta?.thinking;
                    if (typeof reasoning === 'string' && reasoning) reasoningChars += reasoning.length;
                    const content = delta?.content;
                    if (typeof content === 'string' && content) {
                        full += content;
                        if (onToken) onToken(content);
                    }
                } catch {
                    // Skip malformed/partial chunks.
                }
            }
        }

        // Emit usage once, merging a reasoning-token figure (real when the
        // provider reports it, else estimated from streamed reasoning chars).
        if (onUsage && (capturedUsage || reasoningChars)) {
            try {
                onUsage({
                    ...(capturedUsage || {}),
                    reasoning_tokens: capturedUsage?.completion_tokens_details?.reasoning_tokens
                        ?? Math.ceil(reasoningChars / 4)
                });
            } catch { }
        }

        return full;
    } catch {
        // Silent fail — never surface auto-completion errors to the user.
        return '';
    }
}

/**
 * System prompt for inline auto-completion.
 * The model is instructed to return ONLY the code to insert at the cursor —
 * no prose, no markdown fences, no repetition of existing context.
 */
export const BUILTIN_AUTOCOMPLETE_SYSTEM_PROMPT = [
    'Identity: Embedded IDE code completion engine',
    'Context given: Code ± cursor, file name & language',
    'Task: Predict contextually accurate code at cursor position',
    '',
    'Rules:',
    '- Return ONLY the raw code to insert at the cursor. No explanations, commentary or rambling',
    '- Do NOT wrap in markdown code fences',
    '- NEVER repeat same code that exist around cursor, if nothing sensible possible to predict, return empty string',
    '- Match surrounding indentation and code style',
    '- Complete the current line statement',
    '- Never include placeholder comments like // TODO or # your code here',
    '',
    'Output format:',
    '- Wrap the code to insert in <completion>...</completion>',
    '- Do not put anything except the code to insert between the tags'
].join('\n');

/**
 * Cached active system prompt for auto-completion.
 * Loaded once on extension startup from ~/.fluxflow/.cache/completion.json;
 * falls back silently to BUILTIN_AUTOCOMPLETE_SYSTEM_PROMPT if missing or unparseable.
 */
let cachedAutocompleteSystemPrompt: string = BUILTIN_AUTOCOMPLETE_SYSTEM_PROMPT;

export function loadCachedAutocompleteSystemPrompt(): string {
    try {
        const cachePath = path.join(os.homedir(), '.fluxflow', '.cache', 'completion.json');
        if (fs.existsSync(cachePath)) {
            const raw = fs.readFileSync(cachePath, 'utf8');
            const data = JSON.parse(raw);
            if (typeof data?.systemPrompt === 'string' && data.systemPrompt.trim()) {
                cachedAutocompleteSystemPrompt = data.systemPrompt;
                return cachedAutocompleteSystemPrompt;
            }
        }
    } catch {
        // Silent fallback on any error
    }
    cachedAutocompleteSystemPrompt = BUILTIN_AUTOCOMPLETE_SYSTEM_PROMPT;
    return cachedAutocompleteSystemPrompt;
}

// Initial load at module startup
loadCachedAutocompleteSystemPrompt();

export function getAutocompleteSystemPrompt(): string {
    return cachedAutocompleteSystemPrompt;
}

export const AUTOCOMPLETE_SYSTEM_PROMPT = BUILTIN_AUTOCOMPLETE_SYSTEM_PROMPT;

/**
 * Build inline-completion context from a document + cursor position.
 * Grabs up to ±25 lines around the cursor and reports file name + language.
 */
export function buildCompletionContext(
    document: vscode.TextDocument,
    position: vscode.Position,
    window = 25
): { prefix: string; suffix: string; fileName: string; language: string; recentChanges: string; clipboard?: string } {
    const startLine = Math.max(0, position.line - window);
    const endLine = Math.min(document.lineCount - 1, position.line + window);

    const prefixEnd = position;
    const prefixStart = new vscode.Position(startLine, 0);
    const prefix = document.getText(new vscode.Range(prefixStart, prefixEnd));

    const suffixStart = position;
    const suffixEnd = new vscode.Position(endLine, document.lineAt(endLine).text.length);
    const suffix = document.getText(new vscode.Range(suffixStart, suffixEnd));

    return {
        prefix,
        suffix,
        fileName: path.basename(document.fileName),
        language: document.languageId,
        recentChanges: getRecentManualChanges(
            document.fileName,
            { startLine: startLine + 1, endLine: endLine + 1 }
        )
    };
}


/**
 * Last N manual line changes across the M most-recently-edited files.
 * Reads accumulatedEdits WITHOUT clearing it. Files are ordered by edit
 * recency (bubbled on each change); lines within a file likewise.
 */
function getRecentManualChanges(
    currentDocPath?: string,
    windowRange?: { startLine: number; endLine: number },
    maxFiles = 3,
    maxLines = 5
): string {
    if (accumulatedEdits.size === 0) return '';
    const entries = Array.from(accumulatedEdits.entries());
    const recentFiles = entries.slice(-maxFiles);
    const parts: string[] = [];
    for (const [docPath, fileMap] of recentFiles) {
        if (!fileMap || fileMap.size === 0) continue;
        let lineEntries = Array.from(fileMap.entries());
        // Exclude edits inside the ±window around cursor if editing the same file
        if (currentDocPath && docPath === currentDocPath && windowRange) {
            lineEntries = lineEntries.filter(
                ([n]) => n < windowRange.startLine || n > windowRange.endLine
            );
        }
        if (lineEntries.length === 0) continue;
        const lines = lineEntries.slice(-maxLines);
        const relPath = vscode.workspace.asRelativePath(docPath);
        const lineText = lines.map(([n, t]) => `  L${n}: ${t}`).join('\n');
        parts.push(`${relPath}:\n${lineText}`);
    }
    return parts.join('\n');
}

/**
 * Build the chat messages for an inline-completion request.
 */
export function buildCompletionMessages(
    ctx: { prefix: string; suffix: string; fileName: string; language: string; recentChanges?: string; clipboard?: string }
): Array<{ role: string; content: string }> {
    const recent = ctx.recentChanges
        ? ['### Recent manual changes (context):', ctx.recentChanges, '']
        : [];
    const clip = ctx.clipboard
        ? ['### Clipboard (additional context):', ctx.clipboard, '']
        : [];
    const user = [
        `File: ${ctx.fileName}`,
        `Language: ${ctx.language}`,
        '',
        '### Code before cursor:',
        ctx.prefix,
        '',
        '[cursor here]',
        '',
        '### Code after cursor:',
        ctx.suffix,
        '',
        ...recent,
        ...clip,
        '### Completion to insert at cursor:'
    ].join('\n');

    return [
        { role: 'system', content: getAutocompleteSystemPrompt() },
        { role: 'user', content: user }
    ];
}

/**
 * Extract the completion text from a model response.
 * If <completion>...</completion> tags are present, return only what's inside
 * them; otherwise treat the entire response as the completion.
 */
export function extractCompletion(raw: string): string {
    if (!raw) return '';
    const match = raw.match(/<completion>([\s\S]*?)<\/completion>/i);
    if (match) return match[1];
    // No tags → fall back to the full response.
    return raw;
}

// ---------------------------------------------------------------------------
// Auto-completion credential/config access
// Directly reads FluxFlow's local vault:
//   ~/.fluxflow/.token            → machine key seed
//   ~/.fluxflow/settings.json     → plaintext settings (external data path)
//   <dataDir>/secret/secrets.json → AES-encrypted provider API keys
// All operations are fail-silent.
// ---------------------------------------------------------------------------

const FLUXFLOW_HOME = path.join(os.homedir(), '.fluxflow');
const LEGACY_AES_KEY = crypto.createHash('sha256').update('fluxflow-cli-sanctuary-key').digest();
const VAULT_CACHE_TTL = 5000;

let _tokenCache: string | null | undefined;
let _settingsCache: { data: any; at: number } | null = null;
let _secretsCache: { data: any; at: number } | null = null;

/** Read the machine token from ~/.fluxflow/.token (read-only; never created). */
function readMachineToken(): string | null {
    if (_tokenCache !== undefined) return _tokenCache;
    try {
        const tokenPath = path.join(FLUXFLOW_HOME, '.token');
        if (!fs.existsSync(tokenPath)) {
            _tokenCache = null;
            return null;
        }
        const token = fs.readFileSync(tokenPath, 'utf8').trim();
        _tokenCache = token || null;
        return _tokenCache;
    } catch {
        _tokenCache = null;
        return null;
    }
}

/** Derive the AES-256 key (sha256) from a machine token. */
function deriveMachineKey(token: string): Buffer {
    return crypto.createHash('sha256').update(token).digest();
}

/** Decrypt an `ivHex:cipherHex` aes-256-cbc string → utf8, or null. */
function decryptAesValue(encryptedText: string, key: Buffer): string | null {
    try {
        const parts = encryptedText.split(':');
        if (parts.length !== 2) return null;
        const iv = Buffer.from(parts[0], 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let out = decipher.update(parts[1], 'hex', 'utf8');
        out += decipher.final('utf8');
        return out;
    } catch {
        return null;
    }
}

/** XOR (0x42) decode fallback for very old vault files. */
function decryptXor(raw: Buffer): string | null {
    try {
        const out = Buffer.from(raw);
        for (let i = 0; i < out.length; i++) out[i] ^= 0x42;
        return out.toString('utf8');
    } catch {
        return null;
    }
}

/** Parse a vault blob as JSON: plaintext → machine key → legacy key → XOR. */
function parseVault(raw: Buffer): any | null {
    const text = raw.toString('utf8').trim();
    if (!text) return null;
    if (text.startsWith('{') || text.startsWith('[')) {
        try { return JSON.parse(text); } catch { }
    }
    const keys: Buffer[] = [];
    const token = readMachineToken();
    if (token) keys.push(deriveMachineKey(token));
    keys.push(LEGACY_AES_KEY);
    for (const k of keys) {
        const dec = decryptAesValue(text, k);
        if (dec) {
            try { return JSON.parse(dec); } catch { }
        }
    }
    const xor = decryptXor(raw);
    if (xor && (xor.trim().startsWith('{') || xor.trim().startsWith('['))) {
        try { return JSON.parse(xor); } catch { }
    }
    return null;
}

/** Read ~/.fluxflow/settings.json (plaintext; encrypted legacy supported). */
export function readFluxSettings(forceReload = false): any | null {
    const now = Date.now();
    if (!forceReload && _settingsCache && (now - _settingsCache.at) < VAULT_CACHE_TTL) {
        return _settingsCache.data;
    }
    let data: any = null;
    try {
        const settingsPath = path.join(FLUXFLOW_HOME, 'settings.json');
        if (fs.existsSync(settingsPath)) {
            data = parseVault(fs.readFileSync(settingsPath));
        }
    } catch {
        data = null;
    }
    _settingsCache = { data, at: now };
    return data;
}

/** Write ~/.fluxflow/settings.json (plaintext) with a shallow top-level merge. */
export function writeFluxSettings(patch: any): boolean {
    try {
        const current = readFluxSettings(true);
        if (!current || typeof current !== 'object') return false;
        const merged = { ...current, ...patch };
        const settingsPath = path.join(FLUXFLOW_HOME, 'settings.json');
        fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2), 'utf8');
        _settingsCache = { data: merged, at: Date.now() };
        return true;
    } catch {
        return false;
    }
}

/** Flip auto-completion on/off in settings.json (deep-merges autoCompletion). */
export function setAutoCompletionEnabled(enabled: boolean): boolean {
    try {
        const current = readFluxSettings(true);
        if (!current || typeof current !== 'object') return false;

        const ac = { ...(current.autoCompletion || {}), enabled };
        return writeFluxSettings({ autoCompletion: ac });
    } catch {
        return false;
    }
}

/** Resolve the data directory (external if configured, else ~/.fluxflow). */
export function resolveDataDir(): string {
    try {
        const sys = readFluxSettings()?.systemSettings || {};
        if (sys.useExternalData && sys.externalDataPath) {
            return path.normalize(String(sys.externalDataPath).trim());
        }
    } catch { }
    return FLUXFLOW_HOME;
}

/** Read + decrypt <dataDir>/secret/secrets.json → object, or null. */
export function readFluxSecrets(forceReload = false): any | null {
    const now = Date.now();
    if (!forceReload && _secretsCache && (now - _secretsCache.at) < VAULT_CACHE_TTL) {
        return _secretsCache.data;
    }
    let data: any = null;
    try {
        const secretsPath = path.join(resolveDataDir(), 'secret', 'secrets.json');
        if (fs.existsSync(secretsPath)) {
            data = parseVault(fs.readFileSync(secretsPath));
        }
    } catch {
        data = null;
    }
    _secretsCache = { data, at: now };
    return data;
}

/** Resolve an API key for a provider (mirrors src/utils/secrets.js). */
export function getCompletionApiKey(provider: string): string | null {
    if (!provider) return null;
    const s = readFluxSecrets();
    if (!s) return null;
    const p = provider;
    if (p === 'Google') return s.GOOGLE_API_KEY || s.API_KEY || null;
    if (p === 'DeepSeek') return s.DEEPSEEK_API_KEY || null;
    if (p === 'OpenRouter') return s.OPENROUTER_API_KEY || null;
    if (p === 'NVIDIA') return s.NVIDIA_API_KEY || null;
    if (p === 'Mistral') return s.MISTRAL_API_KEY || null;
    if (p === 'Ollama') return s.OLLAMA_API_KEY || 'LOCAL';
    if (p === 'InferX') return s.INFERX_API_KEY || null;
    if (p === 'SenseNova' || p === 'Sensenova') return s.SENSENOVA_API_KEY || null;
    if (p === 'Poolside' || p === 'poolside') return s.POOLSIDE_API_KEY || null;
    if (p === '9router' || p === '9Router') return s['9ROUTER_API_KEY'] || 'LOCAL';
    if (p === 'ExpLabs' || p === 'ExperimentalLabs' || p === 'explabs') return s.EXPLABS_API_KEY || s.EXPERIENTIALLABS_API_KEY || null;
    if (p === 'TokenHarbor' || p === 'tokenharbor' || p === 'thk') return s.TOKENHARBOR_API_KEY || s.TOKEN_HARBOR_API_KEY || null;
    if (p === 'Infron') return s.INFRON_API_KEY || null;
    if (p === 'APInex' || p === 'apinex' || p === 'apx') return s.APINEX_API_KEY || null;
    if (p === 'c_openai' || p === 'Custom (OpenAI)') return s.CUSTOM_OPENAI_API_KEY || s.C_OPENAI_API_KEY || null;
    // Generic fallback (e.g. AIHubMix → AIHUBMIX_API_KEY).
    return s[`${p.toUpperCase()}_API_KEY`] || null;
}

// ---------------------------------------------------------------------------
// Lightweight usage tracking (extension side)
// Mirrors src/utils/usage.js: writes per-request JSONL into the SAME ledger the
// CLI reads — <dataDir>/secret/timed_usage/YYYY-MM-DD.jsonl — and estimates cost
// from ~/.fluxflow/model_config.json pricing. Fire-and-forget, fail-silent.
// Only the direct-fetch path uses this (CLI-bridge completions are logged by
// the CLI itself, so we skip them to avoid double counting).
// ---------------------------------------------------------------------------

let _pricingCache: { data: any; at: number } | null = null;

/**
 * Read ~/.fluxflow/model_config.json pricing.
 * Cached 3s to avoid a sync disk read + JSON.parse per completion, while still
 * picking up model_config.json edits almost immediately. Fail-silent.
 */
function readModelConfig(): any | null {
    const now = Date.now();
    if (_pricingCache && (now - _pricingCache.at) < 3000) return _pricingCache.data;
    let data: any = null;
    try {
        const p = path.join(FLUXFLOW_HOME, 'model_config.json');
        if (fs.existsSync(p)) data = JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch { data = null; }
    _pricingCache = { data, at: now };
    return data;
}

/** {IN,OUT,CR,CW} $/1M for provider+model, or null. Mirrors getModelPricing. */
function getCompletionPricing(provider: string, modelId: string): { IN: number; OUT: number; CR: number; CW: number } | null {
    if (!provider || !modelId) return null;
    const p = readModelConfig()?.providers?.[provider];
    if (!p?.models) return null;
    const id = modelId.trim().toLowerCase();
    for (const tier of ['Free', 'Paid']) {
        const list = p.models[tier];
        if (!Array.isArray(list)) continue;
        for (const item of list) {
            if (item && typeof item === 'object' && item.cmd && item.cmd.trim().toLowerCase() === id && item.info) {
                return {
                    IN: Number(item.info.IN) || 0,
                    OUT: Number(item.info.OUT) || 0,
                    CR: Number(item.info.CR) || 0,
                    CW: Number(item.info.CW) || 0
                };
            }
        }
    }
    return null;
}

// Cached-token state per provider+model, for cache-write (CW) estimation.
const lastModelCacheState = new Map<string, number>();

/** Estimate request cost. Mirrors calculateTokenCost in src/utils/usage.js. */
function estimateCost(provider: string, model: string, t: { input?: number; cached?: number; output?: number }) {
    const input = Number(t.input) || 0;
    const cached = Number(t.cached) || 0;
    const output = Number(t.output) || 0;
    const pricing = getCompletionPricing(provider, model);
    if (!pricing) return { cost: 0, estimatedCacheWrite: 0, breakdown: null as any };

    const uncachedInput = Math.max(0, input - cached);
    const key = provider + ':' + model;
    const prevCached = lastModelCacheState.get(key) || 0;
    lastModelCacheState.set(key, cached);
    const estimatedCacheWrite = cached > prevCached ? (cached - prevCached) : 0;

    const inputCost = (uncachedInput / 1000000) * pricing.IN;
    const outputCost = (output / 1000000) * pricing.OUT;
    const cacheReadCost = (cached / 1000000) * pricing.CR;
    const cacheWriteCost = (estimatedCacheWrite / 1000000) * pricing.CW;
    const cost = inputCost + outputCost + cacheReadCost + cacheWriteCost;

    return {
        cost: Number(cost.toFixed(6)),
        estimatedCacheWrite,
        breakdown: {
            inputCost: Number(inputCost.toFixed(6)),
            outputCost: Number(outputCost.toFixed(6)),
            cacheReadCost: Number(cacheReadCost.toFixed(6)),
            cacheWriteCost: Number(cacheWriteCost.toFixed(6))
        }
    };
}

/**
 * Append one request's token/cost breakdown to the CLI's per-request JSONL
 * ledger. Format matches recordTimedUsage() in src/utils/usage.js exactly.
 * Fire-and-forget: never throws, never blocks an inline completion.
 */
function recordExtensionUsage(
    provider: string,
    model: string,
    t: { input?: number; cached?: number; output?: number; reasoning?: number; ttft?: number }
): void {
    try {
        if (!provider || !model) return;
        const costCalc = estimateCost(provider, model, t);
        const entry: any = {
            time: new Date().toISOString(),
            provider,
            model,
            input: Number(t.input) || 0,
            cached: Number(t.cached) || 0,
            output: Number(t.output) || 0,
            reasoning: Number(t.reasoning) || 0,
            ttft: Number(t.ttft) || 0,
            cost: costCalc.cost,
            estimatedCacheWrite: costCalc.estimatedCacheWrite
        };
        if (costCalc.breakdown) entry.costBreakdown = costCalc.breakdown;

        const dir = path.join(resolveDataDir(), 'secret', 'timed_usage');
        const ymd = new Date().toISOString().split('T')[0];
        fs.mkdirSync(dir, { recursive: true });
        fs.appendFileSync(path.join(dir, ymd + '.jsonl'), JSON.stringify(entry) + '\n', 'utf8');
    } catch { }
}

/**
 * Send an inline completion request over the CLI bridge and await the reply.
 * Resolves to '' on timeout, cancellation, or when no CLI client is connected.
 */
function requestInlineFromBridge(
    ctx: { prefix: string; suffix: string; fileName: string; language: string; recentChanges?: string; clipboard?: string },
    token: vscode.CancellationToken,
    timeoutMs = 8000
): Promise<string> {
    return new Promise<string>((resolve) => {
        const client = wss?.clients ? wss.clients.values().next().value : undefined;
        if (!client) return resolve('');
        const requestId = crypto.randomUUID();
        const finish = (value: string) => {
            const pending = pendingInlineRequests.get(requestId);
            if (pending) {
                clearTimeout(pending.timer);
                pendingInlineRequests.delete(requestId);
            }
            resolve(value);
        };
        const timer = setTimeout(() => finish(''), timeoutMs);
        pendingInlineRequests.set(requestId, { resolve, timer });
        token.onCancellationRequested(() => finish(''));
        try {
            client.send(JSON.stringify({
                command: 'inlineComplete',
                requestId,
                prefix: ctx.prefix,
                suffix: ctx.suffix,
                fileName: ctx.fileName,
                language: ctx.language,
                recentChanges: ctx.recentChanges || '',
                clipboard: ctx.clipboard || ''
            }));
        } catch {
            finish('');
        }
    });
}

/**
 * Resolve the direct-fetch endpoint + API key for a provider.
 * Some providers aren't in PROVIDER_BASE_URLS and need runtime resolution:
 *  - c_openai → systemSettings.customOpenAIBaseUrl
 *  - 9router  → localhost (env override 9ROUTER_URL/NINEROUTER_URL)
 *  - Ollama   → localhost when key is LOCAL/empty, cloud otherwise
 */
function resolveDirectEndpoint(cfg: any, settings: any): { baseUrl: string; apiKey?: string } {
    const provider = cfg.provider || '';
    const sys = settings?.systemSettings || {};
    let baseUrl = cfg.baseUrl || '';
    let apiKey = getCompletionApiKey(provider) || undefined;

    if (provider === 'c_openai') {
        baseUrl = sys.customOpenAIBaseUrl || '';
        // Custom OpenAI endpoints may be local/authless (e.g. LM Studio,
        // llama.cpp, vLLM): use the key when present, otherwise fire without
        // an Authorization header rather than bailing out.
        if (apiKey === 'LOCAL' || apiKey === '') apiKey = undefined;
    } else if (provider === '9router' || provider === '9Router') {
        baseUrl = process.env['9ROUTER_URL'] || process.env.NINEROUTER_URL || 'http://127.0.0.1:20128/v1';
        if (!apiKey || apiKey === 'LOCAL') apiKey = process.env.NINEROUTER_KEY || 'dummy-key';
    } else if (provider === 'Ollama') {
        const isLocal = !apiKey || apiKey === 'LOCAL';
        baseUrl = isLocal
            ? (process.env.OLLAMA_HOST || 'http://127.0.0.1:11434/v1')
            : (process.env.OLLAMA_HOST || 'https://ollama.com/v1');
        if (isLocal) apiKey = 'LOCAL';
    }

    return { baseUrl, apiKey };
}

/** Normalize a path for cwd comparison (lowercase, forward slashes, no trailing slash). */
function normalizeCwd(p?: string): string {
    if (!p) return '';
    try {
        return path.resolve(p).replace(/[\\/]+$/, '').replace(/\\/g, '/').toLowerCase();
    } catch {
        return String(p).replace(/\\/g, '/').toLowerCase();
    }
}

/**
 * True if the CLI working directory matches a workspace folder root.
 * Returns true when we can't compare (no cwd sent, or no folder open).
 */
function cwdMatchesWorkspace(cwd?: string): boolean {
    if (!cwd) return true;
    const target = normalizeCwd(cwd);
    if (!target) return true;
    const folders = vscode.workspace.workspaceFolders || [];
    if (folders.length === 0) return true;
    return folders.some(f => normalizeCwd(f.uri.fsPath) === target);
}

export function activate(context: vscode.ExtensionContext) {
    loadCachedAutocompleteSystemPrompt();
    const diffProvider = new FluxFlowDiffProvider();
    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider('fluxflow-diff', diffProvider));

    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'fluxflow.statusMenu';
    context.subscriptions.push(statusBarItem);
    updateStatusBar();
    statusBarItem.show();

    // Single chip: the icon encodes BOTH connection + auto-completion state.
    // Click opens a small menu (toggle AC, and start the companion if offline).
    context.subscriptions.push(vscode.commands.registerCommand('fluxflow.statusMenu', async () => {
        const acEnabled = !!readFluxSettings(true)?.autoCompletion?.enabled;
        const items: any[] = [
            { label: `$(sparkle) Auto-Completion: ${acEnabled ? 'ON' : 'OFF'}`, description: 'click to toggle', action: 'toggleAc' }
        ];
        if (!isCliConnected) {
            items.push({ label: '$(play) Start FluxFlow', description: 'Open FluxFlow in Terminal', action: 'start' });
        }
        const pick = await vscode.window.showQuickPick(items, { placeHolder: 'FluxFlow' });
        if (!pick) return;
        if (pick.action === 'toggleAc') {
            setAutoCompletionEnabled(!acEnabled);
            updateStatusBar();
        } else if (pick.action === 'start') {
            vscode.commands.executeCommand('fluxflow-editorx.run');
        }
    }));

    // Register command to launch CLI
    context.subscriptions.push(vscode.commands.registerCommand('fluxflow-editorx.run', () => {
        const terminal = vscode.window.createTerminal('FluxFlow');
        fluxFlowTerminal = terminal;
        terminal.show();
        terminal.sendText('fluxflow');
    }));

    // Register command to focus the FluxFlow terminal
    context.subscriptions.push(vscode.commands.registerCommand('fluxflow-editorex.chat', async () => {
        if (fluxFlowTerminal) {
            fluxFlowTerminal.show(false);
        } else {
            // Fallback: try finding by name if PID link wasn't established
            const terminal = vscode.window.terminals.find(t => t.name === 'FluxFlow');
            if (terminal) {
                fluxFlowTerminal = terminal;
                terminal.show(false);
            } else {
                const newTerminal = vscode.window.createTerminal('FluxFlow');
                fluxFlowTerminal = newTerminal;
                newTerminal.show(false);
                await newTerminal.processId;
                newTerminal.sendText('fluxflow');
            }
        }
    }));

    // Register command to fix errors
    context.subscriptions.push(vscode.commands.registerCommand('fluxflow-editorex.fixErrors', async () => {
        const editor = vscode.window.activeTextEditor;
        const allDiags = vscode.languages.getDiagnostics();
        const brokenFiles = allDiags.filter(([uri, diags]) => diags.some(d => d.severity === vscode.DiagnosticSeverity.Error));

        let command = "";
        if (brokenFiles.length === 1) {
            const fileName = path.basename(brokenFiles[0][0].fsPath);
            command = `Fix the errors in ${fileName}`;
        } else if (brokenFiles.length > 1) {
            command = `Fix the errors in the workspace (${brokenFiles.length} files broken)`;
        } else if (editor) {
            const fileName = path.basename(editor.document.fileName);
            command = `Fix the errors in ${fileName}`;
        } else {
            command = "Fix the errors in the workspace";
        }

        if (!fluxFlowTerminal) {
            const terminal = vscode.window.terminals.find(t => t.name === 'FluxFlow');
            if (terminal) {
                fluxFlowTerminal = terminal;
            } else {
                fluxFlowTerminal = vscode.window.createTerminal('FluxFlow');
                fluxFlowTerminal.show(false);
                await fluxFlowTerminal.processId;
                fluxFlowTerminal.sendText('fluxflow');
                await new Promise(r => setTimeout(r, 2500));
            }
        }

        fluxFlowTerminal.show(false);
        await fluxFlowTerminal.processId;
        setTimeout(() => {
            fluxFlowTerminal?.sendText(command, true);
        }, 500);
    }));

    // Register command to fix warnings
    context.subscriptions.push(vscode.commands.registerCommand('fluxflow-editorex.fixWarnings', async () => {
        const editor = vscode.window.activeTextEditor;
        const allDiags = vscode.languages.getDiagnostics();
        const warningFiles = allDiags.filter(([uri, diags]) => diags.some(d => d.severity === vscode.DiagnosticSeverity.Warning));

        let command = "";
        if (warningFiles.length === 1) {
            const fileName = path.basename(warningFiles[0][0].fsPath);
            command = `Fix the lint warnings in ${fileName}`;
        } else if (warningFiles.length > 1) {
            command = `Fix the lint warnings in the workspace (${warningFiles.length} files with warnings)`;
        } else if (editor) {
            const fileName = path.basename(editor.document.fileName);
            command = `Fix the lint warnings in ${fileName}`;
        } else {
            command = "Fix the lint warnings in the workspace";
        }

        if (!fluxFlowTerminal) {
            const terminal = vscode.window.terminals.find(t => t.name === 'FluxFlow');
            if (terminal) {
                fluxFlowTerminal = terminal;
            } else {
                fluxFlowTerminal = vscode.window.createTerminal('FluxFlow');
                fluxFlowTerminal.show(false);
                await fluxFlowTerminal.processId;
                fluxFlowTerminal.sendText('fluxflow');
                await new Promise(r => setTimeout(r, 2500));
            }
        }

        fluxFlowTerminal.show(false);
        await fluxFlowTerminal.processId;
        setTimeout(() => {
            fluxFlowTerminal?.sendText(command, true);
        }, 500);
    }));

    // Register commands for Accept/Deny from Title Bar
    context.subscriptions.push(vscode.commands.registerCommand('fluxflow-editorex.acceptDiff', () => {
        wss?.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ command: 'securityResponse', result: 'allow' }));
            }
        });
    }));

    context.subscriptions.push(vscode.commands.registerCommand('fluxflow-editorex.denyDiff', () => {
        wss?.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ command: 'securityResponse', result: 'deny' }));
            }
        });
    }));

    // Headless session context toggle state (persisted across sessions)
    let useHeadlessContext = context.globalState.get<boolean>('fluxflow.useHeadlessContext', false);
    vscode.commands.executeCommand('setContext', 'fluxflow.isHeadlessContextEnabled', useHeadlessContext);

    // Register Enable command
    context.subscriptions.push(vscode.commands.registerCommand('fluxflow-editorex.enableHeadlessContext', async () => {
        useHeadlessContext = true;
        await context.globalState.update('fluxflow.useHeadlessContext', true);
        vscode.commands.executeCommand('setContext', 'fluxflow.isHeadlessContextEnabled', true);
        vscode.window.showInformationMessage('FluxFlow: Headless Session Context is now ENABLED (inherits active terminal sessions).');
    }));

    // Register Disable command
    context.subscriptions.push(vscode.commands.registerCommand('fluxflow-editorex.disableHeadlessContext', async () => {
        useHeadlessContext = false;
        await context.globalState.update('fluxflow.useHeadlessContext', false);
        vscode.commands.executeCommand('setContext', 'fluxflow.isHeadlessContextEnabled', false);
        vscode.window.showInformationMessage('FluxFlow: Headless Session Context is now DISABLED (isolated clean commits).');
    }));

    // Helper function to generate commit messages with or without session flag
    const generateCommit = async (scmContext?: any) => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showWarningMessage('No workspace folder is open.');
            return;
        }

        let repoCwd = workspaceFolders[0].uri.fsPath;
        if (scmContext?.rootUri?.fsPath) {
            repoCwd = scmContext.rootUri.fsPath;
        }

        const notificationTitle = useHeadlessContext
            ? "Generating commit message (Headless Context)"
            : "Generating commit message";

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Window,
            title: notificationTitle,
            cancellable: false
        }, async () => {
            return new Promise<void>((resolve) => {
                const finalCmd = useHeadlessContext
                    ? 'fluxflow --commit_8f4a2b9c'
                    : 'fluxflow -n --commit_8f4a2b9c';

                const execOptions: any = {
                    cwd: repoCwd,
                    env: { ...process.env },
                    maxBuffer: 10 * 1024 * 1024
                };
                if (process.platform === 'win32') {
                    execOptions.shell = 'cmd.exe';
                }

                exec(finalCmd, execOptions, (error, stdoutRaw, stderrRaw) => {
                    const stdout = String(stdoutRaw || '');
                    const stderr = String(stderrRaw || '');

                    try {
                        if (error) {
                            const errMsg = (stderr || error.message || '').toLowerCase();
                            if (
                                errMsg.includes('not recognized') ||
                                errMsg.includes('command not found') ||
                                errMsg.includes('enoent') ||
                                error.code === 127 ||
                                (error as any).code === 'ENOENT'
                            ) {
                                vscode.window.showErrorMessage(
                                    'FluxFlow CLI is not installed globally or is outdated. Please install or update to v4.23.0 or later to use this feature (`npm i -g fluxflow-cli@latest`).'
                                );
                            } else {
                                vscode.window.showErrorMessage(`FluxFlow Error: ${stderr || error.message}`);
                            }
                            return;
                        }

                        const commitMsg = stdout.trim();
                        if (!commitMsg) {
                            vscode.window.showInformationMessage('FluxFlow: No staged changes detected to summarize.');
                            return;
                        }

                        // 1. Check scmContext directly (fastest & most accurate for the active SCM view)
                        if (scmContext?.inputBox) {
                            scmContext.inputBox.value = commitMsg;
                        }

                        // 2. Look for VS Code built-in Git extension API to populate all matching repositories
                        try {
                            const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
                            const git = gitExtension?.getAPI?.(1);
                            if (git?.repositories && git.repositories.length > 0) {
                                const repo = git.repositories.find((r: any) => r.rootUri?.fsPath?.toLowerCase() === repoCwd.toLowerCase()) || git.repositories[0];
                                if (repo?.inputBox) {
                                    repo.inputBox.value = commitMsg;
                                }
                            }
                        } catch (e: any) { }
                    } finally {
                        resolve();
                    }
                });
            });
        });
    };

    // Register command for commit generation button
    context.subscriptions.push(vscode.commands.registerCommand('fluxflow-editorex.generateCommitMessage', async (scmContext?: any) => {
        await generateCommit(scmContext);
    }));

    // Cleanup reference if terminal is closed manually
    context.subscriptions.push(vscode.window.onDidCloseTerminal((terminal) => {
        if (terminal === fluxFlowTerminal) {
            fluxFlowTerminal = undefined;
        }
    }));

    // Background Diagnostic Scanner
    const updateErrorContext = () => {
        const allDiags = vscode.languages.getDiagnostics();
        let hasErrors = false;
        let hasWarnings = false;
        let activeFileHasWarnings = false;

        const activeEditor = vscode.window.activeTextEditor;

        for (const [uri, diags] of allDiags) {
            const fileHasErrors = diags.some(d => d.severity === vscode.DiagnosticSeverity.Error);
            const fileHasWarnings = diags.some(d => d.severity === vscode.DiagnosticSeverity.Warning);

            if (fileHasErrors) hasErrors = true;
            if (fileHasWarnings) hasWarnings = true;

            if (activeEditor && uri.fsPath === activeEditor.document.uri.fsPath) {
                if (fileHasWarnings) activeFileHasWarnings = true;
            }
        }

        vscode.commands.executeCommand('setContext', 'fluxflow.hasErrors', hasErrors);
        vscode.commands.executeCommand('setContext', 'fluxflow.hasWarnings', hasWarnings);
        vscode.commands.executeCommand('setContext', 'fluxflow.activeFileHasWarnings', activeFileHasWarnings);

        // Update Diff Visibility Context
        const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
        const isDiff = activeTab?.input instanceof vscode.TabInputTextDiff &&
            activeTab.input.original.scheme === 'fluxflow-diff';
        vscode.commands.executeCommand('setContext', 'fluxflow.isDiffVisible', isDiff);
    };

    context.subscriptions.push(vscode.languages.onDidChangeDiagnostics(updateErrorContext));
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
        updateErrorContext();
        // Clear cache first when file changes/closes
        lastCursorLine = 0;
        if (editor) {
            lastCursorLine = editor.selection.active.line + 1;
        }
    }));
    context.subscriptions.push(vscode.window.tabGroups.onDidChangeTabs(() => updateErrorContext()));
    context.subscriptions.push(vscode.window.tabGroups.onDidChangeTabGroups(() => updateErrorContext()));
    updateErrorContext();

    // Code Action Provider (The Lightbulb)
    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider('*', {
            provideCodeActions(document, range, context) {
                const diagnostics = context.diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error);
                if (diagnostics.length === 0) return [];

                const action = new vscode.CodeAction('Fix with FluxFlow', vscode.CodeActionKind.QuickFix);
                action.command = {
                    command: 'fluxflow-editorex.fixErrors',
                    title: 'Fix with FluxFlow'
                };
                action.isPreferred = true;
                return [action];
            }
        })
    );

    // Register command so clicking the status bar doesn't errort
    context.subscriptions.push(vscode.commands.registerCommand('fluxflow-editorex.startCompanion', () => {
        if (isCliConnected) {
            vscode.window.showInformationMessage('FluxFlow Companion is connected and active.');
        } else {
            vscode.window.showWarningMessage('Start FluxFlow CLI in your terminal to enable IDE features.');
        }
    }));

    const port = 56832;
    wss = new WebSocketServer({ port });

    wss.on('connection', (ws: WebSocket) => {
        isCliConnected = true;
        updateStatusBar();

        ws.on('message', async (data: string) => {
            try {
                const message = JSON.parse(data.toString());

                // Refuse the connection if the CLI's cwd != workspace root.
                if (message.cwd !== undefined && !cwdMatchesWorkspace(message.cwd)) {
                    vscode.window.showWarningMessage(
                        `FluxFlow: CLI working directory (${message.cwd}) does not match the open workspace. Connection refused.`
                    );
                    isCliConnected = false;
                    updateStatusBar();
                    // Emit a special handshake so the CLI can show a tailored message
                    try {
                        ws.send(JSON.stringify({
                            command: 'connectionRejected',
                            reason: 'cwd_mismatch',
                            cliCwd: message.cwd,
                            workspaceRoots: (vscode.workspace.workspaceFolders || []).map(f => f.uri.fsPath)
                        }));
                    } catch { }
                    try { ws.close(); } catch { }
                    return;
                }

                // When receiving PID, find and link the terminal
                if (message.pid) {
                    let found = false;
                    for (const t of vscode.window.terminals) {
                        const tpid = await t.processId;
                        // Match if shell PID is either the CLI PID or the CLI Parent PID
                        if (tpid === message.pid || tpid === message.ppid) {
                            fluxFlowTerminal = t;
                            found = true;
                            break;
                        }
                    }

                    // If still not found and there's an active terminal,
                    // assume it's the one that just connected (high probability)
                    if (!found && vscode.window.activeTerminal) {
                        fluxFlowTerminal = vscode.window.activeTerminal;
                    }
                }

                if (message.command === 'requestContext') {
                    const ctx = await getIDEContext();
                    ws.send(JSON.stringify({ command: 'contextResponse', data: ctx }));
                    accumulatedEdits.clear();
                    manualEditBaseContents.clear();
                } else if (message.command === 'status') {
                    updateStatusBar(message.status);
                } else if (message.command === 'version') {
                    const majorVersion = parseInt(message.version?.split('.')[0] || '0');
                    if (majorVersion < 2) {
                        vscode.window.showErrorMessage(`FluxFlow Companion Error: CLI version ${message.version} is not supported. Please update FluxFlow CLI to 2.0.0 or later.`);
                        try {
                            ws.send(JSON.stringify({
                                command: 'connectionRejected',
                                reason: 'version_mismatch',
                                cliVersion: message.version
                            }));
                        } catch { }
                        ws?.close();
                        return;
                    }
                } else if (message.command === 'inlineCompleteResponse') {
                    const pending = pendingInlineRequests.get(message.requestId);
                    if (pending) {
                        clearTimeout(pending.timer);
                        pendingInlineRequests.delete(message.requestId);
                        pending.resolve(typeof message.completion === 'string' ? message.completion : '');
                    }
                } else {
                    await handleMessage(message, ws);
                }
            } catch (err) {
                console.error('Error:', err);
            }
        });
        ws.on('close', () => {
            isCliConnected = (wss?.clients.size || 0) > 0;
            if (!isCliConnected) {
                fluxFlowTerminal = undefined;
                // No CLI client left → no one will answer in-flight requests.
                drainPendingInlineRequests();
            }
            updateStatusBar();
        });
    });

    setInterval(() => {
        const currentlyConnected = (wss?.clients.size || 0) > 0;
        if (currentlyConnected !== isCliConnected) {
            isCliConnected = currentlyConnected;
            updateStatusBar();
        }
    }, 5000);

    const decorationAdded = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(0, 255, 0, 0.15)',
        isWholeLine: true,
    });

    const cleanup = () => {
        if (Date.now() - lastDiffTimestamp < 1500) {
            return;
        }
        while (activeDecs.length > 0) {
            const d = activeDecs.pop();
            if (d) d.dispose();
        }
        vscode.window.visibleTextEditors.forEach(editor => {
            editor.setDecorations(decorationAdded, []);
        });
    };

    context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(e => {
        if (e.selections.length > 0) {
            lastCursorLine = e.selections[0].active.line + 1;
        }
    }));
    context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(cleanup));

    // Initialize lastKnownStates for currently open documents
    vscode.workspace.textDocuments.forEach(doc => {
        if (!doc.isUntitled && !doc.fileName.includes('.git')) {
            lastKnownStates.set(doc.fileName, doc.getText());
        }
    });

    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(doc => {
        if (!doc.isUntitled && !doc.fileName.includes('.git')) {
            lastKnownStates.set(doc.fileName, doc.getText());
        }
    }));

    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(e => {
        cleanup();

        const doc = e.document;
        if (doc.isUntitled || doc.fileName.includes('.git')) {
            return;
        }
        const docPath = doc.fileName;
        const currentContent = doc.getText();
        const lastContent = lastKnownStates.get(docPath);
        if (lastContent !== undefined && lastContent !== currentContent) {
            const currentLines = currentContent.split(/\r?\n/);
            const lastLines = lastContent.split(/\r?\n/);

            // Capture baseline content if not already present
            if (!manualEditBaseContents.has(docPath)) {
                manualEditBaseContents.set(docPath, lastLines);
            }
            const baseLines = manualEditBaseContents.get(docPath)!;

            let fileMap = accumulatedEdits.get(docPath);
            if (!fileMap) {
                fileMap = new Map<number, string>();
            }

            currentLines.forEach((line, idx) => {
                if (line !== lastLines[idx]) {
                    const originalLine = baseLines[idx] !== undefined ? baseLines[idx] : "";
                    if (line.trim() === originalLine.trim()) {
                        fileMap!.delete(idx + 1);
                    } else {
                        // Bubble to most-recent (Map preserves insertion order).
                        fileMap!.delete(idx + 1);
                        fileMap!.set(idx + 1, line.trim());
                    }
                }
            });

            // Move the file map to the end to maintain insertion order of most recent edits
            accumulatedEdits.delete(docPath);
            if (fileMap.size > 0) {
                accumulatedEdits.set(docPath, fileMap);
            } else {
                manualEditBaseContents.delete(docPath);
            }
        }
        lastKnownStates.set(docPath, currentContent);
    }));

    // Terminal Link Provider (Clickable File Paths)
    context.subscriptions.push(vscode.window.registerTerminalLinkProvider({
        provideTerminalLinks: (context: vscode.TerminalLinkContext, token: vscode.CancellationToken) => {
            const links: (vscode.TerminalLink & { path: string, line?: number, startLine?: number, endLine?: number })[] = [];

            // Match paths like src/app.js:42, a range src/app.js:42-58, src/app.js:42:58,
            // or src/app.js:42..58 (VSCode-style), or a bare path src/app.js.
            const regex = /((?:[a-zA-Z]:[\\/]|[\\/]|[a-zA-Z0-9_.\-]+[\\/])[^ \n\r\t:"']+\.[a-zA-Z0-9]+)(?::(\d+)(?:[-:]|\.\.)(\d+))?/g;

            let match;
            while ((match = regex.exec(context.line)) !== null) {
                const fullPath = match[1];
                const startNum = match[2] ? parseInt(match[2]) : undefined;
                const endNum = match[3] ? parseInt(match[3]) : undefined;

                const hasRange = startNum !== undefined && endNum !== undefined && endNum !== startNum;
                const label = hasRange
                    ? ` lines ${startNum}-${endNum}`
                    : (startNum ? ` at line ${startNum}` : '');

                links.push({
                    startIndex: match.index,
                    length: match[0].length,
                    tooltip: `Open ${path.basename(fullPath)}${label}`,
                    path: fullPath,
                    line: startNum,
                    startLine: startNum,
                    endLine: endNum ?? startNum
                });
            }
            return links;
        },
        handleTerminalLink: async (link: any) => {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            let absolutePath = link.path;

            if (!path.isAbsolute(absolutePath) && workspaceFolders) {
                absolutePath = path.resolve(workspaceFolders[0].uri.fsPath, absolutePath);
            }

            if (fs.existsSync(absolutePath)) {
                const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(absolutePath));
                // preserveFocus: true → never steal keyboard focus from the terminal.
                // The file still opens/reveals in the editor area, but the user keeps typing in the CLI.
                const editor = await vscode.window.showTextDocument(doc, { preview: false, preserveFocus: true });

                // Support single line (link.line) OR a multi-line range
                // (link.startLine / link.endLine, or link.endLine === startLine for a single).
                const startLine = link.startLine ?? link.line;
                const endLine = link.endLine ?? link.line;

                if (startLine) {
                    const start = new vscode.Position(Math.max(0, startLine - 1), 0);
                    // clamp end to the last real line so an over-long range never throws
                    const lastLineIdx = Math.max(0, doc.lineCount - 1);
                    const endIdx = Math.min(Math.max(0, (endLine || startLine) - 1), lastLineIdx);
                    const end = new vscode.Position(endIdx, doc.lineAt(endIdx).text.length);
                    const range = new vscode.Range(start, end);
                    // select the whole range, and reveal it centred in the viewport
                    editor.selection = new vscode.Selection(range.start, range.end);
                    editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
                }

                // Belt & braces: some VS Code versions still shift focus on reveal — actively restore the terminal.
                vscode.commands.executeCommand('workbench.action.terminal.focus').then(undefined, () => { /* no-op if no terminal */ });
            } else {
                vscode.window.showErrorMessage(`Could not find file: ${link.path}`);
            }
        }
    }));

    const inlineCompletionProvider = vscode.languages.registerInlineCompletionItemProvider(
        { pattern: '**' },
        {
            async provideInlineCompletionItems(document, position, _context, token) {
                try {
                    const settings = readFluxSettings() || {};
                    const cfg = settings?.autoCompletion || {};
                    const sys = settings?.systemSettings || {};
                    if (!cfg.enabled) return;
                    if (document.uri.scheme !== 'file' && document.uri.scheme !== 'untitled') return;
                    debugLog('[provider] enabled=' + cfg.enabled + ' model=' + cfg.model + ' provider=' + cfg.provider + ' cli=' + isCliConnected);

                    // Fast path: user is typing through the existing suggestion.
                    const cached = getCachedRemainder(document, position);
                    if (cached !== null) {
                        if (!cached) return;
                        return [{ insertText: cached }];
                    }

                    // Debounce: wait for a typing pause before hitting the model.
                    await debounceWait(969, token);
                    if (token.isCancellationRequested) return;

                    const built = buildCompletionContext(document, position, 25);
                    const clipboardContextEnabled = sys.clipboardContext ?? cfg.clipboardContext;
                    if (clipboardContextEnabled) {
                        try {
                            const clip = (await vscode.env.clipboard.readText() || '').slice(0, 250);
                            if (clip.trim()) built.clipboard = clip;
                        } catch { }
                    }
                    let completion = '';

                    if (isCliConnected) {
                        // CLI connected: route through the bridge (CLI provider layer).
                        completion = await requestInlineFromBridge(built, token);
                    } else {
                        // Not connected: direct in-extension OpenAI-compatible fetch.
                        if (!cfg.model || cfg.model === 'Default') return;
                        const { baseUrl, apiKey } = resolveDirectEndpoint(cfg, settings);
                        if (!baseUrl) return;
                        const controller = new AbortController();
                        token.onCancellationRequested(() => controller.abort());
                        const messages = buildCompletionMessages(built);
                        const directStart = Date.now();
                        let ttft = 0;
                        let usage: any = null;
                        const raw = await openaiChatCompletion({
                            baseUrl,
                            model: cfg.model,
                            messages,
                            apiKey,
                            signal: controller.signal,
                            onToken: () => { if (!ttft) ttft = Date.now() - directStart; },
                            onUsage: (u) => { usage = u; }
                        });
                        completion = extractCompletion(raw);
                        // Best-effort usage tracking (mirrors CLI src/utils/usage.js).
                        try {
                            const promptChars = messages.reduce((n, m) => n + (m.content?.length || 0), 0);
                            const input = usage?.prompt_tokens ?? Math.ceil(promptChars / 4);
                            const output = usage?.completion_tokens ?? Math.ceil(completion.length / 4);
                            const cached = usage?.prompt_tokens_details?.cached_tokens
                                ?? usage?.prompt_cache_hit_tokens
                                ?? 0;
                            const reasoning = usage?.reasoning_tokens
                                ?? usage?.completion_tokens_details?.reasoning_tokens
                                ?? 0;
                            recordExtensionUsage(cfg.provider, cfg.model, { input, cached, output, reasoning, ttft });
                        } catch { }
                    }

                    if (!completion || token.isCancellationRequested) return;

                    // Remember it so typed-through characters don't refetch.
                    completionCache = {
                        uri: document.uri.toString(),
                        anchor: position,
                        anchorText: document.lineAt(position.line).text.slice(0, position.character),
                        completion
                    };

                    return [{ insertText: completion }];
                } catch {
                    return;
                }
            }
        }
    );
    context.subscriptions.push(inlineCompletionProvider);

    // Invalidate the completion cache when the active file changes.
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(() => {
        completionCache = null;
    }));

    context.subscriptions.push({ dispose: () => wss?.close() });
}

function updateStatusBar(status?: string) {
    let acEnabled = false;
    try {
        acEnabled = !!readFluxSettings()?.autoCompletion?.enabled;
    } catch { }

    // Icon matrix:
    //   AC OFF + disconnected → $(circle-slash)
    //   AC ON  + disconnected → $(sparkle)
    //   AC OFF + connected    → $(zap)
    //   AC ON  + connected    → $(sparkle)
    const icon = acEnabled ? '$(sparkle)' : (isCliConnected ? '$(zap)' : '$(circle-slash)');

    statusBarItem.text = `${icon} FluxFlow: ${isCliConnected ? (status || 'Connected') : 'Not Running'}`;
    statusBarItem.tooltip = `FluxFlow ${isCliConnected ? 'Connected' : 'Not Running'} · Auto-Completion ${acEnabled ? 'ON' : 'OFF'} — click for options`;
    statusBarItem.backgroundColor = (acEnabled || isCliConnected)
        ? new vscode.ThemeColor('statusBarItem.prominentBackground')
        : undefined;
}

async function getIDEContext() {
    const activeEditor = vscode.window.activeTextEditor;
    const openedEditors: string[] = [];
    try {
        for (const group of vscode.window.tabGroups.all) {
            for (const tab of group.tabs) {
                if (tab.input instanceof vscode.TabInputText) {
                    openedEditors.push(tab.input.uri.fsPath);
                }
            }
        }
    } catch (e) {
        vscode.workspace.textDocuments.forEach(doc => {
            if (!doc.isUntitled && !doc.fileName.includes('.git')) {
                openedEditors.push(doc.fileName);
            }
        });
    }

    let context: any = {
        cursor_line: lastCursorLine,
        selected: 0,
        manual_edits: "",
        full_content: "",
        file_focused: activeEditor ? activeEditor.document.fileName : "none",
        opened_editors: [...new Set(openedEditors)],
        diagnostics: "",
        warnings: ""
    };

    if (activeEditor) {
        const selection = activeEditor.selection;
        lastCursorLine = selection.active.line + 1;
        context.cursor_line = lastCursorLine;
        if (!selection.isEmpty) {
            context.selected = activeEditor.document.getText(selection);
        }

        const filePath = activeEditor.document.fileName;

        // Aggregated Workspace Diagnostics (Errors & Warnings)
        const allDiags = vscode.languages.getDiagnostics();
        const workspaceErrors: string[] = [];
        const workspaceWarnings: string[] = [];
        let errorFileCount = 0;
        let warningFileCount = 0;

        for (const [uri, diags] of allDiags) {
            const relPath = vscode.workspace.asRelativePath(uri);

            // Collect Errors
            if (errorFileCount < 10) {
                const errors = diags
                    .filter(d => d.severity === vscode.DiagnosticSeverity.Error)
                    .map(d => `  Line ${d.range.start.line + 1}: ${d.message}`);

                if (errors.length > 0) {
                    workspaceErrors.push(`File: ${relPath}\n${errors.join('\n')}`);
                    errorFileCount++;
                }
            }

            // Collect Warnings
            if (warningFileCount < 10) {
                const warnings = diags
                    .filter(d => d.severity === vscode.DiagnosticSeverity.Warning)
                    .map(d => `  Line ${d.range.start.line + 1}: ${d.message}`);

                if (warnings.length > 0) {
                    workspaceWarnings.push(`File: ${relPath}\n${warnings.join('\n')}`);
                    warningFileCount++;
                }
            }
        }

        if (workspaceErrors.length > 0) {
            context.diagnostics = `[WORKSPACE ERRORS]:\n${workspaceErrors.join('\n\n')}`;
        }
        if (workspaceWarnings.length > 0) {
            context.warnings = `[WORKSPACE WARNINGS/LINT]:\n${workspaceWarnings.join('\n\n')}`;
        }

        context.full_content = activeEditor.document.getText();

        if (accumulatedEdits.size > 0) {
            const manualEditsParts: string[] = [];
            accumulatedEdits.forEach((fileMap, docPath) => {
                if (fileMap.size > 0) {
                    const fileEdits: string[] = [];
                    // Sort lines by line number
                    const sortedLines = Array.from(fileMap.keys()).sort((a, b) => a - b);
                    sortedLines.forEach(lineNum => {
                        fileEdits.push(`    Line ${lineNum}: ${fileMap.get(lineNum)}`);
                    });
                    const relPath = vscode.workspace.asRelativePath(docPath);
                    manualEditsParts.push(`${relPath}:\n${fileEdits.join('\n')}`);
                }
            });
            context.manual_edits = manualEditsParts.join('\n');
        }
    }

    return context;
}

async function handleMessage(message: any, ws?: WebSocket) {
    const { command, version, filePath, addedLines, originalContent, modifiedContent, result } = message;

    if (command === 'version') {
        const majorVersion = parseInt(version?.split('.')[0] || '0');
        if (majorVersion < 2) {
            vscode.window.showErrorMessage(`FluxFlow Companion Error: CLI version ${version} is not supported. Please update FluxFlow CLI to 2.0.0 or later.`);
            ws?.close();
            return;
        }
        return;
    }

    if (!filePath) return;

    // Use absolute path
    const uri = vscode.Uri.file(filePath);

    try {
        if (command === 'open') {
            const doc = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(doc, { preview: false, preserveFocus: true });
            lastKnownStates.set(doc.fileName, doc.getText());
        }
        else if (command === 'diff') {
            lastDiffTimestamp = Date.now();
            const doc = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(doc, { preview: false, preserveFocus: true });
        }
        else if (command === 'showDiff') {
            // Handle new file creation placeholder
            if (!fs.existsSync(uri.fsPath)) {
                const parentDir = path.dirname(uri.fsPath);
                if (!fs.existsSync(parentDir)) {
                    fs.mkdirSync(parentDir, { recursive: true });
                }
                fs.writeFileSync(uri.fsPath, '');
                newFilesCreatedByBridge.add(uri.fsPath.toLowerCase());
            }

            const doc = await vscode.workspace.openTextDocument(uri);
            // Store original state for robust denial/revert
            originalStates.set(uri.fsPath.toLowerCase(), originalContent !== undefined ? originalContent : doc.getText());

            // Open doc with preserveFocus: true
            const editor = await vscode.window.showTextDocument(doc, { preview: false, preserveFocus: true });

            // Setup virtual document for the left side (Original)
            const virtualUri = vscode.Uri.parse(`fluxflow-diff://original/${path.basename(filePath)}?${Date.now()}`);
            virtualDocs.set(virtualUri.toString(), originalContent !== undefined ? originalContent : doc.getText());

            // Apply modified content to the REAL document buffer (unsaved)
            if (modifiedContent !== undefined) {
                await editor.edit(editBuilder => {
                    const fullRange = new vscode.Range(
                        doc.positionAt(0),
                        doc.positionAt(doc.getText().length)
                    );
                    editBuilder.replace(fullRange, modifiedContent);
                });
            }

            // Open diff with preserveFocus: true
            await vscode.commands.executeCommand('vscode.diff',
                virtualUri,
                uri,
                `${path.basename(filePath)} (Original) ↔ Modified (AI)`,
                { preserveFocus: true }
            );

            // Ensure inline diff mode without modifying user's persistent settings
            const isSideBySide = vscode.workspace.getConfiguration('diffEditor').get<boolean>('renderSideBySide', true);
            if (isSideBySide) {
                await vscode.commands.executeCommand('toggle.diff.renderSideBySide');
            }
        }
        else if (command === 'save') {
            const doc = await vscode.workspace.openTextDocument(uri);
            await doc.save();
        }
        else if (command === 'closeDiff') {
            const targetPath = uri.fsPath.toLowerCase();
            const tabsToClose: vscode.Tab[] = [];

            // 1. Identify all matching tabs first
            for (const group of vscode.window.tabGroups.all) {
                for (const tab of group.tabs) {
                    if (tab.input instanceof vscode.TabInputTextDiff &&
                        tab.input.original.scheme === 'fluxflow-diff') {
                        const tabPath = (tab.input.modified as vscode.Uri).fsPath.toLowerCase();
                        if (tabPath === targetPath) {
                            tabsToClose.push(tab);
                        }
                    }
                }
            }

            // 2. Perform restoration/save logic in background
            if (result === 'deny') {
                try {
                    const original = originalStates.get(targetPath);
                    if (original !== undefined) {
                        const doc = await vscode.workspace.openTextDocument(uri);
                        const wsEdit = new vscode.WorkspaceEdit();
                        const fullRange = new vscode.Range(
                            doc.positionAt(0),
                            doc.positionAt(doc.getText().length)
                        );
                        wsEdit.replace(uri, fullRange, original);
                        await vscode.workspace.applyEdit(wsEdit);
                        await doc.save();
                    } else {
                        // Fallback revert
                        await vscode.commands.executeCommand('workbench.action.files.revert', uri);
                    }

                    // If it was a new file created by us, delete it from disk
                    if (newFilesCreatedByBridge.has(targetPath)) {
                        if (fs.existsSync(targetPath)) {
                            fs.unlinkSync(targetPath);
                        }
                    }
                } catch (e) { }
            } else if (result === 'allow') {
                try {
                    const doc = await vscode.workspace.openTextDocument(uri);
                    await doc.save();
                } catch (e) { }
            }

            // 3. Cleanup state
            originalStates.delete(targetPath);
            newFilesCreatedByBridge.delete(targetPath);

            // 4. Close the tabs
            for (const tab of tabsToClose) {
                try {
                    await vscode.window.tabGroups.close(tab);
                } catch (e) { }
            }
        }
    } catch (err: any) {
        vscode.window.showErrorMessage(`FluxFlow Companion Error [${command}]: ${err.message}`);
        console.error(`FluxFlow Companion Error [${command}]:`, err);
    }
}

export function deactivate() {
    wss?.close();
}
