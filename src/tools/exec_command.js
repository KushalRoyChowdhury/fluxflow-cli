import { spawn } from 'child_process';
import { parseArgs } from '../utils/arg_parser.js';

/**
 * Execute Command Tool
 * Runs a terminal command and returns the output.
 * @param {string} args - JSON string of arguments
 * @param {Object} options - Tool options including onChunk callback
 */
export let activeChildProcess = null;

export const writeToActiveCommand = (data) => {
    try {
        if (activeChildProcess && activeChildProcess.stdin && activeChildProcess.stdin.writable) {
            activeChildProcess.stdin.write(data);
        }
    } catch (err) {
        // Silently catch EPIPE or other stream errors to prevent app crash
    }
};

export const terminateActiveCommand = () => {
    if (activeChildProcess) {
        try {
            // Forcefully terminate the process and all its children
            activeChildProcess.kill('SIGKILL');
        } catch (err) {
            // Process might already be dead
        }
        activeChildProcess = null;
    }
};

/**
 * Programmatically converts forward slashes to backslashes for path-like arguments
 * in Windows commands to prevent shell execution errors.
 */
export const adjustWindowsCommand = (command) => {
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
                tokens.push('&');
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

    return processedTokens.join(' ');
};

export const exec_command = async (args, options = {}) => {
    const { command: rawCommand } = parseArgs(args);
    const { onChunk } = options;
    
    if (!rawCommand) return 'ERROR: Missing "command" argument for exec_command.';

    const command = adjustWindowsCommand(rawCommand);

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
        // Use shell: true for Windows (handles .cmd, .bat, pnpm etc)
        // Inject interactive environment variables to "trick" CLI tools into showing prompts
        const child = spawn(command, { 
            shell: true, 
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
        
        // Handle stdin errors (like EPIPE)
        if (child.stdin) {
            child.stdin.on('error', () => {
                activeChildProcess = null; // Clean up on stream error
            });
        }
        
        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
            const chunk = data.toString();
            stdout += chunk;
            if (onChunk) onChunk(chunk);
        });

        child.stderr.on('data', (data) => {
            const chunk = data.toString();
            stderr += chunk;
            if (onChunk) onChunk(chunk);
        });

        child.on('close', (code) => {
            activeChildProcess = null;
            const result = [];
            if (stdout) result.push(`STDOUT:\n${stdout}`);
            if (stderr) result.push(`STDERR:\n${stderr}`);
            if (code !== 0) result.push(`EXIT CODE: ${code}`);

            const finalOutput = result.join('\n\n') || 'Command executed with no output.';
            
            if (code !== 0) {
                resolve(`ERROR: Command [${rawCommand}] failed with exit code [${code}].\n\n${finalOutput}`);
            } else {
                resolve(`SUCCESS: Command [${rawCommand}] completed.\n\n${finalOutput}`);
            }
        });

        child.on('error', (err) => {
            activeChildProcess = null;
            resolve(`ERROR: Failed to start command [${rawCommand}]: ${err.message}`);
        });
    });
};
