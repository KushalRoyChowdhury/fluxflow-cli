import path from 'path';
import fs from 'fs';

const safeReaddirWithTypesDefault = (dir) => {
    try {
        return fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
        return [];
    }
};

export const getDirTreeIndentation = (
    dir,
    maxDepth,
    depth = 1,
    safeReaddir = safeReaddirWithTypesDefault,
    collapsedDirs = [],
    preFetchedEntries = null
) => {
    const entries = preFetchedEntries || safeReaddir(dir);
    const indent = '  '.repeat(depth - 1);

    if (entries.length > 100) {
        return `${indent}${path.basename(dir)}/ (>100 files)\n`;
    }

    let result = '';
    const COLLAPSED_DIRS = collapsedDirs;

    const filtered = entries.filter(e => !COLLAPSED_DIRS.includes(e.name) && !e.name.startsWith('.'));
    const collapsedInDir = entries.filter(e => COLLAPSED_DIRS.includes(e.name) || e.name.startsWith('.'))
        .map(e => e.name)
        .sort();

    if (collapsedInDir.length > 0) {
        result += `${indent}[ignored: ${collapsedInDir.map(d => d + '/').join(', ')}]\n`;
    }

    const subDirs = filtered.filter(e => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
    const files = filtered.filter(e => !e.isDirectory()).map(e => e.name).sort();

    // 1. Process directories recursively with pre-fetched entries (zero duplicate disk hits)
    for (const subDir of subDirs) {
        const filePath = path.join(dir, subDir.name);
        if (depth > maxDepth) {
            result += `${indent}${subDir.name}/ (max depth)\n`;
        } else {
            const subEntries = safeReaddir(filePath);
            if (subEntries.length > 80) {
                result += `${indent}${subDir.name}/ (>80 files)\n`;
            } else {
                result += `${indent}${subDir.name}/\n`;
                result += getDirTreeIndentation(filePath, maxDepth, depth + 1, safeReaddir, collapsedDirs, subEntries);
            }
        }
    }

    // 2. Process files with horizontal inline compression using semicolon separator
    if (files.length > 0) {
        result += `${indent}${files.join('; ')}\n`;
    }

    return result;
};
