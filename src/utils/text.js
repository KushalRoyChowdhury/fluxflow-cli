import os from 'os';
/**
 * High-fidelity word wrapping that preserves indentation and whitespace.
 * ANSI-aware: does not count escape sequences in width calculation.
 */
export const wrapText = (text, width) => {
    if (!text) return '';
    const ansiRegex = /\x1B\[[0-?]*[ -/]*[@-~]/g;
    
    // Split by standard newline only, since processOutput already normalized it
    const sourceLines = text.split('\n');
    let finalLines = [];

    if (width <= 5) return text;

    const getVisibleLength = (str) => str.replace(ansiRegex, '').length;

    sourceLines.forEach(sLine => {
        const visibleLength = getVisibleLength(sLine);
        
        if (visibleLength <= width) {
            finalLines.push(sLine);
            return;
        }

        // For lines that need wrapping, we split into words but preserve spaces
        const tokens = sLine.split(/(\s+)/);
        let currentLine = '';
        let currentVisibleLength = 0;
        
        const leadingSpaceMatch = sLine.match(/^(\s*)/);
        const indent = leadingSpaceMatch ? leadingSpaceMatch[1] : '';

        tokens.forEach((token, idx) => {
            if (token.length === 0) return;

            const tokenVisibleLength = getVisibleLength(token);

            if (currentVisibleLength + tokenVisibleLength > width) {
                if (currentLine.trim().length > 0) {
                    finalLines.push(currentLine.trimEnd());
                    // Start new line with the current indent + the token
                    currentLine = indent + token;
                    currentVisibleLength = getVisibleLength(currentLine);
                } else {
                    // Ultra long token (e.g. long path or string)
                    // If it has ANSI, we can't easily slice it, so we just push it
                    if (ansiRegex.test(token)) {
                        finalLines.push(token);
                        currentLine = indent;
                        currentVisibleLength = getVisibleLength(currentLine);
                    } else {
                        // Safe to slice non-ANSI long tokens
                        let word = token;
                        while (getVisibleLength(word) > width && width > 10) {
                            finalLines.push(word.substring(0, width));
                            word = word.substring(width);
                        }
                        currentLine = word;
                        currentVisibleLength = getVisibleLength(currentLine);
                    }
                }
            } else {
                currentLine += token;
                currentVisibleLength += tokenVisibleLength;
            }
        });

        if (currentLine.trimEnd().length > 0 || currentLine === indent) {
            finalLines.push(currentLine.trimEnd());
        }
    });

    return finalLines.join('\n');
};

/**
 * Formats token counts into human-readable strings (e.g., 1.5k, 2.1m)
 */
export const formatTokens = (tokens) => {
    if (!tokens && tokens !== 0) return '0.0k';
    const num = typeof tokens === 'string' ? parseFloat(tokens) : tokens;

    if (num >= 1000000) {
        return `${(num / 1000000).toFixed(1)}m`;
    } else if (num >= 1000) {
        return `${(num / 1000).toFixed(1)}k`;
    }
    return num.toString();
};

/**
 * Middle-truncates a string (usually a path) to fit within a maximum length.
 */
export const truncatePath = (p, maxLength = 40) => {
    // represent home dir by ~
    p = p.replace(os.homedir(), '~');
    if (!p || p.length <= maxLength) return p;
    const half = Math.floor((maxLength - 3) / 2);
    return p.substring(0, half) + '...' + p.substring(p.length - half);
};

export const parsePatchPairs = (args) => {
    const patchPairs = [];
    const indices = new Set();

    Object.keys(args).forEach(key => {
        const m = key.match(/^(replaceContent|newContent|content_to_replace|content_to_add)(\d+)?$/);
        if (m) {
            const index = m[2] ? parseInt(m[2]) : 1;
            indices.add(index);
        }
    });

    const sortedIndices = Array.from(indices).sort((a, b) => a - b);
    for (const i of sortedIndices) {
        let r, n;
        if (i === 1) {
            r = args.replaceContent1 ?? (args.content_to_replace ?? args.replaceContent);
            n = args.newContent1 ?? (args.content_to_add ?? args.newContent);
        } else {
            r = args[`replaceContent${i}`] ?? args[`content_to_replace${i}`];
            n = args[`newContent${i}`] ?? args[`content_to_add${i}`];
        }

        if (r !== undefined && n !== undefined) {
            patchPairs.push({ replace: r, new: n });
        } else if (r !== undefined || n !== undefined) {
            return { error: `Mismatched replacement pair for index ${i}. Both replacement and new content must be provided.` };
        }
    }

    return { patchPairs };
};

export const applyPatches = (content, patches) => {
    const results = [];
    let currentFileContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const strip = (t) => t.replace(/^```[\w]*\n?/, '').replace(/```\s*$/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

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

    const adjustIndentation = (newText, originalMatch, leadingContext = '') => {
        if (!newText || originalMatch === undefined) return newText;

        const getIndentStyle = (text) => {
            const lines = text.split('\n').filter(l => l.trim() !== '');
            if (lines.length === 0) return { char: ' ', size: 4 };
            
            const firstIndent = lines[0].match(/^\s*/)[0];
            if (firstIndent.includes('\t')) return { char: '\t', size: 1 };
            
            // Detect space step
            const indents = lines.map(l => l.match(/^\s*/)[0].length).filter(l => l > 0);
            if (indents.length === 0) return { char: ' ', size: firstIndent.length || 4 };
            
            // Find greatest common divisor of indents to guess step
            const gcd = (a, b) => b ? gcd(b, a % b) : a;
            const step = indents.reduce((a, b) => gcd(a, b));
            return { char: ' ', size: step || 4 };
        };

        const fileStyle = getIndentStyle(originalMatch);
        const modelStyle = getIndentStyle(newText);

        const matchMinIndent = getMinIndent(originalMatch).length;
        const leadingIndent = (leadingContext.match(/^\s*/) || [''])[0].length;
        const targetBaseIndentRaw = leadingIndent + matchMinIndent;
        
        // Convert physical lengths to logical units
        const targetUnits = targetBaseIndentRaw / fileStyle.size;
        const modelBaseUnits = getMinIndent(newText).length / modelStyle.size;
        const deltaUnits = targetUnits - modelBaseUnits;

        const newLines = newText.split('\n');
        return newLines.map((line, i) => {
            if (line.trim() === '' && i !== 0) return '';
            
            const currentLineUnits = line.match(/^\s*/)[0].length / modelStyle.size;
            const finalUnits = Math.max(0, currentLineUnits + deltaUnits);
            
            // Re-calculate for first line if it's already partially indented by leadingContext
            let unitCount = finalUnits;
            if (i === 0) {
                const leadingUnits = leadingIndent / fileStyle.size;
                unitCount = Math.max(0, finalUnits - leadingUnits);
            }

            return fileStyle.char.repeat(unitCount * fileStyle.size) + line.trimStart();
        }).join('\n');
    };

    // --- ATOMIC PRE-CHECK ---
    let tempContent = currentFileContent;
    const plan = [];

    for (const pair of patches) {
        const content_to_replace = strip(pair.replace || '');
        const content_to_add = strip(pair.new || '');

        if (content_to_replace === '' && content_to_add === '') continue;

        const exactPattern = content_to_replace.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        let matchRegex = null;

        if (content_to_replace !== '' && tempContent.includes(content_to_replace)) {
            matchRegex = new RegExp(exactPattern, 'g');
        } else {
            const fuzzyLines = content_to_replace.split('\n').map(line => line.trim()).filter(line => line.length > 0)
                .map(line => line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*'));

            if (fuzzyLines.length > 0) {
                const fuzzyPattern = fuzzyLines.join('\\s*');
                try { matchRegex = new RegExp(fuzzyPattern, 'g'); } catch (e) { matchRegex = new RegExp(exactPattern, 'g'); }
            } else { matchRegex = new RegExp(exactPattern, 'g'); }

        }

        const matches = [...tempContent.matchAll(matchRegex)];
        if (matches.length === 0) {
            results.push({ success: false, error: `Block ${results.length + 1}: Could not find match.` });
            continue;
        }
        if (matches.length > 1) {
            results.push({ success: false, error: `Block ${results.length + 1}: Found ${matches.length} matches (must be unique).` });
            continue;
        }

        const startPos = matches[0].index;
        const firstMatchContent = matches[0][0];
        const lineStart = tempContent.lastIndexOf('\n', startPos) + 1;
        const leadingContext = tempContent.substring(lineStart, startPos);

        const finalReplacement = adjustIndentation(content_to_add, firstMatchContent, leadingContext);
        
        plan.push({ startPos, firstMatchContent, finalReplacement, content_to_replace, content_to_add });
        tempContent = tempContent.substring(0, startPos) + finalReplacement + tempContent.substring(startPos + firstMatchContent.length);
    }

    // --- EXECUTION PASS ---
    // If ANY block failed in pre-check, we still return the results but NO content change
    const failures = results.filter(r => !r.success);
    if (failures.length > 0) {
        return { content, results };
    }

    // Re-apply to generate reporting metadata for successful blocks
    let finalContent = currentFileContent;
    const finalResults = [];

    for (let i = 0; i < plan.length; i++) {
        const p = plan[i];
        
        // Match again on the CURRENT state to get accurate line numbers and context
        const exactPattern = p.content_to_replace.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        let matchRegex = null;
        if (p.content_to_replace !== '' && finalContent.includes(p.content_to_replace)) {
            matchRegex = new RegExp(exactPattern, 'g');
        } else {
            const fuzzyLines = p.content_to_replace.split('\n').map(line => line.trim()).filter(line => line.length > 0)
                .map(line => line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*'));
            const fuzzyPattern = fuzzyLines.join('\\s*');
            try { matchRegex = new RegExp(fuzzyPattern, 'g'); } catch (e) { matchRegex = new RegExp(exactPattern, 'g'); }
        }

        const matches = [...finalContent.matchAll(matchRegex)];
        const startPos = matches[0].index;
        const firstMatchContent = matches[0][0];
        const lineStart = finalContent.lastIndexOf('\n', startPos) + 1;
        const leadingContext = finalContent.substring(lineStart, startPos);
        const finalReplacement = adjustIndentation(p.content_to_add, firstMatchContent, leadingContext);

        const allLines = finalContent.split('\n');
        const patchStartLine = finalContent.substring(0, startPos).split('\n').length;
        const contextBefore = [];
        for (let j = Math.max(0, patchStartLine - 4); j < patchStartLine - 1; j++) {
            contextBefore.push({ num: j + 1, text: allLines[j] });
        }
        const patchOldLines = firstMatchContent.split('\n');
        const contextAfter = [];
        const patchEndLineIdx = patchStartLine + patchOldLines.length - 1;
        for (let j = patchEndLineIdx; j < Math.min(allLines.length, patchEndLineIdx + 3); j++) {
            contextAfter.push({ num: j + 1, text: allLines[j] });
        }

        finalResults.push({
            success: true,
            oldContent: firstMatchContent,
            newContent: finalReplacement,
            originalStartLine: patchStartLine,
            contextBefore,
            contextAfter
        });

        finalContent = finalContent.substring(0, startPos) + finalReplacement + finalContent.substring(startPos + firstMatchContent.length);
    }

    return { content: finalContent, results: finalResults };
};

export const generateHighFidelityDiff = (originalContent, finalContent, patchResults, threshold = 8) => {
    if (!patchResults || patchResults.length === 0) return "";

    const allLinesOriginal = originalContent.split(/\r?\n/);
    const allLinesFinal = finalContent.split(/\r?\n/);

    let diffText = `[DIFF_START]\n`;
    const separatorLine = '═'.repeat(88);
    
    // We track where we are in the final content to ensure line numbers are smooth
    let currentFinalLineIdx = 0;

    patchResults.forEach((res, idx) => {
        if (!res.success) return;

        // 1. Context Before / Hunk Merging
        if (idx === 0) {
            // Very first hunk: Show context lines before it
            const contextStart = Math.max(0, res.originalStartLine - 4);
            currentFinalLineIdx = contextStart;
            while (currentFinalLineIdx < res.originalStartLine - 1) {
                diffText += `[UI_CONTEXT]  ${currentFinalLineIdx + 1} |${allLinesFinal[currentFinalLineIdx] || ''}\n`;
                currentFinalLineIdx++;
            }
        } else {
            const prev = patchResults[idx - 1];
            const prevOriginalEnd = prev.originalStartLine + prev.oldContent.split('\n').length - 1;
            const gap = res.originalStartLine - prevOriginalEnd - 1;
            
            if (gap >= threshold) {
                // Large gap: Show 3 lines of context after prev, then separator, then 3 lines before current
                let afterLimit = Math.min(allLinesFinal.length, currentFinalLineIdx + 3);
                while (currentFinalLineIdx < afterLimit) {
                    diffText += `[UI_CONTEXT]  ${currentFinalLineIdx + 1} |${allLinesFinal[currentFinalLineIdx] || ''}\n`;
                    currentFinalLineIdx++;
                }
                diffText += `[UI_CONTEXT] ${separatorLine}\n`;
                
                // Jump to context before current patch
                const beforeStart = Math.max(currentFinalLineIdx, res.originalStartLine - 4);
                currentFinalLineIdx = beforeStart;
                while (currentFinalLineIdx < res.originalStartLine - 1) {
                    diffText += `[UI_CONTEXT]  ${currentFinalLineIdx + 1} |${allLinesFinal[currentFinalLineIdx] || ''}\n`;
                    currentFinalLineIdx++;
                }
            } else {
                // Small gap: Simply fill the lines between patches
                while (currentFinalLineIdx < res.originalStartLine - 1) {
                    diffText += `[UI_CONTEXT]  ${currentFinalLineIdx + 1} |${allLinesFinal[currentFinalLineIdx] || ''}\n`;
                    currentFinalLineIdx++;
                }
            }
        }

        // 2. Report the Removal (-)
        // We use the ORIGINAL line numbers here to show where it was removed from
        const oldLines = res.oldContent.split('\n');
        oldLines.forEach((line, i) => {
            diffText += `-${res.originalStartLine + i}|${line}\n`;
        });

        // 3. Report the Addition (+) with "Anchored Resync"
        // Use FINAL line numbers for all additions
        const originalResyncLineIdx = res.originalStartLine + oldLines.length - 1;
        const resyncAnchorText = allLinesOriginal[originalResyncLineIdx] || null;

        let hunkEndInFinal = currentFinalLineIdx;
        if (resyncAnchorText !== null) {
            // Scan ahead in the final content to find the resync anchor
            const lookAheadLimit = (idx < patchResults.length - 1) ? patchResults[idx+1].originalStartLine + 10 : allLinesFinal.length;
            for (let s = currentFinalLineIdx; s < lookAheadLimit; s++) {
                if (allLinesFinal[s] === resyncAnchorText) {
                    hunkEndInFinal = s;
                    break;
                }
                if (s === allLinesFinal.length - 1) hunkEndInFinal = allLinesFinal.length;
            }
        } else {
            hunkEndInFinal = allLinesFinal.length;
        }

        // Output all lines in finalContent as (+) until resync point
        while (currentFinalLineIdx < hunkEndInFinal) {
            diffText += `+${currentFinalLineIdx + 1}|${allLinesFinal[currentFinalLineIdx] || ''}\n`;
            currentFinalLineIdx++;
        }

        // 4. Final context after if this is the last patch
        if (idx === patchResults.length - 1) {
            let limit = Math.min(allLinesFinal.length, currentFinalLineIdx + 3);
            while (currentFinalLineIdx < limit) {
                diffText += `[UI_CONTEXT]  ${currentFinalLineIdx + 1} |${allLinesFinal[currentFinalLineIdx] || ''}\n`;
                currentFinalLineIdx++;
            }
        }
    });

    diffText += `[DIFF_END]`;
    return diffText;
};
