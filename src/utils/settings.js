import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SETTINGS_PATH = path.join(__dirname, '../../settings.json');

const DEFAULT_SETTINGS = {
    mode: 'Flux',
    thinkingLevel: 'Medium',
    activeModel: 'gemma-4-31b-it',
    showFullThinking: false,
    apiTier: 'Free',
    quotas: {
        agentLimit: 1500,
        backgroundLimit: 1500,
        searchLimit: 100,
        customModelId: '',
        customLimit: 0
    },
    systemSettings: {
        memory: true,
        compression: 0.0,
        autoExec: false,
        allowExternalAccess: false,
        autoDeleteHistory: '7d'
    },
    profileData: {
        name: null,
        nickname: null,
        instructions: null
    }
};

/**
 * Loads settings from the JSON file
 */
export const loadSettings = async () => {
    try {
        if (await fs.exists(SETTINGS_PATH)) {
            const saved = await fs.readJson(SETTINGS_PATH);
            // Deep merge for second-level objects
            return {
                ...DEFAULT_SETTINGS,
                ...saved,
                quotas: { ...DEFAULT_SETTINGS.quotas, ...saved.quotas },
                systemSettings: { ...DEFAULT_SETTINGS.systemSettings, ...saved.systemSettings },
                profileData: { ...DEFAULT_SETTINGS.profileData, ...saved.profileData }
            };
        }
    } catch (err) {
        console.error('Failed to load settings:', err);
    }
    return DEFAULT_SETTINGS;
};

/**
 * Saves settings to the JSON file
 */
export const saveSettings = async (settings) => {
    try {
        const current = await loadSettings();
        const updated = { ...current, ...settings };
        await fs.writeJson(SETTINGS_PATH, updated, { spaces: 2 });
        return true;
    } catch (err) {
        console.error('Failed to save settings:', err);
        return false;
    }
};
