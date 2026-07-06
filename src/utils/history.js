import fs from 'fs-extra';
import path from 'path';
import { nanoid } from 'nanoid';
import { readEncryptedJson, writeEncryptedJson } from './crypto.js';
import { HISTORY_FILE, HISTORY_DIR, TEMP_MEM_FILE, TEMP_MEM_CHAT_FILE, CONTEXT_FILE } from './paths.js';
import { RevertManager } from './revert.js';
import { loadSettings } from './settings.js';

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
        // These should only exist in the live UI session.
        let persistentMessages = (messages || []).filter(m =>
            !m.isUpdateNotification &&
            (!m.isMeta || (m.text && m.text.includes('Request Cancelled')))
        );

        // [PRESERVE THINKING] Strip think-role entries when the setting is disabled.
        try {
            const settings = await loadSettings();
            if (settings.systemSettings?.preserveThinking === false) {
                persistentMessages = persistentMessages.filter(m => m.role !== 'think');
            }
        } catch (e) { }

        // Defensive name selection:
        // 1. Provided name
        // 2. Existing name on disk
        // 3. Fallback to unique ID suffix
        const finalName = name || (existingChat ? existingChat.name : `Session ${id.slice(-6)}`);

        // Save the messages to the separate chat file
        const chatFile = path.join(HISTORY_DIR, `${id}.json`);
        writeEncryptedJson(chatFile, persistentMessages);

        // Keep index clean (no inline messages stored in index)
        history[id] = {
            name: finalName,
            updatedAt: Date.now()
        };

        // Write index only
        const indexHistory = {};
        for (const chatId in history) {
            indexHistory[chatId] = {
                name: history[chatId].name,
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

        // Write index only
        const indexHistory = {};
        for (const chatId in history) {
            indexHistory[chatId] = {
                name: history[chatId].name,
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

        // Write index only
        const indexHistory = {};
        for (const chatId in history) {
            indexHistory[chatId] = {
                name: history[chatId].name,
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
 * Helper to parse custom timestamp strings from logs robustly
 */
const parseCustomDate = (dateStr) => {
    const cleanStr = dateStr.replace(/[\[\]]/g, '').trim();
    const parsed = new Date(cleanStr);
    if (!isNaN(parsed.getTime())) return parsed.getTime();

    const parts = cleanStr.split(/,\s*|\s+/);
    if (parts.length === 0) return null;

    const datePart = parts[0];
    const timePart = parts[1] || "";
    const ampm = parts[2] || "";

    const dateNums = datePart.split(/[-/.]/).map(Number);
    if (dateNums.length !== 3) return null;

    let year, month, day;
    if (dateNums[0] > 1000) {
        year = dateNums[0];
        month = dateNums[1];
        day = dateNums[2];
    } else if (dateNums[2] > 1000) {
        year = dateNums[2];
        if (dateNums[0] > 12) {
            day = dateNums[0];
            month = dateNums[1];
        } else if (dateNums[1] > 12) {
            day = dateNums[1];
            month = dateNums[0];
        } else {
            month = dateNums[0];
            day = dateNums[1];
        }
    } else {
        return null;
    }

    let hours = 0, minutes = 0, seconds = 0;
    if (timePart) {
        const timeNums = timePart.split(':').map(Number);
        hours = timeNums[0] || 0;
        minutes = timeNums[1] || 0;
        seconds = timeNums[2] || 0;

        if (ampm.toLowerCase() === 'pm' && hours < 12) {
            hours += 12;
        } else if (ampm.toLowerCase() === 'am' && hours === 12) {
            hours = 0;
        }
    }

    const d = new Date(year, month - 1, day, hours, minutes, seconds);
    return isNaN(d.getTime()) ? null : d.getTime();
};

/**
 * Parses and filters out log entries older than 7 days from inside a single log file
 */
const cleanupLogFile = async (filePath) => {
    try {
        if (!await fs.pathExists(filePath)) return;
        const content = await fs.readFile(filePath, 'utf8');
        if (!content.trim()) return;

        const lines = content.split('\n');
        const entries = [];
        let currentEntry = null;
        const entryStartRegex = /^\s*(?:DEBUG|ERROR|SEARCH|PUPPETEER)\b/i;

        for (const line of lines) {
            if (entryStartRegex.test(line)) {
                if (currentEntry) {
                    entries.push(currentEntry);
                }
                currentEntry = { header: line, body: [] };
            } else {
                if (currentEntry) {
                    currentEntry.body.push(line);
                } else {
                    entries.push({ header: line, body: [] });
                }
            }
        }
        if (currentEntry) {
            entries.push(currentEntry);
        }

        const threshold = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
        const now = Date.now();
        const keptEntries = [];
        const timestampRegex = /(\d{1,4}[-/.]\d{1,4}[-/.]\d{1,4}(?:,\s*|\s+)?(?:\d{1,2}:\d{2}:\d{2}(?:\s*[aApP][mM])?)?)/;

        for (const entry of entries) {
            const entryText = entry.header + (entry.body.length > 0 ? '\n' + entry.body.join('\n') : '');
            const match = entryText.match(timestampRegex);

            if (match) {
                const timeMs = parseCustomDate(match[1]);
                if (timeMs && (now - timeMs) > threshold) {
                    // Expired entry - skip writing it back
                    continue;
                }
            }
            keptEntries.push(entryText);
        }

        // If all entries are filtered out or empty, we can clean/truncate the file
        const finalContent = keptEntries.join('\n').trim();
        if (finalContent) {
            await fs.writeFile(filePath, finalContent + '\n', 'utf8');
        } else {
            await fs.writeFile(filePath, '', 'utf8');
        }
    } catch (e) {
        // Silent catch for log file processing errors
    }
};

/**
 * Recursively cleans up old log entries within log files and deletes empty directories
 */
export const cleanupOldLogs = async (logsDir) => {
    try {
        if (!await fs.pathExists(logsDir)) return;

        const cleanRecursive = async (dir) => {
            const files = await fs.readdir(dir);
            for (const file of files) {
                const fullPath = path.join(dir, file);
                const stat = await fs.stat(fullPath);

                if (stat.isDirectory()) {
                    await cleanRecursive(fullPath);
                    // Remove directory if empty after file pruning
                    const subFiles = await fs.readdir(fullPath);
                    if (subFiles.length === 0) {
                        await fs.remove(fullPath);
                    }
                } else if (file.endsWith('.log')) {
                    await cleanupLogFile(fullPath);
                }
            }
        };

        await cleanRecursive(logsDir);
    } catch (e) {
        // Silent catch to prevent startup disruption
    }
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
export const saveChatContext = async (chatId, chatTokens, contextTokens) => {
    return withLock(async () => {
        let contextData = readEncryptedJson(CONTEXT_FILE, []);
        if (!Array.isArray(contextData)) contextData = [];

        const data = { total: chatTokens, context: contextTokens };
        const existingIdx = contextData.findIndex(item => Object.keys(item)[0] === String(chatId));
        if (existingIdx !== -1) {
            contextData[existingIdx] = { [String(chatId)]: data };
        } else {
            contextData.push({ [String(chatId)]: data });
        }

        writeEncryptedJson(CONTEXT_FILE, contextData);
    });
};

export const loadChatContext = async (chatId) => {
    try {
        if (!(await fs.pathExists(CONTEXT_FILE))) return { total: 0, context: 0 };
        const contextData = readEncryptedJson(CONTEXT_FILE, []);
        if (!Array.isArray(contextData)) return { total: 0, context: 0 };
        const entry = contextData.find(item => Object.keys(item)[0] === String(chatId));
        return entry ? entry[String(chatId)] : { total: 0, context: 0 };
    } catch (e) {
        return { total: 0, context: 0 };
    }
};
