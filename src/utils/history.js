import fs from 'fs-extra';
import path from 'path';
import { nanoid } from 'nanoid';
import { HISTORY_FILE, TEMP_MEM_FILE } from './paths.js';

// HIGH-FIDELITY PERSISTENCE LOCK (Prevents race conditions between foreground and janitor)
let WRITE_LOCK = Promise.resolve();

const withLock = (op) => {
    const nextLock = WRITE_LOCK.then(async () => {
        try {
            return await op();
        } catch (e) {
            console.error("Lock Operation Failed:", e);
            throw e; // Propagate to caller
        }
    });
    // Update the lock chain, ensuring we don't block the next op even if this one fails
    WRITE_LOCK = nextLock.catch(() => {}); 
    return nextLock;
};

/**
 * Structure of history.json:
 * {
 *   "chat-id-1": { name: "Fixing Auth", messages: [...], timestamp: 12345 },
 *   "chat-id-2": { name: "Refactor UI", messages: [...], timestamp: 12347 }
 * }
 */

export const loadHistory = async () => {
    if (await fs.pathExists(HISTORY_FILE)) {
        try {
            return await fs.readJson(HISTORY_FILE);
        } catch (e) {
            return {};
        }
    }
    return {};
};

export const saveChat = async (id, name, messages) => {
    return withLock(async () => {
        const history = await loadHistory();
        const existingChat = history[id];
        
        // Defensive name selection: 
        // 1. Provided name
        // 2. Existing name on disk
        // 3. Fallback to unique ID suffix
        const finalName = name || (existingChat ? existingChat.name : `Session ${id.slice(-6)}`);

        history[id] = {
            name: finalName,
            messages,
            updatedAt: Date.now()
        };
        await fs.ensureDir(path.dirname(HISTORY_FILE));
        await fs.writeJson(HISTORY_FILE, history, { spaces: 2 });
    });
};

/**
 * Surgically updates ONLY the title of a chat, preserving messages.
 */
export const saveChatTitle = async (id, title) => {
    return withLock(async () => {
        const history = await loadHistory();
        if (history[id]) {
            history[id].name = title;
            history[id].updatedAt = Date.now();
        } else {
            // Janitor often runs BEFORE the main app's first save — create a skeleton entry
            history[id] = { name: title, messages: [], updatedAt: Date.now() };
        }
        await fs.ensureDir(path.dirname(HISTORY_FILE));
        await fs.writeJson(HISTORY_FILE, history, { spaces: 2 });
    });
};

export const deleteChat = async (id) => {
    return withLock(async () => {
        const history = await loadHistory();
        delete history[id];
        await fs.writeJson(HISTORY_FILE, history, { spaces: 2 });

        // Also clean up temp memory if it exists
        if (await fs.pathExists(TEMP_MEM_FILE)) {
            try {
                const temp = await fs.readJson(TEMP_MEM_FILE);
                if (temp[id]) {
                    delete temp[id];
                    await fs.writeJson(TEMP_MEM_FILE, temp, { spaces: 2 });
                }
            } catch (e) {
                // Ignore if temp file is encrypted/unreadable for now
            }
        }
        return history;
    });
};

export const generateChatId = () => `flow-${nanoid(6)}`;

export const cleanupOldHistory = async (retentionSetting) => {
    if (!retentionSetting || retentionSetting === 'Never') return;

    const days = parseInt(retentionSetting);
    if (isNaN(days)) return;

    const history = await loadHistory();
    const now = Date.now();
    const threshold = days * 24 * 60 * 60 * 1000;

    let deletedCount = 0;
    for (const id in history) {
        const chat = history[id];
        if (chat.updatedAt && (now - chat.updatedAt) > threshold) {
            await deleteChat(id);
            deletedCount++;
        }
    }
    return deletedCount;
};

/**
 * Returns a new history array with the oldest X exchanges removed.
 * Skip welcome message at index 0.
 */
export const getTruncatedHistory = (history, exchangesToRemove = 4) => {
    if (history.length <= 1) return history;
    
    const welcome = history[0];
    const rest = history.slice(1);
    
    // 1 exchange = 1 user + 1 agent turn (usually)
    // We remove 2 * exchangesToRemove messages
    const sliceIndex = exchangesToRemove * 2;
    const truncated = rest.slice(sliceIndex);
    
    return [welcome, ...truncated];
};

/**
 * Extracts a range of messages based on estimated token positions.
 * 1 token ~= 4 characters for estimation.
 */
export const getRangeByTokens = (history, startToken, endToken) => {
    let currentTokens = 0;
    const results = [];
    
    for (const msg of history) {
        const msgTokens = Math.ceil((msg.text?.length || 0) / 4);
        const nextTokens = currentTokens + msgTokens;
        
        // If message is within or partially within the token range
        if (nextTokens > startToken && currentTokens < endToken) {
            results.push(msg);
        }
        
        currentTokens = nextTokens;
        if (currentTokens >= endToken) break;
    }
    
    return results;
};
