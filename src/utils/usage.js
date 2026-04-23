import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USAGE_PATH = path.join(__dirname, '../../secret/usage.json');

/**
 * Gets the daily usage stats, resetting if the date has changed
 */
export const getDailyUsage = async () => {
    const today = new Date().toISOString().split('T')[0];
    
    try {
        if (await fs.exists(USAGE_PATH)) {
            const data = await fs.readJson(USAGE_PATH);
            if (data.date === today) {
                return data.stats;
            }
        }
    } catch (err) {
        console.error('Failed to read usage:', err);
    }

    // Reset for new day
    const defaultStats = { agent: 0, background: 0, search: 0 };
    await fs.writeJson(USAGE_PATH, { date: today, stats: defaultStats }, { spaces: 2 });
    return defaultStats;
};

/**
 * Increments a specific usage key
 */
export const incrementUsage = async (key) => {
    const today = new Date().toISOString().split('T')[0];
    const data = await fs.readJson(USAGE_PATH).catch(() => ({ date: today, stats: { agent: 0, background: 0, search: 0 } }));
    
    if (data.date !== today) {
        data.date = today;
        data.stats = { agent: 0, background: 0, search: 0 };
    }

    if (data.stats[key] !== undefined) {
        data.stats[key]++;
        await fs.writeJson(USAGE_PATH, data, { spaces: 2 });
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
