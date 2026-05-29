import fs from 'fs';
import path from 'path';
import { parseArgs } from '../utils/arg_parser.js';
import { RevertManager } from '../utils/revert.js';

/**
 * Update File Tool (Smart Patching)
 * Replaces a specific block of text with new content.
 */
export const update_file = async (args) => {
    const parsed = parseArgs(args);
    const targetPath = parsed.path;

    if (!targetPath) return 'ERROR: Missing "path" argument for update_file.';

    // Extract up to 10 pairs of replacements
    const patchPairs = [];

    // Legacy support for replaceContent/newContent (pair 1)
    const legacyReplace = parsed.content_to_replace !== undefined ? parsed.content_to_replace : parsed.replaceContent;
    const legacyNew = parsed.content_to_add !== undefined ? parsed.content_to_add : parsed.newContent;

    if (legacyReplace !== undefined && legacyNew !== undefined) {
        patchPairs.push({ replace: legacyReplace, new: legacyNew });
    }

    // Modern support for numbered pairs (1-10)
    for (let i = 1; i <= 10; i++) {
        const r = parsed[`replaceContent${i}`];
        const n = parsed[`newContent${i}`];
        // Don't duplicate if it was already caught by legacy (usually i=1)
        if (r !== undefined && n !== undefined && r !== legacyReplace) {
            patchPairs.push({ replace: r, new: n });
        }
    }

    if (patchPairs.length === 0) {
        return 'ERROR: No valid replacement pairs found. Use replaceContent1, newContent1, etc.';
    }

    // Sanitization: Strip unintended markdown code blocks and normalize to LF
    const strip = (t) => t.replace(/^```[\w]*\n?/, '').replace(/```\s*$/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    const absolutePath = path.resolve(process.cwd(), targetPath);

    try {
        if (!fs.existsSync(absolutePath)) {
            return `ERROR: File [${targetPath}] does not exist. Use write_file instead.`;
        }

        // Record file change for Reversion Time Travel (One record for the whole transaction)
        await RevertManager.recordFileChange(absolutePath);

        let diskContent = fs.readFileSync(absolutePath, 'utf8');
        if (diskContent.startsWith('\uFEFF')) diskContent = diskContent.slice(1);
        let currentFileContent = diskContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

        const results = [];
        let totalInstances = 0;

        for (let i = 0; i < patchPairs.length; i++) {
            const pair = patchPairs[i];
            const content_to_replace = strip(pair.replace);
            const content_to_add = strip(pair.new);

            // --- INDENTATION PRESERVATION ENGINE ---
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
                const delta = targetBaseIndent.length - newBaseIndent.length;
                const indentChar = (targetBaseIndent.match(/\s/) || originalMatch.match(/\s/) || [' '])[0];

                const newLines = newText.split('\n');
                return newLines.map((line, i) => {
                    if (line.trim() === '' && i !== 0) return '';
                    const currentLineIndent = getIndent(line).length;
                    const shiftedIndentLength = Math.max(0, currentLineIndent + delta);
                    const prependedIndentLength = (i === 0) ? Math.max(0, shiftedIndentLength - leadingContext.length) : shiftedIndentLength;
                    return indentChar.repeat(prependedIndentLength) + line.trimStart();
                }).join('\n');
            };

            // --- MATCHER ---
            const exactPattern = content_to_replace.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            let matchRegex = null;

            if (content_to_replace !== '' && currentFileContent.includes(content_to_replace)) {
                matchRegex = new RegExp(exactPattern, 'g');
            } else {
                const fuzzyLines = content_to_replace.split('\n').map(line => line.trim()).filter(line => line.length > 0)
                    .map(line => line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*'));

                if (fuzzyLines.length > 0) {
                    const fuzzyPattern = fuzzyLines.join('\\s*');
                    try { matchRegex = new RegExp(fuzzyPattern, 'g'); } catch (e) { matchRegex = new RegExp(exactPattern, 'g'); }
                } else { matchRegex = new RegExp(exactPattern, 'g'); }
            }

            const matches = [...currentFileContent.matchAll(matchRegex)];
            if (matches.length === 0) {
                results.push({ success: false, error: `Block ${i + 1}: Could not find match.` });
                continue;
            }
            if (matches.length > 1) {
                results.push({ success: false, error: `Block ${i + 1}: Found ${matches.length} matches (must be unique).` });
                continue;
            }

            const startPos = matches[0].index;
            const firstMatchContent = matches[0][0];
            const lineStart = currentFileContent.lastIndexOf('\n', startPos) + 1;
            const leadingContext = currentFileContent.substring(lineStart, startPos);

            const finalReplacement = adjustIndentation(content_to_add, firstMatchContent, leadingContext);

            // --- CONTEXT CALCULATOR (Block-Level) ---
            const allOriginalLines = currentFileContent.split('\n');
            const patchStartLine = currentFileContent.substring(0, startPos).split('\n').length;
            const patchOldLines = firstMatchContent.split('\n');

            // Capture 3 lines of context before
            const contextBefore = [];
            for (let j = Math.max(0, patchStartLine - 4); j < patchStartLine - 1; j++) {
                contextBefore.push({ num: j + 1, text: allOriginalLines[j] });
            }

            // Capture 3 lines of context after
            const contextAfter = [];
            const patchEndLineIdx = patchStartLine + patchOldLines.length - 1;
            for (let j = patchEndLineIdx; j < Math.min(allOriginalLines.length, patchEndLineIdx + 3); j++) {
                contextAfter.push({ num: j + 1, text: allOriginalLines[j] });
            }

            // Record for diff generation
            results.push({
                success: true,
                startPos,
                oldContent: firstMatchContent,
                newContent: finalReplacement,
                originalStartLine: patchStartLine,
                contextBefore,
                contextAfter
            });

            // Apply immediately to currentFileContent for next pair matching
            currentFileContent = currentFileContent.substring(0, startPos) + finalReplacement + currentFileContent.substring(startPos + firstMatchContent.length);
            totalInstances++;
        }

        if (totalInstances === 0) {
            return `ERROR: Failed to apply any patches to [${targetPath}].\n${results.map(r => r.error).join('\n')}`;
        }

        fs.writeFileSync(absolutePath, currentFileContent, 'utf8');

        // --- MULTI-DIFF GENERATION (With Smart Gaps) ---
        let diffText = `SUCCESS: File [${targetPath}] updated. [${totalInstances}/${patchPairs.length}] blocks applied.\n\n`;
        diffText += `[DIFF_START]\n`;

        const terminalWidth = process.stdout.columns || 100;
        const separatorLine = '═'.repeat(Math.max(20, terminalWidth - 12));
        const allLinesFinal = currentFileContent.split('\n');
        const successfulPatches = results.filter(r => r.success);

        successfulPatches.forEach((res, idx) => {
            if (idx === 0) {
                // First patch: Context Before
                res.contextBefore.forEach(ctx => {
                    diffText += `[UI_CONTEXT]  ${ctx.num} |${ctx.text}\n`;
                });
            } else {
                const prev = successfulPatches[idx - 1];
                const prevLinesCount = prev.newContent.split('\n').length;
                const prevEndLine = prev.originalStartLine + prevLinesCount - 1;
                const gap = res.originalStartLine - prevEndLine - 1;

                // Threshold 12: If gap is small, show code. If large, show separator.
                if (gap >= 1 && gap < 12) {
                    // Small gap: Show actual lines from the final file state
                    for (let j = prevEndLine; j < res.originalStartLine - 1; j++) {
                        diffText += `[UI_CONTEXT]  ${j + 1} |${allLinesFinal[j]}\n`;
                    }
                } else if (gap >= 12) {
                    // Large gap: Context jump with separator
                    prev.contextAfter.forEach(ctx => {
                        diffText += `[UI_CONTEXT]  ${ctx.num} |${ctx.text}\n`;
                    });
                    diffText += `[UI_CONTEXT] ${separatorLine}\n`;
                    res.contextBefore.forEach(ctx => {
                        diffText += `[UI_CONTEXT]  ${ctx.num} |${ctx.text}\n`;
                    });
                }
            }

            // The Change
            const oldLines = res.oldContent.split('\n');
            const newLines = res.newContent.split('\n');

            oldLines.forEach((line, i) => {
                diffText += `-${res.originalStartLine + i}|${line}\n`;
            });
            newLines.forEach((line, i) => {
                diffText += `+${res.originalStartLine + i}|${line}\n`;
            });

            if (idx === successfulPatches.length - 1) {
                // Final patch: Context After
                res.contextAfter.forEach(ctx => {
                    diffText += `[UI_CONTEXT]  ${ctx.num} |${ctx.text}\n`;
                });
            }
        });

        diffText += `[DIFF_END]`;

        // Add errors if any blocks failed
        const errors = results.filter(r => !r.success);
        if (errors.length > 0) {
            diffText += `\n\n⚠️ WARNING: Some blocks failed:\n${errors.map(e => `  • ${e.error}`).join('\n')}`;
        }

        return diffText;
    } catch (err) {
        return `ERROR: Failed to update file [${targetPath}]: ${err.message}`;
    }
};
