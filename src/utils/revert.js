import fs from 'fs-extra';
import path from 'path';
import { BACKUPS_DIR, LEDGER_FILE, ACTIVE_TX_FILE } from './paths.js';
import { readEncryptedJson, writeEncryptedJson, encryptAes, decryptAes } from './crypto.js';

fs.ensureDirSync(BACKUPS_DIR);

let currentTransaction = null;

/**
 * Helper to perform a single restoration attempt for a file.
 */
async function performRestoration(change, tx) {
    try {
        if (change.type === 'create') {
            if (await fs.pathExists(change.filePath)) {
                // Ensure we have permission to delete
                await fs.chmod(change.filePath, 0o666).catch(() => {});
                await fs.remove(change.filePath);
            }
        } else if (change.type === 'update') {
            if (!change.backupFile) return;
            const backupPath = path.join(BACKUPS_DIR, tx.chatId, change.backupFile);
            if (await fs.pathExists(backupPath)) {
                const encrypted = await fs.readFile(backupPath, 'utf8');
                const decrypted = decryptAes(encrypted);
                
                // Ensure we have permission to overwrite
                if (await fs.pathExists(change.filePath)) {
                    await fs.chmod(change.filePath, 0o666).catch(() => {});
                }
                
                await fs.writeFile(change.filePath, decrypted, 'utf8');
            } else {
                console.warn(`[RevertManager] Backup file missing: ${backupPath}`);
            }
        }
    } catch (err) {
        throw new Error(`Restoration failed for ${path.basename(change.filePath)}: ${err.message}`);
    }
}

/**
 * Retries file restoration with exponential backoff.
 */
async function restoreWithRetry(change, tx, maxAttempts = 7) {
    let attempt = 0;
    while (attempt < maxAttempts) {
        try {
            await performRestoration(change, tx);
            return true;
        } catch (err) {
            attempt++;
            if (attempt >= maxAttempts) {
                console.error(`[RevertManager] Permanent failure: ${change.filePath}. ${err.message}`);
                return false;
            }
            const delay = Math.min(100 * Math.pow(2, attempt - 1), 5000);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    return false;
}

export const RevertManager = {
    async startTransaction(chatId, promptText) {
        currentTransaction = {
            id: `tx_prompt_${Date.now()}`,
            chatId,
            timestamp: new Date().toISOString(),
            prompt: promptText.trim(),
            changes: [],
            reverted: false
        };
        writeEncryptedJson(ACTIVE_TX_FILE, currentTransaction);
    },

    async recordFileChange(absolutePath, forcedContent = null) {
        if (!currentTransaction) return;
        try {
            const alreadyBackedUp = currentTransaction.changes.some(c => c.filePath === absolutePath);
            if (alreadyBackedUp) return;

            const fileExists = await fs.pathExists(absolutePath);
            let type = (fileExists || forcedContent) ? 'update' : 'create';
            let backupFile = null;

            if (type === 'update') {
                const fileName = path.basename(absolutePath);
                backupFile = `${currentTransaction.id}_${fileName}.bak`;
                const chatBackupDir = path.join(BACKUPS_DIR, currentTransaction.chatId);
                await fs.ensureDir(chatBackupDir);
                const backupPath = path.join(chatBackupDir, backupFile);

                let content = forcedContent !== null ? forcedContent : await fs.readFile(absolutePath, 'utf8').catch(() => null);
                if (content !== null) {
                    writeEncryptedJson(backupPath, { data: encryptAes(content) }); // Nested for extra safety
                } else {
                    type = 'create';
                    backupFile = null;
                }
            }

            currentTransaction.changes.push({ filePath: absolutePath, type, backupFile });
            writeEncryptedJson(ACTIVE_TX_FILE, currentTransaction);
        } catch (err) {}
    },

    async commitTransaction() {
        if (!currentTransaction) return;
        try {
            const ledger = readEncryptedJson(LEDGER_FILE, []);
            ledger.push(currentTransaction);
            if (ledger.length > 512000) {
                const removed = ledger.shift();
                if (removed.changes) {
                    for (const change of removed.changes) {
                        if (change.backupFile) {
                            await fs.remove(path.join(BACKUPS_DIR, removed.chatId, change.backupFile)).catch(() => {});
                        }
                    }
                }
            }
            writeEncryptedJson(LEDGER_FILE, ledger);
            await fs.remove(ACTIVE_TX_FILE).catch(() => {});
        } catch (err) {} finally {
            currentTransaction = null;
        }
    },

    async recoverCrashedTransaction() {
        try {
            if (await fs.pathExists(ACTIVE_TX_FILE)) {
                const orphanedTx = readEncryptedJson(ACTIVE_TX_FILE, null);
                if (orphanedTx?.changes?.length > 0) {
                    const ledger = readEncryptedJson(LEDGER_FILE, []);
                    if (!ledger.some(t => t.id === orphanedTx.id)) {
                        ledger.push(orphanedTx);
                        writeEncryptedJson(LEDGER_FILE, ledger);
                    }
                }
                await fs.remove(ACTIVE_TX_FILE).catch(() => {});
            }
        } catch (e) {}
    },

    async rollbackToBefore(txId) {
        let ledger = readEncryptedJson(LEDGER_FILE, null);
        if (!ledger) throw new Error('No transaction ledger found.');

        const targetIndex = ledger.findIndex(t => t.id === txId);
        if (targetIndex === -1) throw new Error(`Transaction [${txId}] not found.`);

        const chatId = ledger[targetIndex].chatId;
        const targetPrompt = ledger[targetIndex].prompt;

        // Collect all transactions to revert for this chat in reverse order
        const toRevert = ledger
            .slice(targetIndex)
            .filter(t => t.chatId === chatId && !t.reverted)
            .reverse();

        console.log(`[RevertManager] Starting sequential rollback of ${toRevert.length} transactions...`);

        for (const tx of toRevert) {
            // 1. Restore files for this specific transaction
            for (const change of [...tx.changes].reverse()) {
                await restoreWithRetry(change, tx);
            }

            // 2. Immediate cleanup of backups for this transaction
            for (const change of tx.changes) {
                if (change.backupFile) {
                    const backupPath = path.join(BACKUPS_DIR, tx.chatId, change.backupFile);
                    await fs.remove(backupPath).catch(() => {});
                }
            }

            // 3. Update the Ledger on disk IMMEDIATELY (Checkpoint)
            // This ensures if we crash, we don't double-revert or lose track.
            ledger = ledger.filter(t => t.id !== tx.id);
            writeEncryptedJson(LEDGER_FILE, ledger);
        }

        return { success: true, chatId, targetPrompt };
    },

    async getChatHistory(chatId) {
        try {
            const ledger = readEncryptedJson(LEDGER_FILE, []);
            return ledger.filter(t => t.chatId === chatId && !t.reverted);
        } catch (e) { return []; }
    },

    async deleteChatBackups(chatId) {
        try {
            await fs.remove(path.join(BACKUPS_DIR, chatId));
            let ledger = readEncryptedJson(LEDGER_FILE, []);
            const clean = ledger.filter(t => t.chatId !== chatId);
            if (ledger.length !== clean.length) writeEncryptedJson(LEDGER_FILE, clean);
        } catch (e) {}
    }
};
