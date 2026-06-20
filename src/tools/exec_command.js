import { spawn } from 'child_process';
import { parseArgs } from '../utils/arg_parser.js';
import { isPsAvailable } from '../data/main_tools.js';

// Attempt to load node-pty for a more authentic terminal experience
let pty = null;
try {
    // Dynamic import to avoid crashing if not installed
    const ptyModule = await import('node-pty');
    pty = ptyModule.default || ptyModule;
} catch (err) {
    // Fallback to child_process.spawn will be used
}

export const isPtyAvailable = !!pty;

const stripAnsi = (str) => {
    if (typeof str !== 'string') return str;
    // eslint-disable-next-line no-control-regex
    return str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
};

export const cleanTerminalOutput = (text) => {
    if (!text) return '';

    // Simulate character grid to resolve carriage returns and cursor movements
    const lines = [[]];
    let cursorRow = 0;
    let cursorCol = 0;

    const ansiRegex = /\x1b\[([0-9;]*?)([a-zA-Z])/g;
    let lastIndex = 0;
    let match;

    const writeText = (plainText) => {
        for (let i = 0; i < plainText.length; i++) {
            const char = plainText[i];
            if (char === '\n') {
                cursorRow++;
                cursorCol = 0;
                while (cursorRow >= lines.length) {
                    lines.push([]);
                }
            } else if (char === '\r') {
                cursorCol = 0;
            } else {
                while (cursorRow >= lines.length) {
                    lines.push([]);
                }
                const line = lines[cursorRow];
                while (cursorCol > line.length) {
                    line.push(' ');
                }
                line[cursorCol] = char;
                cursorCol++;
            }
        }
    };

    while ((match = ansiRegex.exec(text)) !== null) {
        writeText(text.substring(lastIndex, match.index));

        const params = match[1];
        const command = match[2];
        const paramValues = params ? params.split(';').map(Number) : [];

        if (command === 'A') {
            const count = paramValues[0] || 1;
            cursorRow = Math.max(0, cursorRow - count);
        } else if (command === 'B') {
            const count = paramValues[0] || 1;
            cursorRow = cursorRow + count;
            while (cursorRow >= lines.length) {
                lines.push([]);
            }
        } else if (command === 'C') {
            const count = paramValues[0] || 1;
            cursorCol = cursorCol + count;
        } else if (command === 'D') {
            const count = paramValues[0] || 1;
            cursorCol = Math.max(0, cursorCol - count);
        } else if (command === 'G') {
            const col = (paramValues[0] || 1) - 1;
            cursorCol = Math.max(0, col);
        } else if (command === 'H' || command === 'f') {
            const row = (paramValues[0] || 1) - 1;
            const col = (paramValues[1] || 1) - 1;
            cursorRow = Math.max(0, row);
            cursorCol = Math.max(0, col);
            while (cursorRow >= lines.length) {
                lines.push([]);
            }
        } else if (command === 'K') {
            const mode = paramValues[0] || 0;
            if (cursorRow < lines.length) {
                const line = lines[cursorRow];
                if (mode === 0) {
                    line.length = cursorCol;
                } else if (mode === 1) {
                    for (let c = 0; c < cursorCol && c < line.length; c++) {
                        line[c] = ' ';
                    }
                } else if (mode === 2) {
                    line.length = 0;
                }
            }
        } else if (command === 'J') {
            const mode = paramValues[0] || 0;
            if (mode === 2 || mode === 3) {
                lines.length = 0;
                lines.push([]);
                cursorRow = 0;
                cursorCol = 0;
            }
        }

        lastIndex = ansiRegex.lastIndex;
    }

    writeText(text.substring(lastIndex));

    const resultLines = lines.map(line => line.join(''));
    while (resultLines.length > 0 && resultLines[resultLines.length - 1] === '') {
        resultLines.pop();
    }

    return resultLines.join('\n');
};

/**
 * Execute Command Tool
 * Runs a terminal command and returns the output.
 * @param {string} args - JSON string of arguments
 * @param {Object} options - Tool options including onChunk callback
 */
export let activeChildProcess = null;
export let isActiveCommandPty = false;

export const writeToActiveCommand = (data) => {
    try {
        if (activeChildProcess) {
            if (isActiveCommandPty && typeof activeChildProcess.write === 'function') {
                // node-pty process
                activeChildProcess.write(data);
            } else if (activeChildProcess.stdin && activeChildProcess.stdin.writable) {
                activeChildProcess.stdin.write(data);
            }
        }
    } catch (err) {
        // Silently catch EPIPE or other stream errors to prevent app crash
    }
};

export const terminateActiveCommand = () => {
    if (activeChildProcess) {
        try {
            if (isActiveCommandPty && typeof activeChildProcess.destroy === 'function') {
                // node-pty cleanup
                activeChildProcess.destroy();
            } else if (typeof activeChildProcess.kill === 'function') {
                // Forcefully terminate the process and all its children
                if (process.platform === 'win32') {
                    spawn('taskkill', ['/pid', activeChildProcess.pid, '/f', '/t']);
                } else {
                    activeChildProcess.kill('SIGKILL');
                }
            }
        } catch (err) {
            // Process might already be dead
        }
        activeChildProcess = null;
        isActiveCommandPty = false;
    }
};

/**
 * Programmatically converts forward slashes to backslashes for path-like arguments
 * in Windows commands to prevent shell execution errors.
 */
export const adjustWindowsCommand = (command, usePowerShell = false) => {
    if (process.platform !== 'win32') return command;

    // Split command by space, respecting single/double quotes
    const tokens = [];
    let current = '';
    let inQuote = null;
    let isEscaped = false;

    for (let i = 0; i < command.length; i++) {
        const char = command[i];

        if (isEscaped) {
            current += char;
            isEscaped = false;
            continue;
        }

        if (char === '\\') {
            // Check if the next character is a space (escaped space)
            if (command[i + 1] === ' ') {
                current += ' ';
                i++; // Skip the space
                continue;
            }
            current += char;
            isEscaped = true;
            continue;
        }

        if (inQuote) {
            if (char === inQuote) {
                inQuote = null;
            }
            current += char;
        } else {
            if (char === '"' || char === "'") {
                inQuote = char;
                current += char;
            } else if (char === ';' && !current.includes('://')) {
                if (current.length > 0) {
                    tokens.push(current);
                    current = '';
                }
                tokens.push(usePowerShell ? ';' : '&');
            } else if (char === '&' && !current.includes('://')) {
                if (command[i + 1] === '&') {
                    if (current.length > 0) {
                        tokens.push(current);
                        current = '';
                    }
                    tokens.push('&&');
                    i++; // Skip the second &
                } else {
                    if (current.length > 0) {
                        tokens.push(current);
                        current = '';
                    }
                    tokens.push('&');
                }
            } else if (char === '|' && !current.includes('://')) {
                if (current.length > 0) {
                    tokens.push(current);
                    current = '';
                }
                tokens.push('|');
            } else if (/\s/.test(char)) {
                if (current.length > 0) {
                    tokens.push(current);
                    current = '';
                }
            } else {
                current += char;
            }
        }
    }
    if (current.length > 0) {
        tokens.push(current);
    }

    const looksLikePath = (str) => {
        // Must contain at least one forward slash
        if (!str.includes('/')) return false;

        // Ignore URLs
        if (/^(https?|file|ftp):\/\//i.test(str)) return false;

        // Ignore scoped npm packages (e.g. @types/inquirer)
        if (str.startsWith('@')) return false;

        // Ignore Windows command-line switches (starts with / and contains no other slashes)
        // e.g. /s, /q, /y, /?, /A, /help
        if (str.startsWith('/') && (str.match(/\//g) || []).length === 1) {
            return false;
        }

        // A path never has spaces directly adjacent to a slash (e.g. "a / b" is not a path)
        if (/\s\/|\/\s/.test(str)) return false;

        // Disqualify strings containing characters typical of code/expressions but never paths
        if (/[\(\)\{\}\;\<\>\=\'\"]/.test(str)) return false;

        return true;
    };

    // Post-process tokens to translate Unix '| tee' and '| cat >' to Windows '>' or '>>'
    // Also gracefully auto-corrects pipe typos '| file.txt' to '> file.txt'
    const translatedTokens = [];
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (token === 'mkdir' && usePowerShell && isPsAvailable()) {
            const paths = [];
            let j = i + 1;
            while (j < tokens.length) {
                const nextToken = tokens[j];
                const controlOperators = ['>', '>>', '<', '&', '&&', '|', '||', ';'];
                if (controlOperators.includes(nextToken)) {
                    break;
                }
                if (nextToken !== '-p' && nextToken !== '--parents' && nextToken !== '-v' && nextToken !== '--verbose') {
                    paths.push(nextToken);
                }
                j++;
            }
            if (paths.length > 0) {
                const processedPaths = paths.map(p => {
                    const unquoted = p.replace(/^['"]|['"]$/g, '');
                    let newPath = p;
                    if (looksLikePath(unquoted)) {
                        newPath = p.replace(/\//g, '\\');
                    }
                    return newPath;
                });
                translatedTokens.push('New-Item', '-ItemType', 'Directory', '-Force', '-Path', processedPaths.join(','));
            } else {
                translatedTokens.push('New-Item', '-ItemType', 'Directory', '-Force');
            }
            i = j - 1;
            continue;
        }

        if (token === 'rm' && usePowerShell && isPsAvailable()) {
            const paths = [];
            let recurse = false;
            let force = false;
            let j = i + 1;
            while (j < tokens.length) {
                const nextToken = tokens[j];
                const controlOperators = ['>', '>>', '<', '&', '&&', '|', '||', ';'];
                if (controlOperators.includes(nextToken)) {
                    break;
                }
                if (nextToken === '-rf' || nextToken === '-fr') {
                    recurse = true;
                    force = true;
                } else if (nextToken === '-r' || nextToken === '-R' || nextToken === '--recursive') {
                    recurse = true;
                } else if (nextToken === '-f' || nextToken === '--force') {
                    force = true;
                } else {
                    paths.push(nextToken);
                }
                j++;
            }
            const args = ['Remove-Item'];
            if (recurse) args.push('-Recurse');
            if (force) args.push('-Force');
            if (paths.length > 0) {
                const processedPaths = paths.map(p => {
                    const unquoted = p.replace(/^['"]|['"]$/g, '');
                    let newPath = p;
                    if (looksLikePath(unquoted)) {
                        newPath = p.replace(/\//g, '\\');
                    }
                    return newPath;
                });
                args.push('-Path', processedPaths.join(','));
            }
            translatedTokens.push(...args);
            i = j - 1;
            continue;
        }

        if (token === 'cp' && usePowerShell && isPsAvailable()) {
            const paths = [];
            let recurse = false;
            let force = false;
            let j = i + 1;
            while (j < tokens.length) {
                const nextToken = tokens[j];
                const controlOperators = ['>', '>>', '<', '&', '&&', '|', '||', ';'];
                if (controlOperators.includes(nextToken)) {
                    break;
                }
                if (nextToken === '-r' || nextToken === '-R' || nextToken === '--recursive') {
                    recurse = true;
                } else if (nextToken === '-f' || nextToken === '--force') {
                    force = true;
                } else {
                    paths.push(nextToken);
                }
                j++;
            }
            const args = ['Copy-Item'];
            if (recurse) args.push('-Recurse');
            if (force) args.push('-Force');
            if (paths.length > 0) {
                const processedPaths = paths.map(p => {
                    const unquoted = p.replace(/^['"]|['"]$/g, '');
                    let newPath = p;
                    if (looksLikePath(unquoted)) {
                        newPath = p.replace(/\//g, '\\');
                    }
                    return newPath;
                });
                if (processedPaths.length > 1) {
                    const dest = processedPaths.pop();
                    args.push('-Path', processedPaths.join(','), '-Destination', dest);
                } else {
                    args.push('-Path', processedPaths[0]);
                }
            }
            translatedTokens.push(...args);
            i = j - 1;
            continue;
        }

        if (token === 'touch' && usePowerShell && isPsAvailable()) {
            const paths = [];
            let j = i + 1;
            while (j < tokens.length) {
                const nextToken = tokens[j];
                const controlOperators = ['>', '>>', '<', '&', '&&', '|', '||', ';'];
                if (controlOperators.includes(nextToken)) {
                    break;
                }
                paths.push(nextToken);
                j++;
            }
            if (paths.length > 0) {
                const processedPaths = paths.map(p => {
                    const unquoted = p.replace(/^['"]|['"]$/g, '');
                    let newPath = p;
                    if (looksLikePath(unquoted)) {
                        newPath = p.replace(/\//g, '\\');
                    }
                    return newPath;
                });
                const psTouch = `(${processedPaths.join(', ')}) | ForEach-Object { if (Test-Path $_) { (Get-Item $_).LastWriteTime = [System.DateTime]::Now } else { $null | Out-File -FilePath $_ } }`;
                translatedTokens.push(psTouch);
            }
            i = j - 1;
            continue;
        }

        if (token === '|' && tokens[i + 1] === 'tee') {
            if (tokens[i + 2] === '-a') {
                translatedTokens.push('>>');
                i += 2; // Skip 'tee' and '-a'
            } else {
                translatedTokens.push('>');
                i += 1; // Skip 'tee'
            }
            continue;
        }

        if (token === '|' && tokens[i + 1] === 'cat' && tokens[i + 2] === '>') {
            translatedTokens.push('>');
            i += 2; // Skip 'cat' and '>'
            continue;
        }

        // Auto-correct '| folder/file.txt' to '> folder/file.txt'
        if (token === '|') {
            const nextToken = tokens[i + 1];
            if (nextToken) {
                const nextUnquoted = nextToken.replace(/^['"]|['"]$/g, '');
                const isWritableFile = /\.(txt|md|json|log|csv|html|css|py|js|xml|yaml|yml|pdf|docx|pptx|xlsx)$/i.test(nextUnquoted);
                if (looksLikePath(nextUnquoted) && isWritableFile) {
                    translatedTokens.push('>');
                    continue;
                }
            }
        }

        translatedTokens.push(token);
    }

    let inEchoArguments = false;
    const processedTokens = translatedTokens.map(token => {
        if (token === 'echo') {
            inEchoArguments = true;
            return token;
        }

        const controlOperators = ['>', '>>', '<', '&', '&&', '|', '||', ';'];
        if (controlOperators.includes(token)) {
            inEchoArguments = false;
        }

        const hasOuterQuotes = /^['"]|['"]$/.test(token);
        let processed = token;

        // If we are in echo arguments, strip outer quotes from this token!
        if (inEchoArguments && hasOuterQuotes) {
            processed = token.replace(/^['"]|['"]$/g, '');
        }

        const currentHasOuterQuotes = /^['"]|['"]$/.test(processed);
        const unquoted = processed.replace(/^['"]|['"]$/g, '');
        if (looksLikePath(unquoted)) {
            processed = processed.replace(/\//g, '\\');
        }

        // If the processed token contains a space and is not quoted, wrap it in double quotes!
        const finalUnquoted = processed.replace(/^['"]|['"]$/g, '');
        if (finalUnquoted.includes(' ') && !currentHasOuterQuotes) {
            processed = `"${finalUnquoted}"`;
        }

        return processed;
    });

    if (usePowerShell) {
        let cmdStr = '';
        let openBraces = 0;
        for (let i = 0; i < processedTokens.length; i++) {
            const token = processedTokens[i];
            if (token === '&&') {
                cmdStr += '; if ($?) {';
                openBraces++;
            } else if (token === ';') {
                cmdStr += ' }'.repeat(openBraces) + ';';
                openBraces = 0;
            } else {
                if (cmdStr && !cmdStr.endsWith(' ') && !cmdStr.endsWith('{')) {
                    cmdStr += ' ';
                }
                cmdStr += token;
            }
        }
        cmdStr += ' }'.repeat(openBraces);
        return cmdStr;
    }

    return processedTokens.join(' ');
};

export const exec_command = async (args, options = {}) => {
    const { command: rawCommand } = parseArgs(args);
    const { onChunk } = options;

    if (!rawCommand) return 'ERROR: Missing "command" argument for exec_command.';

    const isWin = process.platform === 'win32';
    const systemSettings = options.systemSettings || {};
    const netEnv = {};
    if (systemSettings.networkAccess === false) {
        netEnv.HTTP_PROXY = 'http://127.0.0.1:9999';
        netEnv.HTTPS_PROXY = 'http://127.0.0.1:9999';
        netEnv.ALL_PROXY = 'socks5://127.0.0.1:9999';
        netEnv.http_proxy = 'http://127.0.0.1:9999';
        netEnv.https_proxy = 'http://127.0.0.1:9999';
        netEnv.all_proxy = 'socks5://127.0.0.1:9999';
        netEnv.NO_PROXY = 'localhost,127.0.0.1';
    }

    return new Promise((resolve) => {
        const attempt = (usePowerShell) => {
            const command = adjustWindowsCommand(rawCommand, usePowerShell);
            let shell = isWin ? (usePowerShell ? 'powershell.exe' : 'cmd.exe') : (process.env.SHELL || 'bash');
            let shellArgs = isWin ? (usePowerShell ? ['-NoProfile', '-Command', command] : ['/c', command]) : ['-c', command];

            // --- 🔒 UNIX LOW-LEVEL KERNEL SANDBOXING 🔒 ---
            if (systemSettings.networkAccess === false && !isWin) {
                const originalShell = shell;
                const originalArgs = [...shellArgs];

                if (process.platform === 'linux') {
                    shell = 'unshare';
                    shellArgs = ['-n', '-r', originalShell, ...originalArgs];
                }
                else if (process.platform === 'darwin') {
                    const sbProfile = '(version 1)\n(allow default)\n(deny network-outbound)\n(allow network-outbound (remote ip "localhost:*"))\n(allow network-outbound (remote ip "127.0.0.1:*"))\n';
                    shell = 'sandbox-exec';
                    shellArgs = ['-p', sbProfile, originalShell, ...originalArgs];
                }
            }

            if (pty) {
                try {
                    const ptyProcess = pty.spawn(shell, shellArgs, {
                        name: 'xterm-256color',
                        cols: options.cols || 120,
                        rows: options.rows || 30,
                        cwd: process.cwd(),
                        env: {
                            ...process.env,
                            CI: 'false',
                            TERM: 'xterm-256color',
                            FORCE_COLOR: '1',
                            ...netEnv
                        }
                    });
                    activeChildProcess = ptyProcess;
                    isActiveCommandPty = true;
                    let output = '';

                    let isResolved = false;

                    ptyProcess.onData((data) => {
                        if (!isResolved) {
                            output += data;
                            if (onChunk) onChunk(data);

                            const cleanOut = stripAnsi(output);
                            if (/(?:Network:\s+use\s+--host\s+to|Network:\s+Type\s+--host\s+to|Local:\s+http:\/\/localhost:\d+|ready in \d+\s*ms|Compiled successfully|Development server is running|Listening on:)/i.test(cleanOut)) {
                                isResolved = true;
                                setTimeout(() => resolve(`SUCCESS: Dev server started successfully in background.\n\n${cleanOut}`), 500);
                            }
                        }
                    });

                    ptyProcess.onExit(({ exitCode }) => {
                        if (isResolved) return;
                        activeChildProcess = null;
                        // Resolve terminal movements/overwrites first
                        const normalizedOutput = cleanTerminalOutput(output || '');
                        const finalOutput = stripAnsi(normalizedOutput).replace(/\n{3,}/g, '\n\n') || 'Command executed with no output.';
                        if (exitCode !== 0) {
                            resolve(`ERROR: Command [${rawCommand}] failed with exit code [${exitCode}].\n\n${finalOutput}`);
                        } else {
                            resolve(`SUCCESS: Command [${rawCommand}] completed.\n\n${finalOutput}`);
                        }
                    });
                    return true;
                } catch (err) {
                    if (isWin && usePowerShell && err.code === 'ENOENT') {
                        return false; // Trigger CMD attempt
                    }
                    // Fallback to child_process if pty fails for other reasons
                    runStandardSpawn(resolve, command, rawCommand, netEnv, onChunk, usePowerShell, systemSettings);
                    return true;
                }
            } else {
                runStandardSpawn(resolve, command, rawCommand, netEnv, onChunk, usePowerShell, systemSettings);
                return true;
            }
        };

        if (isWin) {
            if (!attempt(true)) {
                attempt(false);
            }
        } else {
            attempt(false);
        }
    });
};

/**
 * Standard child_process.spawn fallback
 */
const runStandardSpawn = (resolve, command, rawCommand, netEnv, onChunk, usePowerShell = true, systemSettings = {}) => {
    const isWin = process.platform === 'win32';
    let shell = isWin ? (usePowerShell ? 'powershell.exe' : 'cmd.exe') : (process.env.SHELL || 'bash');
    let shellArgs = isWin ? (usePowerShell ? ['-NoProfile', '-Command', command] : ['/c', command]) : ['-c', command];

    // --- 🔒 UNIX LOW-LEVEL KERNEL SANDBOXING FOR FALLBACK ---
    if (systemSettings.networkAccess === false && !isWin) {
        const originalShell = shell;
        const originalArgs = [...shellArgs];

        if (process.platform === 'linux') {
            shell = 'unshare';
            shellArgs = ['-n', '-r', originalShell, ...originalArgs];
        } else if (process.platform === 'darwin') {
            const sbProfile = '(version 1)\n(allow default)\n(deny network-outbound)\n(allow network-outbound (remote ip "localhost:*"))\n(allow network-outbound (remote ip "127.0.0.1:*"))\n';
            shell = 'sandbox-exec';
            shellArgs = ['-p', sbProfile, originalShell, ...originalArgs];
        }
    }

    const child = isWin
        ? spawn(shell, shellArgs, { cwd: process.cwd(), env: { ...process.env, ...netEnv } })
        : spawn(shell, shellArgs, {
            cwd: process.cwd(),
            env: {
                ...process.env,
                CI: 'false',
                TERM: 'xterm-256color',
                FORCE_COLOR: '1',
                ...netEnv
            }
        });

    activeChildProcess = child;
    isActiveCommandPty = false;

    // Handle stdin errors (like EPIPE)
    if (child.stdin) {
        child.stdin.on('error', () => {
            activeChildProcess = null; // Clean up on stream error
        });
    }

    let stdout = '';
    let stderr = '';

    let isResolved = false;

    child.stdout.on('data', (data) => {
        if (!isResolved) {
            const chunk = data.toString();
            stdout += chunk;
            if (onChunk) onChunk(chunk);

            const cleanOut = stripAnsi(stdout);
            if (/(?:Network:\s+use\s+--host\s+to|Network:\s+Type\s+--host\s+to|Local:\s+http:\/\/localhost:\d+|ready in \d+\s*ms|Compiled successfully|Development server is running|Listening on:)/i.test(cleanOut)) {
                isResolved = true;
                setTimeout(() => resolve(`SUCCESS: Dev server started successfully in background.\n\n${cleanOut}`), 500);
            }
        }
    });

    child.stderr.on('data', (data) => {
        if (!isResolved) {
            const chunk = data.toString();
            stderr += chunk;
            if (onChunk) onChunk(chunk);
        }
    });

    child.on('close', (code) => {
        if (isResolved) return;
        activeChildProcess = null;
        const result = [];
        const cleanStdout = cleanTerminalOutput(stdout);
        const cleanStderr = cleanTerminalOutput(stderr);
        if (cleanStdout) result.push(`STDOUT:\n${cleanStdout}`);
        if (cleanStderr) result.push(`STDERR:\n${cleanStderr}`);
        if (code !== 0) result.push(`EXIT CODE: ${code}`);

        const rawOutput = result.join('\n\n') || 'Command executed with no output.';
        const finalOutput = stripAnsi(rawOutput).replace(/\n{3,}/g, '\n\n');

        if (code !== 0) {
            resolve(`ERROR: Command [${rawCommand}] failed with exit code [${code}].\n\n${finalOutput}`);
        } else {
            resolve(`SUCCESS: Command [${rawCommand}] completed.\n\n${finalOutput}`);
        }
    });

    child.on('error', (err) => {
        if (isWin && usePowerShell && err.code === 'ENOENT') {
            // PowerShell missing, retry with CMD
            const cmdCommand = adjustWindowsCommand(rawCommand, false);
            return runStandardSpawn(resolve, cmdCommand, rawCommand, netEnv, onChunk, false, systemSettings);
        }
        activeChildProcess = null;
        const errorMsg = err instanceof Error ? err.message : String(err);
        resolve(`ERROR: Failed to start command [${rawCommand}]: ${errorMsg}`);
    });
};
