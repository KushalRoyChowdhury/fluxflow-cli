import os from 'os';
import { DATA_DIR } from './paths';
import fs from 'fs';
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
    let data_dir = DATA_DIR.replaceAll('\\\\', '\\');
    // console.log('D - ' + data_dir + '\nP - ' + p);
    p = p.replace(os.homedir(), '~').replace(data_dir, 'FluxFlow').replaceAll('\\', '/');
    if (!p || p.length <= maxLength) return p;
    const half = Math.floor((maxLength - 3) / 2);
    return p.substring(0, half) + '...' + p.substring(p.length - half).replaceAll('\\', '/');
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

    // Pre-match all patches in the original content
    const patchMatches = [];
    for (let i = 0; i < patches.length; i++) {
        const pair = patches[i];
        const content_to_replace = strip(pair.replace || '');
        const content_to_add = strip(pair.new || '');

        if (content_to_replace === '' && content_to_add === '') {
            patchMatches.push({ index: i, success: false, error: `Block ${i + 1}: Empty replace and add content.` });
            continue;
        }

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
            } else {
                matchRegex = new RegExp(exactPattern, 'g');
            }
        }

        const matches = [...currentFileContent.matchAll(matchRegex)];
        if (matches.length === 0) {
            patchMatches.push({ index: i, success: false, error: `Block ${i + 1}: Could not find match.` });
            continue;
        }
        if (matches.length > 1) {
            patchMatches.push({ index: i, success: false, error: `Block ${i + 1}: Found ${matches.length} matches (must be unique).` });
            continue;
        }

        patchMatches.push({
            index: i,
            success: true,
            startPos: matches[0].index,
            firstMatchContent: matches[0][0],
            content_to_add
        });
    }

    // Identify and mark overlapping patches
    const successful = patchMatches.filter(m => m.success).sort((a, b) => a.startPos - b.startPos);
    for (let j = 0; j < successful.length - 1; j++) {
        const curr = successful[j];
        const next = successful[j + 1];
        if (curr.startPos + curr.firstMatchContent.length > next.startPos) {
            curr.success = false;
            curr.error = `Block ${curr.index + 1}: Overlaps with another block.`;
            next.success = false;
            next.error = `Block ${next.index + 1}: Overlaps with another block.`;
        }
    }

    // Now execute/apply them in ascending order of startPos
    const resultsMap = new Map();
    let finalContent = currentFileContent;
    let charOffset = 0;
    let lineOffset = 0;

    const toApply = patchMatches.filter(m => m.success).sort((a, b) => a.startPos - b.startPos);

    for (const match of toApply) {
        const originalStartPos = match.startPos;
        const originalStartLine = currentFileContent.substring(0, originalStartPos).split('\n').length;

        const finalStartPos = originalStartPos + charOffset;
        const finalStartLine = originalStartLine + lineOffset;

        const lineStart = finalContent.lastIndexOf('\n', finalStartPos) + 1;
        const leadingContext = finalContent.substring(lineStart, finalStartPos);

        const finalReplacement = adjustIndentation(match.content_to_add, match.firstMatchContent, leadingContext);

        const allLines = finalContent.split('\n');
        const contextBefore = [];
        for (let j = Math.max(0, finalStartLine - 4); j < finalStartLine - 1; j++) {
            contextBefore.push({ num: j + 1, text: allLines[j] });
        }
        const patchOldLines = match.firstMatchContent.split('\n');
        const contextAfter = [];
        const patchEndLineIdx = finalStartLine + patchOldLines.length - 1;
        for (let j = patchEndLineIdx; j < Math.min(allLines.length, patchEndLineIdx + 3); j++) {
            contextAfter.push({ num: j + 1, text: allLines[j] });
        }

        resultsMap.set(match.index, {
            success: true,
            oldContent: match.firstMatchContent,
            newContent: finalReplacement,
            originalStartLine,
            finalStartLine,
            contextBefore,
            contextAfter
        });

        // Apply replacement in finalContent
        finalContent = finalContent.substring(0, finalStartPos) + finalReplacement + finalContent.substring(finalStartPos + match.firstMatchContent.length);

        // Update offsets
        charOffset += finalReplacement.length - match.firstMatchContent.length;
        lineOffset += finalReplacement.split('\n').length - match.firstMatchContent.split('\n').length;
    }

    const results = [];
    for (let i = 0; i < patches.length; i++) {
        if (resultsMap.has(i)) {
            results.push(resultsMap.get(i));
        } else {
            const match = patchMatches.find(m => m.index === i);
            results.push({
                success: false,
                error: match ? match.error : `Block ${i + 1}: Unknown error.`
            });
        }
    }

    return { content: finalContent, results };
};

export const generateHighFidelityDiff = (originalContent, finalContent, patchResults, threshold = 8) => {
    if (!patchResults || patchResults.length === 0) return "";

    const allLinesOriginal = originalContent.split(/\r?\n/);
    const allLinesFinal = finalContent.split(/\r?\n/);

    let diffText = `[DIFF_START]\n`;
    const separatorLine = '═'.repeat(88);

    let currentFinalLineIdx = 0;
    let lastSuccessfulHunk = null;

    const sortedResults = patchResults
        .filter(res => res.success)
        .sort((a, b) => a.originalStartLine - b.originalStartLine);

    sortedResults.forEach((res, idx) => {
        const startLineFinal = res.finalStartLine !== undefined ? res.finalStartLine : res.originalStartLine;

        // 1. Context Before / Hunk Merging
        if (lastSuccessfulHunk === null) {
            const contextStart = Math.max(0, startLineFinal - 4);
            currentFinalLineIdx = contextStart;
            while (currentFinalLineIdx < startLineFinal - 1) {
                diffText += `[UI_CONTEXT]  ${currentFinalLineIdx + 1} |${allLinesFinal[currentFinalLineIdx] || ''}\n`;
                currentFinalLineIdx++;
            }
        } else {
            const prev = lastSuccessfulHunk;
            const prevOriginalEnd = prev.originalStartLine + prev.oldContent.split('\n').length - 1;
            const gap = res.originalStartLine - prevOriginalEnd - 1;

            if (gap >= threshold) {
                let afterLimit = Math.min(allLinesFinal.length, currentFinalLineIdx + 3);
                while (currentFinalLineIdx < afterLimit) {
                    diffText += `[UI_CONTEXT]  ${currentFinalLineIdx + 1} |${allLinesFinal[currentFinalLineIdx] || ''}\n`;
                    currentFinalLineIdx++;
                }
                diffText += `[UI_CONTEXT] ${separatorLine}\n`;

                const beforeStart = Math.max(currentFinalLineIdx, startLineFinal - 4);
                currentFinalLineIdx = beforeStart;
                while (currentFinalLineIdx < startLineFinal - 1) {
                    diffText += `[UI_CONTEXT]  ${currentFinalLineIdx + 1} |${allLinesFinal[currentFinalLineIdx] || ''}\n`;
                    currentFinalLineIdx++;
                }
            } else {
                while (currentFinalLineIdx < startLineFinal - 1) {
                    diffText += `[UI_CONTEXT]  ${currentFinalLineIdx + 1} |${allLinesFinal[currentFinalLineIdx] || ''}\n`;
                    currentFinalLineIdx++;
                }
            }
        }

        // 2. Report the Removal (-)
        const oldLines = res.oldContent.split('\n');
        oldLines.forEach((line, i) => {
            diffText += `-${res.originalStartLine + i}|${line}\n`;
        });

        // 3. Report the Addition (+) with Exact Anchoring
        let hunkEndInFinal = currentFinalLineIdx;
        if (res.finalStartLine !== undefined) {
            hunkEndInFinal = res.finalStartLine - 1 + (res.newContent ? res.newContent.split('\n').length : 0);
        } else {
            const originalResyncLineIdx = res.originalStartLine + oldLines.length - 1;
            const resyncAnchorText = allLinesOriginal[originalResyncLineIdx] || null;
            if (resyncAnchorText !== null) {
                const lookAheadLimit = (idx < sortedResults.length - 1) ? (sortedResults[idx + 1].originalStartLine || allLinesFinal.length) + 10 : allLinesFinal.length;
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
        }

        while (currentFinalLineIdx < hunkEndInFinal) {
            diffText += `+${currentFinalLineIdx + 1}|${allLinesFinal[currentFinalLineIdx] || ''}\n`;
            currentFinalLineIdx++;
        }

        lastSuccessfulHunk = res;
    });

    if (lastSuccessfulHunk !== null) {
        let limit = Math.min(allLinesFinal.length, currentFinalLineIdx + 3);
        while (currentFinalLineIdx < limit) {
            diffText += `[UI_CONTEXT]  ${currentFinalLineIdx + 1} |${allLinesFinal[currentFinalLineIdx] || ''}\n`;
            currentFinalLineIdx++;
        }
    }

    diffText += `[DIFF_END]`;
    return diffText;
};

export const parseMessageToBlocks = (msg, columns) => {
    const text = cleanSignals(msg.text || '');

    if (text.includes('- Content Preview:')) {
        const mainParts = text.split('- Content Preview:');
        const headerText = mainParts[0] || '';
        const contentPart = mainParts[1] || '';

        const footerMarker = '[SYSTEM] Check the content preview for verification [/SYSTEM]';
        const contentAndFooter = contentPart.split(footerMarker);
        const content = contentAndFooter[0]?.trim() || '';
        const footer = contentAndFooter[1] ? `${footerMarker}${contentAndFooter[1]}` : '';

        const codeLines = content.split('\n').map(l => l.replace(/\r$/, ''));
        const gutterWidth = String(codeLines.length).length;

        const completedBlocks = [];
        let activeBlock = null;

        codeLines.forEach((line, idx) => {
            const isLast = idx === codeLines.length - 1;
            const block = {
                key: `${msg.id || Date.now()}-write-line-${idx}`,
                msg,
                type: 'write-line',
                text: line,
                gutterWidth,
                lineNum: idx + 1,
                isLastLine: isLast
            };

            if (isLast && msg.isStreaming) {
                activeBlock = block;
            } else {
                completedBlocks.push(block);
            }
        });

        return {
            completed: completedBlocks,
            active: activeBlock ? [activeBlock] : []
        };
    }

    if (text.includes('[DIFF_START]')) {
        const match = text.match(/\[DIFF_START\]([\s\S]*?)(?:\[DIFF_END\]|$)/);
        const diffBody = match ? match[1].trim() : '';
        const diffLines = diffBody.split('\n').map(l => l.replace(/\r$/, ''));

        const highlightInfos = Array(diffLines.length).fill(null);
        let idx = 0;

        while (idx < diffLines.length) {
            const removals = [];
            const additions = [];

            while (idx < diffLines.length) {
                const line = diffLines[idx];
                const cleanLine = line.replace('[UI_CONTEXT]', '');
                if (cleanLine.startsWith('-')) {
                    removals.push({ idx, line: cleanLine });
                    idx++;
                } else {
                    break;
                }
            }

            while (idx < diffLines.length) {
                const line = diffLines[idx];
                const cleanLine = line.replace('[UI_CONTEXT]', '');
                if (cleanLine.startsWith('+')) {
                    additions.push({ idx, line: cleanLine });
                    idx++;
                } else {
                    break;
                }
            }

            if (removals.length > 0 && additions.length > 0) {
                const pairCount = Math.min(removals.length, additions.length);
                for (let k = 0; k < pairCount; k++) {
                    const r = removals[k];
                    const a = additions[k];

                    const rRest = r.line.substring(1);
                    const rSplit = rRest.indexOf('|');
                    const rContent = rSplit !== -1 ? rRest.substring(rSplit + 1) : rRest;

                    const aRest = a.line.substring(1);
                    const aSplit = aRest.indexOf('|');
                    const aContent = aSplit !== -1 ? aRest.substring(aSplit + 1) : aRest;

                    let prefixLen = 0;
                    while (prefixLen < rContent.length && prefixLen < aContent.length && rContent[prefixLen] === aContent[prefixLen]) {
                        prefixLen++;
                    }

                    let suffixLen = 0;
                    const maxSuffix = Math.min(rContent.length - prefixLen, aContent.length - prefixLen);
                    while (suffixLen < maxSuffix && rContent[rContent.length - 1 - suffixLen] === aContent[aContent.length - 1 - suffixLen]) {
                        suffixLen++;
                    }

                    if (prefixLen > 0 || suffixLen > 0) {
                        highlightInfos[r.idx] = { prefixLen, suffixLen };
                        highlightInfos[a.idx] = { prefixLen, suffixLen };
                    }
                }
            }

            if (removals.length === 0 && additions.length === 0) {
                idx++;
            }
        }

        const completedBlocks = [];
        let activeBlock = null;

        diffLines.forEach((line, i) => {
            const isLast = i === diffLines.length - 1;
            const block = {
                key: `${msg.id || Date.now()}-diff-${i}`,
                msg,
                type: 'diff-line',
                text: line,
                highlightInfo: highlightInfos[i]
            };

            if (isLast && msg.isStreaming) {
                activeBlock = block;
            } else {
                completedBlocks.push(block);
            }
        });

        return {
            completed: completedBlocks,
            active: activeBlock ? [activeBlock] : []
        };
    }

    // If it's a system message, special record, user message, it's a single completed block
    if (msg.role === 'system' || msg.isLogo || msg.isHelpRecord || msg.isTerminalRecord || msg.isHomeWarning || msg.isImageStats || msg.isAskRecord || msg.isAboutRecord || msg.isUpdateNotification || msg.role === 'user') {
        return {
            completed: [{
                key: `${msg.id || Date.now()}-full`,
                msg,
                type: 'full-message',
                text
            }],
            active: []
        };
    }

    // It is a think or agent message (either streaming or completed)
    const completedBlocks = [];
    let activeBlock = null;

    if (msg.role === 'think') {
        completedBlocks.push({
            key: `${msg.id}-header`,
            msg,
            type: 'think-header',
            text: ''
        });
        const lines = text.split('\n');
        lines.forEach((line, idx) => {
            const isLast = idx === lines.length - 1;
            const block = {
                key: `${msg.id}-${idx}`,
                msg,
                type: 'think-line',
                text: line
            };
            if (isLast && msg.isStreaming) {
                activeBlock = block;
            } else {
                completedBlocks.push(block);
            }
        });
        if (!msg.isStreaming) {
            completedBlocks.push({
                key: `${msg.id}-footer-padding`,
                msg,
                type: 'think-footer-padding',
                text: ''
            });
        }
    } else {
        const lines = text.split('\n');
        let inTable = false;
        let tableLines = [];
        let inCodeBlock = false;
        let codeLines = [];

        lines.forEach((line, idx) => {
            const isLast = idx === lines.length - 1;
            const isTableRow = line.trim().startsWith('|');
            const isCodeBlockMarker = line.trim().startsWith('```');

            if (inCodeBlock) {
                codeLines.push(line);
                if (isCodeBlockMarker || isLast) {
                    inCodeBlock = !isCodeBlockMarker;
                    if (!inCodeBlock || isLast) {
                        const block = {
                            key: `${msg.id}-code-${idx}`,
                            msg,
                            type: 'agent-line',
                            text: codeLines.join('\n')
                        };
                        if (isLast && msg.isStreaming && inCodeBlock) {
                            activeBlock = block;
                        } else {
                            completedBlocks.push(block);
                        }
                        codeLines = [];
                    }
                }
            } else if (isCodeBlockMarker) {
                inCodeBlock = true;
                codeLines.push(line);
                if (isLast) {
                    const block = {
                        key: `${msg.id}-code-${idx}`,
                        msg,
                        type: 'agent-line',
                        text: codeLines.join('\n')
                    };
                    if (msg.isStreaming) {
                        activeBlock = block;
                    } else {
                        completedBlocks.push(block);
                    }
                }
            } else if (isTableRow) {
                inTable = true;
                tableLines.push(line);
                if (isLast) {
                    if (msg.isStreaming) {
                        activeBlock = {
                            key: `${msg.id}-table-${idx}`,
                            msg,
                            type: 'table',
                            text: tableLines.join('\n'),
                            isStreaming: true
                        };
                    } else {
                        completedBlocks.push({
                            key: `${msg.id}-table-${idx}`,
                            msg,
                            type: 'table',
                            text: tableLines.join('\n'),
                            isStreaming: false
                        });
                    }
                }
            } else {
                if (inTable) {
                    completedBlocks.push({
                        key: `${msg.id}-table-${idx}`,
                        msg,
                        type: 'table',
                        text: tableLines.join('\n'),
                        isStreaming: false
                    });
                    inTable = false;
                    tableLines = [];
                }

                const block = {
                    key: `${msg.id}-${idx}`,
                    msg,
                    type: 'agent-line',
                    text: line
                };

                if (isLast && msg.isStreaming) {
                    activeBlock = block;
                } else {
                    completedBlocks.push(block);
                }
            }
        });

        if (!msg.isStreaming && msg.workedDuration) {
            completedBlocks.push({
                key: `${msg.id}-worked-duration`,
                msg,
                type: 'worked-duration',
                text: ''
            });
        }
    }

    return {
        completed: completedBlocks,
        active: activeBlock ? [activeBlock] : []
    };
};

export const TOOL_LABELS = {
    'write_file': 'WriteFile',
    'update_file': 'UpdateFile',
    'read_folder': 'ReadFolder',
    'view_file': 'ViewFile',
    'exec_command': 'ExecuteCommand',
    'web_search': 'WebSearch',
    'web_scrape': 'ReadSite',
    'search_keyword': 'SearchKeyword',
    'write_pdf': 'CreatePDF',
    'write_docx': 'CreateDocument',
    'generate_image': 'GenerateImage',

    // PascalCase Support
    'WriteFile': 'WriteFile',
    'PatchFile': 'PatchFile',
    'ReadFolder': 'ReadFolder',
    'ReadFile': 'ReadFile',
    'Run': 'RunCommand',
    'WebSearch': 'WebSearch',
    'WebScrape': 'WebScrape',
    'SearchKeyword': 'SearchKeyword',
    'WritePDF': 'WritePDF',
    'WriteDoc': 'WriteDoc',
    'Memory': 'Memory',
    'Chat': 'Chat',
    'GenerateImage': 'GenerateImage'
};

export const cleanSignals = (text) => {
    if (!text) return text;

    let result = text
        .replace(/<\/think>(\r?\n){2}/gi, '</think>')
        .replace(/(\r?\n){2}(?=\[?(?:tool:functions|tool\.functions|\s*turn\s*:))/gi, '');
    const trigger = 'tool:functions.';

    // Greedy loop to strip all tool calls
    while (true) {
        const lowerResult = result.toLowerCase();
        let triggerIdx = lowerResult.indexOf(trigger);
        if (triggerIdx === -1) break;

        // [HARDENING] Check for outer bracket
        let startIdx = triggerIdx;
        let hasOuterBracket = false;

        // Look back for '[' (ignoring whitespace)
        let k = triggerIdx - 1;
        while (k >= 0 && /\s/.test(result[k])) k--;
        if (k >= 0 && result[k] === '[') {
            startIdx = k;
            hasOuterBracket = true;
        }

        let balance = 0;
        let foundStart = false;
        let inString = null;
        let j = triggerIdx;

        while (j < result.length) {
            const char = result[j];

            // String immunity
            if (!inString && (char === "'" || char === '"' || char === '`')) {
                inString = char;
            } else if (inString && char === inString && result[j - 1] !== '\\') {
                inString = null;
            }

            if (!inString) {
                if (char === '(') {
                    balance++;
                    foundStart = true;
                } else if (char === ')') {
                    balance--;
                }
            }

            if (foundStart && balance === 0 && !inString) {
                // If we have outer bracket, look for closing ']'
                let endIdx = j;
                if (hasOuterBracket) {
                    let m = j + 1;
                    while (m < result.length && /\s/.test(result[m])) m++;
                    if (m < result.length && result[m] === ']') {
                        endIdx = m;
                    }
                }
                result = result.substring(0, startIdx) + result.substring(endIdx + 1);
                break;
            }

            j++;

            // [SAFETY] If we reached the end without finding a closing boundary,
            // it's a partial call. Strip it and break to prevent infinite loop.
            if (j === result.length) {
                result = result.substring(0, startIdx);
                return result; // Immediate exit
            }
        }
    }

    // Secondary cleanup for protocol signals and success/error markers
    return result
        .replaceAll(/\[SYSTEM\][\s\S]*?\[\/SYSTEM\]/gi, '')
        .replaceAll(/<(think|thought)>[\s\S]*?(?:<\/(think|thought)>|$)/gi, '')
        .replace(/\[ANSWER\][\s\S]*?(?:\[\/ANSWER\]|$)/gi, '')
        // .replaceAll('[ANSWER]', '')
        // .replaceAll('[/ANSWER]', '')
        .replaceAll(/\[TOOL RESULT\]:?\s*/gi, '')
        .split('\n')
        .filter(line => !line.trim().startsWith('SUCCESS:') && !line.trim().startsWith('ERROR:'))
        .join('\n')
        .replaceAll(/\[\s*turn\s*:\s*(continue|finish)\s*\]/gi, '')
        .replaceAll(/\[\[END\]\]/gi, '')
        .replaceAll(/\[\s*turn\s*:?.*?$/gi, '')
        .replaceAll(/\n\s*turn\s*:?.*?$/gi, '')
        .replaceAll(/\[\s*$/gi, '')
        .replaceAll(/\n\nResponded on .*/g, '')
        .replaceAll(/\n\n\[Prompted on: .*\]/g, '')
        .replaceAll(/(\$?\\?\/?\\rightarrow\$?|\$\\rightarrow\$)/gi, '→')
        .replaceAll(/(\$?\\?\/?\\leftarrow\$?|\$\\leftarrow\$)/gi, '←')
        .replaceAll(/(\$?\\?\/?\\uparrow\$?|\$\\uparrow\$)/gi, '↑')
        .replaceAll(/(\$?\\?\/?\\downarrow\$?|\$\\downarrow\$)/gi, '↓')
        .replaceAll(/(\$?\\?\/?\\leftrightarrow\$?|\$\\leftrightarrow\$)/gi, '↔')
        .replaceAll(/@\[TerminalName:.*?, ProcessId:.*?\]/gi, '')
        .replaceAll(/\b(write_file|update_file|read_folder|view_file|exec_command|web_search|web_scrape|search_keyword|write_pdf|write_docx|generate_image)\b/gi, (match) => TOOL_LABELS[match.toLowerCase()] || match)
        .trim();
};

