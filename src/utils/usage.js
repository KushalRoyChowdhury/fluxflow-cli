import fs from 'fs-extra';
import path from 'path';
import { USAGE_FILE } from './paths.js';

let cachedUsage = null;
let writeTimeout = null;
let lastWriteTime = 0;
let isDirty = false;

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
                return {
                    ...data,
                    stats: { ...defaultStats, ...data.stats }
                };
            }
        }
    } catch (err) {}

    // Reset for new day or recovery
    const defaultStats = { 
        agent: 0, 
        background: 0, 
        search: 0, 
        toolSuccess: 0, 
        toolFailure: 0, 
        toolDenied: 0,
        duration: 0, 
        tokens: 0 
    };
    
    return { date: today, stats: defaultStats };
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
                    cachedUsage.stats[key] = Math.max(cachedUsage.stats[key], diskData.stats[key]);
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
            stats: { 
                agent: 0, background: 0, search: 0, 
                toolSuccess: 0, toolFailure: 0, toolDenied: 0, duration: 0, tokens: 0 
            }
        };
        isDirty = true;
        await flushUsage(); // Immediate flush for day rollover
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
