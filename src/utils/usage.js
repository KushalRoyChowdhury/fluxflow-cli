import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { USAGE_FILE } from './paths.js';
import { encryptAes, decryptAes } from './crypto.js';

const getLocalBackupPath = () => {
    if (process.platform === 'win32') {
        const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
        return path.join(localAppData, 'FxFl', 'backups', 'backup.json');
    }
    if (process.platform === 'darwin') {
        return path.join(os.homedir(), 'Library', 'Application Support', 'FxFl', 'backups', 'backup.json');
    }
    const xdgDataHome = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
    return path.join(xdgDataHome, 'fxfl', 'backups', 'backup.json');
};

const BACKUP_FILE = getLocalBackupPath();

const generateSaveId = () => Math.random().toString(36).substring(2) + Date.now().toString(36);

let cachedUsage = null;
let writeTimeout = null;
let lastWriteTime = 0;
let isDirty = false;

const defaultStats = {
    agent: 0,
    background: 0,
    search: 0,
    toolSuccess: 0,
    toolFailure: 0,
    toolDenied: 0,
    duration: 0,
    tokens: 0,
    linesAdded: 0,
    linesRemoved: 0,
    imageCalls: []
};

/**
 * Loads usage from file into memory
 */
const loadUsageFromFile = async () => {
    const today = new Date().toISOString().split('T')[0];

    const tempFile = USAGE_FILE + '.tmp';
    let primaryData = null;
    let backupData = null;

    // A. Check for pending .tmp write recovery first (Self-Healing Loop)
    try {
        if (await fs.exists(tempFile)) {
            const rawContent = (await fs.readFile(tempFile, 'utf8')).trim();
            let parsed = null;
            if (rawContent.startsWith('{') || rawContent.startsWith('[')) {
                parsed = JSON.parse(rawContent);
            } else {
                parsed = JSON.parse(decryptAes(rawContent));
            }

            if (parsed && parsed.date && parsed.stats) {
                // .tmp is intact and valid - Recover it immediately and complete rename
                primaryData = parsed;
                try {
                    await fs.rename(tempFile, USAGE_FILE);
                } catch (e) {}
            } else {
                // Invalid structure inside .tmp - remove corrupted file safely
                try {
                    await fs.remove(tempFile);
                } catch (e) {}
            }
        }
    } catch (err) {
        // Tmp file parsing or decryption failed (corrupted) - safely clean it up
        try {
            await fs.remove(tempFile);
        } catch (e) {}
    }

    // 1. Try reading primary usage file (if not already recovered from .tmp)
    if (!primaryData) {
        try {
            if (await fs.exists(USAGE_FILE)) {
                const rawContent = (await fs.readFile(USAGE_FILE, 'utf8')).trim();
                if (rawContent.startsWith('{') || rawContent.startsWith('[')) {
                    primaryData = JSON.parse(rawContent);
                } else {
                    primaryData = JSON.parse(decryptAes(rawContent));
                }
            }
        } catch (err) {}
    }

    // 2. Try reading backup redundancy file
    try {
        if (await fs.exists(BACKUP_FILE)) {
            const rawContent = (await fs.readFile(BACKUP_FILE, 'utf8')).trim();
            if (rawContent.startsWith('{') || rawContent.startsWith('[')) {
                backupData = JSON.parse(rawContent);
            } else {
                backupData = JSON.parse(decryptAes(rawContent));
            }
        }
    } catch (err) {}

    let resolvedData = null;

    if (primaryData && backupData) {
        // Both exist - Check for saveId mismatch (meaning the backup copy was interrupted/missed)
        if (primaryData.saveId !== backupData.saveId) {
            // Primary is written first, so it is assumed newer. Fallback copy to restore alignment.
            resolvedData = primaryData;
            try {
                await fs.ensureDir(path.dirname(BACKUP_FILE));
                await fs.copy(USAGE_FILE, BACKUP_FILE);
            } catch (e) {}
        } else {
            resolvedData = primaryData;
        }
    } else if (primaryData && !backupData) {
        // Backup got wiped or is missing - Copy primary to backup
        resolvedData = primaryData;
        try {
            await fs.ensureDir(path.dirname(BACKUP_FILE));
            await fs.copy(USAGE_FILE, BACKUP_FILE);
        } catch (e) {}
    } else if (!primaryData && backupData) {
        // Primary got wiped or deleted - Restore from backup redundancy!
        resolvedData = backupData;
        try {
            await fs.ensureDir(path.dirname(USAGE_FILE));
            await fs.copy(BACKUP_FILE, USAGE_FILE);
        } catch (e) {}
    }

    if (resolvedData && resolvedData.date === today && resolvedData.stats) {
        // [RESILIENCE] Merge with defaults to ensure new keys (like toolDenied) are present
        const mergedStats = { ...defaultStats, ...resolvedData.stats };
        if (!Array.isArray(mergedStats.imageCalls)) {
            mergedStats.imageCalls = [];
        }
        return {
            ...resolvedData,
            stats: mergedStats
        };
    }

    return { date: today, stats: { ...defaultStats } };
};

/**
 * Persists in-memory usage to disk with Read-Merge-Write safety
 */
const flushUsage = async () => {
    if (!isDirty || !cachedUsage) return;

    try {
        await fs.ensureDir(path.dirname(USAGE_FILE));

        // --- READ-MERGE-WRITE SAFETY (v1.8.5 Protection) ---
        // Before we overwrite the file, check if disk has data we lost in memory
        let diskData = null;
        try {
            if (await fs.exists(USAGE_FILE)) {
                const rawContent = (await fs.readFile(USAGE_FILE, 'utf8')).trim();
                if (rawContent.startsWith('{') || rawContent.startsWith('[')) {
                    diskData = JSON.parse(rawContent);
                } else {
                    diskData = JSON.parse(decryptAes(rawContent));
                }
            }
        } catch (e) {}

        if (diskData && diskData.date === cachedUsage.date && diskData.stats) {
            // Merge: Take the maximum of memory vs disk to prevent "Zero-Reset"
            for (const key in cachedUsage.stats) {
                if (diskData.stats[key] !== undefined) {
                    if (Array.isArray(cachedUsage.stats[key])) {
                        const diskArr = Array.isArray(diskData.stats[key]) ? diskData.stats[key] : [];
                        const memArr = cachedUsage.stats[key];
                        const uniqueMap = new Map();
                        for (const item of [...diskArr, ...memArr]) {
                            if (item && item.timestamp) {
                                uniqueMap.set(item.timestamp, item);
                            }
                        }
                        cachedUsage.stats[key] = Array.from(uniqueMap.values());
                    } else if (typeof cachedUsage.stats[key] === 'number') {
                        cachedUsage.stats[key] = Math.max(cachedUsage.stats[key], Number(diskData.stats[key]) || 0);
                    }
                }
            }
        }

        // Append unique save ID to verify alignment during boot sequence
        cachedUsage.saveId = generateSaveId();

        const tempFile = USAGE_FILE + '.tmp';
        const encryptedStr = encryptAes(JSON.stringify(cachedUsage, null, 2));
        await fs.writeFile(tempFile, encryptedStr, 'utf8');

        // Physical Flush to ensure durability
        const fd = await fs.open(tempFile, 'r+');
        await fs.fsync(fd);
        await fs.close(fd);

        // Atomic rename to commit change
        await fs.rename(tempFile, USAGE_FILE);

        // Mirror changes to encrypted backup redundancy directory
        try {
            await fs.ensureDir(path.dirname(BACKUP_FILE));
            await fs.copy(USAGE_FILE, BACKUP_FILE);
        } catch (backupErr) {
            // Silently ignore backup write failure to avoid blocking app flow
        }

        isDirty = false;
        lastWriteTime = Date.now();
    } catch (e) {}
};

/**
 * Queues a debounced write to disk
 */
const queueFlush = () => {
    isDirty = true;
    if (writeTimeout) return;

    const now = Date.now();
    const delay = Math.max(0, 1500 - (now - lastWriteTime));

    writeTimeout = setTimeout(async () => {
        await flushUsage();
        writeTimeout = null;
    }, delay);
    if (writeTimeout.unref) writeTimeout.unref();
};

/**
 * Initializes the usage cache
 */
export const initUsage = async () => {
    cachedUsage = await loadUsageFromFile();
};

/**
 * Forces an immediate write of any pending changes
 */
export const forceFlushUsage = async () => {
    if (writeTimeout) {
        clearTimeout(writeTimeout);
        writeTimeout = null;
    }
    await flushUsage();
};

/**
 * Gets the daily usage stats from memory
 */
export const getDailyUsage = async () => {
    const today = new Date().toISOString().split('T')[0];

    if (!cachedUsage) {
        cachedUsage = await loadUsageFromFile();
    } else if (cachedUsage.date !== today) {
        // Roll over to new day
        cachedUsage = {
            date: today,
            stats: { ...defaultStats }
        };
        isDirty = true;
        await flushUsage(); // Immediate flush for day rollover
    }

    if (cachedUsage && cachedUsage.stats && !Array.isArray(cachedUsage.stats.imageCalls)) {
        cachedUsage.stats.imageCalls = [];
    }

    return cachedUsage.stats;
};

/**
 * Increments a specific usage key in memory
 */
export const incrementUsage = async (key) => {
    const stats = await getDailyUsage();
    if (stats[key] !== undefined) {
        stats[key]++;
        queueFlush();
    }
};

/**
 * Adds a specific amount to a usage key in memory
 */
export const addToUsage = async (key, amount) => {
    const stats = await getDailyUsage();
    if (stats[key] !== undefined) {
        stats[key] += Math.floor(amount);
        queueFlush();
    }
};

/**
 * Checks if a call is allowed based on settings and tier
 */
export const checkQuota = async (key, settings) => {
    const usage = await getDailyUsage();
    const tier = settings.apiTier || 'Free';
    const quotas = settings.quotas || {};

    if (tier === 'Free') {
        if (key === 'agent' || key === 'background') {
            return (usage.agent + usage.background) < 1500;
        }
        if (key === 'search') return true;
    }

    if (tier === 'Paid' || tier === 'Custom') {
        if (key === 'agent') return usage.agent < (quotas.agentLimit || 1500);
        if (key === 'background') return usage.background < (quotas.backgroundLimit || 1500);
        if (key === 'search') return usage.search < (quotas.searchLimit || 100);
    }

    return true;
};

/**
 * Groups raw image calls into consecutive, non-overlapping chronological 1-hour buckets.
 * The first call made starts a fixed 1-hour bucket window. Subsequent calls fall into
 * that bucket until the hour expires, at which point the next call starts a new bucket.
 */
export const getImageQuotaBuckets = (imageCalls) => {
    const hourMs = 60 * 60 * 1000;
    if (!imageCalls || imageCalls.length === 0) {
        return [];
    }

    // Sort ascending
    const sortedCalls = [...imageCalls].sort((a, b) => a.timestamp - b.timestamp);
    const buckets = [];

    for (const call of sortedCalls) {
        if (buckets.length > 0) {
            const lastBucket = buckets[buckets.length - 1];
            if (call.timestamp >= lastBucket.start && call.timestamp < lastBucket.end) {
                lastBucket.calls.push(call);
                lastBucket.spent += call.cost;
                continue;
            }
        }
        // Start a new 1-hour bucket
        buckets.push({
            start: call.timestamp,
            end: call.timestamp + hourMs,
            calls: [call],
            spent: call.cost
        });
    }

    return buckets;
};

/**
 * Calculates the dynamic image hourly credit limit based on historical bucket utilization.
 * Base limit is 25 credits (0.025).
 * - If maxed (>80%) for 2 consecutive hours, drops to 15 credits (0.015).
 * - If usage is still >80% at 15 credits, keeps at 15 credits.
 * - If usage >= 80%, limit remains same unless consecutive maxes drop it to 15.
 * - Recovery increases:
 *   - If usage <40%, increases by 5 credits (+0.005).
 *   - If usage >= 40% and <60%, increases by 4 credits (+0.004).
 *   - If usage >= 60% and <80%, increases by 2 credits (+0.002).
 */
export const getImageQuotaLimit = (imageCalls, now) => {
    const hourMs = 60 * 60 * 1000;
    if (!imageCalls || imageCalls.length === 0) {
        return 0.025;
    }

    const buckets = getImageQuotaBuckets(imageCalls);
    if (buckets.length === 0) {
        return 0.025;
    }

    const history = [];

    for (const bucket of buckets) {
        let limit = 0.025;

        if (history.length > 0) {
            const prev1 = history[history.length - 1];
            let consecutiveMax = false;

            if (history.length >= 2) {
                const prev2 = history[history.length - 2];
                if (prev1.ratio >= 0.8 && prev2.ratio >= 0.8) {
                    consecutiveMax = true;
                }
            }

            if (consecutiveMax) {
                limit = 0.015;
            } else {
                const prevLimit = prev1.limit;
                const prevRatio = prev1.ratio;

                if (prevRatio >= 0.8) {
                    limit = prevLimit === 0.015 ? 0.015 : prevLimit;
                } else if (prevRatio < 0.4) {
                    limit = Math.min(0.025, prevLimit + 0.005);
                } else if (prevRatio >= 0.4 && prevRatio < 0.6) {
                    limit = Math.min(0.025, prevLimit + 0.004);
                } else {
                    limit = Math.min(0.025, prevLimit + 0.002);
                }
            }
        }

        const ratio = limit > 0 ? bucket.spent / limit : 0;
        history.push({ limit, spent: bucket.spent, ratio });
    }

    // Determine current active limit.
    const lastBucket = buckets[buckets.length - 1];
    if (now < lastBucket.end) {
        return history[history.length - 1].limit;
    }

    // If last bucket expired, simulate recovery over the idle gap
    let currentLimit = history[history.length - 1].limit;
    let prevLimit = currentLimit;
    let prevRatio = history[history.length - 1].ratio;
    let simulatedTime = lastBucket.end;

    let consecutiveMaxCount = 0;
    for (let k = history.length - 1; k >= 0; k--) {
        if (history[k].ratio >= 0.8) {
            consecutiveMaxCount++;
        } else {
            break;
        }
    }

    while (simulatedTime <= now) {
        let limit = 0.025;
        const consecutiveMax = consecutiveMaxCount >= 2;

        if (consecutiveMax) {
            limit = 0.015;
        } else {
            if (prevRatio >= 0.8) {
                limit = prevLimit === 0.015 ? 0.015 : prevLimit;
            } else if (prevRatio < 0.4) {
                limit = Math.min(0.025, prevLimit + 0.005);
            } else if (prevRatio >= 0.4 && prevRatio < 0.6) {
                limit = Math.min(0.025, prevLimit + 0.004);
            } else {
                limit = Math.min(0.025, prevLimit + 0.002);
            }
        }

        prevLimit = limit;
        prevRatio = 0; // Simulated idle hour has 0% usage
        consecutiveMaxCount = 0;
        simulatedTime += hourMs;
        currentLimit = limit;
    }

    return currentLimit;
};

/**
 * Checks if the user is within the hourly image generation quota.
 * Enforced if keyType is 'Default'.
 */
export const checkImageQuota = async (settings) => {
    const imageSettings = settings.imageSettings || { keyType: 'Default', quality: 'Low-High' };
    if (imageSettings.keyType !== 'Default') return true;

    const costs = {
        'Low': 0.001,
        'Low-High': 0.002,
        'Medium': 0.008,
        'Medium-High': 0.01,
        'High': 0.045,
        'Ultra': 0.0488,
        'Premium': 0.15
    };
    const currentCost = costs[imageSettings.quality] || 0.002;

    const stats = await getDailyUsage();
    if (!stats.imageCalls) {
        stats.imageCalls = [];
    }

    const now = Date.now();
    const buckets = getImageQuotaBuckets(stats.imageCalls);
    let totalSpent = 0;

    if (buckets.length > 0) {
        const lastBucket = buckets[buckets.length - 1];
        if (now >= lastBucket.start && now < lastBucket.end) {
            totalSpent = lastBucket.spent;
        }
    }

    const currentLimit = getImageQuotaLimit(stats.imageCalls, now);
    return (totalSpent + currentCost) <= currentLimit;
};

/**
 * Gets stats about the hourly image generation quota for display
 */
export const getImageQuotaStats = async () => {
    const stats = await getDailyUsage();
    if (!stats.imageCalls) {
        stats.imageCalls = [];
    }

    const now = Date.now();
    const buckets = getImageQuotaBuckets(stats.imageCalls);

    let activeCalls = [];
    let totalSpent = 0;
    let nextResetMin = 0;

    if (buckets.length > 0) {
        const lastBucket = buckets[buckets.length - 1];
        if (now >= lastBucket.start && now < lastBucket.end) {
            activeCalls = lastBucket.calls;
            totalSpent = lastBucket.spent;
            nextResetMin = Math.max(0, Math.ceil((lastBucket.end - now) / (60 * 1000)));
        }
    }

    const currentLimit = getImageQuotaLimit(stats.imageCalls, now);
    const remaining = Math.max(0, currentLimit - totalSpent);

    // In the classic block-reset pattern, the entire spent amount is returned upon expiration.
    const reclaimCost = totalSpent;

    return {
        totalSpent,
        remaining,
        activeCallsCount: activeCalls.length,
        nextResetMin,
        reclaimCost,
        limit: currentLimit
    };
};

/**
 * Records an image generation cost with timestamp in the daily usage history.
 */
export const recordImageGeneration = async (settings) => {
    const imageSettings = settings.imageSettings || { keyType: 'Default', quality: 'Low-High' };
    const costs = {
        'Low': 0.001,
        'Low-High': 0.002,
        'Medium': 0.008,
        'Medium-High': 0.01,
        'High': 0.045,
        'Ultra': 0.0488,
        'Premium': 0.1
    };
    const cost = costs[imageSettings.quality] || 0.002;

    const stats = await getDailyUsage();
    if (!stats.imageCalls) {
        stats.imageCalls = [];
    }

    stats.imageCalls.push({
        timestamp: Date.now(),
        cost: cost
    });
    queueFlush();
};
