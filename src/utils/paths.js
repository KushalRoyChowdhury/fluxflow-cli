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
                externalDir = path.normalize(sys.externalDataPath.trim());
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
export const USAGE_FILE_OLD = path.join(FLUXFLOW_DIR, 'usage.json');
export const USAGE_FILE = path.join(SECRET_DIR, 'usage.json');
export const USAGE_FILE_TIMED = path.join(SECRET_DIR, 'timed_usage');
export const MEMORIES_FILE = path.join(SECRET_DIR, 'memories.json');
export const TEMP_MEM_FILE = path.join(SECRET_DIR, 'memory-temp.json');
export const TEMP_MEM_CHAT_FILE = path.join(SECRET_DIR, 'temp-memory-chat.json');
export const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
export const LEDGER_FILE = path.join(SECRET_DIR, 'ledger.json');
export const LEDGER_ADVANCE_FILE = path.join(SECRET_DIR, 'ledgerAdvance.json');
export const ACTIVE_TX_FILE = path.join(SECRET_DIR, 'active_tx.json');
export const PATHS_FILE = path.join(SECRET_DIR, 'path.json');
export const CONTEXT_FILE = path.join(SECRET_DIR, 'context.json');
export const PARSER_DIR = path.join(DATA_DIR, 'parsers');
export const CU_CACHE_DIR = path.join(FLUXFLOW_DIR, '.cache', 'CU');
export const THINKING_CONFIG_FILE = path.join(FLUXFLOW_DIR, 'thinking_config.json');

export const DEFAULT_EXCLUDES = [
    // --- The OG Clutter & VCS ---
    '.git', 'node_modules', '.gemini', 'dist', 'build', '.next', 'out',
    '.cache', 'bin', 'obj', 'vendor', 'venv', '.idea', '.gradle',
    '.terraform', 'target', 'coverage', '.vscode',
    '.svn', '.hg', '.fslckout', '.github', '.gitlab', '.circleci',
    '.gitea', '.gitee', '.lerna', '.changeset', '.nx',

    // --- JS / TS / Web Dev Armageddon ---
    '.npm', '.yarn', '.pnpm-store', '.pnpm', '.expo', '.nuxt', '.svelte-kit',
    '.docusaurus', '.turbo', '.vercel', 'bower_components', '.netlify',
    '.vuepress', '.quasar', '.output', '.angular', 'jspm_packages',
    '.parcel-cache', '.rollup.cache', '.rspack', '.vitepress',

    // --- Python & Data Science Brain Melting ---
    '__pycache__', '.pytest_cache', '.mypy_cache', '.tox', '.poetry',
    'env', 'vhdl', '.ipynb_checkpoints', '.jupyter', '.conda', '.pdm-build',

    // --- Ruby / PHP / Go / Rust / Java / C++ / C# ---
    '.bundle', '.yardoc', '.metadata', 'App_Data', 'ClientBin',
    '.cargo', '.rustc_info', '.go', 'Godeps', '_vendor', '.rake_tasks',
    'CMakefiles', '.wakatime',

    // --- Mobile Dev Madness (Android / iOS / Flutter) ---
    '.dart_tool', '.fvm', '.cocoapods', 'Pods', '.pub-cache',
    '.symlinks', 'DerivedData', '.xcworkspace',

    // --- Containers, Cloud & Database Dumps ---
    '.serverless', '.aws', '.gcloud', '.azure', '.kube',
    '.vagrant', '.docker', 'postgres-data', 'redis-data', 'mongo-data',

    // --- OS & System Trash ---
    '.Spotlight-V100', '.Trashes', '$RECYCLE.BIN',
    'System Volume Information', '.DocumentRevisions-V100', '.fseventsd',
    'AppData', 'Application Data', 'Local', 'LocalLow', 'Roaming',
    '$WinREAgent', '$WINDOWS.~BT', '$WINDOWS.~WS', 'scw', 'System32', 'SysWOW64',
    '.AppleDouble', '.AppleDB', '.AppleDesktop', '_CodeSignature',
    '.cmio', '.LSOverride', '.localized', '.TemporaryItems',
    '.Trash', '.Trash-0', '.Trash-1000', '.gvfs', '.local', '.config',
    '.dbus', '.fontconfig', '.snap', '.var', '.lost+found', 'lost+found',
    '.thumb', '.thumbnails', 'EFI', 'boot', 'grub',
    'logs', 'log', '.nyc_output', '.sonar', '.ruff_cache', '.VSCodeCounter',

    // Binaries, Media, Compressed & Font Files
    '.exe', '.dll', '.so', '.dylib', '.png', '.jpg', '.jpeg', '.gif', '.ico',
    '.svg', '.webp', '.mp3', '.mp4', '.avi', '.zip', '.tgz', '.tar', '.gz',
    '.7z', '.rar', '.pdf', '.docx', '.xlsx', '.pptx', '.woff', '.woff2', '.ttf', '.eot',

    // FluxFlow
    '.skills', 'skills'
];

export const getGitignoreExcludes = (dir = process.cwd()) => {
    try {
        const gitignorePath = path.join(dir, '.gitignore');
        if (fs.existsSync(gitignorePath)) {
            const content = fs.readFileSync(gitignorePath, 'utf8');
            return content
                .split('\n')
                .map(line => line.trim())
                .filter(line => line && !line.startsWith('#') && !line.startsWith('!'))
                .map(line => line.replace(/^[\/\\]+/, '').replace(/[\/\\]+$/, '').replace(/\/\*+$/, ''))
                .filter(Boolean);
        }
    } catch {
        // ignore errors
    }
    return [];
};

