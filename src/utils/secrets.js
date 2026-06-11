import fs from 'fs-extra';
import { readEncryptedJson, writeEncryptedJson } from './crypto.js';
import { SECRET_DIR } from './paths.js';
import path from 'path';

const SECRET_FILE = path.join(SECRET_DIR, 'secrets.json');

/**
 * Load API Key based on the hierarchy:
 * secrets.json -> Manual Input (handled by CLI)
 */
export const getAPIKey = async () => {
    // 1. Try secrets.json
    try {
        const secrets = readEncryptedJson(SECRET_FILE, {});
        if (secrets.API_KEY) return secrets.API_KEY;
    } catch (e) {
        // Malformed JSON or other error
    }

    return null; // Triggers CLI Prompt
};

export const getProviderAPIKey = async (provider) => {
    try {
        const secrets = readEncryptedJson(SECRET_FILE, {});
        if (provider === 'Google') return secrets.GOOGLE_API_KEY || secrets.API_KEY || null;
        if (provider === 'DeepSeek') return secrets.DEEPSEEK_API_KEY || null;
        if (provider === 'OpenRouter') return secrets.OPENROUTER_API_KEY || null;
        if (provider === 'NVIDIA') return secrets.NVIDIA_API_KEY || null;
    } catch (e) {}
    return null;
};

export const saveProviderAPIKey = async (provider, key) => {
    if (provider === 'Google') {
        await saveSecret('GOOGLE_API_KEY', key);
        await saveSecret('API_KEY', key);
    } else if (provider === 'DeepSeek') {
        await saveSecret('DEEPSEEK_API_KEY', key);
    } else if (provider === 'OpenRouter') {
        await saveSecret('OPENROUTER_API_KEY', key);
    } else if (provider === 'NVIDIA') {
        await saveSecret('NVIDIA_API_KEY', key);
    }
};

/**
 * Load a specific secret key
 */
export const getSecret = async (key) => {
    try {
        const secrets = readEncryptedJson(SECRET_FILE, {});
        return secrets[key] || null;
    } catch (e) {
        return null;
    }
};

/**
 * Persist API Key to JSON (Preserving existing keys)
 */
export const saveSecret = async (key, value) => {
    await fs.ensureDir(SECRET_DIR);
    let current = readEncryptedJson(SECRET_FILE, {});
    current[key] = value;
    writeEncryptedJson(SECRET_FILE, current);
};

export const getSearchSecrets = async () => {
    try {
        const secrets = readEncryptedJson(SECRET_FILE, {});
        return {
            key: secrets.GOOGLE_API_KEY || secrets.API_KEY,
            cx: secrets.SEARCH_ID
        };
    } catch (e) {}
    return { key: null, cx: null };
};

export const saveAPIKey = async (apiKey) => saveSecret('API_KEY', apiKey);
export const saveSearchKey = async (key) => saveSecret('GOOGLE_API_KEY', key);
export const saveSearchId = async (id) => saveSecret('SEARCH_ID', id);

export const removeSecret = async (key) => {
    try {
        const secrets = readEncryptedJson(SECRET_FILE, {});
        delete secrets[key];
        writeEncryptedJson(SECRET_FILE, secrets);
    } catch (e) {}
};

export const removeAPIKey = async () => removeSecret('API_KEY');
