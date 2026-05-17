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
        if (!str.includes('/') || /^(https?|file|ftp):\/\//i.test(str)) {
            return false;
        }

        const firstSlashIdx = str.indexOf('/');
        const lastSlashIdx = str.lastIndexOf('/');
        if (firstSlashIdx === 0 && lastSlashIdx === 0) {
            return false;
        }

        const hasDriveLetter = /^[a-zA-Z]:\//.test(str);
        const hasRelativeStart = /^\.?\.?\//.test(str);
        const hasMultipleSlashes = (str.match(/\//g) || []).length > 1;
        const hasExtension = /\.[a-zA-Z0-9_-]+$/.test(str);

        return hasDriveLetter || hasRelativeStart || hasMultipleSlashes || hasExtension;
    };

    const processedTokens = tokens.map(token => {
        const unquoted = token.replace(/^['"]|['"]$/g, '');
        if (looksLikePath(unquoted)) {
            return token.replace(/\//g, '\\');
        }
        return token;
    });

    return processedTokens.join(' ');
};

export const exec_command = async (args, options = {}) => {
    const { command: rawCommand } = parseArgs(args);
    const { onChunk } = options;
    
    if (!rawCommand) return 'ERROR: Missing "command" argument for exec_command.';

    const command = adjustWindowsCommand(rawCommand);

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
                FORCE_COLOR: '1'
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
                resolve(`ERROR: Command [${command}] failed with exit code [${code}].\n\n${finalOutput}`);
            } else {
                resolve(`SUCCESS: Command [${command}] completed.\n\n${finalOutput}`);
            }
        });

        child.on('error', (err) => {
            activeChildProcess = null;
            resolve(`ERROR: Failed to start command [${command}]: ${err.message}`);
        });
    });
};
