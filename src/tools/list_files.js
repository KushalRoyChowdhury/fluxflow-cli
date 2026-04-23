import fs from 'fs';
import path from 'path';
import { parseArgs } from '../utils/arg_parser.js';

/**
 * List Files Tool
 * Lists the contents of a directory.
 */
export const list_files = async (args) => {
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
        if (files.length === 0) {
            return `Directory [${targetPath}] is empty.`;
        }

        const totalFiles = files.length;
        const maxDisplay = 100;
        const displayFiles = files.slice(0, maxDisplay);

        const list = displayFiles.map(file => {
            const fPath = path.join(absolutePath, file);
            let indicator = '📄';
            let metaPart = '';
            
            try {
                const fStats = fs.statSync(fPath);
                indicator = fStats.isDirectory() ? '📁' : '📄';
                const sizeKB = (fStats.size / 1024).toFixed(1);
                metaPart = fStats.isFile() ? ` - [${sizeKB} KB]` : '';
            } catch (e) {
                indicator = '❓';
                metaPart = ' - [Access Denied]';
            }

            return `${indicator} ${file}${metaPart}`;
        }).join('\n');

        let footer = `\n\n(Total items: ${totalFiles})`;
        if (totalFiles > maxDisplay) {
            footer = `\n\n⚠️ TRUNCATED: Showing first ${maxDisplay} of ${totalFiles} items. Use more specific paths to see others.`;
        }

        const result = `Contents of [${targetPath}]:\n\n${list}${footer}`;
        
        // Memory Flush: Explicitly clear large raw arrays before returning
        files.length = 0;
        displayFiles.length = 0;
        
        return result;
    } catch (err) {
        return `ERROR: Failed to list files in [${targetPath}]: ${err.message}`;
    }
};
