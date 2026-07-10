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

// 1. Try to load user-specific config first
if (fs.existsSync(userConfigPath)) {
    try {
        const fileContent = fs.readFileSync(userConfigPath, 'utf-8');
        const parsed = JSON.parse(fileContent);
        if (parsed && parsed.providers && parsed.fallbacks && parsed.release) {
            activeConfig = parsed;
        }
    } catch (e) {
        // Ignore and fallback to package config
    }
}

// 2. Fallback to package config if user config wasn't loaded
if (!activeConfig && packageConfigPath) {
    try {
        const fileContent = fs.readFileSync(packageConfigPath, 'utf-8');
        const parsed = JSON.parse(fileContent);
        if (parsed && parsed.providers && parsed.fallbacks && parsed.release) {
            activeConfig = parsed;
        }
    } catch (e) {
        // Ignore and fail later
    }
}

// Enforce configuration presence
if (!activeConfig) {
    console.error("\n[Error] Unable to load model configuration. Please re-install the package from your package manager.\n");
    process.exit(1);
}

let multimodalModelsSet = new Set();

const rebuildMultimodalSet = () => {
    const nextSet = new Set();
    if (activeConfig.providers) {
        for (const providerKey of Object.keys(activeConfig.providers)) {
            const provider = activeConfig.providers[providerKey];
            if (provider && provider.models) {
                const tiers = ['Free', 'Paid'];
                for (const tier of tiers) {
                    const list = provider.models[tier];
                    if (Array.isArray(list)) {
                        for (const m of list) {
                            if (m && m.cmd && m.multimodal === true) {
                                nextSet.add(m.cmd.trim().toLowerCase());
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
};

// Initialize the set at startup
rebuildMultimodalSet();

export const getModelConfig = () => activeConfig;

export const loadRemoteModelConfig = async () => {
    try {
        const url = 'https://raw.githubusercontent.com/KushalRoyChowdhury/fluxflow-cli/main/model_config.json';
        const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
            const data = await res.json();
            if (data && data.providers && data.fallbacks && data.release) {
                const isNewerVersion = typeof data.version === 'number' && data.version > activeConfig.version;
                const isNewerRelease = typeof data.release === 'number' && data.release > activeConfig.release;
                if (isNewerVersion || isNewerRelease) {
                    activeConfig = data;
                    rebuildMultimodalSet();

                    // Always write update to the user-specific homedir data sanctuary path
                    try {
                        if (!fs.existsSync(FLUXFLOW_DIR)) {
                            fs.mkdirSync(FLUXFLOW_DIR, { recursive: true });
                        }
                        fs.writeFileSync(userConfigPath, JSON.stringify(data, null, 2), 'utf-8');
                    } catch (writeErr) {
                        // Silently ignore write failures if homedir is read-only
                    }
                    return true;
                }
            }
        }
    } catch (e) {
        // Fallback silently to default bundled config
    }
    return false;
};

export const isModelMultimodal = (model) => {
    if (!model) return false;
    const lower = model.trim().toLowerCase();

    // O(1) set lookup
    if (multimodalModelsSet.has(lower)) return true;

    // Default prefix match fallbacks for custom or unlisted models
    if (lower.startsWith('gemini-') || lower.startsWith('gemma-')) return true;

    return false;
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
