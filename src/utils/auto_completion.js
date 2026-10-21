import { loadSettings } from './settings.js';
import { getProviderAPIKey } from './secrets.js';
import { getDefaultModel } from '../data/model_config.js';
import { generateSimpleContent } from './ai.js';
import fs from 'fs';
import path from 'path';
import { FLUXFLOW_DIR } from './paths.js';


/**
 * System prompt for inline auto-completion (CLI side).
 * Mirrors the extension's prompt so behavior stays consistent whether
 * completion runs in-editor (direct fetch) or through the CLI bridge.
 */
export const AUTOCOMPLETE_SYSTEM_PROMPT = [
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
    '- Never include placeholder comments  like // TODO or # your code here',
    '',
    'Output format:',
    '- Wrap the code to insert in <completion>...</completion>',
    '- Do not put anything except the code to insert between the tags'
].join('\n');

try {
    const cacheDir = path.join(FLUXFLOW_DIR, '.cache');
    if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
    }
    fs.writeFileSync(
        path.join(cacheDir, 'completion.json'),
        JSON.stringify({ systemPrompt: AUTOCOMPLETE_SYSTEM_PROMPT }, null, 2)
    );
} catch {
    // Non-critical cache write
}

/**
 * Extract completion text. If <completion>...</completion> tags exist, return
 * only their contents; otherwise treat the whole response as the completion.
 */
export const extractCompletion = (raw) => {
    if (!raw) return '';
    const match = raw.match(/<completion>([\s\S]*?)<\/completion>/i);
    return match ? match[1] : raw;
};

/**
 * Build the user message sent to the model for an inline-completion request.
 */
const buildUserPrompt = ({ prefix = '', suffix = '', fileName = '', language = '', recentChanges = '', clipboard = '' }) => {
    const recent = recentChanges
        ? ['### Recent manual changes (context):', recentChanges, '']
        : [];
    const clip = clipboard
        ? ['### Clipboard (context):', clipboard, '']
        : [];
    return [
        `File: ${fileName}`,
        `Language: ${language}`,
        '',
        '### Code before cursor:',
        prefix,
        '',
        '[cursor here]',
        '',
        '### Code after cursor:',
        suffix,
        '',
        ...recent,
        ...clip,
        '### Completion to insert at cursor:'
    ].join('\n');
};

/**
 * Generate an inline auto-completion using the CLI's own provider layer.
 * Uses generateSimpleContent directly - no manual OpenAI schema typing.
 * Fails silent: returns '' on any error or when disabled.
 *
 * @param {{prefix?:string,suffix?:string,fileName?:string,language?:string,recentChanges?:string,clipboard?:string}} ctx
 * @returns {Promise<string>}
 */
export const generateAutoCompletion = async (ctx = {}) => {
    try {
        const settings = await loadSettings();
        const ac = settings.autoCompletion || {};
        if (!ac.enabled) return '';

        const provider = ac.provider || settings.aiProvider || 'Google';

        const model = (ac.model && ac.model !== 'Default')
            ? ac.model
            : (settings.activeModel || getDefaultModel(provider, settings.apiTier) || getDefaultModel(provider, 'paid'));
        if (!model) return '';

        const apiKey = await getProviderAPIKey(provider);
        if (!apiKey && !(provider === 'c_openai' && settings.systemSettings?.customOpenAIBaseUrl)) {
            return '';
        }

        const oneShotSettings = {
            aiProvider: provider,
            apiKey,
            model,
            mode: 'flow',
            thinkingLevel: 'Fast',
            systemSettings: settings.systemSettings || {}
        };

        const contents = [{ role: 'user', parts: [{ text: buildUserPrompt(ctx) }] }];

        // fs.writeFileSync('cont.json', JSON.stringify(contents));
        const { text } = await generateSimpleContent(
            oneShotSettings,
            model,
            contents,
            AUTOCOMPLETE_SYSTEM_PROMPT,
            'Fast'
        );
        // console.log(text);
        return extractCompletion(text || '');
    } catch (e) {
        // Silent fail - never surface auto-completion errors.
        return '';
    }
};
