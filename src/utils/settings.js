import fs from 'fs-extra';
import path from 'path';
import { SETTINGS_FILE } from './paths.js';

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
        autoDeleteHistory: '7d',
        useExternalData: false,
        externalDataPath: ''
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
        if (await fs.exists(SETTINGS_FILE)) {
            const saved = await fs.readJson(SETTINGS_FILE);
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
 * Migrates data from default location to external path
 */
const migrateToExternal = async (newPath) => {
    const { FLUXFLOW_DIR } = await import('./paths.js');
    const folders = ['logs', 'secret'];
    for (const folder of folders) {
        const src = path.join(FLUXFLOW_DIR, folder);
        const dest = path.join(newPath, folder);
        try {
            if (await fs.exists(src)) {
                await fs.ensureDir(dest);
                await fs.copy(src, dest, { overwrite: true });
            }
        } catch (err) {
            console.error(`Migration failed for ${folder}:`, err);
        }
    }
};

/**
 * Saves settings to the JSON file
 */
export const saveSettings = async (settings) => {
    try {
        const current = await loadSettings();
        
        // MIGRATION TRIGGER: If useExternalData is being turned ON
        if (!current.systemSettings.useExternalData && settings.systemSettings?.useExternalData && settings.systemSettings?.externalDataPath) {
            await migrateToExternal(settings.systemSettings.externalDataPath);
        }

        const updated = { ...current, ...settings };
        await fs.ensureDir(path.dirname(SETTINGS_FILE));
        await fs.writeJson(SETTINGS_FILE, updated, { spaces: 2 });
        return true;
    } catch (err) {
        console.error('Failed to save settings:', err);
        return false;
    }
};
