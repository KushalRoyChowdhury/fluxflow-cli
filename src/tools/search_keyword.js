import fs from 'fs/promises';
import path from 'path';
import fg from 'fast-glob';
import { Minimatch } from 'minimatch';
import { parseArgs } from '../utils/arg_parser.js';
import fsSync from 'fs';

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
 * Normalize and tokenize a string for code-aware fuzzy comparison:
 * Splits on camelCase, snake_case, punctuation, and whitespace.
 */
function tokenizeStr(s, isKeyword = false) {
    if (!s) return [];
    // Split camelCase boundaries (e.g. "searchKeyword" -> "search Keyword")
    const decamelized = s.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
    // Replace non-alphanumeric with spaces and extract lowercase tokens
    const tokens = decamelized.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(Boolean);
    if (isKeyword && tokens.length > 1) {
        // When keyword has multiple words (e.g. "/ vrson"), filter out 1-char noise tokens like "/" or "a"
        const filtered = tokens.filter(t => t.length > 1);
        return filtered.length > 0 ? filtered : tokens;
    }
    return tokens;
}

/**
 * Levenshtein distance between two strings (capped early for performance).
 */
function levenshtein(a, b, cap = Infinity) {
    if (a === b) return 0;
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    if (Math.abs(a.length - b.length) > cap) return cap + 1;

    let row = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
        let nextRow = [i];
        let minInRow = i;
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            const dist = Math.min(
                nextRow[j - 1] + 1, // insertion
                row[j] + 1,        // deletion
                row[j - 1] + cost  // substitution
            );
            nextRow.push(dist);
            if (dist < minInRow) minInRow = dist;
        }
        row = nextRow;
        if (minInRow > cap) return cap + 1;
    }
    return row[b.length];
}

/**
 * Dynamic proportional threshold for allowed edit distance.
 */
function getMaxEditDistance(len) {
    if (len <= 2) return 0;
    if (len <= 5) return 1;
    if (len <= 10) return 2;
    return Math.min(3, Math.floor(len * 0.25));
}

function fuzzyMatch(line, keyword) {
    if (!line || !keyword) return false;
    const normLine = line.toLowerCase();
    const normKw = keyword.toLowerCase();

    // 1. Direct substring check (fastest path)
    if (normLine.includes(normKw)) return true;

    const lineWords = normLine.split(/[^a-z0-9]+/).filter(w => w.length > 0);
    const kwTokens = normKw.split(/[^a-z0-9]+/).filter(t => t.length > 1 || (normKw.length === 1 && t.length > 0));

    if (kwTokens.length === 0) return false;

    // 2. Every non-trivial token in the keyword must find a close match in lineWords
    return kwTokens.every(kwToken => {
        const maxDist = kwToken.length <= 2 ? 0 : (kwToken.length <= 5 ? 1 : 2);

        for (const lineWord of lineWords) {
            // A) Exact substring within lineWord (e.g. "files" in "getFilesRecursively")
            if (lineWord.includes(kwToken)) return true;

            // B) Levenshtein match for tokens of length >= 3
            if (kwToken.length >= 3 && lineWord.length >= 3 && Math.abs(lineWord.length - kwToken.length) <= maxDist) {
                if (levenshtein(kwToken, lineWord, maxDist) <= maxDist) return true;
            }
        }
        return false;
    });
}

/**
 * Search Keyword Tool
 * Searches for a specific keyword in the current workspace natively without shell commands.
 *
 * @param {string}  keyword          - The keyword/word (or regex pattern) to search for.
 * @param {string}  [path]           - Optional: restrict search to a specific file or directory.
 *                                     If a file path is given, only that file is searched.
 *                                     If a directory path is given (trailing slash optional),
 *                                     all files inside that directory are searched recursively.
 * @param {boolean} [fuzzy=false]    - When true, enables typo-tolerant fuzzy matching.
 * @param {boolean} [regex=false]    - When true, treats keyword as a regex pattern (case-insensitive).
 */
export const search_keyword = async (args) => {
    const { keyword: rawKeyword, path: pathArg, fuzzy, subString, regex } = parseArgs(args);
    if (rawKeyword === undefined || rawKeyword === null) return 'ERROR: Missing "keyword" argument.';
    const keyword = String(rawKeyword);

    // Normalise boolean-like flags
    const toBool = v => v === true || v === 'true' || v === 1 || v === '1' || v === 'yes';
    const regexExplicitlyFalse = regex === false || regex === 'false' || regex === 0 || regex === '0' || regex === 'no';
    const regexExplicitlyTrue = regex === true || regex === 'true' || regex === 1 || regex === '1' || regex === 'yes';
    const isFuzzy = toBool(fuzzy) || toBool(subString);

    // Build search matchers
    let regexPattern = null; // used for regex mode
    let wordRegex = null;    // used for normal (whole-word) mode

    if (regexExplicitlyFalse) {
        if (!isFuzzy) {
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
        let pathArgType = null; // 'file' | 'dir' | 'glob' | null

        if (pathArg) {
            // Support multiple patterns via semicolon separation, enabling negative globs (!pattern) without breaking brace expansion
            const patterns = pathArg.split(';').map(p => p.trim()).filter(Boolean);
            const hasNegation = patterns.some(p => p.startsWith('!'));
            const isGlob = patterns.some(p => fg.isDynamicPattern(p) || /[*?{}[\]()|+]/.test(p));
           if (isGlob) {
                pathArgType = 'glob';
                const posixPath = pathArg.replace(/\\/g, '/');
                const posixPatterns = patterns.map(p => p.replace(/\\/g, '/'));
                const globExcludes = excludes.map(ex => ex.startsWith('.') ? `**/*${ex}` : `**/${ex}/**`);
                const isNegativeOnly = hasNegation && !patterns.some(p => !p.startsWith('!'));

                if (isNegativeOnly) {
                    // Negative-only patterns: use recursive walker (prunes excludes during traversal, avoids node_modules walk)
                    const allFiles = await getFilesRecursively(rootDir, excludes, rootDir);
                    // Normalize: directory patterns like "src/" -> "src/**" to match contents
                    const normalizePattern = (p) => p.endsWith('/') ? p + '**' : p;
                    const negPatterns = posixPatterns.filter(p => p.startsWith('!')).map(p => normalizePattern(p.slice(1)));
                    const posPatterns = posixPatterns.filter(p => !p.startsWith('!')).map(normalizePattern);

                    filesToSearch = allFiles.filter(f => {
                        const rel = f.relativePath.replace(/\\/g, '/');
                        // Must match at least one positive pattern (or all if none specified)
                        const posMatch = posPatterns.length === 0 || posPatterns.some(p => {
                            try { return new Minimatch(p).match(rel); } catch { return false; }
                        });
                        // Must NOT match any negative pattern
                        const negMatch = negPatterns.some(p => {
                            try { return new Minimatch(p).match(rel); } catch { return false; }
                        });
                        return posMatch && !negMatch;
                    });
                } else {
                    // Mixed/positive patterns: fast-glob natively handles braces + negation in arrays
                    const hasRegexSyntax = posixPatterns.some(p => /[\(\)\|]|\.\*/.test(p));
                    let matchedPaths = [];
                    if (!hasRegexSyntax) {
                        try {
                            matchedPaths = await fg(posixPatterns, {
                                cwd: rootDir,
                                ignore: globExcludes,
                                dot: true,
                                onlyFiles: true,
                                absolute: false
                            });
                        } catch {
                            matchedPaths = [];
                        }
                    }

                    // If fast-glob was skipped or returned 0 matches and path has regex syntax, fallback to RegExp file filtering
                    if (matchedPaths.length === 0 && (hasRegexSyntax || fg.isDynamicPattern(posixPath))) {
                        // Extract static base directory before regex characters
                        const baseDirMatch = posixPath.match(/^([^\*\?\(\)\|\[\]\s]+)\//);
                        const scanDir = (baseDirMatch && !/[\*\?\(\)\|\[\]]/.test(baseDirMatch[1]))
                            ? path.resolve(rootDir, baseDirMatch[1])
                            : rootDir;
                        const allFiles = await getFilesRecursively(scanDir, excludes, rootDir);

                        try {
                            let cleanRegexStr = posixPath.replace(/^\.\//, '');
                            // Fix common model regex path patterns like `.*read_folder.*/.js` or `.*/.js` where `.*/.` was meant to match `.js` or `/\w+\.js`
                            cleanRegexStr = cleanRegexStr.replace(/\.\*\/(\\.|[^\/])/g, '.*$1');
                            if (!cleanRegexStr.startsWith('^') && !cleanRegexStr.startsWith('.*')) {
                                cleanRegexStr = `.*${cleanRegexStr}`;
                            }
                            const pathRegex = new RegExp(cleanRegexStr.endsWith('$') ? cleanRegexStr : `${cleanRegexStr}$`, 'i');
                            filesToSearch = allFiles.filter(f => {
                                const rel = f.relativePath.replace(/\\/g, '/');
                                return pathRegex.test(rel);
                            });
                        } catch {
                            filesToSearch = [];
                        }
                    } else {
                        filesToSearch = matchedPaths.map(relP => ({
                            fullPath: path.resolve(rootDir, relP),
                            relativePath: relP
                        }));
                    }
                }
            } else {
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
                    const matched = isFuzzy
                        ? (lines[i].toLowerCase().includes(keyword.toLowerCase()) || fuzzyMatch(lines[i], keyword))
                        : (regexExplicitlyFalse
                            ? (wordRegex && wordRegex.test(lines[i]))
                            : ((regexPattern && regexPattern.test(lines[i])) || (wordRegex && wordRegex.test(lines[i]))));
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

        const modeLabel = isFuzzy
            ? '(fuzzy mode)'
            : (regexExplicitlyTrue ? '(regex mode)' : (regexExplicitlyFalse ? '(keyword mode)' : '(standard mode)'));

        if (fileGroups.length === 0) {
            const zeroLocation = pathArgType === 'file'
                ? ` in '${pathArg}'`
                : (pathArgType === 'dir' || pathArgType === 'glob')
                    ? ` in '${pathArg}'`
                    : '. Try to specify files';
            const dirPrefix = pathArgType === 'dir' ? '[DIR]' : (pathArgType === 'glob' ? '[GLOB]' : '');
            return `${dirPrefix}${dirPrefix ? ' ' : ''}Found 0 matches of '${keyword}'${zeroLocation}${modeLabel ? ` ${modeLabel}` : ''}`;
        }

        const ml = modeLabel ? ` ${modeLabel}` : '';
        const fileCount = `${fileGroups.length} file${fileGroups.length === 1 ? '' : 's'}`;
        const matchCount = `${totalMatches} match${totalMatches === 1 ? '' : 'es'}`;
        let outputHeader;
        if (pathArgType === 'file') {
            outputHeader = `Found ${matchCount} of '${keyword}' in '${pathArg}'${ml}:`;
        } else if (pathArgType === 'dir' || pathArgType === 'glob') {
            outputHeader = `Found ${matchCount} of '${keyword}' in '${pathArg}' across ${fileCount}${ml}:`;
        } else {
            outputHeader = `Found ${matchCount} of '${keyword}' across ${fileCount}${ml}:`;
        }
        const dirPrefix = pathArgType === 'dir' ? '[DIR]' : (pathArgType === 'glob' ? '[GLOB]' : '');
        let output = `${dirPrefix}${dirPrefix ? ' ' : ''}${outputHeader}\n\n`;

        for (const group of fileGroups) {
            output += `${group.path}\n`;
            for (const m of group.matches) {
                output += `  ${m.line}: ${m.content}\n`;
            }
            output += '\n';
        }

        return output.trimEnd();

    } catch (error) {
        return `ERROR: ${error.message}`;
    }
};
