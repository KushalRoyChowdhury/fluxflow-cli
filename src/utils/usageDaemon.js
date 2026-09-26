import http from 'http';
import fs from 'fs-extra';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { USAGE_FILE, LOGS_DIR } from './paths.js';
import { encryptAes, decryptAes } from './crypto.js';

export const USAGE_DAEMON_PORT = 52991;
const HEARTBEAT_TIMEOUT_MS = 15000; // 15s without heartbeat = app exited/crashed

const USAGE_ERROR_LOG_FILE = path.join(LOGS_DIR, 'usage', 'usage_error.txt');

const logDaemonError = async (context, err) => {
    const errorMsg = err?.stack || err?.message || String(err);
    console.error(`[Usage Daemon Error] [${context}]:`, err);
    try {
        await fs.ensureDir(path.dirname(USAGE_ERROR_LOG_FILE));
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [Daemon:${context}] ${errorMsg}\n-------------------------------------\n\n`;
        await fs.appendFile(USAGE_ERROR_LOG_FILE, logEntry, 'utf8');
    } catch {}
};

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
 * Loads usage data from disk directly into daemon memory on startup.
 */
async function loadUsageFromDisk() {
    const today = new Date().toISOString().split('T')[0];
    let primaryData = null;

    try {
        if (await fs.exists(USAGE_FILE)) {
            const rawContent = (await fs.readFile(USAGE_FILE, 'utf8')).trim();
            if (rawContent.startsWith('{') || rawContent.startsWith('[')) {
                primaryData = JSON.parse(rawContent);
            } else {
                primaryData = JSON.parse(decryptAes(rawContent));
            }
        }
    } catch (err) {
        await logDaemonError('loadUsageFromDisk', err);
    }

    if (primaryData) {
        const stats = { ...defaultStats, ...(primaryData.stats || {}) };
        if (!Array.isArray(stats.imageCalls)) stats.imageCalls = [];
        const history = primaryData.history || {};
        const purgedHistory = purgeOldHistory(history, today);

        if (primaryData.date === today) {
            return {
                ...primaryData,
                stats,
                history: purgedHistory
            };
        } else {
            const oldDate = primaryData.date;
            const updatedHistory = { ...purgedHistory };
            if (oldDate) {
                updatedHistory[oldDate] = stats;
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
}

/**
 * Starts the standalone Usage Writer Daemon process.
 */
export async function runUsageDaemon(port = USAGE_DAEMON_PORT) {
    let usageData = await loadUsageFromDisk();
    let isFinalized = false;
    let isDirty = false;
    let lastHeartbeat = Date.now();
    let heartbeatCheckInterval = null;

    const flushToDisk = async () => {
        if (!usageData) return;
        try {
            await fs.ensureDir(path.dirname(USAGE_FILE));
            const today = new Date().toISOString().split('T')[0];
            usageData.history = purgeOldHistory(usageData.history || {}, usageData.date || today);
            usageData.saveId = Math.random().toString(36).substring(2) + Date.now().toString(36);

            const encryptedStr = encryptAes(JSON.stringify(usageData, null, 2));
            // Single process writes cleanly directly to file
            await fs.writeFile(USAGE_FILE, encryptedStr, 'utf8');
            isDirty = false;
        } catch (err) {
            await logDaemonError('flushToDisk', err);
        }
    };

    const shutdown = async () => {
        if (heartbeatCheckInterval) clearInterval(heartbeatCheckInterval);
        await flushToDisk();
        server.close(() => {
            process.exit(0);
        });
        setTimeout(() => process.exit(0), 1000).unref();
    };

    // Heartbeat liveness watchdog (every 5s checks if heartbeat timed out)
    heartbeatCheckInterval = setInterval(async () => {
        if (isFinalized) return;
        const elapsed = Date.now() - lastHeartbeat;
        if (elapsed > HEARTBEAT_TIMEOUT_MS) {
            // App crashed or closed without finalize
            await shutdown();
        }
    }, 5000);
    if (heartbeatCheckInterval.unref) heartbeatCheckInterval.unref();

    const server = http.createServer(async (req, res) => {
        const url = req.url || '';

        // 1. HEARTBEAT endpoint
        if (req.method === 'POST' && url === '/heartbeat') {
            if (!isFinalized) {
                lastHeartbeat = Date.now();
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
            return;
        }

        // 2. FINALIZE endpoint (Graceful app exit)
        if ((req.method === 'GET' || req.method === 'POST') && url === '/finalize') {
            isFinalized = true;
            if (heartbeatCheckInterval) clearInterval(heartbeatCheckInterval);

            // Write data to disk immediately
            await flushToDisk();

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: 'Finalized and written to disk' }));

            // Auto-exit after 3s to give OS full flush guarantee
            setTimeout(() => {
                server.close(() => process.exit(0));
                setTimeout(() => process.exit(0), 500).unref();
            }, 3000);
            return;
        }

        // 3. FLUSH endpoint (Immediate write on demand)
        if (req.method === 'POST' && url === '/flush') {
            if (!isFinalized) {
                lastHeartbeat = Date.now();
                await flushToDisk();
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
            return;
        }

        // 4. WRITE / MUTATION endpoint
        if (req.method === 'POST' && url === '/write') {
            if (isFinalized) {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Daemon finalized. Writes locked.' }));
                return;
            }

            lastHeartbeat = Date.now();
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', async () => {
                try {
                    const payload = JSON.parse(body || '{}');
                    const today = new Date().toISOString().split('T')[0];

                    // Check day rollover
                    if (usageData.date !== today) {
                        const oldDate = usageData.date;
                        if (oldDate) {
                            if (!usageData.history) usageData.history = {};
                            usageData.history[oldDate] = { ...usageData.stats };
                        }
                        usageData.date = today;
                        usageData.stats = { ...defaultStats };
                    }

                    if (!usageData.stats) usageData.stats = { ...defaultStats };
                    const { key, amount = 1, provider, model } = payload;

                    if (key && usageData.stats[key] !== undefined) {
                        if (typeof usageData.stats[key] === 'number') {
                            usageData.stats[key] += Math.floor(amount);
                        }
                    }

                    if (key === 'agent' && provider) {
                        if (!usageData.stats.providerRequests) usageData.stats.providerRequests = {};
                        usageData.stats.providerRequests[provider] = (usageData.stats.providerRequests[provider] || 0) + Math.floor(amount);
                    }

                    if (provider && model && (key === 'tokens' || key === 'cachedTokens' || key === 'candidateTokens')) {
                        if (!usageData.stats.models) usageData.stats.models = {};
                        if (!usageData.stats.models[provider]) usageData.stats.models[provider] = {};
                        if (!usageData.stats.models[provider][model]) {
                            usageData.stats.models[provider][model] = { tokens: 0, cachedTokens: 0, candidateTokens: 0 };
                        }
                        const mObj = usageData.stats.models[provider][model];
                        if (key === 'tokens') mObj.tokens += Math.floor(amount);
                        if (key === 'cachedTokens') mObj.cachedTokens += Math.floor(amount);
                        if (key === 'candidateTokens') mObj.candidateTokens += Math.floor(amount);
                    }

                    isDirty = true;
                    // Debounced write to disk
                    await flushToDisk();

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                } catch (err) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: err.message }));
                }
            });
            return;
        }

        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    });

    server.listen(port, '127.0.0.1', () => {
        lastHeartbeat = Date.now();
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            process.exit(0);
        }
    });
}

/**
 * Ensures the usage daemon background worker is running.
 */
export async function ensureUsageDaemonRunning(port = USAGE_DAEMON_PORT) {
    try {
        const res = await fetch(`http://127.0.0.1:${port}/heartbeat`, {
            method: 'POST',
            signal: AbortSignal.timeout(300)
        });
        if (res.ok) return true;
    } catch {}

    try {
        const currentFilePath = fileURLToPath(import.meta.url);
        const child = spawn(process.execPath, [
            currentFilePath,
            '--usage-daemon-worker',
            `--port=${port}`
        ], {
            detached: true,
            stdio: 'ignore',
            windowsHide: true
        });

        child.unref();

        for (let i = 0; i < 10; i++) {
            await new Promise(r => setTimeout(r, 100));
            try {
                const res = await fetch(`http://127.0.0.1:${port}/heartbeat`, {
                    method: 'POST',
                    signal: AbortSignal.timeout(300)
                });
                if (res.ok) return true;
            } catch {}
        }
    } catch {}
    return false;
}

/**
 * Sends a write mutation to the Usage Daemon.
 */
export async function sendUsageWrite(payload, port = USAGE_DAEMON_PORT) {
    try {
        await ensureUsageDaemonRunning(port);
        await fetch(`http://127.0.0.1:${port}/write`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(1000)
        });
    } catch {}
}

/**
 * Sends heartbeat signal to the Usage Daemon.
 */
export async function sendUsageHeartbeat(port = USAGE_DAEMON_PORT) {
    try {
        await fetch(`http://127.0.0.1:${port}/heartbeat`, {
            method: 'POST',
            signal: AbortSignal.timeout(600)
        });
    } catch {}
}

/**
 * Sends finalize command to the Usage Daemon on app graceful shutdown.
 */
export async function sendUsageFinalize(port = USAGE_DAEMON_PORT) {
    try {
        await fetch(`http://127.0.0.1:${port}/finalize`, {
            method: 'GET',
            signal: AbortSignal.timeout(1000)
        });
    } catch {}
}

// Background Worker entry point
if (process.argv.includes('--usage-daemon-worker')) {
    const portArg = process.argv.find(a => a.startsWith('--port='));
    const port = portArg ? parseInt(portArg.split('=')[1], 10) : USAGE_DAEMON_PORT;
    runUsageDaemon(port);
}
