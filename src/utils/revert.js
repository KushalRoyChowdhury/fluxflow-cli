import fs from 'fs-extra';
import path from 'path';
import { BACKUPS_DIR, LEDGER_FILE } from './paths.js';
import { readEncryptedJson, writeEncryptedJson, encryptAes, decryptAes } from './crypto.js';

fs.ensureDirSync(BACKUPS_DIR);

let currentTransaction = null;

export const RevertManager = {
    /**
     * Initializes a new transaction before a prompt starts processing.
     */
    async startTransaction(chatId, promptText) {
        currentTransaction = {
            id: `tx_prompt_${Date.now()}`,
            chatId,
            timestamp: new Date().toISOString(),
            prompt: promptText.trim(),
            changes: [],
            reverted: false
        };
    },

    /**
     * Records a file change under the active prompt transaction.
     */
    async recordFileChange(absolutePath, forcedContent = null) {
        if (!currentTransaction) return;

        try {
            // Prevent redundant backups of the same file in the same prompt execution
            const alreadyBackedUp = currentTransaction.changes.some(c => c.filePath === absolutePath);
            if (alreadyBackedUp) return;

            const fileExists = await fs.pathExists(absolutePath);
            let type = (fileExists && !forcedContent) ? 'update' : (forcedContent ? 'update' : 'create');
            // If file doesn't exist on disk but we have forcedContent, it's still an update (to the placeholder)
            if (!fileExists && !forcedContent) type = 'create';
            
            let backupFile = null;

            if (fileExists || forcedContent) {
                type = 'update';
                const fileName = path.basename(absolutePath);
                backupFile = `${currentTransaction.id}_${fileName}.bak`;

                // Create a sub-directory specifically for the current chat session
                const chatBackupDir = path.join(BACKUPS_DIR, currentTransaction.chatId);
                await fs.ensureDir(chatBackupDir);

                const backupPath = path.join(chatBackupDir, backupFile);

                // Use forcedContent if provided, otherwise read from disk
                let content;
                if (forcedContent !== null) {
                    content = forcedContent;
                } else {
                    try {
                        content = await fs.readFile(absolutePath, 'utf8');
                    } catch (readErr) {
                        // If we can't read it, we can't back it up as an update. 
                        // It might be locked or in transition. Treat as create if it's not critical.
                        console.warn(`[RevertManager] Could not read file for backup: ${absolutePath}. ${readErr.message}`);
                        type = 'create';
                        backupFile = null;
                    }
                }

                if (backupFile) {
                    const encrypted = encryptAes(content);
                    await fs.writeFile(backupPath, encrypted, 'utf8');
                }
            }

            currentTransaction.changes.push({
                filePath: absolutePath,
                type,
                backupFile
            });
        } catch (err) {
            console.error(`[RevertManager] Error recording file change for ${absolutePath}:`, err.message);
            // Don't throw, let the main operation proceed even if backup fails
        }
    },

    /**
     * Finalizes the transaction and saves it to ledger.json.
     */
    async commitTransaction() {
        if (!currentTransaction) return;

        // Use the secure crypto read/write routines
        const ledger = readEncryptedJson(LEDGER_FILE, []);

        ledger.push(currentTransaction);

        // Enforce the 512000 entry overall limit
        if (ledger.length > 512000) {
            const removed = ledger.shift();
            if (removed.changes) {
                for (const change of removed.changes) {
                    if (change.backupFile) {
                        const backupPath = path.join(BACKUPS_DIR, removed.chatId, change.backupFile);
                        await fs.remove(backupPath);
                    }
                }
            }
        }

        writeEncryptedJson(LEDGER_FILE, ledger);
        currentTransaction = null;
    },

    /**
     * Reverts the codebase to a state immediately before the target transaction.
     * Reverts the target transaction and all subsequent ones in reverse sequential order.
     * Returns the target prompt text so it can be loaded back into the user input.
     */
    async rollbackToBefore(txId) {
        // Read ledger using the secure AES decryption
        const ledger = readEncryptedJson(LEDGER_FILE, null);
        if (!ledger) throw new Error('No transaction ledger found.');

        const targetIndex = ledger.findIndex(t => t.id === txId);

        if (targetIndex === -1) throw new Error(`Transaction [${txId}] not found.`);

        const chatId = ledger[targetIndex].chatId;
        const targetPrompt = ledger[targetIndex].prompt;

        // Get all subsequent unreverted transactions for the SAME chat in reverse order
        const toRevert = ledger
            .slice(targetIndex)
            .filter(t => t.chatId === chatId && !t.reverted)
            .reverse();

        for (const tx of toRevert) {
            // Revert changes in reverse order
            for (const change of [...tx.changes].reverse()) {
                try {
                    if (change.type === 'create') {
                        if (await fs.pathExists(change.filePath)) {
                            await fs.remove(change.filePath);
                        }
                    } else if (change.type === 'update') {
                        // CRITICAL SAFETY: Only attempt restoration if a valid backup exists
                        if (change.backupFile) {
                            const backupPath = path.join(BACKUPS_DIR, tx.chatId, change.backupFile);
                            if (await fs.pathExists(backupPath)) {
                                // Read, decrypt and write back the restored file
                                const encrypted = await fs.readFile(backupPath, 'utf8');
                                const decrypted = decryptAes(encrypted);
                                await fs.writeFile(change.filePath, decrypted, 'utf8');
                            } else {
                                console.warn(`[RevertManager] Backup file missing: ${backupPath}`);
                            }
                        }
                    }
                } catch (err) {
                    console.error(`[RevertManager] Failed to restore ${change.filePath}:`, err.message);
                }
            }
            tx.reverted = true;
        }

        // Clean up backups for reverted transactions to save space
        for (const tx of toRevert) {
            for (const change of tx.changes) {
                if (change.backupFile) {
                    const backupPath = path.join(BACKUPS_DIR, tx.chatId, change.backupFile);
                    await fs.remove(backupPath).catch(() => {});
                }
            }
        }

        // Efficiently update ledger by removing all entries from the target index onwards 
        // that belong to this chat. Since ledger is chronological, this is safe.
        const updatedLedger = ledger.filter(t => !toRevert.some(r => r.id === t.id));
        writeEncryptedJson(LEDGER_FILE, updatedLedger);

        return {
            success: true,
            chatId,
            targetPrompt
        };
    },

    /**
     * Gets all non-reverted prompt transactions for a specific chat.
     */
    async getChatHistory(chatId) {
        try {
            const ledger = readEncryptedJson(LEDGER_FILE, []);
            return ledger.filter(t => t.chatId === chatId && !t.reverted);
        } catch (e) {
            return [];
        }
    },

    /**
     * Cleans up all transaction logs and backups associated with a deleted chat.
     */
    async deleteChatBackups(chatId) {
        try {
            // Delete entire chat-specific backups folder
            const chatBackupDir = path.join(BACKUPS_DIR, chatId);
            await fs.remove(chatBackupDir);

            // Clean up ledger entries for the chat and save encrypted
            let ledger = readEncryptedJson(LEDGER_FILE, []);
            const originalLength = ledger.length;
            ledger = ledger.filter(t => t.chatId !== chatId);
            if (ledger.length !== originalLength) {
                writeEncryptedJson(LEDGER_FILE, ledger);
            }
        } catch (e) {
            // Safe fallback
        }
    }
};
