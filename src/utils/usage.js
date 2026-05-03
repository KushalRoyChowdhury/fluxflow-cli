import fs from 'fs-extra';
import path from 'path';
import { USAGE_FILE } from './paths.js';

/**
 * Gets the daily usage stats, resetting if the date has changed
 */
export const getDailyUsage = async () => {
    const today = new Date().toISOString().split('T')[0];
    
    try {
        if (await fs.exists(USAGE_FILE)) {
            const data = await fs.readJson(USAGE_FILE);
            if (data && data.date === today && data.stats) {
                // Ensure all keys exist (migration)
                const s = data.stats;
                const normalized = {
                    agent: s.agent || 0,
                    background: s.background || 0,
                    search: s.search || 0,
                    toolSuccess: s.toolSuccess || 0,
                    toolFailure: s.toolFailure || 0,
                    duration: s.duration || 0,
                    tokens: s.tokens || 0
                };
                return normalized;
            } else if (data && data.date !== today) {
                // It's actually a new day, fall through to reset
            } else {
                // File exists but is malformed - don't reset immediately if we can avoid it
                // But if we're here, it's likely corrupted.
            }
        }
    } catch (err) {
        // Only log, don't return default yet - let the missing file logic handle it
        // unless it's truly unreadable
    }

    // Reset for new day or recovery
    const defaultStats = { 
        agent: 0, 
        background: 0, 
        search: 0, 
        toolSuccess: 0, 
        toolFailure: 0, 
        duration: 0, 
        tokens: 0 
    };
    
    try {
        await fs.ensureDir(path.dirname(USAGE_FILE));
        const tempFile = USAGE_FILE + '.tmp';
        await fs.writeJson(tempFile, { date: today, stats: defaultStats }, { spaces: 2 });
        
        // Ensure data is physically on disk before swap (Durability)
        const fd = await fs.open(tempFile, 'r+');
        await fs.fsync(fd);
        await fs.close(fd);
        
        await fs.rename(tempFile, USAGE_FILE);
    } catch (e) {}
    
    return defaultStats;
};

/**
 * Increments a specific usage key
 */
export const incrementUsage = async (key) => {
    const today = new Date().toISOString().split('T')[0];
    const stats = await getDailyUsage();
    const data = { date: today, stats };
    
    if (data.stats[key] !== undefined) {
        data.stats[key]++;
        try {
            await fs.ensureDir(path.dirname(USAGE_FILE));
            const tempFile = USAGE_FILE + '.tmp';
            await fs.writeJson(tempFile, data, { spaces: 2 });
            
            // Physical Flush
            const fd = await fs.open(tempFile, 'r+');
            await fs.fsync(fd);
            await fs.close(fd);
            
            await fs.rename(tempFile, USAGE_FILE);
        } catch (e) {}
    }
};

/**
 * Adds a specific amount to a usage key
 */
export const addToUsage = async (key, amount) => {
    const today = new Date().toISOString().split('T')[0];
    const stats = await getDailyUsage();
    const data = { date: today, stats };
    
    if (data.stats[key] !== undefined) {
        data.stats[key] += Math.floor(amount);
        try {
            await fs.ensureDir(path.dirname(USAGE_FILE));
            const tempFile = USAGE_FILE + '.tmp';
            await fs.writeJson(tempFile, data, { spaces: 2 });
            
            // Physical Flush
            const fd = await fs.open(tempFile, 'r+');
            await fs.fsync(fd);
            await fs.close(fd);
            
            await fs.rename(tempFile, USAGE_FILE);
        } catch (e) {}
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
            // Shared 1500 for models in Free tier
            return (usage.agent + usage.background) < 1500;
        }
        if (key === 'search') return true;
    } 
    
    if (tier === 'Paid' || tier === 'Custom') {
        if (key === 'agent') return usage.agent < (quotas.agentLimit || 1500);
        if (key === 'background') return usage.background < (quotas.backgroundLimit || 1500);
        if (key === 'search') return true;
        return true;
    }

    return true;
};
