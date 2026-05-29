import { exec } from 'child_process';
import { parseArgs } from '../utils/arg_parser.js';

/**
 * Search Keyword Tool
 * Searches for a specific keyword in the current workspace.
 */
export const search_keyword = async (args) => {
    const { keyword, file } = parseArgs(args);
    if (!keyword) return 'ERROR: Missing "keyword" argument.';

    const isWindows = process.platform === 'win32';
    const excludes = ['node_modules', '.git', 'dist', '.next', '.gemini'];

    // Command construction
    let command = '';
    if (file) {
        // Targeted search in a specific file
        if (isWindows) {
            command = `powershell -Command "if (Test-Path '${file}') { Select-String -Path '${file}' -Pattern '${keyword}' | Select-Object -First 150 | ForEach-Object { $rel = Resolve-Path $_.Path -Relative; '{0}:{1}:' -f $rel, $_.LineNumber } } else { Write-Error 'File not found: ${file}' }"`;
        } else {
            command = `grep -HnI "${keyword}" "${file}" | head -n 150`;
        }
    } else {
        // Global project search
        if (isWindows) {
            const excludePattern = excludes.join('|').replace(/\./g, '\\.');
            command = `powershell -Command "Get-ChildItem -Path . -Recurse -File | Where-Object { $_.FullName -notmatch '${excludePattern}' } | Select-String -Pattern '${keyword}' | Select-Object -First 150 | ForEach-Object { $rel = Resolve-Path $_.Path -Relative; '{0}:{1}:' -f $rel, $_.LineNumber }"`;
        } else {
            const excludeDirArgs = excludes.map(d => `--exclude-dir="${d}"`).join(' ');
            command = `grep -rnI ${excludeDirArgs} "${keyword}" . | head -n 150`;
        }
    }

    return new Promise((resolve) => {
        exec(command, { cwd: process.cwd(), maxBuffer: 15 * 1024 * 1024 }, (error, stdout, stderr) => {
            // Handle error case for file not found or other command failures
            if (error && stderr && stderr.includes('File not found')) {
                return resolve(`ERROR: File not found: ${file}`);
            }

            // Handle no matches (error code 1 for grep)
            if (error && error.code === 1 && !stdout) {
                return resolve(`Found 0 matches for keyword: "${keyword}"${file ? ` in file: ${file}` : ''}`);
            }
            if (error && !stdout) {
                return resolve(`ERROR: ${stderr || error.message}`);
            }

            const rawLines = stdout.trim().split('\n').filter(l => l.trim() !== '');
            if (rawLines.length === 0) return resolve(`Found 0 matches for keyword: "${keyword}"${file ? ` in file: ${file}` : ''}`);

            // Filter out common noise directories to keep results high-fidelity
            const filteredLines = rawLines.filter(line => {
                const lower = line.toLowerCase();
                return !lower.includes('node_modules') &&
                       !lower.includes('.git') &&
                       !lower.includes('dist') &&
                       !lower.includes('.next') &&
                       !lower.includes('.gemini');
            });

            if (filteredLines.length === 0) return resolve(`Found 0 matches for keyword: "${keyword}"${file ? ` in file: ${file}` : ''}`);

            const matches = filteredLines.slice(0, 150).map(line => {
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
            if (filteredLines.length > 150) {
                output += '\n\n... (Truncated to first 150 matches)';
            }

            resolve(output);
        });
    });
};
