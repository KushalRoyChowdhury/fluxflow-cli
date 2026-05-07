import { exec } from 'child_process';
import { parseArgs } from '../utils/arg_parser.js';

/**
 * Search Keyword Tool
 * Searches for a specific keyword in the current workspace.
 */
export const search_keyword = async (args) => {
    const { keyword } = parseArgs(args);
    if (!keyword) return 'ERROR: Missing "keyword" argument.';

    const isWindows = process.platform === 'win32';
    const excludes = ['node_modules', '.git', 'dist', '.next', '.gemini'];
    
    // Command construction with shell-level exclusions for speed
    let command = '';
    if (isWindows) {
        // PowerShell optimization: filter directories early and resolve relative paths correctly
        const excludePattern = excludes.join('|').replace(/\./g, '\\.');
        command = `powershell -Command "Get-ChildItem -Path . -Recurse -File | Where-Object { $_.FullName -notmatch '${excludePattern}' } | Select-String -Pattern '${keyword}' | Select-Object -First 100 | ForEach-Object { $rel = Resolve-Path $_.Path -Relative; '{0}:{1}:' -f $rel, $_.LineNumber }"`;
    } else {
        // Grep optimization: skip directories entirely
        const excludeDirArgs = excludes.map(d => `--exclude-dir="${d}"`).join(' ');
        command = `grep -rnI ${excludeDirArgs} "${keyword}" . | head -n 100`;
    }

    return new Promise((resolve) => {
        // We use a large buffer (10MB) to handle large results
        exec(command, { cwd: process.cwd(), maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
            // Handle no matches (error code 1 for grep)
            if (error && error.code === 1 && !stdout) {
                return resolve(`Found 0 matches for keyword: "${keyword}"`);
            }
            if (error && !stdout) {
                return resolve(`ERROR: ${stderr || error.message}`);
            }

            const rawLines = stdout.trim().split('\n').filter(l => l.trim() !== '');
            if (rawLines.length === 0) return resolve(`Found 0 matches for keyword: "${keyword}"`);

            // Filter out common noise directories to keep results high-fidelity
            const filteredLines = rawLines.filter(line => {
                const lower = line.toLowerCase();
                return !lower.includes('node_modules') && 
                       !lower.includes('.git') && 
                       !lower.includes('dist') &&
                       !lower.includes('.next') &&
                       !lower.includes('.gemini');
            });

            if (filteredLines.length === 0) return resolve(`Found 0 matches for keyword: "${keyword}" (Filtered out system noise)`);

            const matches = filteredLines.slice(0, 100).map(line => {
                // Format: path:line:content (standard for both grep and findstr)
                const firstColon = line.indexOf(':');
                const secondColon = line.indexOf(':', firstColon + 1);
                
                if (firstColon === -1 || secondColon === -1) return null;
                
                const filePath = line.substring(0, firstColon).replace(/^(\.\/|\.\\)/, '');
                const lineNum = line.substring(firstColon + 1, secondColon);
                
                // Return exactly as requested: relative_path line_num
                return `${filePath} ${lineNum}`;
            }).filter(Boolean);

            let output = `Found ${filteredLines.length} matches:\n\n`;
            output += matches.join('\n');
            if (filteredLines.length > 100) {
                output += '\n\n... (Truncated to first 100 matches to avoid context bloat)';
            }

            resolve(output);
        });
    });
};
