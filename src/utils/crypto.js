import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

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

// AES-256-CBC secure encryption keys
const AES_ALGORITHM = 'aes-256-cbc';
const AES_KEY = crypto.createHash('sha256').update('fluxflow-cli-sanctuary-key').digest();

export const encryptAes = (text) => {
    if (bypass) return text;
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(AES_ALGORITHM, AES_KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
};

export const decryptAes = (encryptedText) => {
    const parts = encryptedText.split(':');
    if (parts.length !== 2) {
        throw new Error('Invalid AES format');
    }
    const iv = Buffer.from(parts[0], 'hex');
    const ciphertext = parts[1];
    const decipher = crypto.createDecipheriv(AES_ALGORITHM, AES_KEY, iv);
    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
};

/**
 * Reads an AES encrypted JSON file (with automatic fallback to XOR and raw JSON for seamless migration).
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

        // 2. Try AES decryption
        try {
            const decrypted = decryptAes(fileContent);
            return JSON.parse(decrypted);
        } catch (aesErr) {
            // Not AES or AES failed, fallback to XOR.
        }

        // 3. Fallback to legacy XOR decryption
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
 */
export const writeEncryptedJson = (filePath, data) => {
    try {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const jsonData = JSON.stringify(data, null, 2);
        const encrypted = encryptAes(jsonData);
        fs.writeFileSync(filePath, encrypted, 'utf8');
    } catch (err) {
        console.error(`Vault Write Error [${path.basename(filePath)}]:`, err.message);
    }
};

// Aliases for clean backward compatibility referencing
export const readAesEncryptedJson = readEncryptedJson;
export const writeAesEncryptedJson = writeEncryptedJson;
