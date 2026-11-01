import fs from 'fs-extra';
import path from 'path';
import { readEncryptedJson, writeEncryptedJson } from './crypto.js';
import { SECRET_DIR } from './paths.js';

/**
 * Flux Flow - API Key Store v2
 * ------------------------------------------------------------------
 * Multi-key, fixed 10-slot array per provider. Stored encrypted in
 * secret/secrets_v2.json. Legacy secret/secrets.json is NEVER touched;
 * its single keys are migrated into slot 1 on first read.
 *
 * Shape:
 *   {
 *     "Google":  [ "key1", null, "key2", ... ],   // 10 slots
 *     "c_openai":[ { key, baseUrl }, null, ... ]  // custom carries URL
 *   }
 *
 * Active index per provider is persisted in settings.json (activeKeyIndex).
 * Temp (session-only) keys live in memory and are discarded on provider
 * switch or app close.
 * ------------------------------------------------------------------
 */

const SECRET_FILE_V2 = path.join(SECRET_DIR, 'secrets_v2.json');
const SLOT_COUNT = 10;

// Providers hidden from the no-value summary listing.
export const HIDDEN_FROM_SUMMARY = new Set(['9router', 'c_openai']);

// Provider that stores { key, baseUrl } per slot.
const URL_BEARING_PROVIDERS = new Set(['c_openai']);

// Canonical provider registry. `secret` = legacy keys to migrate from secrets.json.
export const PROVIDER_DEFS = [
    { canonical: 'Google',      secret: ['GOOGLE_API_KEY', 'API_KEY'],           aliases: ['gemini'] },
    { canonical: 'DeepSeek',    secret: ['DEEPSEEK_API_KEY'],                    aliases: ['deepseek-ai', 'deepseekai'] },
    { canonical: 'OpenRouter',  secret: ['OPENROUTER_API_KEY'],                  aliases: ['open router', 'open_router'] },
    { canonical: 'NVIDIA',      secret: ['NVIDIA_API_KEY'],                      aliases: ['nvidia nim'] },
    { canonical: 'Mistral',     secret: ['MISTRAL_API_KEY'],                     aliases: [] },
    { canonical: 'Ollama',      secret: ['OLLAMA_API_KEY'],                      aliases: [] },
    { canonical: 'InferX',      secret: ['INFERX_API_KEY'],                      aliases: ['infer x', 'inferx'] },
    { canonical: 'SenseNova',   secret: ['SENSENOVA_API_KEY'],                   aliases: ['sensenova', 'sense nova'] },
    { canonical: 'AIHubMix',    secret: ['AIHUBMIX_API_KEY'],                    aliases: ['aihubmix', 'ai hub mix'] },
    { canonical: 'Poolside',    secret: ['POOLSIDE_API_KEY'],                    aliases: [] },
    { canonical: '9router',     secret: ['9ROUTER_API_KEY'],                     aliases: ['9router', '9-router', 'nine router'] },
    { canonical: 'ExpLabs',     secret: ['EXPLABS_API_KEY', 'EXPERIENTIALLABS_API_KEY'], aliases: ['explabs', 'experientiallabs', 'experimentallabs', 'experiential labs'] },
    { canonical: 'TokenHarbor', secret: ['TOKENHARBOR_API_KEY', 'TOKEN_HARBOR_API_KEY'], aliases: ['tokenharbor', 'token harbor', 'token_harbor', 'thk'] },
    { canonical: 'Infron',      secret: ['INFRON_API_KEY'],                      aliases: ['infron'] },
    { canonical: 'APInex',      secret: ['APINEX_API_KEY'],                      aliases: ['apinex', 'apx'] },
    { canonical: 'xKiro',       secret: ['XKIRO_API_KEY'],                       aliases: ['xkiro', 'kiro'] },
    { canonical: 'c_openai',    secret: ['CUSTOM_OPENAI_API_KEY', 'C_OPENAI_API_KEY'], aliases: ['custom', 'custom (openai)', 'custom openai'] },
];

// Fast lookup: lowercased name/alias/canonical -> canonical
const LOOKUP = new Map();
for (const def of PROVIDER_DEFS) {
    LOOKUP.set(def.canonical.toLowerCase(), def.canonical);
    for (const a of def.aliases) LOOKUP.set(a.toLowerCase(), def.canonical);
}

/**
 * Normalize a user-supplied provider name to its canonical form.
 * Case-insensitive, exact alias/canonical match only (no fuzzy).
 * Returns canonical name or null.
 */
export const normalizeProvider = (name) => {
    if (!name || typeof name !== 'string') return null;
    return LOOKUP.get(name.trim().toLowerCase()) || null;
};

export const getCanonicalProviders = () => PROVIDER_DEFS.map(d => d.canonical);

/** True when provider stores { key, baseUrl } slots. */
export const isUrlBearing = (provider) => URL_BEARING_PROVIDERS.has(provider);

/** True when provider is hidden from summary. */
export const isHiddenFromSummary = (provider) => HIDDEN_FROM_SUMMARY.has(provider);

const getDef = (provider) => PROVIDER_DEFS.find(d => d.canonical === provider);

/** User-facing provider label (c_openai is never exposed; show 'custom'). */
export const getProviderLabel = (provider) => {
    const canonical = normalizeProvider(provider) || provider;
    return canonical === 'c_openai' ? 'custom' : canonical;
};

// ---------------------------------------------------------------------------
// Slot helpers
// ---------------------------------------------------------------------------

const emptySlots = () => new Array(SLOT_COUNT).fill(null);

const isSlotFilled = (slot) => {
    if (!slot) return false;
    if (typeof slot === 'string') return slot.trim().length > 0;
    if (typeof slot === 'object') return !!(slot.key && String(slot.key).trim());
    return false;
};

const slotKey = (slot) => {
    if (!slot) return null;
    if (typeof slot === 'string') return slot;
    if (typeof slot === 'object' && slot.key) return slot.key;
    return null;
};

/** Normalize a raw stored value into a fixed-length 10-slot array. */
const normalizeSlots = (raw) => {
    const slots = emptySlots();
    if (Array.isArray(raw)) {
        for (let i = 0; i < SLOT_COUNT && i < raw.length; i++) slots[i] = raw[i] ?? null;
    } else if (typeof raw === 'string' && raw.trim()) {
        slots[0] = raw; // legacy single string -> slot 1
    }
    return slots;
};

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const readStore = () => {
    try {
        return readEncryptedJson(SECRET_FILE_V2, {}) || {};
    } catch {
        return {};
    }
};

const writeStore = (store) => {
    // Synchronous write so subsequent reads in the same turn see fresh data.
    try {
        if (!fs.existsSync(SECRET_DIR)) fs.mkdirSync(SECRET_DIR, { recursive: true });
        writeEncryptedJson(SECRET_FILE_V2, store, true);
    } catch {
        // best-effort
    }
};

// ---------------------------------------------------------------------------
// Legacy migration (secrets.json -> secrets_v2.json, slot 1)
// ---------------------------------------------------------------------------

let migrated = false;

/**
 * One-time migration: copy each legacy single key into slot 1 of its provider.
 * Legacy secrets.json is left completely untouched.
 */
export const migrateFromLegacy = async () => {
    if (migrated) return;
    migrated = true;
    try {
        if (await fs.pathExists(SECRET_FILE_V2)) {
            // Already have v2 data; still merge any missing provider slots once.
        }
        const legacyPath = path.join(SECRET_DIR, 'secrets.json');
        if (!(await fs.pathExists(legacyPath))) return;

        const legacy = readEncryptedJson(legacyPath, {}) || {};
        const store = readStore();
        let changed = false;

        for (const def of PROVIDER_DEFS) {
            const slots = normalizeSlots(store[def.canonical]);
            // Only migrate if provider has no filled slots yet.
            if (slots.some(isSlotFilled)) {
                store[def.canonical] = slots;
                continue;
            }
            let legacyKey = null;
            for (const sk of def.secret) {
                if (legacy[sk]) { legacyKey = legacy[sk]; break; }
            }
            if (legacyKey) {
                if (isUrlBearing(def.canonical)) {
                    slots[0] = { key: legacyKey, baseUrl: '' };
                } else {
                    slots[0] = legacyKey;
                }
                store[def.canonical] = slots;
                changed = true;
            }
        }

        if (changed) writeStore(store);
    } catch {
        // silent
    }
};

// ---------------------------------------------------------------------------
// Read / list
// ---------------------------------------------------------------------------

/** Return the 10-slot array for a provider (never null; freshly normalized). */
export const getProviderSlots = (provider) => {
    const canonical = normalizeProvider(provider) || provider;
    const store = readStore();
    return normalizeSlots(store[canonical]);
};

/** Count of filled slots for a provider. */
export const countProviderKeys = (provider) => getProviderSlots(provider).filter(isSlotFilled).length;

/** All-provider summary (excludes hidden). Returns [{provider, count, hasKeys}]. */
export const getProviderSummary = () => {
    return PROVIDER_DEFS
        .filter(d => !HIDDEN_FROM_SUMMARY.has(d.canonical))
        .map(d => {
            const count = countProviderKeys(d.canonical);
            return { provider: d.canonical, count, hasKeys: count > 0 };
        });
};

// ---------------------------------------------------------------------------
// Active index (persisted in settings.json)
// ---------------------------------------------------------------------------

const loadActiveMap = async () => {
    try {
        const { loadSettings } = await import('./settings.js');
        const s = await loadSettings();
        return (s && s.activeKeyIndex) || {};
    } catch {
        return {};
    }
};

const persistActiveMap = async (map) => {
    try {
        const { loadSettings, saveSettings } = await import('./settings.js');
        const s = await loadSettings();
        s.activeKeyIndex = map;
        // saveSettings merges shallowly at top level; pass the full updated object.
        await saveSettings(s);
    } catch {
        // silent
    }
};

export const getActiveIndex = async (provider) => {
    const canonical = normalizeProvider(provider) || provider;
    const map = await loadActiveMap();
    const idx = map[canonical];
    return Number.isInteger(idx) ? idx : null;
};

export const setActiveIndex = async (provider, index) => {
    const canonical = normalizeProvider(provider) || provider;
    const map = await loadActiveMap();
    map[canonical] = index;
    await persistActiveMap(map);
    return index;
};

// ---------------------------------------------------------------------------
// Persisted "no key" mode (--null). Saved slots are left untouched.
// ---------------------------------------------------------------------------

const loadNullMap = async () => {
    try {
        const { loadSettings } = await import('./settings.js');
        const s = await loadSettings();
        return (s && s.nullKeyProviders) || {};
    } catch {
        return {};
    }
};

const persistNullMap = async (map) => {
    try {
        const { loadSettings, saveSettings } = await import('./settings.js');
        const s = await loadSettings();
        s.nullKeyProviders = map;
        await saveSettings(s);
    } catch {
        // silent
    }
};

/** Providers where "use no key" makes sense (local / keyless endpoints). */
const NULL_KEY_PROVIDERS = new Set(['c_openai', 'Ollama']);

/** Truthy sentinel meaning "send no key" (providers recognise and skip auth). */
export const NULL_KEY_SENTINEL = '__FLUX_NULL_KEY__';

export const supportsNullKey = (provider) => NULL_KEY_PROVIDERS.has(normalizeProvider(provider) || provider);

/** True when the provider is in persisted no-key mode. */
export const isNullMode = async (provider) => {
    const canonical = normalizeProvider(provider) || provider;
    const map = await loadNullMap();
    return map[canonical] === true;
};

/** Toggle persisted no-key mode. Does NOT delete or alter any slot. */
export const setNullMode = async (provider, on = true) => {
    const canonical = normalizeProvider(provider) || provider;
    const map = await loadNullMap();
    if (on) map[canonical] = true;
    else delete map[canonical];
    await persistNullMap(map);
    return on === true;
};

// ---------------------------------------------------------------------------
// Temp (in-memory, session-only) keys
// ---------------------------------------------------------------------------

const tempKeys = new Map(); // canonical -> { key, baseUrl? }

export const setTempKey = (provider, key, baseUrl = undefined) => {
    const canonical = normalizeProvider(provider) || provider;
    const entry = { key };
    if (baseUrl !== undefined) entry.baseUrl = baseUrl;
    tempKeys.set(canonical, entry);
};

export const getTempKey = (provider) => {
    const canonical = normalizeProvider(provider) || provider;
    return tempKeys.get(canonical) || null;
};

export const hasTempKey = (provider) => tempKeys.has(normalizeProvider(provider) || provider);

/** Discard ALL temp keys (called on provider switch). */
export const clearAllTempKeys = () => tempKeys.clear();

/** Discard a single provider's temp key. */
export const clearTempKey = (provider) => tempKeys.delete(normalizeProvider(provider) || provider);

/** Register a callback for user-facing notices (e.g. auto-pick fallback). */
let noticeHandler = null;
export const setNoticeHandler = (fn) => { noticeHandler = typeof fn === 'function' ? fn : null; };
const emitNotice = (msg) => { try { if (noticeHandler) noticeHandler(msg); } catch {} };

// ---------------------------------------------------------------------------
// Custom base URL
// ---------------------------------------------------------------------------

const getCurrentCustomBaseUrl = async () => {
    try {
        const { loadSettings } = await import('./settings.js');
        const s = await loadSettings();
        return (s.systemSettings && s.systemSettings.customOpenAIBaseUrl) || '';
    } catch {
        return '';
    }
};

// ---------------------------------------------------------------------------
// Resolution (request-time key pick)
// ---------------------------------------------------------------------------

/**
 * Resolve the API key to use for a provider at request time.
 * Order: temp key > saved active index > lowest non-empty slot (+notice) > null.
 * Returns the key string, or null when the provider has no keys at all.
 */
export const resolveAPIKey = async (provider, opts = {}) => {
    const canonical = normalizeProvider(provider) || provider;
    const silent = opts.silent === true;

    // 1. Temp key wins.
    const temp = tempKeys.get(canonical);
    if (temp && temp.key) return temp.key;

    // 1b. Persisted no-key mode -> send no key (saved slots are ignored).
    if (await isNullMode(canonical)) return NULL_KEY_SENTINEL;

    // 2. Saved active index.
    const slots = getProviderSlots(canonical);
    const activeIdx = await getActiveIndex(canonical);

    if (Number.isInteger(activeIdx) && activeIdx >= 0 && activeIdx < SLOT_COUNT) {
        if (isSlotFilled(slots[activeIdx])) return slotKey(slots[activeIdx]);
        // Active slot empty/invalid -> fall through to auto-pick.
    }

    // 3. Auto-pick lowest non-empty slot.
    const firstFilled = slots.findIndex(isSlotFilled);
    if (firstFilled !== -1) {
        // Silent callers (preflight "has any key?" checks) must not mutate
        // state or spam the chat with notices.
        if (!silent) {
            await setActiveIndex(canonical, firstFilled);
            emitNotice(`No active key set for ${canonical}. Auto-selected slot ${firstFilled + 1}.`);
        }
        return slotKey(slots[firstFilled]);
    }

    // 4. Nothing.
    return null;
};

/** Resolve the effective base URL for a provider (custom carries per-key URL). */
export const resolveBaseUrl = async (provider) => {
    const canonical = normalizeProvider(provider) || provider;
    if (!isUrlBearing(canonical)) return null;

    const temp = tempKeys.get(canonical);
    if (temp && temp.key) {
        // Temp custom key uses the current settings base URL unless explicitly provided.
        return temp.baseUrl !== undefined ? temp.baseUrl : await getCurrentCustomBaseUrl();
    }

    // No-key mode: keep whatever custom base URL is configured (e.g. localhost).
    if (await isNullMode(canonical)) return await getCurrentCustomBaseUrl();

    const slots = getProviderSlots(canonical);
    const activeIdx = await getActiveIndex(canonical);
    if (Number.isInteger(activeIdx) && activeIdx >= 0 && activeIdx < SLOT_COUNT) {
        const slot = slots[activeIdx];
        if (slot && typeof slot === 'object' && slot.key) return slot.baseUrl || '';
    }
    const idx = slots.findIndex(isSlotFilled);
    if (idx !== -1) {
        const slot = slots[idx];
        if (slot && typeof slot === 'object') return slot.baseUrl || '';
    }
    return await getCurrentCustomBaseUrl();
};

// ---------------------------------------------------------------------------
// Mutations: add / remove / use / clean
// ---------------------------------------------------------------------------

const buildSlotValue = async (provider, key, existingBaseUrl, overrideBaseUrl) => {
    if (isUrlBearing(provider)) {
        const baseUrl = overrideBaseUrl !== undefined
            ? overrideBaseUrl
            : (existingBaseUrl !== undefined ? existingBaseUrl : await getCurrentCustomBaseUrl());
        return { key, baseUrl };
    }
    return key;
};

/**
 * Validate a user-supplied OpenAI-compatible endpoint.
 * Accepts URLs ending in `/v1` or `/v1/chat/completions` (trailing slashes ok).
 * @returns {{ok: boolean, url?: string, error?: string}}
 */
export const validateOpenAIBaseUrl = (raw) => {
    const url = String(raw || '').trim();
    if (!url) return { ok: false, error: 'URL is empty.' };
    if (!/^https?:\/\/\S+$/i.test(url)) {
        return { ok: false, error: 'URL must start with http:// or https://' };
    }
    const clean = url.replace(/\/+$/, '');
    const lower = clean.toLowerCase();
    const isV1 = /(^|\/)v1$/.test(lower);
    const isChat = /(^|\/)v1\/chat\/completions$/.test(lower);
    if (!isV1 && !isChat) {
        return { ok: false, error: 'URL must end with /v1 or /v1/chat/completions' };
    }
    return { ok: true, url: clean };
};

/** Find slots whose key equals or contains `query`. Returns matching indices. */
const findMatchingSlots = (slots, query) => {
    const q = String(query);
    const exact = [];
    const partial = [];
    slots.forEach((slot, i) => {
        const k = slotKey(slot);
        if (!k) return;
        if (k === q) exact.push(i);
        else if (k.includes(q)) partial.push(i);
    });
    return exact.length ? exact : partial;
};

/**
 * Add a key.
 * @returns {object} { ok, index?, error? }
 */
export const addProviderKey = async (provider, key, opts = {}) => {
    const canonical = normalizeProvider(provider) || provider;
    if (!key || !String(key).trim()) return { ok: false, error: 'Empty key.' };
    const addKey = String(key).trim();

    // Optional explicit base URL (custom provider only).
    let overrideBaseUrl;
    if (opts.baseUrl !== undefined) {
        if (!isUrlBearing(canonical)) {
            return { ok: false, error: '--url is only supported for the custom provider.' };
        }
        const validated = validateOpenAIBaseUrl(opts.baseUrl);
        if (!validated.ok) return { ok: false, error: `Invalid URL: ${validated.error}` };
        overrideBaseUrl = validated.url;
    }

    const store = readStore();
    const slots = normalizeSlots(store[canonical]);

    // Duplicate exact key -> error.
    if (slots.some(s => slotKey(s) === addKey)) {
        const dupIdx = slots.findIndex(s => slotKey(s) === addKey);
        return { ok: false, error: `Key already exists in slot ${dupIdx + 1}.` };
    }

    // Explicit index.
    if (Number.isInteger(opts.index)) {
        const i = opts.index;
        if (i < 0 || i >= SLOT_COUNT) {
            return { ok: false, error: `Index must be between 1 and ${SLOT_COUNT}.` };
        }
        // Overwrite semantics (caller is responsible for confirm).
        const existingBaseUrl = (slots[i] && typeof slots[i] === 'object') ? slots[i].baseUrl : undefined;
        slots[i] = await buildSlotValue(canonical, addKey, existingBaseUrl, overrideBaseUrl);
        store[canonical] = slots;
        writeStore(store);
        await setNullMode(canonical, false);
        return { ok: true, index: i };
    }

    // First empty slot.
    const emptyIdx = slots.findIndex(s => !isSlotFilled(s));
    if (emptyIdx === -1) {
        return { ok: false, error: 'All slots full. Specify an index to overwrite.', full: true };
    }
    slots[emptyIdx] = await buildSlotValue(canonical, addKey, undefined, overrideBaseUrl);
    store[canonical] = slots;
    writeStore(store);
    await setNullMode(canonical, false);
    return { ok: true, index: emptyIdx };
};

/**
 * Replace the ACTIVE key with a new key (settings-page semantics).
 * Overwrites the active slot in place instead of appending a new slot.
 * Fallback: lowest filled slot -> slot 1 (then marks it active).
 * @returns {object} { ok, index?, error? }
 */
export const replaceActiveProviderKey = async (provider, key, opts = {}) => {
    const canonical = normalizeProvider(provider) || provider;
    if (!key || !String(key).trim()) return { ok: false, error: 'Empty key.' };
    const newKey = String(key).trim();

    let overrideBaseUrl;
    if (opts.baseUrl !== undefined) {
        if (!isUrlBearing(canonical)) {
            return { ok: false, error: 'Base URL is only supported for the custom provider.' };
        }
        const validated = validateOpenAIBaseUrl(opts.baseUrl);
        if (!validated.ok) return { ok: false, error: `Invalid URL: ${validated.error}` };
        overrideBaseUrl = validated.url;
    }

    const store = readStore();
    const slots = normalizeSlots(store[canonical]);

    const activeIdx = await getActiveIndex(canonical);
    let idx = (Number.isInteger(activeIdx) && activeIdx >= 0 && activeIdx < SLOT_COUNT && isSlotFilled(slots[activeIdx]))
        ? activeIdx
        : slots.findIndex(isSlotFilled);
    if (idx === -1) idx = 0;

    const existingBaseUrl = (slots[idx] && typeof slots[idx] === 'object') ? slots[idx].baseUrl : undefined;
    slots[idx] = await buildSlotValue(canonical, newKey, existingBaseUrl, overrideBaseUrl);
    store[canonical] = slots;
    writeStore(store);
    await setActiveIndex(canonical, idx);
    // A freshly saved key means we are no longer in no-key mode.
    await setNullMode(canonical, false);
    return { ok: true, index: idx };
};

/**
 * Remove one or all keys.
 * target: number (1-based index) | string (exact/substring key) | { all: true } | undefined (active)
 * @returns {object} { ok, removed?, error?, remaining?, needsNewKey? }
 */
export const removeProviderKey = async (provider, target, opts = {}) => {
    const canonical = normalizeProvider(provider) || provider;
    const store = readStore();
    const slots = normalizeSlots(store[canonical]);

    if (opts.all || target === '--all' || target === '__all__') {
        store[canonical] = emptySlots();
        writeStore(store);
        await setActiveIndex(canonical, null);
        return { ok: true, all: true, remaining: 0, needsNewKey: true };
    }

    let idx = -1;

    if (target === undefined || target === null) {
        // Remove the active key (or lowest filled if none active).
        const active = await getActiveIndex(canonical);
        idx = (Number.isInteger(active) && isSlotFilled(slots[active])) ? active : slots.findIndex(isSlotFilled);
        if (idx === -1) return { ok: false, error: 'No keys to remove.' };
    } else if (Number.isInteger(target)) {
        idx = target;
        if (idx < 0 || idx >= SLOT_COUNT) return { ok: false, error: `Index must be between 1 and ${SLOT_COUNT}.` };
        if (!isSlotFilled(slots[idx])) return { ok: false, error: `Slot ${idx + 1} is already empty.` };
    } else {
        // String exact/substring.
        const matches = findMatchingSlots(slots, target);
        if (matches.length === 0) return { ok: false, error: 'No matching key found.' };
        if (matches.length > 1) {
            return { ok: false, error: `Duplicate match (slots ${matches.map(i => i + 1).join(', ')}). Be more specific.` };
        }
        idx = matches[0];
    }

    const removed = slotKey(slots[idx]);
    const wasActive = (await getActiveIndex(canonical)) === idx;
    slots[idx] = null;
    store[canonical] = slots;
    writeStore(store);

    const remaining = slots.filter(isSlotFilled).length;

    if (wasActive) {
        // Pick next filled slot if any; otherwise clear active.
        const nextIdx = slots.findIndex(isSlotFilled);
        await setActiveIndex(canonical, nextIdx === -1 ? null : nextIdx);
    }

    return { ok: true, removed, removedIndex: idx, remaining, needsNewKey: remaining === 0 };
};

/**
 * Use a key as active.
 * target: number (1-based index) | string (exact/substring). For temp use setTempKey separately.
 * @returns {object} { ok, index?, error? }
 */
export const useProviderKey = async (provider, target) => {
    const canonical = normalizeProvider(provider) || provider;
    const slots = getProviderSlots(canonical);

    let idx = -1;
    if (Number.isInteger(target)) {
        idx = target;
        if (idx < 0 || idx >= SLOT_COUNT) return { ok: false, error: `Index must be between 1 and ${SLOT_COUNT}.` };
        if (!isSlotFilled(slots[idx])) return { ok: false, error: `Slot ${idx + 1} is empty.` };
    } else {
        const matches = findMatchingSlots(slots, target);
        if (matches.length === 0) return { ok: false, error: 'No matching key found.' };
        if (matches.length > 1) {
            return { ok: false, error: `Duplicate match (slots ${matches.map(i => i + 1).join(', ')}). Be more specific.` };
        }
        idx = matches[0];
    }

    await setActiveIndex(canonical, idx);
    // Picking a real slot always leaves no-key mode.
    await setNullMode(canonical, false);

    let switchedBaseUrl = null;
    if (isUrlBearing(canonical)) {
        const slot = slots[idx];
        const slotBaseUrl = (slot && typeof slot === 'object' && slot.baseUrl) ? slot.baseUrl.trim() : '';
        if (slotBaseUrl) {
            try {
                const { loadSettings, saveSettings } = await import('./settings.js');
                const s = await loadSettings();
                const currentBaseUrl = (s.systemSettings && s.systemSettings.customOpenAIBaseUrl) ? s.systemSettings.customOpenAIBaseUrl.trim() : '';
                if (currentBaseUrl !== slotBaseUrl) {
                    const newSysSettings = { ...(s.systemSettings || {}), customOpenAIBaseUrl: slotBaseUrl, memory: false };
                    await saveSettings({ ...s, systemSettings: newSysSettings });
                    switchedBaseUrl = slotBaseUrl;
                }
            } catch (e) { }
        }
    }

    return { ok: true, index: idx, key: slotKey(slots[idx]), switchedBaseUrl };
};

/**
 * Compact (clean) one provider or the entire DB.
 * Occupied slots shift up preserving order; gaps move to the tail.
 * Active index follows the active key to its new slot.
 * @returns {object} { ok, providers?, moved? }
 */
export const cleanProviderKeys = async (provider = null) => {
    const store = readStore();
    const targets = provider
        ? [normalizeProvider(provider) || provider]
        : getCanonicalProviders();

    let touched = 0;
    for (const canonical of targets) {
        const slots = normalizeSlots(store[canonical]);
        const filled = slots.filter(isSlotFilled);
        if (filled.length === 0) { store[canonical] = slots; continue; }

        const activeIdx = await getActiveIndex(canonical);
        const activeSlot = (Number.isInteger(activeIdx) && isSlotFilled(slots[activeIdx])) ? slots[activeIdx] : null;

        const compacted = emptySlots();
        filled.forEach((s, i) => { compacted[i] = s; });

        // Active index follows the active key to its new (compacted) position.
        let newActive = Number.isInteger(activeIdx) ? activeIdx : null;
        if (activeSlot) {
            // Position of the active slot within the ordered `filled` array.
            const posInFilled = slots.slice(0, SLOT_COUNT)
                .map((s, i) => ({ s, i }))
                .filter(x => isSlotFilled(x.s))
                .findIndex(x => x.i === activeIdx);
            newActive = posInFilled === -1 ? null : posInFilled;
        }

        store[canonical] = compacted;
        if (newActive !== activeIdx) {
            await setActiveIndex(canonical, newActive);
        }
        touched++;
    }

    writeStore(store);
    return { ok: true, providers: targets.length, touched };
};

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

/** Mask a URL for display: ...host/path (middle-elided, keep scheme-less tail). */
/** Mask a key for display: keep the outer thirds, hide the middle third. */
export const maskKey = (key) => {
    if (!key) return '';
    const k = String(key);
    const n = k.length;
    if (n <= 3) return '...';
    const third = Math.floor(n / 3);
    const head = k.slice(0, third);
    const tail = k.slice(n - third);
    return head + '...' + tail;
};

export const formatBaseUrl = (url) => {
    if (!url) return '';
    const clean = String(url).replace(/\/+$/, '');
    if (clean.length <= 28) return clean;
    // Drop scheme for brevity then elide the front.
    const noScheme = clean.replace(/^https?:\/\//i, '');
    return '...' + noScheme.slice(-24);
};

/** Build the inline list lines for a provider. Returns array of display strings. */
export const buildListLines = async (provider, opts = {}) => {
    const unmask = opts.unmask === true;
    const canonical = normalizeProvider(provider) || provider;
    const slots = getProviderSlots(canonical);
    const activeIdx = await getActiveIndex(canonical);
    const temp = tempKeys.get(canonical);
    const lines = [];

    if (temp && temp.key) {
        lines.push(`Temporary: ${unmask ? temp.key : maskKey(temp.key)}`);
    }

    if (await isNullMode(canonical)) {
        lines.push('Mode: NO KEY (null)  <- active');
    }

    for (let i = 0; i < SLOT_COUNT; i++) {
        const slot = slots[i];
        const rawKey = slotKey(slot);
        const k = rawKey && !unmask ? maskKey(rawKey) : rawKey;
        let label;
        if (!rawKey) {
            label = 'Empty';
        } else if (isUrlBearing(canonical)) {
            const url = slot && typeof slot === 'object' ? formatBaseUrl(slot.baseUrl) : '';
            label = url ? `${k} (Saved: ${url})` : k;
        } else {
            label = k;
        }
        const marker = (i === activeIdx && rawKey) ? '  ← active' : '';
        lines.push(`${i + 1}: ${label}${marker}`);
    }
    return lines;
};
