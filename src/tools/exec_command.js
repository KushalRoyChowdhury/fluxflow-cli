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

export const exec_command = async (args, options = {}) => {
    const { command } = parseArgs(args);
    const { onChunk } = options;
    
    if (!command) return 'ERROR: Missing "command" argument for exec_command.';

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
                resolve(`FAILURE: Command [${command}] failed.\n\n${finalOutput}`);
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
