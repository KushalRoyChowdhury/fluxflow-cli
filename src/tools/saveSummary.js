import { readEncryptedJson, writeEncryptedJson } from '../utils/crypto.js';
import { TEMP_MEM_FILE, TEMP_MEM_CHAT_FILE } from '../utils/paths.js';

/**
 * Tool to save consolidated chat summaries to the L2 on-device cache
 * and clean up the raw L1 turn memories.
 */
export const saveSummary = async (rawArgs, context = {}) => {
    const parseArg = (key) => {
        // Highly robust regex supporting colons, equals, and quote characters
        const regex = new RegExp(`${key}\\s*[:=]\\s*(["'])(.*?)\\1(?=\\s*[,)]|\\s+\\w+\\s*[:=]|$)`, 's');
        const match = rawArgs.match(regex);
        return match ? match[2].trim() : null;
    };

    const id = parseArg('id');
    const summary = parseArg('summary');

    if (!id || !summary) {
        return "ERROR: Missing 'id' or 'summary' for saveSummary tool.";
    }

    try {
        const tempStorage = readEncryptedJson(TEMP_MEM_FILE, {});
        const cacheStorage = readEncryptedJson(TEMP_MEM_CHAT_FILE, {});

        // 1. Write to L2 Cache
        cacheStorage[id] = summary;

        // 2. Delete raw entries from L1
        delete tempStorage[id];

        // 3. Persist back to files
        writeEncryptedJson(TEMP_MEM_CHAT_FILE, cacheStorage);
        writeEncryptedJson(TEMP_MEM_FILE, tempStorage);

        return `SUCCESS: Saved summary and purged raw memories for chat [${id}].`;
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return `ERROR: Failed to save summary for chat [${id}]: ${errorMsg}`;
    }
};
