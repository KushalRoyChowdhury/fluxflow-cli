import fs from 'fs-extra';
import path from 'path';
import { nanoid } from 'nanoid';
import { readEncryptedJson, writeEncryptedJson } from './crypto.js';
import { HISTORY_FILE, HISTORY_DIR, TEMP_MEM_FILE, TEMP_MEM_CHAT_FILE, CONTEXT_FILE } from './paths.js';
import { RevertManager } from './revert.js';

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
 * Structure of history.json (Index metadata only, no messages):
 * {
 *   "chat-id-1": { name: "Fixing Auth", timestamp: 12345 },
 *   "chat-id-2": { name: "Refactor UI", timestamp: 12347 }
 * }
 */

export const loadHistory = async () => {
    await fs.ensureDir(HISTORY_DIR);
    let history = {};
    if (await fs.pathExists(HISTORY_FILE)) {
        try {
            history = readEncryptedJson(HISTORY_FILE, {});
        } catch (e) {
            history = {};
        }
    }

    // Add dynamic getter/setter for transparent lazy-loading compatibility
    for (const id in history) {
        const chatFile = path.join(HISTORY_DIR, `${id}.json`);
        Object.defineProperty(history[id], 'messages', {
            get: () => {
                if (fs.existsSync(chatFile)) {
                    try {
                        return readEncryptedJson(chatFile, []);
                    } catch (e) {
                        return [];
                    }
                }
                return [];
            },
            set: (msgs) => {
                try {
                    writeEncryptedJson(chatFile, msgs);
                } catch (e) {}
            },
            enumerable: false,
            configurable: true
        });
    }
    return history;
};

export const saveChat = async (id, name, messages) => {
    return withLock(async () => {
        await fs.ensureDir(HISTORY_DIR);
        const history = await loadHistory();
        const existingChat = history[id];

        // [CLEANUP] Filter out ephemeral messages (like update notices or transient meta alerts)
        let persistentMessages = (messages || []).filter(m =>
            !m.isUpdateNotification &&
            (!m.isMeta || (m.text && m.text.includes('Request Cancelled')))
        );

        // Compute prompt from user messages, stripping timestamp metadata and steering hint tags
        const extractPrompt = (msg) => {
            if (!msg) return undefined;
            const rawText = typeof msg === 'string' ? msg : (msg.text || msg.content || '');
            if (!rawText || typeof rawText !== 'string') return undefined;

            let text = rawText
                .replace(/\s*\n+\s*\[Prompted on:.*?\]/g, '')
                .replace(/\[\/?(?:STEERING HINT|QUESTION)(?::\s*\w+)?\]/gi, '')
                .trim();

            if (!text) return undefined;

            const words = text.split(/\s+/);
            let prompt = undefined;
            if (words.length > 7) {
                prompt = words.slice(0, 7).join(' ') + '...';
            } else if (text.length > 45) {
                prompt = text.substring(0, 45).trimEnd() + '...';
            } else {
                prompt = text;
            }
            return prompt;
        };

        let prompt = undefined;
        const userMessages = persistentMessages.filter(m => m.role === 'user');
        const firstUserMsg = userMessages[0];
        const latestUserMsg = userMessages[userMessages.length - 1];

        const extractedLatest = extractPrompt(latestUserMsg);
        const extractedFirst = extractPrompt(firstUserMsg);

        if (existingChat && existingChat.prompt) {
            // Gacha: 30% chance to update prompt with latest user prompt if valid, otherwise retain existing
            if (Math.random() < 0.30 && extractedLatest) {
                prompt = extractedLatest;
            } else {
                prompt = existingChat.prompt;
            }
        } else {
            // First save: lock onto the very first user prompt (or latest if first missing)
            prompt = extractedFirst || extractedLatest;
        }

        // Defensive name selection:
        // 1. Provided name
        // 2. Existing name on disk
        // 3. Default fallback to Session ID
        const finalName = name || (existingChat ? existingChat.name : `Session ${id.slice(-6)}`);

        // Save the history to the separate chat file
        const chatFile = path.join(HISTORY_DIR, `${id}.json`);
        writeEncryptedJson(chatFile, persistentMessages);

        // Keep index clean (no inline messages stored in index)
        history[id] = {
            name: finalName,
            prompt: prompt || undefined,
            updatedAt: Date.now()
        };

        // Write index only
        const indexHistory = {};
        for (const chatId in history) {
            indexHistory[chatId] = {
                name: history[chatId].name,
                prompt: history[chatId].prompt || undefined,
                updatedAt: history[chatId].updatedAt
            };
        }
        writeEncryptedJson(HISTORY_FILE, indexHistory);
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
            history[id] = { name: title, updatedAt: Date.now() };
        }

        // Write index only (preserve any existing prompt)
        const indexHistory = {};
        for (const chatId in history) {
            indexHistory[chatId] = {
                name: history[chatId].name,
                prompt: history[chatId].prompt || undefined,
                updatedAt: history[chatId].updatedAt
            };
        }
        writeEncryptedJson(HISTORY_FILE, indexHistory);
    });
};

export const deleteChat = async (id) => {
    return withLock(async () => {
        const history = await loadHistory();
        delete history[id];

        // Write index only (preserve prompt)
        const indexHistory = {};
        for (const chatId in history) {
            indexHistory[chatId] = {
                name: history[chatId].name,
                prompt: history[chatId].prompt || undefined,
                updatedAt: history[chatId].updatedAt
            };
        }
        writeEncryptedJson(HISTORY_FILE, indexHistory);

        // Also clean up context.json
        if (await fs.pathExists(CONTEXT_FILE)) {
            try {
                const contextData = readEncryptedJson(CONTEXT_FILE, []);
                if (Array.isArray(contextData)) {
                    const filtered = contextData.filter(item => Object.keys(item)[0] !== String(id));
                    writeEncryptedJson(CONTEXT_FILE, filtered);
                }
            } catch (e) {}
        }

        // Also clean up temp memory if it exists
        const temp = readEncryptedJson(TEMP_MEM_FILE, {});
        if (temp[id]) {
            delete temp[id];
            writeEncryptedJson(TEMP_MEM_FILE, temp);
        }

        // Also clean up temp memory cache if it exists
        const cache = readEncryptedJson(TEMP_MEM_CHAT_FILE, {});
        if (cache[id]) {
            delete cache[id];
            writeEncryptedJson(TEMP_MEM_CHAT_FILE, cache);
        }

        // Clean up backups and transaction records
        await RevertManager.deleteChatBackups(id);

        // Clean up the individual chat history file
        const chatFile = path.join(HISTORY_DIR, `${id}.json`);
        if (await fs.pathExists(chatFile)) {
            try {
                await fs.remove(chatFile);
            } catch (e) {}
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
 * No-op: Log purging has been removed so error and debug logs are retained permanently.
 */
// export const cleanupOldLogs = async () => {};

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
export const saveChatContext = async (chatId, chatTokens, contextTokens) => {
    return withLock(async () => {
        let contextData = readEncryptedJson(CONTEXT_FILE, []);
        if (!Array.isArray(contextData)) contextData = [];

        const total = chatTokens || 0;
        const context = contextTokens || 0;
        const data = { total, context };

        const existingIdx = contextData.findIndex(item => Object.keys(item)[0] === String(chatId));
        if (total === 0 && context === 0) {
            // If entry is empty (0/0), remove it
            if (existingIdx !== -1) {
                contextData.splice(existingIdx, 1);
            }
        } else {
            if (existingIdx !== -1) {
                contextData[existingIdx] = { [String(chatId)]: data };
            } else {
                contextData.push({ [String(chatId)]: data });
            }
        }

        // Prune any legacy or existing entries that are 0 / empty
        const cleaned = contextData.filter(item => {
            if (!item || typeof item !== 'object') return false;
            const key = Object.keys(item)[0];
            if (!key) return false;
            const val = item[key];
            return val && ((val.total || 0) > 0 || (val.context || 0) > 0);
        });

        writeEncryptedJson(CONTEXT_FILE, cleaned);
    });
};

export const loadChatContext = async (chatId) => {
    try {
        if (!(await fs.pathExists(CONTEXT_FILE))) return { total: 0, context: 0 };
        const contextData = readEncryptedJson(CONTEXT_FILE, []);
        if (!Array.isArray(contextData)) return { total: 0, context: 0 };
        const entry = contextData.find(item => Object.keys(item)[0] === String(chatId));
        return entry ? { total: 0, context: 0, ...entry[String(chatId)] } : { total: 0, context: 0 };
    } catch (e) {
        return { total: 0, context: 0 };
    }
};
