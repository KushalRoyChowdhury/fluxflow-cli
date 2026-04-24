import os from 'os';
import path from 'path';

/**
 * Flux Flow - Global Path Configuration
 * Centralized coordinates for the ~/.fluxflow data sanctuary.
 */
export const FLUXFLOW_DIR = path.join(os.homedir(), '.fluxflow');

// Sub-Coordinates
export const LOGS_DIR = path.join(FLUXFLOW_DIR, 'logs');
export const SECRET_DIR = path.join(FLUXFLOW_DIR, 'secret');

// File Targets
export const SETTINGS_FILE = path.join(FLUXFLOW_DIR, 'settings.json');
export const HISTORY_FILE = path.join(SECRET_DIR, 'history.json');
export const USAGE_FILE = path.join(SECRET_DIR, 'usage.json');
export const MEMORIES_FILE = path.join(SECRET_DIR, 'memories.json');
export const TEMP_MEM_FILE = path.join(SECRET_DIR, 'memory-temp.json');
