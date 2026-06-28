import os from 'os';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

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
        const fileContent = fs.readFileSync(SETTINGS_FILE, 'utf8').trim();
        let settings;
        if (fileContent.startsWith('{')) {
            settings = JSON.parse(fileContent);
        } else {
            // Decrypt AES settings securely
            const parts = fileContent.split(':');
            if (parts.length === 2) {
                const iv = Buffer.from(parts[0], 'hex');
                const ciphertext = parts[1];
                const key = crypto.createHash('sha256').update('fluxflow-cli-sanctuary-key').digest();
                const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
                let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
                decrypted += decipher.final('utf8');
                settings = JSON.parse(decrypted);
            }
        }

        if (settings) {
            const sys = settings.systemSettings || {};
            if (sys.useExternalData && sys.externalDataPath) {
                externalDir = sys.externalDataPath;
            }
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
export const HISTORY_DIR = path.join(SECRET_DIR, 'history');
export const USAGE_FILE = path.join(FLUXFLOW_DIR, 'usage.json');
export const MEMORIES_FILE = path.join(SECRET_DIR, 'memories.json');
export const TEMP_MEM_FILE = path.join(SECRET_DIR, 'memory-temp.json');
export const TEMP_MEM_CHAT_FILE = path.join(SECRET_DIR, 'temp-memory-chat.json');
export const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
export const LEDGER_FILE = path.join(SECRET_DIR, 'ledger.json');
export const ACTIVE_TX_FILE = path.join(SECRET_DIR, 'active_tx.json');
export const PATHS_FILE = path.join(SECRET_DIR, 'path.json');
export const CONTEXT_FILE = path.join(SECRET_DIR, 'context.json');
export const PARSER_DIR = path.join(DATA_DIR, 'parsers');
