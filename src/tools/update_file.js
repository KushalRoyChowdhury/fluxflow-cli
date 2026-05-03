import fs from 'fs';
import path from 'path';
import { parseArgs } from '../utils/arg_parser.js';

/**
 * Update File Tool (Smart Patching)
 * Replaces a specific block of text with new content.
 */
export const update_file = async (args) => {
    let { path: targetPath, content_to_replace, content_to_add } = parseArgs(args);

    if (!targetPath) return 'ERROR: Missing "path" argument for update_file.';
    if (content_to_replace === undefined) return 'ERROR: Missing "content_to_replace" argument.';
    if (content_to_add === undefined) return 'ERROR: Missing "content_to_add" argument.';

    // Sanitization: Strip unintended markdown code blocks and normalize to LF
    const strip = (t) => t.replace(/^```[\w]*\n?/, '').replace(/```\s*$/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // --- CONTEXT-AWARE NEURAL UNESCAPE ---
    const unescapeContent = (content) => {
        let processedContent = "";
        let inString = null;
        for (let i = 0; i < content.length; i++) {
            const char = content[i];
            const next2 = content.substring(i, i + 2);

            if (!inString) {
                if (char === '"' || char === "'" || char === '`') {
                    inString = char;
                    processedContent += char;
                } else if (next2 === '\\\\n') {
                    processedContent += '\\n';
                    i++;
                } else if (next2 === '\\n') {
                    processedContent += '\n';
                    i++;
                } else {
                    processedContent += char;
                }
            } else {
                if (char === inString && content[i - 1] !== '\\') {
                    inString = null;
                }
                processedContent += char;
            }
        }
        return processedContent;
    };

    content_to_replace = unescapeContent(strip(content_to_replace));
    content_to_add = unescapeContent(strip(content_to_add));

    const absolutePath = path.resolve(process.cwd(), targetPath);

    try {
        if (!fs.existsSync(absolutePath)) {
            return `ERROR: File [${targetPath}] does not exist. Use write_file instead.`;
        }

        // --- LF NORMALIZATION ARMISTICE ---
        let diskContent = fs.readFileSync(absolutePath, 'utf8');
        // Strip BOM if present
        if (diskContent.startsWith('\uFEFF')) {
            diskContent = diskContent.slice(1);
        }

        const normalizedDisk = diskContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        if (diskContent !== normalizedDisk) {
            fs.writeFileSync(absolutePath, normalizedDisk, 'utf8');
            diskContent = normalizedDisk;
        }
        const currentContent = diskContent;

        if (!currentContent.includes(content_to_replace)) {
            const diskLen = currentContent.length;
            const matchLen = content_to_replace.length;
            return `ERROR: Could not find exact match for the specified "content_to_replace" in [${targetPath}].\n- Disk Content Length (Normalized): ${diskLen}\n- Match String Length (Normalized): ${matchLen}\n- Check indentation/whitespace. Try re-reading the file for latest changes.`;
        }

        const startPos = currentContent.indexOf(content_to_replace);
        // Count lines before the replacement to get the start line number
        const startLine = currentContent.substring(0, startPos).split(/\r?\n/).length;

        const instances = currentContent.split(content_to_replace).length - 1;
        const newFileContent = currentContent.split(content_to_replace).join(content_to_add);

        fs.writeFileSync(absolutePath, newFileContent, 'utf8');

        // Structured response for UI diffing
        const allOriginalLines = currentContent.split(/\r?\n/);
        const oldLines = content_to_replace.split(/\r?\n/);
        const newLines = content_to_add.split(/\r?\n/);
        const endLine = startLine + oldLines.length - 1;

        let diffText = `SUCCESS: File [${targetPath}] updated. [${instances}] instances replaced.\n\n`;
        diffText += `[DIFF_START]\n`;

        // 1. Context Before (up to 15 lines)
        const contextStart = Math.max(0, startLine - 16);
        for (let i = contextStart; i < startLine - 1; i++) {
            diffText += `[UI_CONTEXT]  ${i + 1}| ${allOriginalLines[i]}\n`;
        }

        // 2. The Change (Red then Green)
        oldLines.forEach((line, i) => {
            diffText += `-${startLine + i}| ${line}\n`;
        });
        newLines.forEach((line, i) => {
            diffText += `+${startLine + i}| ${line}\n`;
        });

        // 3. Context After (up to 15 lines)
        for (let i = endLine; i < Math.min(allOriginalLines.length, endLine + 15); i++) {
            diffText += `[UI_CONTEXT]  ${i + 1}| ${allOriginalLines[i]}\n`;
        }

        diffText += `[DIFF_END]`;

        return diffText;
    } catch (err) {
        return `ERROR: Failed to update file [${targetPath}]: ${err.message}`;
    }
};
