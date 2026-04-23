import fs from 'fs';
import path from 'path';
import { parseArgs } from '../utils/arg_parser.js';

/**
 * View File Tool
 * Reads a file, optionally within a specific line range.
 */
export const view_file = async (args) => {
    const { path: targetPath, start_line = 1, end_line = 500 } = parseArgs(args);
    
    if (!targetPath) return 'ERROR: Missing "path" argument for view_file.';
    const absolutePath = path.resolve(process.cwd(), targetPath);

    try {
        if (!fs.existsSync(absolutePath)) {
            return `ERROR: File [${targetPath}] does not exist.`;
        }

        const stats = fs.statSync(absolutePath);
        if (stats.isDirectory()) {
            return `ERROR: Path [${targetPath}] is a directory. Use list_files instead.`;
        }

        const content = fs.readFileSync(absolutePath, 'utf8');
        const lines = content.split('\n');
        const totalLines = lines.length;

        // Slice lines (adjusting for 1-based indexing)
        const start = Math.max(0, start_line - 1);
        const end = Math.min(totalLines, end_line);
        const resultLines = lines.slice(start, end);

        const header = `File: [${targetPath}] (Showing lines ${start + 1}-${end} of ${totalLines})`;
        const code = resultLines.map((line, i) => `${String(start + i + 1).padStart(4)}: ${line}`).join('\n');

        return `${header}\n\n${code}`;
    } catch (err) {
        return `ERROR: Failed to read file [${targetPath}]: ${err.message}`;
    }
};
