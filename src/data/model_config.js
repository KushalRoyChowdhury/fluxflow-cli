/**
 * Centralized Model Configuration for Flux Flow.
 * Loaded dynamically from GitHub at startup, falling back to local defaults if offline.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { FLUXFLOW_DIR } from '../utils/paths.js';
import DEFAULT_MODEL_CONFIG from '../../model_config.json';

export { DEFAULT_MODEL_CONFIG };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Locate the package config file
let packageConfigPath = '';
const pathsToCheck = [
    path.join(__dirname, '../../model_config.json'), // Dev: src/data/model_config.js -> root
    path.join(__dirname, '../model_config.json'),    // Prod: dist/fluxflow.js -> root
];

for (const p of pathsToCheck) {
    try {
        if (fs.existsSync(p)) {
            packageConfigPath = p;
            break;
        }
    } catch (e) {
        // Ignore errors
    }
}

// User-specific configuration file inside the homedir data sanctuary takes absolute precedence
const userConfigPath = path.join(FLUXFLOW_DIR, 'model_config.json');

let activeConfig = null;

// Helper to get raw package config object
const getPackageConfig = () => {
    if (packageConfigPath) {
        try {
            const fileContent = fs.readFileSync(packageConfigPath, "utf-8");
            const parsed = JSON.parse(fileContent);
            if (parsed && typeof parsed === "object") return parsed;
        } catch (e) {}
    }
    return (DEFAULT_MODEL_CONFIG && typeof DEFAULT_MODEL_CONFIG === "object") ? JSON.parse(JSON.stringify(DEFAULT_MODEL_CONFIG)) : { version: 0, release: 20260913, fallbacks: {}, providers: {} };
};

// 1. Try to load user-specific config first
if (fs.existsSync(userConfigPath)) {
    try {
        const fileContent = fs.readFileSync(userConfigPath, "utf-8");
        const parsed = JSON.parse(fileContent);
        if (parsed && typeof parsed === "object") {
            const pkgConfig = getPackageConfig();
            // Merge fallbacks from package install directory if any are missing
            parsed.fallbacks = { ...(pkgConfig.fallbacks || {}), ...(parsed.fallbacks || {}) };
            if (!parsed.providers) parsed.providers = {};
            if (!parsed.release) parsed.release = pkgConfig.release || 20260913;
            activeConfig = parsed;
        }
    } catch (e) {
        // Ignore and fallback to package config
    }
}

// 2. Fallback to package config if user config was not loaded or does not exist
if (!activeConfig) {
    activeConfig = getPackageConfig();
}

let multimodalModelsSet = new Set();
let reasoningModelsSet = new Set();

const rebuildMultimodalSet = () => {
    const nextSet = new Set();
    const nextReasoningSet = new Set();
    if (activeConfig.providers) {
        for (const providerKey of Object.keys(activeConfig.providers)) {
            const provider = activeConfig.providers[providerKey];
            if (provider && provider.models) {
                const tiers = ['Free', 'Paid'];
                for (const tier of tiers) {
                    const list = provider.models[tier];
                    if (Array.isArray(list)) {
                        for (const m of list) {
                            if (m && m.cmd) {
                                const cmdLower = m.cmd.trim().toLowerCase();
                                if (m.multimodal === true) {
                                    nextSet.add(cmdLower);
                                }
                                if (m.hasReasoning === true) {
                                    nextReasoningSet.add(cmdLower);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    // Include legacy models as a fallback
    if (Array.isArray(activeConfig.multimodal_models)) {
        for (const m of activeConfig.multimodal_models) {
            if (m && typeof m === 'string') {
                nextSet.add(m.trim().toLowerCase());
            }
        }
    }
    multimodalModelsSet = nextSet;
    reasoningModelsSet = nextReasoningSet;
};

// Initialize the set at startup
rebuildMultimodalSet();

export const getModelConfig = () => activeConfig;

export const saveModelConfigToDisk = () => {
    try {
        if (!fs.existsSync(FLUXFLOW_DIR)) {
            fs.mkdirSync(FLUXFLOW_DIR, { recursive: true });
        }
        fs.writeFileSync(userConfigPath, JSON.stringify(activeConfig, null, 2), 'utf-8');
        return true;
    } catch (writeErr) {
        return false;
    }
};

export const saveModelToProvider = (provider, modelId, multimodal = false) => {
    if (!provider || !modelId) return { success: false, reason: 'Invalid provider or model ID' };
    const id = modelId.trim();
    if (!id) return { success: false, reason: 'Model ID cannot be empty' };

    if (!activeConfig.providers) activeConfig.providers = {};
    if (!activeConfig.providers[provider]) {
        activeConfig.providers[provider] = {
            default_free: '',
            default_paid: '',
            models: { Free: [], Paid: [] }
        };
    }
    const p = activeConfig.providers[provider];
    if (!p.models) p.models = { Free: [], Paid: [] };
    if (!Array.isArray(p.models.Free)) p.models.Free = [];

    const existingItem = p.models.Free.find(m => (typeof m === 'string' ? m : m?.cmd) === id);
    if (!existingItem) {
        p.models.Free.push({ cmd: id, multimodal: !!multimodal, desc: id });
    } else {
        if (typeof existingItem === 'string') {
            const idx = p.models.Free.indexOf(existingItem);
            p.models.Free[idx] = { cmd: id, multimodal: !!multimodal, desc: id };
        } else {
            existingItem.multimodal = !!multimodal;
        }
    }
    rebuildMultimodalSet();
    saveModelConfigToDisk();
    return { success: true };
};

export const setModelMultimodalInProvider = (provider, modelId, multimodal = true) => {
    if (!provider || !modelId) return { success: false, reason: 'Invalid provider or model ID' };
    const id = modelId.trim();
    if (!id) return { success: false, reason: 'Model ID cannot be empty' };

    const p = activeConfig.providers?.[provider];
    if (!p || !p.models || !Array.isArray(p.models.Free)) {
        return { success: false, reason: `Provider ${provider} has no models configured` };
    }

    const item = p.models.Free.find(m => (typeof m === 'string' ? m : m?.cmd) === id);
    if (!item) {
        return { success: false, reason: `Model "${id}" not found in ${provider} model list` };
    }

    if (typeof item === 'string') {
        const idx = p.models.Free.indexOf(item);
        p.models.Free[idx] = { cmd: id, multimodal: !!multimodal, desc: id };
    } else {
        item.multimodal = !!multimodal;
    }

    rebuildMultimodalSet();
    saveModelConfigToDisk();
    return { success: true };
};

export const setDefaultModelForProvider = (provider, modelId, multimodal = false) => {
    if (!provider || !modelId) return { success: false, reason: 'Invalid provider or model ID' };
    const id = modelId.trim();
    if (!id) return { success: false, reason: 'Model ID cannot be empty' };

    if (!activeConfig.providers) activeConfig.providers = {};
    if (!activeConfig.providers[provider]) {
        activeConfig.providers[provider] = {
            default_free: '',
            default_paid: '',
            models: { Free: [], Paid: [] }
        };
    }
    const p = activeConfig.providers[provider];
    if (!p.models) p.models = { Free: [], Paid: [] };
    if (!Array.isArray(p.models.Free)) p.models.Free = [];

    const existingItem = p.models.Free.find(m => (typeof m === 'string' ? m : m?.cmd) === id);
    if (!existingItem) {
        p.models.Free.push({ cmd: id, multimodal: !!multimodal, desc: id });
    } else if (multimodal) {
        if (typeof existingItem === 'string') {
            const idx = p.models.Free.indexOf(existingItem);
            p.models.Free[idx] = { cmd: id, multimodal: true, desc: id };
        } else {
            existingItem.multimodal = true;
        }
    }
    p.default_free = id;

    rebuildMultimodalSet();
    saveModelConfigToDisk();
    return { success: true };
};

export const removeModelFromProvider = (provider, modelId) => {
    if (!provider || !modelId) return { success: false, reason: 'Invalid provider or model ID' };
    const id = modelId.trim();
    if (!id) return { success: false, reason: 'Model ID cannot be empty' };

    const p = activeConfig.providers?.[provider];
    if (!p || !p.models || !Array.isArray(p.models.Free)) {
        return { success: false, reason: `Provider ${provider} has no models configured` };
    }

    const idx = p.models.Free.findIndex(m => (typeof m === 'string' ? m : m?.cmd) === id);
    if (idx === -1) {
        return { success: false, reason: `Model "${id}" not found in ${provider} model list` };
    }

    p.models.Free.splice(idx, 1);
    if (p.default_free === id) {
        p.default_free = '';
    }
    if (p.default_paid === id) {
        p.default_paid = '';
    }
    rebuildMultimodalSet();
    saveModelConfigToDisk();
    return { success: true };
};

export const renameModelInProvider = (provider, oldModelId, newModelId) => {
    if (!provider || !oldModelId || !newModelId) return { success: false, reason: 'Invalid provider or model IDs' };
    const oldId = oldModelId.trim();
    const newId = newModelId.trim();
    if (!oldId || !newId) return { success: false, reason: 'Model IDs cannot be empty' };

    const p = activeConfig.providers?.[provider];
    if (!p || !p.models || !Array.isArray(p.models.Free)) {
        return { success: false, reason: `Provider ${provider} has no models configured` };
    }

    const item = p.models.Free.find(m => (typeof m === 'string' ? m : m?.cmd) === oldId);
    if (!item) {
        return { success: false, reason: `Model "${oldId}" not found in ${provider} model list` };
    }

    if (typeof item === 'string') {
        const idx = p.models.Free.indexOf(item);
        p.models.Free[idx] = { cmd: newId, multimodal: false, desc: newId };
    } else {
        item.cmd = newId;
        if (item.desc === oldId || !item.desc) {
            item.desc = newId;
        }
    }

    rebuildMultimodalSet();
    saveModelConfigToDisk();
    return { success: true };
};

let customMultimodal = false;

export const setCustomMultimodal = (enabled) => {
    customMultimodal = !!enabled;
};

export const setOllamaMultimodal = setCustomMultimodal;

export const isModelMultimodal = (model) => {
    if (!model) return false;
    const lower = model.trim().toLowerCase();

    if (customMultimodal) return true;

    // O(1) set lookup
    if (multimodalModelsSet.has(lower)) return true;

    // Default prefix match fallbacks for custom or unlisted models
    if (lower.startsWith('gemini-') || lower.startsWith('gemma-')) return true;

    return false;
};

export const hasModelReasoning = (model) => {
    if (!model) return false;
    const lower = model.trim().toLowerCase();
    return reasoningModelsSet.has(lower);
};

export const getModels = (provider, apiTier) => {
    const p = activeConfig.providers[provider];
    if (!p) return [];
    return p.models[apiTier === 'Free' ? 'Free' : 'Paid'] || [];
};

export const getDefaultModel = (provider, apiTier) => {
    const p = activeConfig.providers[provider];
    if (!p) return '';
    return apiTier === 'Free' ? p.default_free : p.default_paid;
};

export const getFallbackValue = (key) => {
    return activeConfig.fallbacks[key];
};
