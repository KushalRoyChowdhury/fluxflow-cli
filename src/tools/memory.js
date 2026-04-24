import { readEncryptedJson, writeEncryptedJson } from '../utils/crypto.js';
import { TEMP_MEM_FILE, MEMORIES_FILE } from '../utils/paths.js';

/**
 * Memory tool for the agent and janitor.
 * Supports temporary chat context and persistent user memories.
 */
export const memory = async (rawArgs, context = {}) => {
    // Parser for named arguments: key='value' or key="value"
    const parseArg = (key) => {
        // More robust regex that matches until a quote is found followed by a boundary (comma, space, or end)
        // This allows single quotes inside values (e.g., content='The user's hobby')
        const regex = new RegExp(`${key}\\s*=\\s*(["'])(.*?)\\1(?=\\s*[,)]|\\s+\\w+\\s*=|$)`, 's');
        const match = rawArgs.match(regex);
        return match ? match[2].trim() : null;
    };

    const action = parseArg('action');
    const method = parseArg('method');
    const content = parseArg('content');
    const contentNew = parseArg('content-new');
    const contentOld = parseArg('content-old');

    // Prioritize context-provided chatId (supporting both naming conventions) to avoid 'default-session'
    const chatId = parseArg('chat-id') || context.chatId || context.sessionId || 'default-session';

    if (action === 'temp') {
        if (!content) return "ERROR: Missing 'content' for temp memory.";

        const tempStorage = readEncryptedJson(TEMP_MEM_FILE, {});
        if (!tempStorage[chatId]) tempStorage[chatId] = [];

        // LIMIT CHECK: Combined length should not exceed 3000 * 4 = 12000 chars
        const MAX_CHARS = 3000 * 4;
        let currentTotalLength = tempStorage[chatId].reduce((acc, m) => acc + m.length, 0);

        // Prune oldest until there is room for the new content
        while (tempStorage[chatId].length > 0 && (currentTotalLength + content.length) > MAX_CHARS) {
            const removed = tempStorage[chatId].shift();
            currentTotalLength -= removed.length;
        }

        tempStorage[chatId].push(content);
        writeEncryptedJson(TEMP_MEM_FILE, tempStorage);

        return `SUCCESS: Temporary context saved for session [${chatId}]. (Size: ${currentTotalLength + content.length} chars)`;
    }

    if (action === 'user') {
        const memories = readEncryptedJson(MEMORIES_FILE, []);

        if (method === 'add') {
            if (!content) return "ERROR: Missing 'content' for memory addition.";

            // LIMIT CHECK: Combined length should not exceed 2000 * 4 = 8000 chars
            const MAX_CHARS = 2000 * 4;
            let currentTotalLength = memories.reduce((acc, m) => acc + (m.memory?.length || 0), 0);

            // Prune oldest until there is room
            while (memories.length > 0 && (currentTotalLength + content.length) > MAX_CHARS) {
                const removed = memories.shift();
                currentTotalLength -= (removed.memory?.length || 0);
            }

            const newMemory = { id: `mem-${Date.now().toString(36)}`, memory: content };
            memories.push(newMemory);
            writeEncryptedJson(MEMORIES_FILE, memories);
            return `SUCCESS: Memory added with ID [${newMemory.id}]. (Vault Size: ${currentTotalLength + content.length} chars)`;
        }

        if (method === 'update') {
            const memId = contentOld;
            const newText = contentNew;
            if (!memId || !newText) return "ERROR: Missing 'content-old' (id) or 'content-new' for update.";
            const index = memories.findIndex(m => m.id === memId);
            if (index === -1) return `ERROR: Memory ID [${memId}] not found.`;

            memories[index].memory = newText;
            writeEncryptedJson(MEMORIES_FILE, memories);
            return `SUCCESS: Memory [${memId}] updated.`;
        }

        if (method === 'delete') {
            const memId = content;
            if (!memId) return "ERROR: Missing 'content' (id) for deletion.";
            const initialLen = memories.length;
            const updatedMemories = memories.filter(m => m.id !== memId);
            if (updatedMemories.length === initialLen) return `ERROR: Memory ID [${memId}] not found.`;

            writeEncryptedJson(MEMORIES_FILE, updatedMemories);
            return `SUCCESS: Memory [${memId}] deleted.`;
        }

        return `ERROR: Invalid method [${method}] for user memory. Use 'add', 'update', or 'delete'.`;
    }

    return `ERROR: Unknown action [${action}] for memory tool.`;
};
