import fs from 'fs-extra';
import path from 'path';
import { USAGE_FILE } from './paths.js';

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
    imageCalls: []
};

/**
 * Loads usage from file into memory
 */
const loadUsageFromFile = async () => {
    const today = new Date().toISOString().split('T')[0];

    try {
        if (await fs.exists(USAGE_FILE)) {
            const data = await fs.readJson(USAGE_FILE);
            if (data && data.date === today && data.stats) {
                // [RESILIENCE] Merge with defaults to ensure new keys (like toolDenied) are present
                const mergedStats = { ...defaultStats, ...data.stats };
                if (!Array.isArray(mergedStats.imageCalls)) {
                    mergedStats.imageCalls = [];
                }
                return {
                    ...data,
                    stats: mergedStats
                };
            }
        }
    } catch (err) {}

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
                diskData = await fs.readJson(USAGE_FILE);
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

        const tempFile = USAGE_FILE + '.tmp';
        await fs.writeJson(tempFile, cachedUsage, { spaces: 2 });

        // Physical Flush to ensure durability
        const fd = await fs.open(tempFile, 'r+');
        await fs.fsync(fd);
        await fs.close(fd);

        await fs.rename(tempFile, USAGE_FILE);
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
    const oneHourAgo = now - 60 * 60 * 1000;

    const activeCalls = stats.imageCalls.filter(c => c.timestamp >= oneHourAgo);
    const totalSpent = activeCalls.reduce((sum, c) => sum + c.cost, 0);

    return (totalSpent + currentCost) <= 0.020;
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
    const oneHourAgo = now - 60 * 60 * 1000;

    const activeCalls = stats.imageCalls.filter(c => c.timestamp >= oneHourAgo);
    const totalSpent = activeCalls.reduce((sum, c) => sum + c.cost, 0);
    const remaining = Math.max(0, 0.020 - totalSpent);

    let nextResetMin = 0;
    let reclaimCost = 0;
    if (activeCalls.length > 0) {
        const earliestCall = activeCalls.reduce((min, c) => c.timestamp < min.timestamp ? c : min, activeCalls[0]);
        const nextResetTimestamp = earliestCall.timestamp + 60 * 60 * 1000;
        nextResetMin = Math.max(0, Math.ceil((nextResetTimestamp - now) / (60 * 1000)));
        reclaimCost = earliestCall.cost;
    }

    return {
        totalSpent,
        remaining,
        activeCallsCount: activeCalls.length,
        nextResetMin,
        reclaimCost
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
