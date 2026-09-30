import fs from 'fs/promises';
import path from 'path';
import { parseArgs } from '../utils/arg_parser.js';
import { DEFAULT_EXCLUDES, getGitignoreExcludes } from '../utils/paths.js';

function getBigrams(str) {
    const s = str.toLowerCase();
    if (s.length === 0) return [];
    if (s.length === 1) return [s];
    const bigrams = [];
    for (let i = 0; i < s.length - 1; i++) {
        bigrams.push(s.slice(i, i + 2));
    }
    return bigrams;
}

function bigramSimilarity(str1, str2) {
    if (str1 === str2) return 1.0;
    if (!str1 || !str2) return 0.0;

    const b1 = getBigrams(str1);
    const b2 = getBigrams(str2);
    if (b1.length === 0 || b2.length === 0) return 0.0;

    const map2 = new Map();
    for (const b of b2) {
        map2.set(b, (map2.get(b) || 0) + 1);
    }

    let intersection = 0;
    for (const b of b1) {
        const count = map2.get(b) || 0;
        if (count > 0) {
            intersection++;
            map2.set(b, count - 1);
        }
    }

    return (2.0 * intersection) / (b1.length + b2.length);
}

async function scanFiles(dir, excludesSet, baseDir = dir, depth = 1, maxDepth = 15) {
    if (depth > maxDepth) return [];

    let entries;
    try {
        entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
        return [];
    }

    const files = [];
    for (const entry of entries) {
        if (excludesSet.has(entry.name)) continue;

        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            const subFiles = await scanFiles(fullPath, excludesSet, baseDir, depth + 1, maxDepth);
            files.push(...subFiles);
        } else {
            const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
            files.push({ name: entry.name, relPath: `./${relPath}` });
        }
    }
    return files;
}

/**
 * FindFile Tool
 * Finds all matching files across the CWD using exact, glob, substring, and bigram (>= 0.4 score) matches.
 */
export const find_file = async (args) => {
    let parsed = typeof args === 'object' && args !== null ? args : parseArgs(args);
    let target = parsed.basename || parsed.name || parsed.path || parsed.file || parsed.filename || parsed.query;

    if (!target && typeof args === 'string' && args.trim()) {
        const clean = args.trim().replace(/^["']|["']$/g, '');
        if (!clean.startsWith('{') && !clean.includes('=')) {
            target = clean;
        }
    }

    if (!target) {
        return 'ERROR: "basename" parameter is required for FindFile';
    }

    const query = String(target).trim().replace(/^["']|["']$/g, '');
    const cleanQuery = query.replace(/^(\.\/|\.\\)/, '').replace(/\\/g, '/');
    const queryLower = cleanQuery.toLowerCase();
    const isGlob = query.includes('*') || query.includes('?');
    const globRegex = isGlob
        ? new RegExp('^' + query.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i')
        : null;

    const rootDir = process.cwd();
    const excludesSet = new Set([
        ...DEFAULT_EXCLUDES,
        ...getGitignoreExcludes(rootDir)
    ]);

    try {
        const allFiles = await scanFiles(rootDir, excludesSet, rootDir);
        const scoredMatches = [];

        for (const file of allFiles) {
            const fileNameLower = file.name.toLowerCase();
            const nameWithoutExt = path.parse(file.name).name.toLowerCase();
            const relPathLower = file.relPath.toLowerCase();
            const relPathWithoutDot = relPathLower.startsWith('./') ? relPathLower.slice(2) : relPathLower;

            let score = 0;

            // 1. Exact matches
            if (file.name === cleanQuery || file.relPath === `./${cleanQuery}`) {
                score = 1.0;
            } else if (fileNameLower === queryLower || relPathLower === `./${queryLower}` || relPathWithoutDot === queryLower) {
                score = 0.98;
            } else if (nameWithoutExt === queryLower) {
                score = 0.95;
            }
            // 2. Glob match
            else if (globRegex && (globRegex.test(file.name) || globRegex.test(relPathWithoutDot))) {
                score = 0.90;
            }
            // 3. Substring match
            else if (fileNameLower.includes(queryLower) || relPathWithoutDot.includes(queryLower)) {
                score = 0.70 + (queryLower.length / Math.max(fileNameLower.length, queryLower.length)) * 0.15;
            }
            // 4. Bigram similarity match (threshold: 0.75)
            else {
                const nameSim = bigramSimilarity(queryLower, fileNameLower);
                const baseSim = bigramSimilarity(queryLower, nameWithoutExt);
                const pathSim = bigramSimilarity(queryLower, relPathWithoutDot);
                const bestSim = Math.max(nameSim, baseSim, pathSim);

                if (bestSim >= 0.75) {
                    score = bestSim * 0.85; // Scaled so exact/substring rank higher
                }
            }

            if (score >= 0.60) {
                scoredMatches.push({ relPath: file.relPath, score });
            }
        }

        if (scoredMatches.length === 0) {
            return `No file found matching name "${query}"`;
        }

        // Sort by highest score first, then by shortest relative path
        scoredMatches.sort((a, b) => b.score - a.score || a.relPath.length - b.relPath.length);

        // Deduplicate
        const uniquePaths = Array.from(new Set(scoredMatches.map(m => m.relPath)));
        const count = uniquePaths.length;
        const header = `Found ${count} file${count === 1 ? '' : 's'} matching "${query}":\n\n`;

        return `${header}${uniquePaths.join('\n')}`;
    } catch (e) {
        return `ERROR: Failed to find file: ${e.message}`;
    }
};
