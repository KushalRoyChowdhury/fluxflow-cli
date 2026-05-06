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
    const ext = path.extname(targetPath).toLowerCase();
    const isProse = ['.md', '.txt', '.log', '.html', '.css'].includes(ext);

    const unescapeContent = (content) => {
        let processedContent = "";
        let inString = null;
        for (let i = 0; i < content.length; i++) {
            const char = content[i];
            const next2 = content.substring(i, i + 2);

            if (!inString) {
                // Prose check: Don't track strings in natural language files (apostrophes are common)
                if (!isProse && (char === '"' || char === "'" || char === '`')) {
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

        // --- INDENTATION PRESERVATION ENGINE (v2: Min-Indent Delta) ---
        const adjustIndentation = (newText, originalMatch) => {
            if (!newText || !originalMatch) return newText;
            
            const getMinIndent = (text) => {
                const lines = text.split('\n').filter(l => l.trim() !== '');
                if (lines.length === 0) return '';
                let min = lines[0].match(/^\s*/)[0];
                for (const line of lines) {
                    const indent = line.match(/^\s*/)[0];
                    if (indent.length < min.length) min = indent;
                }
                return min;
            };

            const originalMinIndent = getMinIndent(originalMatch);
            const newMinIndent = getMinIndent(newText);

            const newLines = newText.split('\n');
            return newLines.map(line => {
                if (line.trim() === '') return '';
                if (line.startsWith(newMinIndent)) {
                    return originalMinIndent + line.substring(newMinIndent.length);
                }
                return originalMinIndent + line.trimStart();
            }).join('\n');
        };

        let matchRegex = null;
        let instances = 0;
        let startPos = -1;

        if (currentContent.includes(content_to_replace)) {
            instances = currentContent.split(content_to_replace).length - 1;
            startPos = currentContent.indexOf(content_to_replace);
        } else {
            // --- GENEROUS WHITESPACE MATCHING (Fuzzy Fallback) ---
            const escaped = content_to_replace.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            // Replace any whitespace sequence in the pattern with \s+ (relaxed matching)
            const fuzzyPattern = escaped.trim().replace(/\s+/g, '\\s+');
            try {
                const fuzzyRegex = new RegExp(fuzzyPattern, 'g');
                const matches = [...currentContent.matchAll(fuzzyRegex)];

                if (matches.length > 0) {
                    matchRegex = fuzzyRegex;
                    instances = matches.length;
                    startPos = matches[0].index;
                    // Use the first match's actual content for line counting and diff display
                    content_to_replace = matches[0][0]; 
                }
            } catch (e) {
                // Regex error (unlikely due to escaping, but safe fallback)
            }
        }

        if (instances === 0) {
            const diskLen = currentContent.length;
            const matchLen = content_to_replace.length;
            return `ERROR: Could not find match (even fuzzy) for the specified "content_to_replace" in [${targetPath}].\n- Disk Content Length (Normalized): ${diskLen}\n- Match String Length (Normalized): ${matchLen}\n- Check indentation/whitespace. Try re-reading the file for latest changes.`;
        }

        // Count lines before the replacement to get the start line number
        const startLine = currentContent.substring(0, startPos).split(/\r?\n/).length;

        const newFileContent = matchRegex 
            ? currentContent.replace(matchRegex, (match) => adjustIndentation(content_to_add, match))
            : currentContent.split(content_to_replace).join(adjustIndentation(content_to_add, content_to_replace));

        // Sync content_to_add for the diff generation based on the first match
        content_to_add = adjustIndentation(content_to_add, content_to_replace);

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
            diffText += `[UI_CONTEXT]  ${i + 1}|${allOriginalLines[i]}\n`;
        }

        // 2. The Change (Full Line Diff for better UI indentation)
        // Find the boundaries of the lines affected by the change
        const lineStartPos = currentContent.lastIndexOf('\n', startPos) + 1;
        const affectedEndPos = startPos + content_to_replace.length;
        const lineEndPos = currentContent.indexOf('\n', affectedEndPos);
        const actualEndPos = lineEndPos === -1 ? currentContent.length : lineEndPos;

        // Original lines (fully indented)
        const fullOldLines = currentContent.substring(lineStartPos, actualEndPos).split('\n');
        
        // Updated lines (fully indented)
        // Calculate the corresponding range in the new content
        const newAffectedEndPos = startPos + content_to_add.length;
        const newLineEndPos = newFileContent.indexOf('\n', newAffectedEndPos);
        const actualNewEndPos = newLineEndPos === -1 ? newFileContent.length : newLineEndPos;
        const fullNewLines = newFileContent.substring(lineStartPos, actualNewEndPos).split('\n');

        fullOldLines.forEach((line, i) => {
            diffText += `-${startLine + i}|${line}\n`;
        });
        fullNewLines.forEach((line, i) => {
            diffText += `+${startLine + i}|${line}\n`;
        });

        // 3. Context After (up to 15 lines)
        for (let i = endLine; i < Math.min(allOriginalLines.length, endLine + 15); i++) {
            diffText += `[UI_CONTEXT]  ${i + 1}|${allOriginalLines[i]}\n`;
        }

        diffText += `[DIFF_END]`;

        return diffText;
    } catch (err) {
        return `ERROR: Failed to update file [${targetPath}]: ${err.message}`;
    }
};
