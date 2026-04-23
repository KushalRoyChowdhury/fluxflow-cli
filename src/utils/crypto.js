import fs from 'fs';
import path from 'path';

// Simple XOR Key - In a real app, this would be more complex
const XOR_KEY = 0x42; 

const xorTransform = (data) => {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const result = Buffer.alloc(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
        result[i] = buffer[i] ^ XOR_KEY;
    }
    return result;
};

/**
 * Reads an XOR encrypted JSON file.
 * @param {string} filePath - Absolute path to the file.
 * @param {any} defaultValue - Value to return if file doesn't exist.
 * @returns {any} The decrypted JSON content.
 */
export const readEncryptedJson = (filePath, defaultValue = {}) => {
    try {
        if (!fs.existsSync(filePath)) return defaultValue;
        const encryptedData = fs.readFileSync(filePath);
        const decryptedData = xorTransform(encryptedData).toString();
        return JSON.parse(decryptedData);
    } catch (err) {
        console.error(`Vault Read Error [${path.basename(filePath)}]:`, err.message);
        return defaultValue;
    }
};

/**
 * Writes a JSON object to a file with XOR encryption.
 * @param {string} filePath - Absolute path to the file.
 * @param {any} data - The object to encrypt and save.
 */
export const writeEncryptedJson = (filePath, data) => {
    try {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        
        const jsonData = JSON.stringify(data, null, 2);
        const encryptedData = xorTransform(jsonData);
        fs.writeFileSync(filePath, encryptedData);
    } catch (err) {
        console.error(`Vault Write Error [${path.basename(filePath)}]:`, err.message);
    }
};
