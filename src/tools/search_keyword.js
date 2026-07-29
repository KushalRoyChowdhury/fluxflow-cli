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
        const fileNameLower = file.name.toLowerCase();

        const isExcluded = excludes.some(ex => {
            const exLower = ex.toLowerCase();
            if (exLower.startsWith('.') && fileNameLower.endsWith(exLower)) {
                return true;
            }
            return pathSegments.some(seg => seg === exLower || seg.startsWith('.pnpm'));
        });

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
 * @param {string}  keyword            - The keyword/word (or regex pattern) to search for.
 * @param {string}  [path]             - Optional: restrict search to a specific file or directory.
 *                                       If a file path is given, only that file is searched.
 *                                       If a directory path is given (trailing slash optional),
 *                                       all files inside that directory are searched recursively.
 * @param {boolean} [subString=false]  - When true, matches any substring (with fuzzy fallback).
 * @param {boolean} [regex=false]      - When true, treats keyword as a regex pattern (case-insensitive).
 *                                       Takes priority over subString mode.
 */
export const search_keyword = async (args) => {
    const { keyword: rawKeyword, path: pathArg, subString, regex } = parseArgs(args);
    if (rawKeyword === undefined || rawKeyword === null) return 'ERROR: Missing "keyword" argument.';
    const keyword = String(rawKeyword);

    // Normalise boolean-like flags
    const toBool = v => v === true || v === 'true' || v === 1 || v === '1' || v === 'yes';
    const regexExplicitlyFalse = regex === false || regex === 'false' || regex === 0 || regex === '0' || regex === 'no';
    const regexExplicitlyTrue = regex === true || regex === 'true' || regex === 1 || regex === '1' || regex === 'yes';
    let matchSubstring = regexExplicitlyFalse && toBool(subString);

    // Build search matchers
    let regexPattern = null; // used for regex mode
    let wordRegex = null;    // used for normal (whole-word) mode

    if (regexExplicitlyFalse) {
        if (!matchSubstring) {
            wordRegex = new RegExp(`(?<![\\w])${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w])`, 'i');
        }
    } else {
        // If regex is not explicitly false (default or explicit true), search both regex & normal whole-word unless regex fails
        try {
            regexPattern = new RegExp(keyword, 'i');
        } catch (e) {
            if (regexExplicitlyTrue) {
                return `ERROR: Invalid regex pattern "${keyword}": ${e.message}`;
            }
            // If regex auto-failed and wasn't explicitly requested as true, fall back gracefully
        }
        wordRegex = new RegExp(`(?<![\\w])${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w])`, 'i');
    }

    const excludes = [
        // Clutter, VCS, Cache & Build Directories
        '.git', 'node_modules', '.gemini', 'dist', 'build', '.next', 'out',
        '.cache', 'bin', 'obj', 'vendor', 'venv', '.idea', '.gradle',
        '.terraform', 'target', 'coverage', '.vscode',
        '.svn', '.hg', '.fslckout', '.github', '.gitlab', '.circleci',
        '.gitea', '.gitee', '.lerna', '.changeset', '.nx',
        '.npm', '.yarn', '.pnpm-store', '.pnpm', '.expo', '.nuxt', '.svelte-kit',
        '.docusaurus', '.turbo', '.vercel', 'bower_components', '.netlify',
        '.vuepress', '.quasar', '.output', '.angular', 'jspm_packages',
        '.parcel-cache', '.rollup.cache', '.rspack', '.vitepress',
        '__pycache__', '.pytest_cache', '.mypy_cache', '.tox', '.poetry',
        'env', 'vhdl', '.ipynb_checkpoints', '.jupyter', '.conda', '.pdm-build',
        '.bundle', '.yardoc', '.metadata', 'App_Data', 'ClientBin',
        '.cargo', '.rustc_info', '.go', 'Godeps', '_vendor', '.rake_tasks',
        'CMakefiles', '.wakatime',
        '.dart_tool', '.fvm', '.cocoapods', 'Pods', '.pub-cache',
        '.symlinks', 'DerivedData', '.xcworkspace',
        '.serverless', '.aws', '.gcloud', '.azure', '.kube',
        '.vagrant', '.docker', 'postgres-data', 'redis-data', 'mongo-data',
        '.Spotlight-V100', '.Trashes', '$RECYCLE.BIN',
        'System Volume Information', '.DocumentRevisions-V100', '.fseventsd',
        'AppData', 'Application Data', 'Local', 'LocalLow', 'Roaming',
        '$WinREAgent', '$WINDOWS.~BT', '$WINDOWS.~WS', 'scw', 'System32', 'SysWOW64',
        '.AppleDouble', '.AppleDB', '.AppleDesktop', '_CodeSignature',
        '.cmio', '.LSOverride', '.localized', '.TemporaryItems',
        '.Trash', '.Trash-0', '.Trash-1000', '.gvfs', '.local', '.config',
        '.dbus', '.fontconfig', '.snap', '.var', '.lost+found', 'lost+found',
        '.thumb', '.thumbnails',
        'EFI', 'boot', 'grub',
        'logs', 'log', '.nyc_output', '.sonar', '.ruff_cache', '.VSCodeCounter',

        // Binaries, Media, Compressed & Font Files
        '.exe', '.dll', '.so', '.dylib', '.png', '.jpg', '.jpeg', '.gif', '.ico',
        '.svg', '.webp', '.mp3', '.mp4', '.avi', '.zip', '.tgz', '.tar', '.gz',
        '.7z', '.rar', '.pdf', '.docx', '.xlsx', '.pptx', '.woff', '.woff2', '.ttf', '.eot'
    ];
    const maxMatches = 150;

    try {
        let filesToSearch = [];
        const rootDir = process.cwd();
        let pathArgType = null; // 'file' | 'dir' | null

        if (pathArg) {
            // Strip trailing slash so both "src/utils" and "src/utils/" work
            const normalised = pathArg.replace(/[\/\\]+$/, '');
            const fullPath = path.resolve(rootDir, normalised);
            try {
                const stat = await fs.stat(fullPath);
                if (stat.isDirectory()) {
                    pathArgType = 'dir';
                    filesToSearch = await getFilesRecursively(fullPath, excludes, rootDir);
                } else if (stat.isFile()) {
                    pathArgType = 'file';
                    filesToSearch.push({ fullPath, relativePath: path.relative(rootDir, fullPath) });
                } else {
                    return `ERROR: Path is neither a file nor a directory: ${pathArg}`;
                }
            } catch {
                return `ERROR: Path not found: ${pathArg}`;
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
                    const matched = regexExplicitlyFalse
                        ? (matchSubstring
                            ? (lines[i].toLowerCase().includes(keyword.toLowerCase()) || fuzzyMatch(lines[i], keyword))
                            : (wordRegex && wordRegex.test(lines[i])))
                        : ((regexPattern && regexPattern.test(lines[i])) || (wordRegex && wordRegex.test(lines[i])));
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

        const modeLabel = regexExplicitlyFalse
            ? (matchSubstring ? '(subString mode)' : '(keyword mode)')
            : (regexExplicitlyTrue ? '(regex mode)' : '(standard mode)');

        if (fileGroups.length === 0) {
            const zeroLocation = pathArgType === 'file'
                ? ` in '${pathArg}'`
                : pathArgType === 'dir'
                    ? ` in '${pathArg}'`
                    : '. Try to specify files';
            const dirPrefix = pathArgType === 'dir' ? '[DIR]' : '';
            return `${dirPrefix}Found 0 matches of '${keyword}'${zeroLocation}${modeLabel ? ` ${modeLabel}` : ''}`;
        }

        const ml = modeLabel ? ` ${modeLabel}` : '';
        const fileCount = `${fileGroups.length} file${fileGroups.length === 1 ? '' : 's'}`;
        const matchCount = `${totalMatches} match${totalMatches === 1 ? '' : 'es'}`;
        let outputHeader;
        if (pathArgType === 'file') {
            outputHeader = `Found ${matchCount} of '${keyword}' in '${pathArg}'${ml}:`;
        } else if (pathArgType === 'dir') {
            outputHeader = `Found ${matchCount} of '${keyword}' in '${pathArg}' across ${fileCount}${ml}:`;
        } else {
            outputHeader = `Found ${matchCount} of '${keyword}' across ${fileCount}${ml}:`;
        }
        const dirPrefix = pathArgType === 'dir' ? '[DIR]' : '';
        let output = `${dirPrefix}${outputHeader}\n\n`;

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
