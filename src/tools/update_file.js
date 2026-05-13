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
        // --- THE FINAL HARMONY ---
        // 1. \n (2 chars) becomes a real newline (LF)
        // 2. [/n] becomes a literal \n in the file
        return content
            .replace(/\\n/g, '\n')
            .replace(/\[\/n\]?/g, '\\n');
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

        // --- INDENTATION PRESERVATION ENGINE (v5: Precision Delta-Shift) ---
        const adjustIndentation = (newText, originalMatch, leadingContext = '') => {
            if (!newText || originalMatch === undefined) return newText;

            const getIndent = (line) => line.match(/^\s*/)[0];

            const getMinIndent = (text) => {
                const lines = text.split('\n').filter(l => l.trim() !== '');
                if (lines.length === 0) return '';
                let min = getIndent(lines[0]);
                for (const line of lines) {
                    const indent = getIndent(line);
                    if (indent.length < min.length) min = indent;
                }
                return min;
            };

            const matchBaseIndent = getMinIndent(originalMatch);
            const targetBaseIndent = leadingContext.match(/^\s*/)[0] + matchBaseIndent;
            const newBaseIndent = getMinIndent(newText);

            // Calculate the delta shift (can be negative)
            const delta = targetBaseIndent.length - newBaseIndent.length;
            const indentChar = (targetBaseIndent.match(/\s/) || originalMatch.match(/\s/) || [' '])[0];

            const newLines = newText.split('\n');
            return newLines.map((line, i) => {
                if (line.trim() === '' && i !== 0) return '';

                const currentLineIndent = getIndent(line).length;
                const shiftedIndentLength = Math.max(0, currentLineIndent + delta);

                // For the first line, we subtract the leadingContext already present in the file
                const prependedIndentLength = (i === 0)
                    ? Math.max(0, shiftedIndentLength - leadingContext.length)
                    : shiftedIndentLength;

                return indentChar.repeat(prependedIndentLength) + line.trimStart();
            }).join('\n');
        };

        let instances = 0;
        let startPos = -1;
        let matchRegex = null;

        // --- UNIFIED MATCHER (v6: High-Fidelity Fuzzy Logic) ---
        const exactPattern = content_to_replace.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        if (content_to_replace !== '' && currentContent.includes(content_to_replace)) {
            matchRegex = new RegExp(exactPattern, 'g');
        } else {
            // High-Res Fuzzy: Match each line's core content while ignoring indentation/whitespace drift
            const fuzzyLines = content_to_replace
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0) // Skip empty lines for matching
                .map(line => line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*'));

            if (fuzzyLines.length > 0) {
                // Construct a pattern that allows flexible indentation and whitespace between lines
                // We use \s* to ensure we stay within the intended block
                const fuzzyPattern = fuzzyLines.join('\\s*');
                try {
                    matchRegex = new RegExp(fuzzyPattern, 'g');
                } catch (e) {
                    matchRegex = new RegExp(exactPattern, 'g');
                }
            } else {
                matchRegex = new RegExp(exactPattern, 'g');
            }
        }

        const matches = matchRegex ? [...currentContent.matchAll(matchRegex)] : [];
        instances = matches.length;

        if (instances === 0) {
            return `ERROR: Could not find match for "content_to_replace" in [${targetPath}]. Check for whitespace discrepancies or try providing more context.`;
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

        let diffText = `SUCCESS: File [${targetPath}] updated. [${instances}] instances replaced.\nIf you see [/n] in preview, it means the tool successfully wrote the literal '\\' and 'n' characters to the file at that place.\n\n`;
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

        let currentNewLine = startLine;
        fullNewLines.forEach((line) => {
            diffText += `+${currentNewLine}|${line}\n`;
            currentNewLine++;
        });

        // 3. Context After (up to 15 lines)
        // Ensure we start context AFTER the full lines we replaced in the original content
        const linesAffected = fullOldLines.length;
        const originalContextIdx = startLine + linesAffected - 1;

        for (let i = originalContextIdx; i < Math.min(allOriginalLines.length, originalContextIdx + 15); i++) {
            diffText += `[UI_CONTEXT]  ${currentNewLine}|${allOriginalLines[i]}\n`;
            currentNewLine++;
        }

        diffText += `[DIFF_END]`;
        return diffText.replace(/\\n/g, '[/n]');
    } catch (err) {
        return `ERROR: Failed to update file [${targetPath}]: ${err.message}`;
    }
};
