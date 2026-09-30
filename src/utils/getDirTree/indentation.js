import path from 'path';
import fs from 'fs';
import { DEFAULT_EXCLUDES, getGitignoreExcludes } from '../paths.js';

const safeReaddirWithTypesDefault = (dir) => {
    try {
        return fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
        return [];
    }
};

export const getDirTreeIndentation = (
    dir,
    maxDepth = 4,
    depth = 1,
    safeReaddir = safeReaddirWithTypesDefault,
    collapsedDirs = [],
    preFetchedEntries = null
) => {
    const entries = preFetchedEntries || safeReaddir(dir);
    const indent = '  '.repeat(depth - 1);

    const excludeSet = depth === 1
        ? new Set([...DEFAULT_EXCLUDES, ...collapsedDirs, ...getGitignoreExcludes(dir), ...getGitignoreExcludes(process.cwd())])
        : (collapsedDirs instanceof Set ? collapsedDirs : new Set([...DEFAULT_EXCLUDES, ...collapsedDirs]));

    const isExcluded = (name) => excludeSet.has(name);

    const filtered = entries.filter(e => !isExcluded(e.name));
    const ignoredCount = entries.filter(e => isExcluded(e.name)).length;

    const files = filtered.filter(e => !e.isDirectory()).map(e => e.name).sort();
    const subDirs = filtered.filter(e => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));

    const formatExtFiles = (fileList) => {
        const count = fileList.length;
        if (count === 0) return 'no files';

        const exts = Array.from(new Set(
            fileList
                .map(f => {
                    const name = typeof f === 'string' ? f : f.name;
                    return path.extname(name).slice(1);
                })
                .filter(Boolean)
        )).sort();

        let extPattern = '*';
        if (exts.length === 1) {
            extPattern = `*.${exts[0]}`;
        } else if (exts.length > 1) {
            extPattern = `*.{${exts.join(', ')}}`;
        }

        return count === 1 ? extPattern : `${extPattern} ${count} files`;
    };

    let result = '';

    // 1. Render files / ignored counts at current level
    if (depth === 1) {
        // Root level: list actual file names
        const fileNames = files.join(', ');
        const ignoredStr = ignoredCount > 0 ? ` [${ignoredCount} ignored]` : '';
        if (fileNames || ignoredStr) {
            result += `${indent}${fileNames ? (fileNames + (ignoredStr ? `${ignoredStr}` : '')) : ignoredStr.trim()}\n`;
        }
    } else {
        // Subdirectory level: show file count with glob pattern if any
        if (files.length > 0) {
            result += `${indent}[${formatExtFiles(files)}]\n`;
        }
    }

    // 2. Process subdirectories with max width limit of 10
    const MAX_WIDTH = 10;
    const visibleSubDirs = subDirs.slice(0, MAX_WIDTH);
    const hasMoreSubDirs = subDirs.length > MAX_WIDTH;

    const inlineLeafDirs = [];
    const expandableDirs = [];

    for (const subDir of visibleSubDirs) {
        let currentPath = path.join(dir, subDir.name);
        let displayName = subDir.name;
        let effDepth = depth;
        let chainEntries = safeReaddir(currentPath);
        let chainFiltered = chainEntries.filter(e => !isExcluded(e.name));
        let chainSubDirs = chainFiltered.filter(e => e.isDirectory());
        let chainFiles = chainFiltered.filter(e => !e.isDirectory());

        // Collapse straight unbranched folder chains with 0 files
        while (chainFiles.length === 0 && chainSubDirs.length === 1 && effDepth < maxDepth) {
            displayName = `${displayName}/${chainSubDirs[0].name}`;
            currentPath = path.join(currentPath, chainSubDirs[0].name);
            effDepth++;
            chainEntries = safeReaddir(currentPath);
            chainFiltered = chainEntries.filter(e => !isExcluded(e.name));
            chainSubDirs = chainFiltered.filter(e => e.isDirectory());
            chainFiles = chainFiltered.filter(e => !e.isDirectory());
        }

        const hasSubFolders = chainSubDirs.length > 0;

        if (hasSubFolders && effDepth < maxDepth) {
            expandableDirs.push({ displayName, subDirPath: currentPath, subEntries: chainEntries, nextDepth: effDepth + 1 });
        } else {
            const filesLabel = formatExtFiles(chainFiles);
            const maxDepthWarning = (hasSubFolders && effDepth >= maxDepth) ? ' ...max scan depth' : '';
            inlineLeafDirs.push(`${displayName}/${filesLabel}${maxDepthWarning}`);
        }
    }

    // Render collapsed leaf folders inline
    if (inlineLeafDirs.length > 0) {
        result += `${indent}${inlineLeafDirs.join(', ')}\n`;
    }

    // Render expanded folders recursively
    for (const { displayName, subDirPath, subEntries, nextDepth } of expandableDirs) {
        result += `${indent}${displayName}/\n`;
        result += getDirTreeIndentation(subDirPath, maxDepth, nextDepth, safeReaddir, excludeSet, subEntries);
    }

    // Render width warning if truncated
    if (hasMoreSubDirs) {
        result += `${indent}...max scan width, ReadFolder if needed\n`;
    }

    return result;
};
