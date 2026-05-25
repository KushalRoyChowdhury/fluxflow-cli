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
    async recordFileChange(absolutePath) {
        if (!currentTransaction) return;

        // Prevent redundant backups of the same file in the same prompt execution
        const alreadyBackedUp = currentTransaction.changes.some(c => c.filePath === absolutePath);
        if (alreadyBackedUp) return;

        const fileExists = await fs.pathExists(absolutePath);
        let type = 'create';
        let backupFile = null;

        if (fileExists) {
            type = 'update';
            const fileName = path.basename(absolutePath);
            backupFile = `${currentTransaction.id}_${fileName}.bak`;

            // Create a sub-directory specifically for the current chat session
            const chatBackupDir = path.join(BACKUPS_DIR, currentTransaction.chatId);
            await fs.ensureDir(chatBackupDir);

            const backupPath = path.join(chatBackupDir, backupFile);

            // Read content, securely AES-256-CBC encrypt it, and write it to backup path
            const content = await fs.readFile(absolutePath, 'utf8');
            const encrypted = encryptAes(content);
            await fs.writeFile(backupPath, encrypted, 'utf8');
        }

        currentTransaction.changes.push({
            filePath: absolutePath,
            type,
            backupFile
        });
    },

    /**
     * Finalizes the transaction and saves it to ledger.json.
     */
    async commitTransaction() {
        if (!currentTransaction || currentTransaction.changes.length === 0) {
            currentTransaction = null;
            return;
        }

        // Use the secure crypto read/write routines
        const ledger = readEncryptedJson(LEDGER_FILE, []);

        ledger.push(currentTransaction);

        // Enforce the 500 entry overall limit
        if (ledger.length > 500) {
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
                if (change.type === 'create') {
                    if (await fs.pathExists(change.filePath)) {
                        await fs.remove(change.filePath);
                    }
                } else if (change.type === 'update') {
                    const backupPath = path.join(BACKUPS_DIR, tx.chatId, change.backupFile);
                    if (await fs.pathExists(backupPath)) {
                        // Read, decrypt and write back the restored file
                        const encrypted = await fs.readFile(backupPath, 'utf8');
                        const decrypted = decryptAes(encrypted);
                        await fs.writeFile(change.filePath, decrypted, 'utf8');
                    }
                }
            }
            tx.reverted = true;
        }

        // Clean up backups for reverted transactions to save space
        for (const tx of toRevert) {
            for (const change of tx.changes) {
                if (change.backupFile) {
                    const backupPath = path.join(BACKUPS_DIR, tx.chatId, change.backupFile);
                    await fs.remove(backupPath);
                }
            }
        }

        // Update ledger by filtering out the reverted entries and saving it encrypted
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
