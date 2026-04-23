import { spawn } from 'child_process';
import { parseArgs } from '../utils/arg_parser.js';

/**
 * Execute Command Tool
 * Runs a terminal command and returns the output.
 * @param {string} args - JSON string of arguments
 * @param {Object} options - Tool options including onChunk callback
 */
export const exec_command = async (args, options = {}) => {
    const { command } = parseArgs(args);
    const { onChunk } = options;
    
    if (!command) return 'ERROR: Missing "command" argument for exec_command.';

    return new Promise((resolve) => {
        // Use shell: true for Windows (handles .cmd, .bat, pnpm etc)
        const child = spawn(command, { shell: true, cwd: process.cwd() });
        
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
            resolve(`ERROR: Failed to start command [${command}]: ${err.message}`);
        });
    });
};
