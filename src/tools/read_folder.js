import fs from 'fs';
import path from 'path';
import { parseArgs } from '../utils/arg_parser.js';

/**
 * Read Folder Tool
 * Provides detailed statistics for files in a directory.
 */
export const read_folder = async (args) => {
    const { path: targetPath = '.' } = parseArgs(args);
    const absolutePath = path.resolve(process.cwd(), targetPath);

    try {
        if (!fs.existsSync(absolutePath)) {
            return `ERROR: Path [${targetPath}] does not exist.`;
        }

        const stats = fs.statSync(absolutePath);
        if (!stats.isDirectory()) {
            return `ERROR: Path [${targetPath}] is a file, not a directory. Use view_file instead.`;
        }
        const files = fs.readdirSync(absolutePath);
        const totalItems = files.length;
        const maxDisplay = 100;
        const displayItems = files.slice(0, maxDisplay);
        const folderData = [];

        for (const file of displayItems) {
            const fPath = path.join(absolutePath, file);
            let indicator = '📄';
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

        const result = `Detailed folder stats for [${targetPath}]:\n\n${formatted}${footer}`;

        // Neural Flush: Explicitly clear technical arrays before the return pass
        files.length = 0;
        displayItems.length = 0;
        folderData.length = 0;

        return result;
        
    } catch (err) {
        return `ERROR: Failed to read folder [${targetPath}]: ${err.message}`;
    }
};
