import fs from 'fs-extra';
import path from 'path';
import { USAGE_FILE, USAGE_FILE_OLD } from './paths.js';
import { encryptAes, decryptAes } from './crypto.js';
import { loadSettings } from './settings.js';

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
    cachedTokens: 0,
    candidateTokens: 0,
    linesAdded: 0,
    linesRemoved: 0,
    imageCalls: []
};

const purgeOldHistory = (history, todayStr) => {
    if (!history) return {};
    const keys = Object.keys(history);
    const thirtyDaysAgo = new Date(new Date(todayStr).getTime() - 30 * 24 * 60 * 60 * 1000);
    const purged = {};
    for (const key of keys) {
        const keyDate = new Date(key);
        if (keyDate >= thirtyDaysAgo) {
            purged[key] = history[key];
        }
    }
    return purged;
};

/**
 * Loads usage from file into memory
 */
const loadUsageFromFile = async () => {
    const today = new Date().toISOString().split('T')[0];

    // Migration: If new secret USAGE_FILE doesn't exist but USAGE_FILE_OLD exists, move it over
    try {
        if (!(await fs.exists(USAGE_FILE)) && (await fs.exists(USAGE_FILE_OLD))) {
            await fs.ensureDir(path.dirname(USAGE_FILE));
            await fs.move(USAGE_FILE_OLD, USAGE_FILE);
        }
    } catch (err) { }

    const tempFile = USAGE_FILE + '.tmp';
    let primaryData = null;

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
                } catch (e) { }
            } else {
                // Invalid structure inside .tmp - remove corrupted file safely
                try {
                    await fs.remove(tempFile);
                } catch (e) { }
            }
        }
    } catch (err) {
        // Tmp file parsing or decryption failed (corrupted) - safely clean it up
        try {
            await fs.remove(tempFile);
        } catch (e) { }
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
        } catch (err) { }
    }

    let resolvedData = primaryData;

    if (resolvedData) {
        const stats = resolvedData.stats || { ...defaultStats };
        const mergedStats = { ...defaultStats, ...stats };
        if (!Array.isArray(mergedStats.imageCalls)) {
            mergedStats.imageCalls = [];
        }

        const history = resolvedData.history || {};
        const purgedHistory = purgeOldHistory(history, today);

        if (Object.keys(history).length !== Object.keys(purgedHistory).length) {
            isDirty = true;
        }

        if (resolvedData.date === today) {
            return {
                ...resolvedData,
                stats: mergedStats,
                history: purgedHistory
            };
        } else {
            const oldDate = resolvedData.date;
            const oldStats = mergedStats;
            const updatedHistory = { ...purgedHistory };
            if (oldDate) {
                updatedHistory[oldDate] = oldStats;
            }
            return {
                date: today,
                stats: { ...defaultStats },
                history: purgeOldHistory(updatedHistory, today)
            };
        }
    }

    return {
        date: today,
        stats: { ...defaultStats },
        history: {}
    };
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
        } catch (e) { }

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
                    } else if (cachedUsage.stats[key] && typeof cachedUsage.stats[key] === 'object') {
                        // Merge plain objects (like providerRequests, models)
                        const diskObj = diskData.stats[key] || {};
                        const memObj = cachedUsage.stats[key];
                        for (const subKey in diskObj) {
                            if (typeof diskObj[subKey] === 'number') {
                                memObj[subKey] = Math.max(memObj[subKey] || 0, diskObj[subKey]);
                            } else if (diskObj[subKey] && typeof diskObj[subKey] === 'object') {
                                // For nested objects like models[provider][model]
                                if (!memObj[subKey]) memObj[subKey] = {};
                                for (const mKey in diskObj[subKey]) {
                                    if (typeof diskObj[subKey][mKey] === 'number') {
                                        memObj[subKey][mKey] = Math.max(memObj[subKey][mKey] || 0, diskObj[subKey][mKey]);
                                    } else if (diskObj[subKey][mKey] && typeof diskObj[subKey][mKey] === 'object') {
                                        if (!memObj[subKey][mKey]) memObj[subKey][mKey] = {};
                                        for (const valKey in diskObj[subKey][mKey]) {
                                            memObj[subKey][mKey][valKey] = Math.max(memObj[subKey][mKey][valKey] || 0, diskObj[subKey][mKey][valKey]);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        if (diskData && diskData.history) {
            const mergedHistory = { ...(cachedUsage.history || {}) };
            for (const dateKey in diskData.history) {
                if (mergedHistory[dateKey]) {
                    for (const key in mergedHistory[dateKey]) {
                        if (key === 'imageCalls') {
                            const diskArr = Array.isArray(diskData.history[dateKey].imageCalls) ? diskData.history[dateKey].imageCalls : [];
                            const memArr = Array.isArray(mergedHistory[dateKey].imageCalls) ? mergedHistory[dateKey].imageCalls : [];
                            const uniqueMap = new Map();
                            for (const item of [...diskArr, ...memArr]) {
                                if (item && item.timestamp) {
                                    uniqueMap.set(item.timestamp, item);
                                }
                            }
                            mergedHistory[dateKey].imageCalls = Array.from(uniqueMap.values());
                        } else if (typeof mergedHistory[dateKey][key] === 'number') {
                            mergedHistory[dateKey][key] = Math.max(mergedHistory[dateKey][key], Number(diskData.history[dateKey][key]) || 0);
                        }
                    }
                } else {
                    mergedHistory[dateKey] = diskData.history[dateKey];
                }
            }
            cachedUsage.history = purgeOldHistory(mergedHistory, cachedUsage.date || today);
        } else if (cachedUsage && cachedUsage.history) {
            const today = new Date().toISOString().split('T')[0];
            cachedUsage.history = purgeOldHistory(cachedUsage.history, today);
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



        isDirty = false;
        lastWriteTime = Date.now();
    } catch (e) { }
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
    if (isDirty) {
        queueFlush();
    }
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
        const oldDate = cachedUsage.date;
        const oldStats = cachedUsage.stats;
        const history = cachedUsage.history || {};

        if (oldStats) {
            history[oldDate] = oldStats;
        }

        cachedUsage = {
            date: today,
            stats: { ...defaultStats },
            history: purgeOldHistory(history, today)
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
 * Gets the 30-day usage stats from memory
 */
export const getMonthlyUsage = async () => {
    const today = new Date().toISOString().split('T')[0];

    if (!cachedUsage) {
        cachedUsage = await loadUsageFromFile();
    }

    // Rollover check
    if (cachedUsage.date !== today) {
        await getDailyUsage();
    }

    const history = cachedUsage.history || {};
    const purgedHistory = purgeOldHistory(history, today);
    cachedUsage.history = purgedHistory;

    const todayStats = cachedUsage.stats || { ...defaultStats };
    const summed = { ...defaultStats };
    summed.imageCalls = [];
    summed.models = {};

    const addStats = (target, source) => {
        for (const key in target) {
            if (key === 'imageCalls') {
                target.imageCalls = [...(target.imageCalls || []), ...(source.imageCalls || [])];
            } else if (key === 'models') {
                const srcModels = source.models || {};
                for (const provider in srcModels) {
                    if (!target.models[provider]) {
                        target.models[provider] = {};
                    }
                    for (const model in srcModels[provider]) {
                        if (!target.models[provider][model]) {
                            target.models[provider][model] = {
                                tokens: 0,
                                cachedTokens: 0,
                                candidateTokens: 0
                            };
                        }
                        const tM = target.models[provider][model];
                        const sM = srcModels[provider][model];
                        tM.tokens += sM.tokens || 0;
                        tM.cachedTokens += sM.cachedTokens || 0;
                        tM.candidateTokens += sM.candidateTokens || 0;
                    }
                }
            } else if (typeof target[key] === 'number') {
                target[key] += source[key] || 0;
            }
        }
    };

    addStats(summed, todayStats);
    for (const dateKey in purgedHistory) {
        addStats(summed, purgedHistory[dateKey]);
    }

    return summed;
};

/**
 * Increments a specific usage key in memory
 */
export const incrementUsage = async (key, provider) => {
    if (key === 'toolSuccess') runtimeSession.toolSuccess++;
    else if (key === 'toolFailure') runtimeSession.toolFailure++;
    else if (key === 'toolDenied') runtimeSession.toolDenied++;

    const stats = await getDailyUsage();
    if (stats[key] !== undefined) {
        stats[key]++;
    }
    if (provider && key === 'agent') {
        if (!stats.providerRequests) {
            stats.providerRequests = {};
        }
        stats.providerRequests[provider] = (stats.providerRequests[provider] || 0) + 1;
    }
    queueFlush();
};

export const runtimeSession = {
    linesAdded: 0,
    linesRemoved: 0,
    toolSuccess: 0,
    toolFailure: 0,
    toolDenied: 0
};

/**
 * Adds a specific amount to a usage key in memory
 */
export const addToUsage = async (key, amount, provider, model) => {
    if (key === 'linesAdded') {
        runtimeSession.linesAdded += amount;
    } else if (key === 'linesRemoved') {
        runtimeSession.linesRemoved += amount;
    }

    const stats = await getDailyUsage();
    if (stats[key] !== undefined) {
        stats[key] += Math.floor(amount);
    }

    if (provider && model && (key === 'tokens' || key === 'cachedTokens' || key === 'candidateTokens')) {
        if (!stats.models) {
            stats.models = {};
        }
        if (!stats.models[provider]) {
            stats.models[provider] = {};
        }
        if (!stats.models[provider][model]) {
            stats.models[provider][model] = {
                tokens: 0,
                cachedTokens: 0,
                candidateTokens: 0
            };
        }
        const mObj = stats.models[provider][model];
        if (key === 'tokens') mObj.tokens += Math.floor(amount);
        if (key === 'cachedTokens') mObj.cachedTokens += Math.floor(amount);
        if (key === 'candidateTokens') mObj.candidateTokens += Math.floor(amount);
    }

    queueFlush();
};

/**
 * Checks if a call is allowed based on settings and tier
 */
/**
 * Gets the custom period usage stats from memory (from custom reset day to today)
 */
export const getCustomPeriodUsage = async (resetDay = 1) => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (!cachedUsage) {
        cachedUsage = await loadUsageFromFile();
    }

    // Rollover check
    if (cachedUsage.date !== todayStr) {
        await getDailyUsage();
    }

    let startYear = today.getFullYear();
    let startMonth = today.getMonth();
    const todayDay = today.getDate();

    if (todayDay < resetDay) {
        startMonth -= 1;
        if (startMonth < 0) {
            startMonth = 11;
            startYear -= 1;
        }
    }

    const startDate = new Date(startYear, startMonth, resetDay);
    const startDateStr = startDate.toISOString().split('T')[0];

    const history = cachedUsage.history || {};
    const todayStats = cachedUsage.stats || { ...defaultStats };
    const summed = { ...defaultStats };
    summed.imageCalls = [];
    summed.models = {};

    const addStats = (target, source) => {
        for (const key in target) {
            if (key === 'imageCalls') {
                target.imageCalls = [...(target.imageCalls || []), ...(source.imageCalls || [])];
            } else if (key === 'models') {
                const srcModels = source.models || {};
                for (const provider in srcModels) {
                    if (!target.models[provider]) {
                        target.models[provider] = {};
                    }
                    for (const model in srcModels[provider]) {
                        if (!target.models[provider][model]) {
                            target.models[provider][model] = {
                                tokens: 0,
                                cachedTokens: 0,
                                candidateTokens: 0
                            };
                        }
                        const tM = target.models[provider][model];
                        const sM = srcModels[provider][model];
                        tM.tokens += sM.tokens || 0;
                        tM.cachedTokens += sM.cachedTokens || 0;
                        tM.candidateTokens += sM.candidateTokens || 0;
                    }
                }
            } else if (typeof target[key] === 'number') {
                target[key] += source[key] || 0;
            }
        }
    };

    addStats(summed, todayStats);

    for (const dateKey in history) {
        if (dateKey >= startDateStr && dateKey < todayStr) {
            addStats(summed, history[dateKey]);
        }
    }

    return summed;
};

/**
 * Checks if a call is allowed based on settings and tier
 */
export const checkQuotaDetailed = async (key, settings = {}) => {
    const loadedSettings = await loadSettings().catch(() => ({}));
    const tier = settings.apiTier || loadedSettings.apiTier || 'Free';
    const quotas = settings.quotas || settings.systemSettings?.quotas || loadedSettings.quotas || {};

    const providerBudgets = quotas.providerBudgets || {};
    const useProvider = !!providerBudgets.__useProvider;
    const currentProvider = settings.aiProvider || loadedSettings.aiProvider || 'Google';
    const isPerProvider = useProvider && !!providerBudgets[currentProvider];

    const resolveAgentLimits = () => {
        if (isPerProvider) {
            const pb = providerBudgets[currentProvider];
            return {
                agentLimit: (typeof pb.agentLimit === 'number' && pb.agentLimit > 0) ? pb.agentLimit : 99999999,
                tokenLimit: (typeof pb.tokenLimit === 'number' && pb.tokenLimit > 0) ? pb.tokenLimit : 99999999999999,
                monthlyTokenLimit: (typeof pb.monthlyTokenLimit === 'number' && pb.monthlyTokenLimit > 0) ? pb.monthlyTokenLimit : 99999999999999,
            };
        }
        return {
            agentLimit: quotas.agentLimit || 99999999,
            tokenLimit: quotas.tokenLimit || 99999999999999,
            monthlyTokenLimit: quotas.monthlyTokenLimit || 99999999999999,
        };
    };

    if (key === 'agent') {
        const { agentLimit, tokenLimit, monthlyTokenLimit } = resolveAgentLimits();
        const dailyUsage = await getDailyUsage();

        let monthlyUsage;
        if (quotas.resetMode === 'Custom') {
            monthlyUsage = await getCustomPeriodUsage(quotas.resetDay || 1);
        } else {
            monthlyUsage = await getMonthlyUsage();
        }

        let dailyAgentCount = 0;
        let dailyTokenCount = 0;
        let monthlyTokenCount = 0;

        if (isPerProvider) {
            dailyAgentCount = dailyUsage.providerRequests?.[currentProvider] || 0;

            const dailyModels = dailyUsage.models?.[currentProvider] || {};
            for (const m in dailyModels) {
                dailyTokenCount += dailyModels[m]?.tokens || 0;
            }

            const monthlyModels = monthlyUsage.models?.[currentProvider] || {};
            for (const m in monthlyModels) {
                monthlyTokenCount += monthlyModels[m]?.tokens || 0;
            }
        } else {
            dailyAgentCount = dailyUsage.agent || 0;
            dailyTokenCount = dailyUsage.tokens || 0;
            monthlyTokenCount = monthlyUsage.tokens || 0;
        }

        if (tier === 'Free' && (dailyUsage.agent + dailyUsage.background) >= 999999) {
            return { allowed: false, reason: 'Free Tier Daily Usage Limit Exceeded' };
        }

        if (dailyAgentCount >= agentLimit) {
            return {
                allowed: false,
                reason: isPerProvider ? `Daily Request Limit Reached for ${currentProvider}` : `Daily Agent Request Limit Reached`
            };
        }
        if (dailyTokenCount >= tokenLimit) {
            return {
                allowed: false,
                reason: isPerProvider ? `Daily Token Budget Exhausted for ${currentProvider}` : `Daily Token Budget Exhausted`
            };
        }
        if (monthlyTokenCount >= monthlyTokenLimit) {
            return {
                allowed: false,
                reason: isPerProvider ? `Monthly Token Budget Exhausted for ${currentProvider}` : `Monthly Token Budget Exhausted`
            };
        }

        return { allowed: true };
    }

    if (key === 'background') {
        const dailyUsage = await getDailyUsage();
        if (tier === 'Free' && (dailyUsage.agent + dailyUsage.background) >= 999999) {
            return { allowed: false, reason: 'Free Tier Background Limit Exceeded' };
        }
        const ok = dailyUsage.background < (quotas.backgroundLimit || 999999);
        return { allowed: ok, reason: ok ? undefined : 'Background Request Limit Exceeded' };
    }

    if (key === 'search') {
        const dailyUsage = await getDailyUsage();
        const ok = dailyUsage.search < (quotas.searchLimit || 100);
        return { allowed: ok, reason: ok ? undefined : 'Search Quota Exceeded' };
    }

    return { allowed: true };
};

export const checkQuota = async (key, settings = {}) => {
    const res = await checkQuotaDetailed(key, settings);
    return res.allowed;
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

/**
 * Retrieves full comprehensive usage datasets: today, history, chronological timeline,
 * and runtime metrics for dashboard visualization.
 */
export const getAllUsageData = async () => {
    const today = new Date().toISOString().split('T')[0];
    if (!cachedUsage) {
        cachedUsage = await loadUsageFromFile();
    }
    if (cachedUsage.date !== today) {
        await getDailyUsage();
    }

    const todayStats = cachedUsage.stats || { ...defaultStats };
    const history = cachedUsage.history || {};

    const dateSet = new Set(Object.keys(history));
    dateSet.add(today);

    const sortedDates = Array.from(dateSet).sort();

    const timeline = sortedDates.map(dateKey => {
        const raw = dateKey === today ? todayStats : (history[dateKey] || {});
        const stats = { ...defaultStats, ...raw };
        const totalTokens = stats.tokens || 0;
        const cachedTokens = stats.cachedTokens || 0;
        const candidateTokens = stats.candidateTokens || 0;
        const promptTokens = Math.max(0, totalTokens - candidateTokens);
        const uncachedPromptTokens = Math.max(0, promptTokens - cachedTokens);
        const agent = stats.agent || 0;
        const background = stats.background || 0;
        const search = stats.search || 0;
        const totalRequests = agent + background + search;
        const toolSuccess = stats.toolSuccess || 0;
        const toolFailure = stats.toolFailure || 0;
        const toolDenied = stats.toolDenied || 0;
        const totalTools = toolSuccess + toolFailure + toolDenied;
        const toolSuccessRate = totalTools > 0 ? ((toolSuccess / totalTools) * 100).toFixed(1) : '100.0';
        const linesAdded = stats.linesAdded || 0;
        const linesRemoved = stats.linesRemoved || 0;
        const imageCalls = Array.isArray(stats.imageCalls) ? stats.imageCalls : [];
        const imageCost = imageCalls.reduce((acc, c) => acc + (c.cost || 0), 0);

        return {
            date: dateKey,
            tokens: totalTokens,
            cachedTokens,
            candidateTokens,
            promptTokens,
            uncachedPromptTokens,
            agent,
            background,
            search,
            totalRequests,
            toolSuccess,
            toolFailure,
            toolDenied,
            totalTools,
            toolSuccessRate: parseFloat(toolSuccessRate),
            linesAdded,
            linesRemoved,
            netLines: linesAdded - linesRemoved,
            duration: stats.duration || 0,
            imageCallsCount: imageCalls.length,
            imageCost,
            models: stats.models || {},
            providerRequests: stats.providerRequests || {}
        };
    });

    const loadedSettings = await loadSettings().catch(() => ({}));
    const quotas = loadedSettings.quotas || {};
    const apiTier = loadedSettings.apiTier || 'Free';
    const monthlyUsage = await getMonthlyUsage().catch(() => ({ tokens: 0, agent: 0 }));
    let customPeriodUsage = null;
    if (quotas.resetMode === 'Custom') {
        customPeriodUsage = await getCustomPeriodUsage(quotas.resetDay || 1).catch(() => ({ tokens: 0 }));
    }

    const dailyTokenLimit = quotas.tokenLimit || 0;
    const monthlyTokenLimit = quotas.monthlyTokenLimit || 0;
    const dailyAgentLimit = quotas.agentLimit || 0;
    const resetMode = quotas.resetMode || 'Daily';
    const resetDay = quotas.resetDay || 1;

    const providerBudgets = quotas.providerBudgets || {};
    const useProvider = !!providerBudgets.__useProvider;
    const providersList = ['Google', 'Anthropic', 'OpenAI', 'DeepSeek', 'Mistral', 'NVIDIA', 'OpenRouter', 'Ollama', 'CrofAI', 'InferX', 'SenseNova', 'AIHubMix', 'Poolside'];
    
    Object.keys(providerBudgets).forEach(k => {
        if (k !== '__useProvider' && !providersList.includes(k)) {
            providersList.push(k);
        }
    });

    const activeProviderBudgets = [];
    for (const prov of providersList) {
        const pb = providerBudgets[prov];
        if (pb && (pb.agentLimit || pb.tokenLimit || pb.monthlyTokenLimit)) {
            let provDailyTokens = 0;
            const dailyModels = todayStats.models?.[prov] || {};
            for (const m in dailyModels) {
                provDailyTokens += dailyModels[m]?.tokens || 0;
            }

            let provMonthlyTokens = 0;
            const periodModels = (quotas.resetMode === 'Custom' ? customPeriodUsage?.models : monthlyUsage?.models)?.[prov] || {};
            for (const m in periodModels) {
                provMonthlyTokens += periodModels[m]?.tokens || 0;
            }

            const provDailyReqs = todayStats.providerRequests?.[prov] || 0;

            const pDailyTokenLimit = pb.tokenLimit || 0;
            const pMonthlyTokenLimit = pb.monthlyTokenLimit || 0;
            const pDailyAgentLimit = pb.agentLimit || 0;

            activeProviderBudgets.push({
                provider: prov,
                dailyTokens: provDailyTokens,
                dailyTokenLimit: pDailyTokenLimit,
                isDailyUnlimited: pDailyTokenLimit >= 9999999999999 || pDailyTokenLimit === 0,
                monthlyTokens: provMonthlyTokens,
                monthlyTokenLimit: pMonthlyTokenLimit,
                isMonthlyUnlimited: pMonthlyTokenLimit >= 9999999999999 || pMonthlyTokenLimit === 0,
                dailyRequests: provDailyReqs,
                dailyAgentLimit: pDailyAgentLimit,
                isRequestsUnlimited: pDailyAgentLimit >= 9999999 || pDailyAgentLimit === 0
            });
        }
    }

    const budgetInfo = {
        apiTier,
        resetMode,
        resetDay,
        quotas,
        usingProviderBudgets: (useProvider && activeProviderBudgets.length > 0) || activeProviderBudgets.length > 0,
        providerBudgetsList: activeProviderBudgets,
        daily: {
            tokensUsed: todayStats.tokens || 0,
            tokenLimit: dailyTokenLimit,
            agentRequests: todayStats.agent || 0,
            agentLimit: dailyAgentLimit,
            isUnlimitedTokens: dailyTokenLimit >= 9999999999999 || dailyTokenLimit === 0,
            isUnlimitedRequests: dailyAgentLimit >= 9999999 || dailyAgentLimit === 0,
        },
        monthly: {
            tokensUsed: (quotas.resetMode === 'Custom' ? customPeriodUsage?.tokens : monthlyUsage?.tokens) || 0,
            tokenLimit: monthlyTokenLimit,
            isUnlimitedTokens: monthlyTokenLimit >= 9999999999999 || monthlyTokenLimit === 0,
        },
        providerBudgets
    };

    return {
        currentDate: today,
        todayStats,
        history,
        timeline,
        budget: budgetInfo,
        runtimeSession: { ...runtimeSession }
    };
};
