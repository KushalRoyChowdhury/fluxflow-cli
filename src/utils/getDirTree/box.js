import path from 'path';
import fs from 'fs';

const safeReaddirWithTypesDefault = (dir) => {
    try {
        return fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
        return [];
    }
};

export const getDirTreeBox = (dir, maxDepth, prefix = '', depth = 1, safeReaddir = safeReaddirWithTypesDefault, collapsedDirs = []) => {
    const entries = safeReaddir(dir);
    const sep = path.sep;

    if (entries.length > 100) {
        return `${prefix}└── ${path.basename(dir)}${sep} ...100+ files...\n`;
    }

    let result = '';
    const COLLAPSED_DIRS = collapsedDirs;

    // Filter into categories using the entry types we already fetched
    const filtered = entries.filter(e => !COLLAPSED_DIRS.includes(e.name) && !e.name.startsWith('.'));
    const collapsedInDir = entries.filter(e => COLLAPSED_DIRS.includes(e.name) || e.name.startsWith('.'))
        .map(e => e.name)
        .sort();

    // 2. FIXED: Sorting is now super fast because we already know if it's a directory! No disk hits!
    filtered.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
    });

    // Create our unified processing list
    const finalItems = [
        ...filtered.map(e => ({ name: e.name, isDir: e.isDirectory() })),
        ...collapsedInDir.map(name => ({ name, isDir: true, isCollapsed: true }))
    ];

    finalItems.forEach((item, index) => {
        const isLast = index === finalItems.length - 1;
        const filePath = path.join(dir, item.name);
        const connector = isLast ? '└── ' : '├── ';
        const childPrefix = prefix + (isLast ? '    ' : '│   ');

        if (item.isCollapsed) {
            result += `${prefix}${connector}${item.name}${sep}...\n`;
            return;
        }

        if (item.isDir) {
            // 3. FIXED: Instead of re-reading the directory here, we let the recursion handle it
            if (depth > maxDepth) {
                result += `${prefix}${connector}${item.name}${sep} ...depth exceeded...\n`;
            } else {
                // Check if sub-directory is overflowing before diving deep
                const subEntries = safeReaddir(filePath);
                if (subEntries.length > 80) {
                    result += `${prefix}${connector}${item.name}${sep} ...80+ files...\n`;
                } else {
                    result += `${prefix}${connector}${item.name}${sep}\n`;
                    result += getDirTreeBox(filePath, maxDepth, childPrefix, depth + 1, safeReaddir, collapsedDirs);
                }
            }
        } else {
            result += `${prefix}${connector}${item.name}\n`;
        }
    });

    return result;
};
