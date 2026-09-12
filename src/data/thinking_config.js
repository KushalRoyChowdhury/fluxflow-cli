import fs from 'fs';
import { FLUXFLOW_DIR, THINKING_CONFIG_FILE } from '../utils/paths.js';

let cachedConfig = null;

export const loadThinkingConfig = () => {
    try {
        if (fs.existsSync(THINKING_CONFIG_FILE)) {
            const raw = fs.readFileSync(THINKING_CONFIG_FILE, 'utf-8');
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
                cachedConfig = parsed;
                return cachedConfig;
            }
        }
    } catch (e) {
        // ignore errors
    }
    cachedConfig = cachedConfig || {};
    return cachedConfig;
};

export const saveThinkingConfig = (config) => {
    try {
        if (!fs.existsSync(FLUXFLOW_DIR)) {
            fs.mkdirSync(FLUXFLOW_DIR, { recursive: true });
        }
        fs.writeFileSync(THINKING_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
        cachedConfig = config;
        return true;
    } catch (e) {
        return false;
    }
};

export const getMappedThinkingLevel = (provider, model, requestedLevel) => {
    if (!provider || !model || !requestedLevel) return null;
    const config = cachedConfig || loadThinkingConfig();
    const key = `${provider}::${model}`;
    const modelEntry = config[key];
    if (modelEntry && typeof modelEntry === 'object') {
        const levelKey = requestedLevel.toLowerCase();
        // Check exact match (e.g. "standard", "medium", "low", "high", "fast", "xhigh")
        if (modelEntry[levelKey] !== undefined && modelEntry[levelKey] !== null) {
            return modelEntry[levelKey];
        }
        // Also check capitalized / exact casing keys if present
        for (const [k, v] of Object.entries(modelEntry)) {
            if (k.toLowerCase() === levelKey) {
                return v;
            }
        }
    }
    return null;
};

export const setThinkingLevelMapping = (provider, model, requestedLevel, mappedTarget) => {
    if (!provider || !model || !requestedLevel || !mappedTarget) {
        return { success: false, reason: 'Invalid arguments' };
    }
    const config = cachedConfig || loadThinkingConfig();
    const key = `${provider}::${model}`;
    if (!config[key] || typeof config[key] !== 'object') {
        config[key] = {};
    }
    config[key][requestedLevel.toLowerCase()] = mappedTarget;
    const ok = saveThinkingConfig(config);
    return { success: ok };
};

export const removeThinkingLevelMapping = (provider, model, requestedLevel) => {
    if (!provider || !model) {
        return { success: false, reason: 'Invalid arguments' };
    }
    const config = cachedConfig || loadThinkingConfig();
    const key = `${provider}::${model}`;
    if (config[key]) {
        if (requestedLevel) {
            delete config[key][requestedLevel.toLowerCase()];
            if (Object.keys(config[key]).length === 0) {
                delete config[key];
            }
        } else {
            delete config[key];
        }
        saveThinkingConfig(config);
    }
    return { success: true };
};
