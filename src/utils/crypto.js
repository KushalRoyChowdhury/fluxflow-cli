import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import { FLUXFLOW_DIR } from './paths.js';

const XOR_KEY = 0x42;
const bypass = true; // Changed

const xorTransform = (data) => {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const result = Buffer.alloc(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
        result[i] = buffer[i] ^ XOR_KEY;
    }
    return result;
};

export const getMachineIdentifier = () => {
    try {
        const idDir = FLUXFLOW_DIR;
        const idFile = path.join(idDir, '.token');

        if (fs.existsSync(idFile)) {
            const token = fs.readFileSync(idFile, 'utf8').trim();
            if (token) return token;
        }

        const token = crypto.randomUUID();

        try {
            if (!fs.existsSync(idDir)) fs.mkdirSync(idDir, { recursive: true });
            fs.writeFileSync(idFile, token, { encoding: 'utf8', mode: 0o600 });
        } catch {}

        return token;
    } catch {
        return 'fluxflow-fallback-default-device-seed';
    }
};

// AES-256-CBC secure encryption keys
const AES_ALGORITHM = 'aes-256-cbc';
const LEGACY_KEY = crypto.createHash('sha256').update('fluxflow-cli-sanctuary-key').digest();
const AES_KEY = crypto.createHash('sha256').update(getMachineIdentifier()).digest();

export const encryptAes = (text, shouldEncrypt = false, key = AES_KEY) => {
    if (bypass && !shouldEncrypt) return text;
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(AES_ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
};

export const decryptAes = (encryptedText, shouldDecrypt = false, key = AES_KEY) => {
    if (bypass && !shouldDecrypt) return encryptedText;
    const parts = encryptedText.split(':');
    if (parts.length !== 2) {
        throw new Error('Invalid AES format');
    }
    const iv = Buffer.from(parts[0], 'hex');
    const ciphertext = parts[1];
    const decipher = crypto.createDecipheriv(AES_ALGORITHM, key, iv);
    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
};

/**
 * Migrates ciphertext from the old hardcoded key to the new machine key.
 * @param {string} encryptedText - Ciphertext encrypted with legacy key.
 * @returns {string} Ciphertext re-encrypted with new machine key.
 */
export const migrateCiphertext = (encryptedText) => {
    try {
        const decrypted = decryptAes(encryptedText, true, LEGACY_KEY);
        return encryptAes(decrypted, true, AES_KEY);
    } catch {
        // If it cannot be decrypted with the old key, return as is
        return encryptedText;
    }
};

/**
 * Migrates a JSON file encrypted with the old key to the new machine key.
 * @param {string} filePath - Absolute path to file.
 * @returns {boolean} True if successfully migrated.
 */
export const migrateFile = (filePath) => {
    try {
        if (!fs.existsSync(filePath)) return false;
        const rawContent = fs.readFileSync(filePath, 'utf8').trim();
        if (!rawContent || rawContent.startsWith('{') || rawContent.startsWith('[')) return false;

        // Try decrypting with old key
        let decrypted;
        try {
            decrypted = decryptAes(rawContent, true, LEGACY_KEY);
        } catch {
            return false; // Already with new key or invalid
        }

        const data = JSON.parse(decrypted);
        writeEncryptedJson(filePath, data, true);
        return true;
    } catch {
        return false;
    }
};

/**
 * Reads an AES encrypted JSON file (with automatic fallback to old key, XOR, and raw JSON).
 * If encrypted with the old key, automatically re-encrypts and migrates with the new key in place!
 * @param {string} filePath - Absolute path to the file.
 * @param {any} defaultValue - Value to return if file doesn't exist.
 * @returns {any} The decrypted JSON content.
 */
export const readEncryptedJson = (filePath, defaultValue = {}) => {
    try {
        if (!fs.existsSync(filePath)) return defaultValue;
        const rawContent = fs.readFileSync(filePath);
        const fileContent = rawContent.toString('utf8').trim();

        // 1. Backwards compatibility: if it starts with '{' or '[', parse as raw JSON
        if (fileContent.startsWith('{') || fileContent.startsWith('[')) {
            return JSON.parse(fileContent);
        }

        // 2. Try AES decryption with current machine key
        try {
            const decrypted = decryptAes(fileContent, true, AES_KEY);
            return JSON.parse(decrypted);
        } catch (aesErr) {
            // Not current key, proceed to check old legacy key
        }

        // 3. Fallback: try AES decryption with old legacy key and auto-migrate file
        try {
            const legacyDecrypted = decryptAes(fileContent, true, LEGACY_KEY);
            const parsed = JSON.parse(legacyDecrypted);
            // Seamless auto-migration to new machine key
            try {
                writeEncryptedJson(filePath, parsed, true);
            } catch {}
            return parsed;
        } catch (legacyErr) {
            // Not old AES either
        }

        // 4. Fallback to legacy XOR decryption
        const decryptedDataXor = xorTransform(rawContent).toString('utf8');
        if (decryptedDataXor.startsWith('{') || decryptedDataXor.startsWith('[')) {
            return JSON.parse(decryptedDataXor);
        }

        throw new Error('Unsupported or corrupt encryption format');
    } catch (err) {
        console.error(`Vault Read Error [${path.basename(filePath)}]:`, err.message);
        return defaultValue;
    }
};

/**
 * Writes a JSON object to a file with AES encryption.
 * @param {string} filePath - Absolute path to the file.
 * @param {any} data - The object to encrypt and save.
 * @param {boolean} [shouldEncrypt=false] - When true, forces AES encryption regardless of the global bypass flag; when false, follows bypass.
 */
export const writeEncryptedJson = (filePath, data, shouldEncrypt = false) => {
    try {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const jsonData = JSON.stringify(data, null, 2);
        const encrypted = encryptAes(jsonData, shouldEncrypt, AES_KEY);
        fs.writeFileSync(filePath, encrypted, 'utf8');
    } catch (err) {
        console.error(`Vault Write Error [${path.basename(filePath)}]:`, err.message);
    }
};

// Aliases for clean backward compatibility referencing
export const readAesEncryptedJson = readEncryptedJson;
export const writeAesEncryptedJson = writeEncryptedJson;
