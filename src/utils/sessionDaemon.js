import http from 'http';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes auto-shutdown
const DEFAULT_PORT = 52145;
const MAX_TURNS = 69; // Maximum turns before auto-closing daemon

/**
 * Starts the standalone in-memory session daemon (called in daemon mode).
 */
export function runSessionDaemon(parentPid = null, port = DEFAULT_PORT) {
    let conversationHistory = [];
    let idleTimer = null;
    let parentCheckInterval = null;

    const resetIdleTimer = () => {
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
            shutdown();
        }, IDLE_TIMEOUT_MS);
    };

    const shutdown = () => {
        if (idleTimer) clearTimeout(idleTimer);
        if (parentCheckInterval) clearInterval(parentCheckInterval);
        server.close(() => {
            process.exit(0);
        });
        setTimeout(() => process.exit(0), 1000).unref();
    };

    // Check if parent process (terminal/shell) is still alive
    if (parentPid) {
        parentCheckInterval = setInterval(() => {
            try {
                // process.kill(pid, 0) checks if process exists without killing it
                process.kill(parentPid, 0);
            } catch (e) {
                // Parent PID no longer exists -> close immediately
                shutdown();
            }
        }, 15000);
        if (parentCheckInterval.unref) parentCheckInterval.unref();
    }

    const server = http.createServer((req, res) => {
        resetIdleTimer();

        if (req.method === 'GET' && req.url === '/history') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ history: conversationHistory }));
            return;
        }

        if (req.method === 'POST' && req.url === '/history') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
                try {
                    const parsed = JSON.parse(body || '{}');
                    if (Array.isArray(parsed.history)) {
                        conversationHistory = parsed.history;
                    } else if (parsed.user && parsed.assistant) {
                        conversationHistory.push({ role: 'user', text: parsed.user });
                        conversationHistory.push({ role: 'model', text: parsed.assistant });
                    }

                    // 1 turn = 1 user prompt + 1 model answer (2 messages)
                    const turnsCount = Math.floor(conversationHistory.length / 2);
                    const shouldTerminate = turnsCount >= MAX_TURNS;

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        count: conversationHistory.length,
                        turns: turnsCount,
                        maxReached: shouldTerminate
                    }));

                    // Force close daemon at 69th turn completion
                    if (shouldTerminate) {
                        setTimeout(shutdown, 200);
                    }
                } catch (err) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: err.message }));
                }
            });
            return;
        }

        if (req.method === 'POST' && req.url === '/clear') {
            conversationHistory = [];
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: 'History cleared' }));
            return;
        }

        if (req.method === 'POST' && req.url === '/shutdown') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: 'Daemon shutting down' }));
            setTimeout(shutdown, 100);
            return;
        }

        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    });

    server.listen(port, '127.0.0.1', () => {
        resetIdleTimer();
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            process.exit(0);
        }
    });
}

/**
 * Client-side helper: Clears in-memory history in the daemon.
 */
export async function clearPromptSessionHistory(port = DEFAULT_PORT) {
    try {
        const res = await fetch(`http://127.0.0.1:${port}/clear`, {
            method: 'POST',
            signal: AbortSignal.timeout(600)
        });
        return res.ok;
    } catch {
        return false;
    }
}

/**
 * Client-side helper: Fetches current non-interactive history from daemon.
 */
export async function getPromptSessionHistory(port = DEFAULT_PORT) {
    try {
        const res = await fetch(`http://127.0.0.1:${port}/history`, {
            signal: AbortSignal.timeout(600)
        });
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data.history) ? data.history : [];
    } catch {
        return [];
    }
}

/**
 * Client-side helper: Appends user prompt & assistant response to in-memory session.
 */
export async function savePromptSessionHistory(userText, assistantText, port = DEFAULT_PORT) {
    try {
        await ensureSessionDaemonRunning(port);
        await fetch(`http://127.0.0.1:${port}/history`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user: userText, assistant: assistantText }),
            signal: AbortSignal.timeout(1000)
        });
    } catch {
        // Silently continue if daemon communication fails
    }
}

/**
 * Ensures the memory session daemon is alive in the background; spawns detached if needed.
 */
export async function ensureSessionDaemonRunning(port = DEFAULT_PORT) {
    try {
        const res = await fetch(`http://127.0.0.1:${port}/history`, {
            signal: AbortSignal.timeout(400)
        });
        if (res.ok) return true;
    } catch {
        // Not running yet -> spawn detached background process
    }

    try {
        const currentFilePath = fileURLToPath(import.meta.url);
        // Note: Do not bind to ephemeral node/pnpm runner process PID. The idle timeout (10m) handles auto-cleanup safely.
        const child = spawn(process.execPath, [
            currentFilePath,
            '--daemon-worker',
            `--port=${port}`
        ], {
            detached: true,
            stdio: 'ignore',
            windowsHide: true
        });

        child.unref();

        // Give the spawned server a moment to bind
        for (let i = 0; i < 10; i++) {
            await new Promise(r => setTimeout(r, 100));
            try {
                const res = await fetch(`http://127.0.0.1:${port}/history`, {
                    signal: AbortSignal.timeout(400)
                });
                if (res.ok) return true;
            } catch {}
        }
    } catch {
        // Spawning failed
    }
    return false;
}

// If directly invoked as the daemon background worker
if (process.argv.includes('--daemon-worker')) {
    const parentPidArg = process.argv.find(a => a.startsWith('--parent-pid='));
    const parentPid = parentPidArg ? parseInt(parentPidArg.split('=')[1], 10) : null;
    const portArg = process.argv.find(a => a.startsWith('--port='));
    const port = portArg ? parseInt(portArg.split('=')[1], 10) : DEFAULT_PORT;
    runSessionDaemon(parentPid, port);
}
