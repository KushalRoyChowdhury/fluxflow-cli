import { readEncryptedJson, writeEncryptedJson } from '../utils/crypto.js';
import { TEMP_MEM_FILE, MEMORIES_FILE } from '../utils/paths.js';

/**
 * Memory tool for the agent and janitor.
 * Supports temporary chat context and persistent user memories.
 */

const USER_MEMORY_SIZE = 4 * (1024 * 2);// Rough token estimate, 2k tokens

export const memory = async (rawArgs, context = {}) => {
    // Parser for named arguments supporting both quoted values and unquoted numbers/strings
    const parseArg = (key) => {
        const quotedRegex = new RegExp(`${key}\\s*[:=]\\s*(["'])(.*?)\\1(?=\\s*[,)]|\\s+\\w+\\s*[:=]|$)`, 's');
        const quotedMatch = rawArgs.match(quotedRegex);
        if (quotedMatch) return quotedMatch[2].trim();

        const unquotedRegex = new RegExp(`${key}\\s*[:=]\\s*([^,\\s)]+)`, 's');
        const unquotedMatch = rawArgs.match(unquotedRegex);
        if (unquotedMatch) return unquotedMatch[1].trim();

        return null;
    };

    const action = parseArg('action');
    const method = parseArg('method');
    const content = parseArg('content');
    const contentNew = parseArg('content-new');
    const contentOld = parseArg('content-old');
    const id = parseArg('id');

    // Prioritize context-provided chatId (supporting both naming conventions) to avoid 'default-session'
    const chatId = parseArg('chat-id') || context.chatId || context.sessionId || 'default-session';

    if (action === 'temp') {
        if (!content) return "ERROR: Missing 'content' for temp memory.";

        const tempStorage = readEncryptedJson(TEMP_MEM_FILE, {});
        if (!tempStorage[chatId]) tempStorage[chatId] = [];

        tempStorage[chatId].push(content);
        writeEncryptedJson(TEMP_MEM_FILE, tempStorage);

        const currentTotalLength = tempStorage[chatId].reduce((acc, m) => acc + m.length, 0);
        return `SUCCESS: Temporary context saved for session [${chatId}]. (Size: ${currentTotalLength} chars)`;
    }

    if (action === 'user') {
        const memories = readEncryptedJson(MEMORIES_FILE, []).map(m => {
            if (m.score === undefined) m.score = 0.5;
            return m;
        });

        if (method === 'add') {
            if (!content) return "ERROR: Missing 'content' for memory addition.";

            const now = new Date();
            const dateStr = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
            const formattedContent = content.includes('[Saved on:')
                ? content
                : `${content.trim()} [Saved on: ${dateStr}]`;

            // LIMIT CHECK
            const MAX_CHARS = USER_MEMORY_SIZE;
            let currentTotalLength = memories.reduce((acc, m) => acc + (m.memory?.length || 0), 0);

            // Prune oldest until there is room
            while (memories.length > 0 && (currentTotalLength + formattedContent.length) > MAX_CHARS) {
                const removed = memories.shift();
                currentTotalLength -= (removed.memory?.length || 0);
            }

            const scoreArg = parseArg('score');
            const initialScore = scoreArg ? parseFloat(scoreArg) : 0.5;

            const newMemory = { 
                id: `mem-${Date.now().toString(36)}`, 
                memory: formattedContent,
                score: Math.min(2.0, isNaN(initialScore) ? 0.5 : initialScore)
            };
            memories.push(newMemory);
            writeEncryptedJson(MEMORIES_FILE, memories);
            return `SUCCESS: Memory added with ID [${newMemory.id}] and score [${newMemory.score}]. (Vault Size: ${currentTotalLength + formattedContent.length} chars)`;
        }

        if (method === 'update') {
            const memId = id || contentOld;
            const newText = contentNew || content;
            if (!memId || !newText) return "ERROR: Missing 'id' or content for update.";
            const index = memories.findIndex(m => m.id === memId);
            if (index === -1) return `ERROR: Memory ID [${memId}] not found.`;

            const now = new Date();
            const dateStr = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
            const formattedText = newText.includes('[Saved on:')
                ? newText
                : `${newText.trim()} [Saved on: ${dateStr}]`;

            memories[index].memory = formattedText;
            writeEncryptedJson(MEMORIES_FILE, memories);
            return `SUCCESS: Memory [${memId}] updated.`;
        }

        if (method === 'delete') {
            const memId = id || content;
            if (!memId) return "ERROR: Missing 'id' for deletion.";
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
