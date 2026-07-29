import fs from 'fs';
import path from 'path';
import { parseArgs } from '../utils/arg_parser.js';

const EXCLUDED_DIRS = new Set([
    // Version control, package managers & build clutter
    '.git', 'node_modules', '.gemini', 'dist', 'build', '.next', 'out',
    '.cache', 'bin', 'obj', 'vendor', 'venv', '.idea', '.gradle',
    '.terraform', 'target', 'coverage', '.vscode',
    '.svn', '.hg', '.fslckout', '.github', '.gitlab', '.circleci',
    '.gitea', '.gitee', '.lerna', '.changeset', '.nx',
    '.npm', '.yarn', '.pnpm-store', '.expo', '.nuxt', '.svelte-kit',
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
    'logs', 'log', '.nyc_output', '.sonar', '.ruff_cache', '.VSCodeCounter'
]);

const isExcludedDir = (dirName) => EXCLUDED_DIRS.has(dirName) || dirName.startsWith('.pnpm');

/**
 * Read Folder Tool
 * Provides detailed statistics for files in a directory, with optional recursion up to depth 5.
 */
export const read_folder = async (args) => {
    const parsed = parseArgs(args);
    const targetPath = parsed.path || null;

    if (!targetPath) {
        return "ERROR: No directory path provided.";
    }

    let recurseDepth = 0;
    if (parsed.recurse !== undefined && parsed.recurse !== null) {
        if (typeof parsed.recurse === 'number') {
            recurseDepth = parsed.recurse;
        } else if (typeof parsed.recurse === 'boolean') {
            recurseDepth = parsed.recurse ? 1 : 0;
        } else {
            const val = parseInt(String(parsed.recurse).trim(), 10);
            recurseDepth = isNaN(val) ? 0 : val;
        }
    }
    recurseDepth = Math.max(0, Math.min(5, recurseDepth));

    const absolutePath = path.resolve(process.cwd(), targetPath);

    try {
        if (!fs.existsSync(absolutePath)) {
            return `ERROR: Path [${targetPath}] does not exist.`;
        }

        const stats = fs.statSync(absolutePath);
        if (!stats.isDirectory()) {
            return `ERROR: Path [${targetPath}] is a file, not a directory. Use ReadFile instead.`;
        }

        if (recurseDepth === 0) {
            const files = fs.readdirSync(absolutePath);
            const totalItems = files.length;
            const maxDisplay = 150;
            const displayItems = files.slice(0, maxDisplay);
            const folderData = [];

            for (const file of displayItems) {
                const fPath = path.join(absolutePath, file);
                let info = { name: file, type: 'unknown', size: 'N/A', mtime: 'N/A' };

                try {
                    const fStats = fs.statSync(fPath);
                    info = {
                        name: file,
                        type: fStats.isDirectory() ? 'directory' : 'file',
                        size: (fStats.size / 1024).toFixed(1) + ' KB',
                        mtime: fStats.mtime.toLocaleString()
                    };
                } catch (e) {
                    info.type = 'inaccessible';
                }

                folderData.push(info);
            }

            const formatted = folderData.map(f => {
                const indicator = f.type === 'directory' ? '📁' : f.type === 'file' ? '📄' : '❓';
                if (f.type === 'directory') {
                    return `${indicator} ${f.name} - [DIR] - [Modified: ${f.mtime}]`;
                }
                return `${indicator} ${f.name} - [Size: ${f.size}] - [Modified: ${f.mtime}]`;
            }).join('\n');

            let footer = `\n\n(Total items in folder: ${totalItems})`;
            if (totalItems > maxDisplay) {
                footer = `\n\n⚠️ TRUNCATED: Showing first ${maxDisplay} of ${totalItems} items.`;
            }

            files.length = 0;
            displayItems.length = 0;
            folderData.length = 0;

            // fs.writeFileSync("DEBUG.txt", `Detailed folder stats for [${targetPath}]:\n\n${formatted}${footer}`);
            return `Detailed folder stats for [${targetPath}]:\n\n${formatted}${footer}`;
        }

        // Recursive tree traversal (recurseDepth 1..5)
        let totalDirectories = 0;
        let totalFiles = 0;
        let totalItemsScanned = 0;
        const maxTotalItems = 500;
        let truncated = false;

        const buildTree = (dirPath, currentDepth, prefix = '') => {
            if (currentDepth > recurseDepth + 1 || truncated) return [];

            let entries = [];
            try {
                entries = fs.readdirSync(dirPath);
            } catch (e) {
                return [`${prefix}⚠️ [Inaccessible Directory]`];
            }

            // Sort directories first, then files
            const sortedEntries = [];
            for (const name of entries) {
                const fullPath = path.join(dirPath, name);
                let isDir = false;
                try {
                    isDir = fs.statSync(fullPath).isDirectory();
                } catch (e) {}
                sortedEntries.push({ name, fullPath, isDir });
            }
            sortedEntries.sort((a, b) => {
                if (a.isDir && !b.isDir) return -1;
                if (!a.isDir && b.isDir) return 1;
                return a.name.localeCompare(b.name);
            });

            const lines = [];
            const count = sortedEntries.length;

            for (let i = 0; i < count; i++) {
                if (totalItemsScanned >= maxTotalItems) {
                    truncated = true;
                    lines.push(`${prefix}⚠️ [Truncated - Maximum item limit reached (${maxTotalItems})]`);
                    break;
                }

                const item = sortedEntries[i];
                const isLast = i === count - 1;
                const connector = isLast ? '└── ' : '├── ';
                const childPrefix = prefix + (isLast ? '    ' : '│   ');

                totalItemsScanned++;

                let itemType = 'unknown';
                let sizeStr = 'N/A';
                let mtimeStr = 'N/A';

                try {
                    const fStats = fs.statSync(item.fullPath);
                    if (fStats.isDirectory()) {
                        itemType = 'directory';
                        mtimeStr = fStats.mtime.toLocaleString();
                        totalDirectories++;
                    } else {
                        itemType = 'file';
                        sizeStr = (fStats.size / 1024).toFixed(1) + ' KB';
                        mtimeStr = fStats.mtime.toLocaleString();
                        totalFiles++;
                    }
                } catch (e) {
                    itemType = 'inaccessible';
                }

                const indicator = itemType === 'directory' ? '📁' : itemType === 'file' ? '📄' : '❓';
                let lineText = '';
                if (itemType === 'directory') {
                    lineText = `${prefix}${connector}${indicator} ${item.name} - [DIR] - [Modified: ${mtimeStr}]`;
                } else {
                    lineText = `${prefix}${connector}${indicator} ${item.name} - [Size: ${sizeStr}] - [Modified: ${mtimeStr}]`;
                }

                lines.push(lineText);

                if (itemType === 'directory' && currentDepth <= recurseDepth && !isExcludedDir(item.name)) {
                    const childLines = buildTree(item.fullPath, currentDepth + 1, childPrefix);
                    lines.push(...childLines);
                }
            }

            return lines;
        };

        const treeLines = buildTree(absolutePath, 1, '');
        const formattedTree = treeLines.join('\n');

        let footer = `\n\n(Total items scanned: ${totalItemsScanned}, Directories: ${totalDirectories}, Files: ${totalFiles})`;
        if (truncated) {
            footer = `\n\n⚠️ TRUNCATED: Scan capped at ${maxTotalItems} items. (Directories: ${totalDirectories}, Files: ${totalFiles})`;
        }

        // fs.writeFileSync("DEBUG.txt", `Detailed directory tree for [${targetPath}] (recurse depth: ${recurseDepth}):\n\n${formattedTree}${footer}`);
        return `Detailed directory tree for [${targetPath}] (recurse depth: ${recurseDepth}):\n\n${formattedTree}${footer}`;

    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return `ERROR: Failed to read folder [${targetPath}]: ${errorMsg}`;
    }
};
