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
    'logs', 'log', '.nyc_output', '.sonar', '.ruff_cache', '.VSCodeCounter', '.skills', 'skills'
]);

const isExcludedDir = (dirName) => EXCLUDED_DIRS.has(dirName) || dirName.startsWith('.pnpm');

const formatMtime = (d) => {
    try {
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        return `${mm}-${dd} ${hh}:${min}`;
    } catch {
        return 'N/A';
    }
};

/**
 * Read Folder Tool
 * Provides detailed statistics for files in a directory, with optional recursion up to depth 3.
 */
export const read_folder = async (args) => {
    const parsed = parseArgs(args);
    const targetPath = parsed.path || null;

    if (!targetPath) {
        return "ERROR: No directory path provided.";
    }

    let recurseDepth = 1;
    if (parsed.recurse !== undefined && parsed.recurse !== null) {
        if (typeof parsed.recurse === 'number') {
            recurseDepth = parsed.recurse;
        } else if (typeof parsed.recurse === 'boolean') {
            recurseDepth = parsed.recurse ? 2 : 1;
        } else {
            const val = parseInt(String(parsed.recurse).trim(), 10);
            recurseDepth = isNaN(val) ? 1 : val;
        }
    }
    recurseDepth = Math.max(1, Math.min(3, recurseDepth));

    try {
        const absolutePath = path.resolve(process.cwd(), targetPath);

        if (!fs.existsSync(absolutePath)) {
            return `ERROR: Path [${targetPath}] does not exist.`;
        }

        const stats = fs.statSync(absolutePath);
        if (!stats.isDirectory()) {
            return `ERROR: Path [${targetPath}] is a file, not a directory. Use ReadFile instead.`;
        }

        if (recurseDepth === 1) {
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
                        size: (fStats.size / 1024).toFixed(1) + 'KB',
                        mtime: formatMtime(fStats.mtime)
                    };
                } catch (e) {
                    info.type = 'inaccessible';
                }

                folderData.push(info);
            }

            const formatted = folderData.map(f => {
                if (f.type === 'directory') {
                    return `${f.name}/`;
                }
                return `${f.name} (${f.size}, ${f.mtime})`;
            }).join('\n');

            let footer = `\n\n(Total items in folder: ${totalItems})`;
            if (totalItems > maxDisplay) {
                footer = `\n\nTRUNCATED: Showing first ${maxDisplay} of ${totalItems} items.`;
            }

            files.length = 0;
            displayItems.length = 0;
            folderData.length = 0;

            // fs.writeFileSync("DEBUG-NORMAL.txt", `Detailed folder stats for [${targetPath}]:\n\n${formatted}${footer}`);
            return `Detailed folder stats for [${targetPath}]:\n\n${formatted}${footer}`;
        }

        // Recursive tree traversal (recurseDepth 1..3)
        let totalDirectories = 0;
        let totalFiles = 0;
        let totalItemsScanned = 0;
        const maxTotalItems = 500;
        let truncated = false;

        const buildTree = (dirPath, currentDepth, depth = 1) => {
            if (currentDepth > recurseDepth || truncated) return [];

            let entries = [];
            try {
                entries = fs.readdirSync(dirPath);
            } catch (e) {
                const indent = '  '.repeat(depth - 1);
                return [`${indent}[Inaccessible Directory]`];
            }

            const subDirs = [];
            const fileEntries = [];

            for (const name of entries) {
                const fullPath = path.join(dirPath, name);
                let isDir = false;
                try {
                    isDir = fs.statSync(fullPath).isDirectory();
                } catch (e) {}
                if (isDir) {
                    subDirs.push({ name, fullPath });
                } else {
                    fileEntries.push({ name, fullPath });
                }
            }

            subDirs.sort((a, b) => a.name.localeCompare(b.name));
            fileEntries.sort((a, b) => a.name.localeCompare(b.name));

            const lines = [];
            const indent = '  '.repeat(depth - 1);

            // 1. Process directories
            for (const subDir of subDirs) {
                if (totalItemsScanned >= maxTotalItems) {
                    truncated = true;
                    lines.push(`${indent}[Truncated - Maximum item limit reached (${maxTotalItems})]`);
                    break;
                }
                totalItemsScanned++;
                totalDirectories++;

                lines.push(`${indent}${subDir.name}/`);

                if (currentDepth < recurseDepth && !isExcludedDir(subDir.name)) {
                    const childLines = buildTree(subDir.fullPath, currentDepth + 1, depth + 1);
                    lines.push(...childLines);
                }
            }

            // 2. Process files compactly horizontally
            const formattedFiles = [];
            for (const file of fileEntries) {
                if (totalItemsScanned >= maxTotalItems) {
                    truncated = true;
                    lines.push(`${indent}[Truncated - Maximum item limit reached (${maxTotalItems})]`);
                    break;
                }
                totalItemsScanned++;
                totalFiles++;

                let sizeStr = 'N/A';
                try {
                    const fStats = fs.statSync(file.fullPath);
                    sizeStr = (fStats.size / 1024).toFixed(1) + 'KB';
                } catch (e) {}

                formattedFiles.push(`${file.name} (${sizeStr})`);
            }

            if (formattedFiles.length > 0) {
                lines.push(`${indent}${formattedFiles.join('; ')}`);
            }

            return lines;
        };

        const treeLines = buildTree(absolutePath, 1, 1);
        const formattedTree = treeLines.join('\n');

        let footer = `\n\n(Total items scanned: ${totalItemsScanned}, Directories: ${totalDirectories}, Files: ${totalFiles})`;
        if (truncated) {
            footer = `\n\nTRUNCATED: Scan capped at ${maxTotalItems} items. (Directories: ${totalDirectories}, Files: ${totalFiles})`;
        }

        // fs.writeFileSync("DEBUG-RECURSE.txt", `Detailed directory tree for [${targetPath}] (Recursive depth: ${recurseDepth}):\n\n${formattedTree}${footer}`);
        return `Detailed directory tree for [${targetPath}] (recursive depth: ${recurseDepth}):\n\n${formattedTree}${footer}`;

    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return `ERROR: Failed to read folder [${targetPath}]: ${errorMsg}`;
    }
};
