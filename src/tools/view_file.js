import fs from 'fs';
import path from 'path';
import { parseArgs } from '../utils/arg_parser.js';

/**
 * View File Tool
 * Reads a file, optionally within a specific line range.
 */
export const view_file = async (args) => {
    let { path: targetPath, StartLine, EndLine, start_line, end_line } = parseArgs(args);

    // Normalize argument names and apply dynamic 800-line paging logic
    const sLine = parseInt(StartLine || start_line);
    const eLine = parseInt(EndLine || end_line);

    const finalStart = sLine || 1;
    const finalEnd = eLine || (sLine ? (sLine + 800) : 800);

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

        // --- MULTIMODAL DETECTION ---
        const ext = path.extname(targetPath).toLowerCase();
        const mimeMap = {
            '.pdf': 'application/pdf',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.webp': 'image/webp',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.doc': 'application/msword'
        };

        if (mimeMap[ext]) {
            const buffer = fs.readFileSync(absolutePath);
            const base64 = buffer.toString('base64');
            const mimeType = mimeMap[ext];

            return {
                text: `[BINARY_FILE]: ${targetPath} (${mimeType}) - Loaded as multimodal part.`,
                binaryPart: {
                    inlineData: {
                        data: base64,
                        mimeType: mimeType
                    }
                }
            };
        }
        // ----------------------------

        let content = fs.readFileSync(absolutePath, 'utf8');
        // Strip BOM if present
        if (content.startsWith('\uFEFF')) {
            content = content.slice(1);
        }
        content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        
        // --- DSL TRANSLATION ---
        // Convert literal \n to [/n] so the model recognizes them as literal characters
        content = content.replace(/\\n/g, '[/n]');
        
        const lines = content.split('\n');
        const totalLines = lines.length;

        // Slice lines (adjusting for 1-based indexing)
        const start = Math.max(0, finalStart - 1);
        const end = Math.min(totalLines, finalEnd);
        const resultLines = lines.slice(start, end);

        const header = `File: [${targetPath}] (Showing lines ${start + 1}-${end} of ${totalLines})`;
        const code = resultLines.map((line, i) => `${String(start + i + 1).padStart(4)}: ${line}`).join('\n');

        return `${header}\n\n${code}`;
    } catch (err) {
        return `ERROR: Failed to read file [${targetPath}]: ${err.message}`;
    }
};
