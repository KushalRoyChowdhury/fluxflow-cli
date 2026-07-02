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
    let list;

    try {
        list = await fs.readdir(dir, { withFileTypes: true });
    } catch {
        return []; // Gracefully skip unreadable or restricted directories
    }

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
 * Normalize a string for fuzzy comparison:
 * lowercase, strip all non-alphanumeric chars (punctuation, quotes, etc.), collapse whitespace.
 */
function normStr(s) {
    return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Levenshtein distance between two strings (capped early for performance).
 */
function levenshtein(a, b) {
    if (a === b) return 0;
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const cap = Math.floor(Math.max(a.length, b.length) / 2) + 1; // max tolerated distance
    const dp = Array.from({ length: a.length + 1 }, (_, i) => i);
    for (let j = 1; j <= b.length; j++) {
        let prev = dp[0];
        dp[0] = j;
        for (let i = 1; i <= a.length; i++) {
            const tmp = dp[i];
            dp[i] = b[j - 1] === a[i - 1]
                ? prev
                : 1 + Math.min(prev, dp[i], dp[i - 1]);
            prev = tmp;
        }
        if (Math.min(...dp) > cap) return cap + 1; // bail early
    }
    return dp[a.length];
}

/**
 * Fuzzy match: every token of the normalized keyword must find a "close enough"
 * word in the normalized line.
 * Tolerance: 0 for 1-2 char tokens, 1 for 3-5 chars, 2 for 6+ chars.
 */
function fuzzyMatch(line, keyword) {
    const normLine = normStr(line);
    const lineWords = normLine.split(' ');
    const kwTokens = normStr(keyword).split(' ').filter(Boolean);

    // First: fast path – if normalized keyword is a substring, accept immediately
    if (normLine.includes(normStr(keyword))) return true;

    // Second: every keyword token must find a close-enough word on the line
    return kwTokens.every(token => {
        const maxDist = token.length <= 2 ? 0 : token.length <= 5 ? 1 : 2;
        return lineWords.some(word => levenshtein(token, word) <= maxDist);
    });
}

/**
 * Search Keyword Tool
 * Searches for a specific keyword in the current workspace natively without shell commands.
 *
 * @param {string}  keyword   - The keyword/word to search for.
 * @param {string}  [file]    - Optional: restrict search to a specific file.
 * @param {boolean} [subString=false] - When true, matches any substring (with fuzzy fallback);
 *                                      when false (default), matches whole words only.
 */
export const search_keyword = async (args) => {
    const { keyword, file, subString } = parseArgs(args);
    if (!keyword) return 'ERROR: Missing "keyword" argument.';

    // Normalise subString: accept boolean true or string 'true'
    const matchSubstring = subString === true || subString === 'true' || subString === 1 || subString === '1' || subString === "true" || subString === "yes" || subString === 'yes' || false;

    // Build a word-boundary regex for whole-word matching (case-insensitive)
    const wordRegex = new RegExp(`(?<![\\w])${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w])`, 'i');

    const excludes = [
        'node_modules', '.git', 'dist', '.next', '.gemini',
        '.exe', '.dll', '.png', '.jpg', '.jpeg', '.gif', '.zip', '.tgz'
    ];
    const maxMatches = 150;

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

        // Parallel processing of files for massive asynchronous performance boosts! ⚡
        const searchPromises = filesToSearch.map(async (fileObj) => {
            try {
                const content = await fs.readFile(fileObj.fullPath, 'utf-8');

                if (content.includes('\u0000')) return [];

                const lines = content.split(/\r?\n/);
                const fileMatches = [];

                for (let i = 0; i < lines.length; i++) {
                    const matched = matchSubstring
                        ? lines[i].toLowerCase().includes(keyword.toLowerCase()) || fuzzyMatch(lines[i], keyword)  // substring + fuzzy fallback
                        : wordRegex.test(lines[i]);                               // default: whole-word only (case-insensitive)
                    if (matched) {
                        fileMatches.push({ line: i + 1, content: lines[i].trim() });
                    }
                }

                if (fileMatches.length === 0) return null;

                const displayPath = fileObj.relativePath.replace(/\\/g, '/');
                return { path: displayPath, matches: fileMatches };
            } catch {
                return []; // Skip if file is strictly locked by the OS
            }
        });

        const settledResults = await Promise.all(searchPromises);
        // Filter out null (no-match) entries and enforce the global cap by total match count
        const fileGroups = [];
        let totalMatches = 0;
        for (const result of settledResults) {
            if (!result || !result.matches) continue;
            if (totalMatches >= maxMatches) break;
            const remaining = maxMatches - totalMatches;
            const trimmedMatches = result.matches.slice(0, remaining);
            fileGroups.push({ path: result.path, matches: trimmedMatches });
            totalMatches += trimmedMatches.length;
        }

        if (typeof global.gc === 'function') {
            global.gc();
        }

        if (fileGroups.length === 0) {
            return `Found 0 matches for keyword: "${keyword}"${file ? ` in file: ${file}` : '. Try to specify files'} ${matchSubstring ? '(subString mode)' : ''}`;
        }

        let output = `Found ${totalMatches} match${totalMatches === 1 ? '' : 'es'} across ${fileGroups.length} file${fileGroups.length === 1 ? '' : 's'} ${matchSubstring ? '(subString mode)' : ''}:\n\n`;

        for (const group of fileGroups) {
            output += `${group.path}\n`;
            for (let i = 0; i < group.matches.length; i++) {
                const isLast = i === group.matches.length - 1;
                const prefix = isLast ? '└──' : '├──';
                output += `${prefix} ${group.matches[i].line}: ${group.matches[i].content}\n`;
            }
            output += '\n';
        }

        return output.trimEnd();

    } catch (error) {
        return `ERROR: ${error.message}`;
    }
};
