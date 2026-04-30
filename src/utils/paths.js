import os from 'os';
import path from 'path';
import fs from 'fs';

/**
 * Flux Flow - Global Path Configuration
 * Centralized coordinates for the ~/.fluxflow data sanctuary.
 */
export const FLUXFLOW_DIR = path.join(os.homedir(), '.fluxflow');
export const SETTINGS_FILE = path.join(FLUXFLOW_DIR, 'settings.json');

// Read settings SYNC to determine the redirection (Anchor Strategy)
let externalDir = null;
try {
    if (fs.existsSync(SETTINGS_FILE)) {
        const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
        const sys = settings.systemSettings || {};
        if (sys.useExternalData && sys.externalDataPath) {
            externalDir = sys.externalDataPath;
        }
    }
} catch (e) {
    // Fallback to default if settings are corrupt or missing
}

export const DATA_DIR = externalDir || FLUXFLOW_DIR;

// Sub-Coordinates
export const LOGS_DIR = path.join(DATA_DIR, 'logs');
export const SECRET_DIR = path.join(DATA_DIR, 'secret');

// File Targets
export const HISTORY_FILE = path.join(SECRET_DIR, 'history.json');
export const USAGE_FILE = path.join(SECRET_DIR, 'usage.json');
export const MEMORIES_FILE = path.join(SECRET_DIR, 'memories.json');
export const TEMP_MEM_FILE = path.join(SECRET_DIR, 'memory-temp.json');
