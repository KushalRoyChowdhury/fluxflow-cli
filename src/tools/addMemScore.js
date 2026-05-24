import { readEncryptedJson, writeEncryptedJson } from '../utils/crypto.js';
import { MEMORIES_FILE } from '../utils/paths.js';

/**
 * Tool to adjust the relevance score of persistent user memories.
 * Adds +0.02 to the target memory, decays all others by -0.01,
 * and deletes any memories whose scores fall <= 0.
 */
export const addMemScore = async (rawArgs, context = {}) => {
    const parseArg = (key) => {
        // Robust regex supporting colons, equals, and quote characters
        const regex = new RegExp(`${key}\\s*[:=]\\s*(["'])(.*?)\\1(?=\\s*[,)]|\\s+\\w+\\s*[:=]|$)`, 's');
        const match = rawArgs.match(regex);
        return match ? match[2].trim() : null;
    };

    const id = parseArg('id');

    if (!id) {
        return "ERROR: Missing 'id' parameter for addMemScore tool.";
    }

    try {
        const memories = readEncryptedJson(MEMORIES_FILE, []);
        let found = false;
        const updatedMemories = [];

        for (const mem of memories) {
            // Ensure every memory has a score property (backwards compatibility)
            if (mem.score === undefined) {
                mem.score = 0.5;
            }

            if (mem.id === id) {
                mem.score = Math.min(2.0, mem.score + 0.2); // Big boost!
                found = true;
            } else {
                mem.score *= 0.98; // Gentle 2% decay
                if (mem.score < 0.05) mem.score = 0.0; // Time to die! (x_x)
            }

            // Precision formatting to avoid float precision issues, then filter by score > 0
            mem.score = Math.round(mem.score * 100000) / 100000;
            if (mem.score > 0) {
                updatedMemories.push(mem);
            }
        }

        writeEncryptedJson(MEMORIES_FILE, updatedMemories);

        if (!found) {
            return `WARNING: Memory ID [${id}] not found. Other memories decayed by -0.01.`;
        }

        const activeTarget = updatedMemories.find(m => m.id === id);
        const finalScoreStr = activeTarget ? activeTarget.score.toFixed(2) : 'deleted (score <= 0)';
        const deletedCount = memories.length - updatedMemories.length;

        return `SUCCESS: Adjusted memory scores. Target [${id}] is now ${finalScoreStr}.${deletedCount > 0 ? ` Purged ${deletedCount} decayed memories.` : ''}`;
    } catch (err) {
        return `ERROR: Failed to adjust memory score for [${id}]: ${err.message}`;
    }
};
