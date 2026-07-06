import fs from 'fs-extra';
import path from 'path';
import { DATA_DIR, LEDGER_ADVANCE_FILE } from './paths.js';
import { readEncryptedJson, writeEncryptedJson } from './crypto.js';

const JUNK_DIRECTORIES = [
    'node_modules', 'dist', 'bin', 'logs', '.git', '.fluxflow', 'secret',
    '.gemini', '.agents', 'tmp', 'temp', 'build', 'out', 'snapshots'
];

async function scanWorkspace(dir, baseDir = dir) {
    const manifest = {};
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
        if (JUNK_DIRECTORIES.includes(entry.name)) continue;
        const fullPath = path.join(dir, entry.name);
        const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
        if (entry.isDirectory()) {
            const sub = await scanWorkspace(fullPath, baseDir);
            Object.assign(manifest, sub);
        } else {
            const stats = await fs.stat(fullPath).catch(() => null);
            if (stats) {
                manifest[relPath] = {
                    size: stats.size,
                    mtime: stats.mtimeMs
                };
            }
        }
    }
    return manifest;
}

async function copyWorkspaceFiles(destDir, manifest) {
    await fs.ensureDir(destDir);
    for (const relPath of Object.keys(manifest)) {
        const srcPath = path.join(process.cwd(), relPath);
        const destPath = path.join(destDir, relPath);
        await fs.ensureDir(path.dirname(destPath));
        await fs.copyFile(srcPath, destPath).catch(() => {});
    }
}

async function restoreSnapshotDir(srcDir, destDir, stats = null, baseDir = null) {
    if (!await fs.pathExists(srcDir)) return;
    if (!baseDir) baseDir = srcDir;
    const entries = await fs.readdir(srcDir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
        const srcPath = path.join(srcDir, entry.name);
        const destPath = path.join(destDir, entry.name);
        if (entry.isDirectory()) {
            await restoreSnapshotDir(srcPath, destPath, stats, baseDir);
        } else {
            const relPath = path.relative(baseDir, srcPath).replace(/\\/g, '/');
            const existed = await fs.pathExists(destPath);
            if (existed) {
                await fs.chmod(destPath, 0o666).catch(() => {});
            }
            await fs.ensureDir(path.dirname(destPath));
            const ok = await fs.copyFile(srcPath, destPath).then(() => true).catch(() => false);
            await fs.chmod(destPath, 0o666).catch(() => {});
            if (stats) {
                if (!ok) {
                    stats.failed.push(relPath);
                } else if (existed) {
                    stats.replaced++;
                } else {
                    stats.restored++;
                }
            }
        }
    }
}

export const AdvanceRevertManager = {
    async takeInitialSnapshot(chatId) {
        try {
            const snapshotsDir = path.join(DATA_DIR, 'snapshots', chatId);
            await fs.remove(snapshotsDir).catch(() => {});
            await fs.ensureDir(snapshotsDir);

            const manifest = await scanWorkspace(process.cwd());
            await copyWorkspaceFiles(path.join(snapshotsDir, 'initial'), manifest);

            const ledger = readEncryptedJson(LEDGER_ADVANCE_FILE, {});
            ledger[chatId] = {
                initialManifest: manifest,
                currentManifest: manifest,
                checkpoints: [
                    {
                        id: 'initial',
                        timestamp: new Date().toISOString(),
                        newFiles: [],
                        modifiedFiles: [],
                        deletedFiles: [],
                        toolsUsed: []
                    }
                ]
            };
            writeEncryptedJson(LEDGER_ADVANCE_FILE, ledger);
        } catch (err) {
            // console.error('[AdvanceRevertManager] Error in takeInitialSnapshot:', err);
        }
    },

    async recordTurnDelta(chatId, turnNumber, toolsUsed = []) {
        try {
            const ledger = readEncryptedJson(LEDGER_ADVANCE_FILE, {});
            const session = ledger[chatId];
            if (!session) return;

            const previousManifest = session.currentManifest || session.initialManifest;
            const currentManifest = await scanWorkspace(process.cwd());

            const newFiles = [];
            const modifiedFiles = [];
            const deletedFiles = [];

            // Detect new and modified files
            for (const [relPath, info] of Object.entries(currentManifest)) {
                const prev = previousManifest[relPath];
                if (!prev) {
                    newFiles.push(relPath);
                } else if (prev.size !== info.size || prev.mtime !== info.mtime) {
                    modifiedFiles.push(relPath);
                }
            }

            // Detect deleted files
            for (const relPath of Object.keys(previousManifest)) {
                if (!currentManifest[relPath]) {
                    deletedFiles.push(relPath);
                }
            }

            // If changes occurred, create delta snapshot folder
            const changedFiles = [...newFiles, ...modifiedFiles];
            if (changedFiles.length > 0 || deletedFiles.length > 0) {
                const deltaManifest = {};
                for (const file of changedFiles) {
                    deltaManifest[file] = currentManifest[file];
                }
                const turnDir = path.join(DATA_DIR, 'snapshots', chatId, `turn_${turnNumber}`);
                await copyWorkspaceFiles(turnDir, deltaManifest);
            }

            session.checkpoints.push({
                id: `turn_${turnNumber}`,
                timestamp: new Date().toISOString(),
                newFiles,
                modifiedFiles,
                deletedFiles,
                toolsUsed
            });
            session.currentManifest = currentManifest;

            writeEncryptedJson(LEDGER_ADVANCE_FILE, ledger);
        } catch (err) {
            // console.error('[AdvanceRevertManager] Error in recordTurnDelta:', err);
        }
    },

    async getCheckpoints(chatId) {
        try {
            const ledger = readEncryptedJson(LEDGER_ADVANCE_FILE, {});
            const session = ledger[chatId];
            if (!session) return [];
            return session.checkpoints || [];
        } catch (err) {
            return [];
        }
    },

    async rollbackToCheckpoint(chatId, checkpointId) {
        try {
            const ledger = readEncryptedJson(LEDGER_ADVANCE_FILE, {});
            const session = ledger[chatId];
            if (!session) throw new Error('No session active for Advance Rollback.');

            const checkpoints = session.checkpoints || [];
            const targetIdx = checkpoints.findIndex(c => c.id === checkpointId);
            if (targetIdx === -1) throw new Error(`Checkpoint [${checkpointId}] not found.`);

            const snapshotsDir = path.join(DATA_DIR, 'snapshots', chatId);

            // Shared stats object accumulated across all restore passes
            const stats = { restored: 0, replaced: 0, failed: [] };

            // 1. Clear workspace of non-junk files
            const currentFiles = await scanWorkspace(process.cwd());
            for (const relPath of Object.keys(currentFiles)) {
                const fullPath = path.join(process.cwd(), relPath);
                await fs.chmod(fullPath, 0o666).catch(() => {});
                await fs.remove(fullPath).catch(() => {});
            }

            // 2. Restore initial snapshot
            const initialDir = path.join(snapshotsDir, 'initial');
            await restoreSnapshotDir(initialDir, process.cwd(), stats, initialDir);

            // 3. Sequentially apply deltas up to target checkpoint
            for (let i = 1; i <= targetIdx; i++) {
                const cp = checkpoints[i];
                const turnDir = path.join(snapshotsDir, cp.id);
                await restoreSnapshotDir(turnDir, process.cwd(), stats, turnDir);
                // Handle deletions recorded in that turn
                if (cp.deletedFiles && cp.deletedFiles.length > 0) {
                    for (const delFile of cp.deletedFiles) {
                        const fullPath = path.join(process.cwd(), delFile);
                        await fs.chmod(fullPath, 0o666).catch(() => {});
                        await fs.remove(fullPath).catch(() => {});
                    }
                }
            }

            // 4. Update ledger: keep only checkpoints up to the restored checkpoint
            session.checkpoints = checkpoints.slice(0, targetIdx + 1);

            // Re-scan workspace after restore to reset currentManifest
            session.currentManifest = await scanWorkspace(process.cwd());

            writeEncryptedJson(LEDGER_ADVANCE_FILE, ledger);
            return { checkpointId, stats };
        } catch (err) {
            throw new Error(`Rollback failed: ${err.message}`);
        }
    },

    async cleanup(chatId) {
        try {
            const snapshotsDir = path.join(DATA_DIR, 'snapshots', chatId);
            await fs.remove(snapshotsDir).catch(() => {});

            const ledger = readEncryptedJson(LEDGER_ADVANCE_FILE, {});
            if (ledger[chatId]) {
                delete ledger[chatId];
                writeEncryptedJson(LEDGER_ADVANCE_FILE, ledger);
            }
        } catch (err) {
            // ignore
        }
    }
};
