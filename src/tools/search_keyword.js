import { exec } from 'child_process';
import { parseArgs } from '../utils/arg_parser.js';
import path from 'path';

/**
 * Search Keyword Tool
 * Searches for a specific keyword in the current workspace.
 */
export const search_keyword = async (args) => {
    const { keyword, file } = parseArgs(args);
    if (!keyword) return 'ERROR: Missing "keyword" argument.';

    const isWindows = process.platform === 'win32';
    const excludes = ['node_modules', '.git', 'dist', '.next', '.gemini'];
    const currentFolder = path.basename(process.cwd());

    // Command construction
    let command = '';
    if (file) {
        // Targeted search in a specific file
        if (isWindows) {
            command = `powershell -NoProfile -Command "if (Test-Path '${file}') { Select-String -Path '${file}' -Pattern '${keyword}' -ErrorAction SilentlyContinue | Select-Object -First 150 | ForEach-Object { '{0}|{1}' -f $_.Path, $_.LineNumber } } else { Write-Error 'File not found: ${file}' }"`;
        } else {
            command = `grep -HnI "${keyword}" "${file}" | head -n 150`;
        }
    } else {
        // Global project search
        if (isWindows) {
            const excludePattern = excludes.join('|').replace(/\./g, '\\.');
            // Anchor the exclusion regex to only match inside the current folder scope
            command = `powershell -NoProfile -Command "Get-ChildItem -Path . -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch '${currentFolder}.*\\\\(${excludePattern})' } | Select-String -Pattern '${keyword}' -ErrorAction SilentlyContinue | Select-Object -First 150 | ForEach-Object { '{0}|{1}' -f $_.Path, $_.LineNumber }"`;
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

            const matches = rawLines.slice(0, 150).map(line => {
                let filePath, lineNum;
                if (line.includes('|')) {
                    // Our custom PowerShell format: path|lineNum
                    const parts = line.split('|');
                    let rawPath = parts[0];
                    if (path.isAbsolute(rawPath)) {
                        rawPath = path.relative(process.cwd(), rawPath);
                    }
                    filePath = rawPath.replace(/^(\.\/|\.\\)/, '').replace(/\\/g, '/');
                    lineNum = parts[1];
                } else {
                    // Grep format: path:line:content
                    let rawPath;
                    const driveMatch = line.match(/^([a-zA-Z]:)/);
                    if (driveMatch) {
                        const startSearch = 2;
                        const nextColon = line.indexOf(':', startSearch);
                        const thirdColon = line.indexOf(':', nextColon + 1);
                        if (nextColon !== -1 && thirdColon !== -1) {
                            rawPath = line.substring(0, nextColon);
                            lineNum = line.substring(nextColon + 1, thirdColon);
                        }
                    } else {
                        const firstColon = line.indexOf(':');
                        const secondColon = line.indexOf(':', firstColon + 1);
                        if (firstColon !== -1 && secondColon !== -1) {
                            rawPath = line.substring(0, firstColon);
                            lineNum = line.substring(firstColon + 1, secondColon);
                        }
                    }

                    if (!rawPath || !lineNum) return null;

                    if (path.isAbsolute(rawPath)) {
                        rawPath = path.relative(process.cwd(), rawPath);
                    }
                    filePath = rawPath.replace(/^(\.\/|\.\\)/, '').replace(/\\/g, '/');
                    lineNum = lineNum;
                }

                if (!filePath || !lineNum) return null;

                // Absolute path resolution to thoroughly isolate project-level noise from parent global directories
                const absoluteFilePath = path.resolve(process.cwd(), filePath).toLowerCase().replace(/\\/g, '/');
                const pathSegments = absoluteFilePath.split('/');

                const currentFolderLower = currentFolder.toLowerCase();
                const folderIndex = pathSegments.lastIndexOf(currentFolderLower);

                // Extract only the segments inside your actual workspace folder
                const relativeSegments = folderIndex !== -1 ? pathSegments.slice(folderIndex + 1) : pathSegments;

                const isNoise = excludes.some(ex => relativeSegments.includes(ex.toLowerCase()));
                if (isNoise) return null;

                return `${filePath} ${lineNum}`;
            }).filter(Boolean);

            if (matches.length === 0) return resolve(`Found 0 matches for keyword: "${keyword}"${file ? ` in file: ${file}` : ''}`);

            let output = `Found ${matches.length} matches:\n\n`;
            output += matches.join('\n');
            if (matches.length >= 150) {
                output += '\n\n... (Truncated to first 150 matches)';
            }

            resolve(output);
        });
    });
};