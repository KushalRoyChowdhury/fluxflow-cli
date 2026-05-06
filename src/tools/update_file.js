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
    
    const unescapeContent = (content) => {
        // \n (backslash + n) becomes a real newline (LF)
        // \\n (two backslashes + n) becomes a literal \n
        return content.replace(/\\\\n|\\n/g, (match) => {
            if (match === '\\\\n') return '\\n';
            return '\n';
        });
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

        // --- INDENTATION PRESERVATION ENGINE (v3: Context-Aware Delta) ---
        const adjustIndentation = (newText, originalMatch, leadingContext = '') => {
            if (!newText || originalMatch === undefined) return newText;
            
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

            // Anchor the original indent using the leading context from the file
            const originalMinIndent = getMinIndent(leadingContext + originalMatch);
            const newMinIndent = getMinIndent(newText);

            const newLines = newText.split('\n');
            return newLines.map((line, i) => {
                if (line.trim() === '' && i !== 0) return '';
                
                // For the first line, we subtract the leading context already present in the file
                const currentOriginalIndent = (i === 0) 
                    ? originalMinIndent.substring(Math.min(originalMinIndent.length, leadingContext.length)) 
                    : originalMinIndent;

                const lineIndent = line.match(/^\s*/)[0];
                
                // Case 1: Standard indentation (starts with the block's minimum)
                if (lineIndent.startsWith(newMinIndent)) {
                    return currentOriginalIndent + line.substring(newMinIndent.length);
                }
                
                // Case 2: Outdent (e.g., a closing brace '}' that is indented less than the block's min)
                if (newMinIndent.startsWith(lineIndent)) {
                    const diff = newMinIndent.length - lineIndent.length;
                    const adjustedIndent = currentOriginalIndent.substring(0, Math.max(0, currentOriginalIndent.length - diff));
                    return adjustedIndent + line.trimStart();
                }

                // Fallback: Just preserve the line as is but prepended with the base indent
                return currentOriginalIndent + line.trimStart();
            }).join('\n');
        };

        let instances = 0;
        let startPos = -1;
        let matchRegex = null;

        // --- UNIFIED MATCHER ---
        // We prioritize an exact match (including any indentation the agent provided).
        // If that fails, we fall back to a fuzzy match that ignores indentation differences.
        const escaped = content_to_replace.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (content_to_replace !== '' && currentContent.includes(content_to_replace)) {
            matchRegex = new RegExp(escaped, 'g');
        } else {
            // Fuzzy Fallback: Trim the agent's input and allow any whitespace sequence (including zero spaces)
            // This allows the agent to be "lazy" with indentation in its search string.
            const fuzzyPattern = escaped.trim().replace(/\s+/g, '\\s*');
            try {
                matchRegex = new RegExp(fuzzyPattern, 'g');
            } catch (e) {
                // Safe fallback for complex strings
            }
        }

        const matches = matchRegex ? [...currentContent.matchAll(matchRegex)] : [];
        instances = matches.length;

        if (instances === 0) {
            const diskLen = currentContent.length;
            const matchLen = content_to_replace.length;
            return `ERROR: Could not find match (even fuzzy) for the specified "content_to_replace" in [${targetPath}].\n- Disk Content Length (Normalized): ${diskLen}\n- Match String Length (Normalized): ${matchLen}\n- Check indentation/whitespace. Try re-reading the file for latest changes.`;
        }

        if (instances > 1) {
            return `ERROR: Unable to find unique match. [${instances}] instances of the specified "content_to_replace" were found in [${targetPath}]. Try providing more context (surrounding lines) to make the match unique.`;
        }

        // Use the first match as the anchor for positioning and diff display
        startPos = matches[0].index;
        const firstMatchContent = matches[0][0];

        // --- PERFORM REPLACEMENT ---
        const newFileContent = currentContent.replace(matchRegex, (match, offset) => {
            const lineStart = currentContent.lastIndexOf('\n', offset) + 1;
            const leadingContext = currentContent.substring(lineStart, offset);
            return adjustIndentation(content_to_add, match, leadingContext);
        });

        // Sync for the diff generation based on the first match
        const firstLineStart = currentContent.lastIndexOf('\n', startPos) + 1;
        const firstLeadingContext = currentContent.substring(firstLineStart, startPos);
        
        const finalContentToAdd = adjustIndentation(content_to_add, firstMatchContent, firstLeadingContext);
        const finalContentToReplace = firstMatchContent;

        fs.writeFileSync(absolutePath, newFileContent, 'utf8');

        // Structured response for UI diffing
        const allOriginalLines = currentContent.split(/\r?\n/);
        const startLine = currentContent.substring(0, startPos).split(/\r?\n/).length;
        const oldLines = content_to_replace.split(/\r?\n/);
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
