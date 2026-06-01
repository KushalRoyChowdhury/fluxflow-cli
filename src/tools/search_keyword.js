import fs from 'fs/promises';
import path from 'path';
import { parseArgs } from '../utils/arg_parser.js';

/**
 * Helper function to recursively scan a directory for files,
 * respecting the exclusion list and limiting recursion to a depth of 12.
 */
async function getFilesRecursively(dir, excludes, baseDir = dir, depth = 1) {
    if (depth > 12) return [];

    let results = [];
    const list = await fs.readdir(dir, { withFileTypes: true });

    for (const file of list) {
        const fullPath = path.join(dir, file.name);
        const relativePath = path.relative(baseDir, fullPath);

        const pathSegments = relativePath.split(path.sep).map(s => s.toLowerCase());
        const isExcluded = excludes.some(ex => pathSegments.includes(ex.toLowerCase()));

        if (isExcluded) continue;

        if (file.isDirectory()) {
            const nestedFiles = await getFilesRecursively(fullPath, excludes, baseDir, depth + 1);
            results = results.concat(nestedFiles);
        } else if (file.isFile()) {
            results.push({ fullPath, relativePath });
        }
    }

    return results;
}

/**
 * Search Keyword Tool
 * Searches for a specific keyword in the current workspace natively without shell commands.
 */
export const search_keyword = async (args) => {
    const { keyword, file } = parseArgs(args);
    if (!keyword) return 'ERROR: Missing "keyword" argument.';

    const excludes = ['node_modules', '.git', 'dist', '.next', '.gemini'];
    const maxMatches = 150;
    let matches = [];

    try {
        let filesToSearch = [];
        const rootDir = process.cwd();

        if (file) {
            const fullPath = path.resolve(rootDir, file);
            try {
                const stat = await fs.stat(fullPath);
                if (stat.isFile()) {
                    filesToSearch.push({ fullPath, relativePath: path.relative(rootDir, fullPath) });
                }
            } catch {
                return `ERROR: File not found: ${file}`;
            }
        } else {
            filesToSearch = await getFilesRecursively(rootDir, excludes);
        }

        // Loop through files and check line-by-line
        for (const fileObj of filesToSearch) {
            if (matches.length >= maxMatches) break;

            // fs.readFile opens and closes the file descriptor automatically safely! 🔒
            let content = await fs.readFile(fileObj.fullPath, 'utf-8');

            if (content.includes('\u0000')) {
                content = null; // Instantly free up memory if it's binary
                continue;
            }

            const lines = content.split(/\r?\n/);
            content = null; // ✨ Free up the massive raw file string immediately!

            for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes(keyword)) {
                    const displayPath = fileObj.relativePath.replace(/\\/g, '/');
                    matches.push(`${displayPath} → ${i + 1}`);

                    if (matches.length >= maxMatches) break;
                }
            }

            // Explicitly clear references for V8 engine optimization
            lines.length = 0;
        }

        // Clean up the main file list references
        filesToSearch = null;

        // 🧼 Manual Garbage Collection Hint (Optional)
        // This will run if you execute node with the `--expose-gc` flag!
        if (typeof global.gc === 'function') {
            global.gc();
        }

        if (matches.length === 0) {
            return `Found 0 matches for keyword: "${keyword}"${file ? ` in file: ${file}` : ''}`;
        }

        let output = `Found ${matches.length} matches:\n\n`;
        output += matches.join('\n');
        return output;

    } catch (error) {
        return `ERROR: ${error.message}`;
    }
};