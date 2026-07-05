import fs from 'fs-extra';
import path from 'path';
import { SETTINGS_FILE } from './paths.js';
import { readAesEncryptedJson, writeAesEncryptedJson } from './crypto.js';

const DEFAULT_SETTINGS = {
    mode: 'Flux',
    thinkingLevel: 'Medium',
    aiProvider: 'Google',
    activeModel: 'gemma-4-31b-it',
    showFullThinking: true,
    apiTier: 'Free',
    quotas: {
        agentLimit: 999999,
        backgroundLimit: 999999,
        searchLimit: 100,
        customModelId: '',
        customLimit: 0,
        providerTiers: {
            Google: 'Free',
            DeepSeek: 'Free',
            NVIDIA: 'Free',
            OpenRouter: 'Free'
        }
    },
    systemSettings: {
        memory: true,
        compression: 0.0,
        autoExec: false,
        allowExternalAccess: false,
        advanceRollback: false,
        autoDeleteHistory: '7d',
        useExternalData: false,
        externalDataPath: ''
    },
    profileData: {
        name: null,
        nickname: null,
        instructions: null
    },
    imageSettings: {
        keyType: 'Default',
        quality: 'Low-High',
        apiKey: ''
    }
};

/**
 * Loads settings from the JSON file
 */
export const loadSettings = async () => {
    let settingsObj = { ...DEFAULT_SETTINGS };
    try {
        if (await fs.exists(SETTINGS_FILE)) {
            const saved = readAesEncryptedJson(SETTINGS_FILE);

            // SECURITY SELF-HEALING MIGRATION:
            // Extract and migrate custom Pollinations API Key from settings.json to encrypted secrets.json
            if (saved.imageSettings && saved.imageSettings.apiKey) {
                try {
                    const legacyKey = saved.imageSettings.apiKey;
                    const { saveSecret } = await import('./secrets.js');
                    await saveSecret('POLLINATIONS_API_KEY', legacyKey);

                    // Scrub immediately from settings file on disk
                    saved.imageSettings.apiKey = '';
                    writeAesEncryptedJson(SETTINGS_FILE, saved);
                } catch (e) { }
            }

            settingsObj = {
                ...DEFAULT_SETTINGS,
                ...saved,
                quotas: {
                    ...DEFAULT_SETTINGS.quotas,
                    ...saved.quotas,
                    providerTiers: {
                        ...DEFAULT_SETTINGS.quotas.providerTiers,
                        ...(saved.quotas?.providerTiers || {})
                    }
                },
                systemSettings: { ...DEFAULT_SETTINGS.systemSettings, ...saved.systemSettings },
                profileData: { ...DEFAULT_SETTINGS.profileData, ...saved.profileData },
                imageSettings: { ...DEFAULT_SETTINGS.imageSettings, ...saved.imageSettings }
            };
        }
    } catch (err) {
        console.error('Failed to load settings:', err);
    }

    try {
        // Dynamic Custom API Key Injection from secrets.json
        const { getSecret } = await import('./secrets.js');
        const customApiKey = await getSecret('POLLINATIONS_API_KEY');
        if (customApiKey) {
            settingsObj.imageSettings.apiKey = customApiKey;
        }
    } catch (e) { }

    // [MIGRATION LOCK]: Always force showFullThinking to true.
    if (settingsObj.showFullThinking === false) {
        settingsObj.showFullThinking = true;
        try {
            writeAesEncryptedJson(SETTINGS_FILE, settingsObj);
        } catch (e) { }
    }

    return settingsObj;
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

        // Intercept Pollinations custom API Key to save to secrets.json
        if (settings.imageSettings && settings.imageSettings.apiKey !== undefined) {
            const { saveSecret, removeSecret } = await import('./secrets.js');
            const keyToSave = settings.imageSettings.apiKey;
            if (keyToSave) {
                await saveSecret('POLLINATIONS_API_KEY', keyToSave);
            } else {
                await removeSecret('POLLINATIONS_API_KEY');
            }
        }

        const updated = { ...current, ...settings };

        // Scrub apiKey from imageSettings so it NEVER gets written to settings.json
        if (updated.imageSettings) {
            updated.imageSettings = { ...updated.imageSettings, apiKey: '' };
        }

        await fs.ensureDir(path.dirname(SETTINGS_FILE));
        writeAesEncryptedJson(SETTINGS_FILE, updated);
        return true;
    } catch (err) {
        console.error('Failed to save settings:', err);
        return false;
    }
};
