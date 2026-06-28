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

export const parseLineInfo = (l) => {
    if (!l) return null;
    const clean = l.replace('[UI_CONTEXT]', '').replace(/\r/g, '');

    // Check formatting indicators
    const isR = clean.startsWith('-');
    const isA = clean.startsWith('+');

    // Slice away the prefix symbol if it exists, otherwise keep it clean
    let rest = (isR || isA) ? clean.substring(1) : clean;
    rest = rest.trim();

    const splitIdx = rest.indexOf('|');

    // Extract gutter values cleanly
    const num = splitIdx !== -1 ? rest.substring(0, splitIdx).trim() : '';
    const content = splitIdx !== -1 ? rest.substring(splitIdx + 1) : rest;

    return { isR, isA, num, content };
};

export const getSimilarity = (s1, s2) => {
    if (!s1 && !s2) return 1.0;
    if (!s1 || !s2) return 0.0;
    const l1 = s1.length;
    const l2 = s2.length;
    const dp = Array.from({ length: l1 + 1 }, () => Array(l2 + 1).fill(0));
    for (let i = 0; i <= l1; i++) dp[i][0] = i;
    for (let j = 0; j <= l2; j++) dp[0][j] = j;
    for (let i = 1; i <= l1; i++) {
        for (let j = 1; j <= l2; j++) {
            if (s1[i - 1] === s2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1;
            }
        }
    }
    const maxLen = Math.max(l1, l2);
    if (maxLen === 0) return 1.0;
    return 1.0 - dp[l1][l2] / maxLen;
};

export const alignChangeGroup = (group) => {
    const removals = [];
    const additions = [];

    group.forEach((item, index) => {
        if (item.parsed.isR) {
            removals.push({ index, content: item.parsed.content });
        } else if (item.parsed.isA) {
            additions.push({ index, content: item.parsed.content });
        }
    });

    const N = removals.length;
    const M = additions.length;
    if (N === 0 || M === 0) return;

    const dp = Array.from({ length: N + 1 }, () => Array(M + 1).fill(0));
    const choices = Array.from({ length: N + 1 }, () => Array(M + 1).fill(''));

    for (let i = 1; i <= N; i++) choices[i][0] = 'up';
    for (let j = 1; j <= M; j++) choices[0][j] = 'left';

    const simMatrix = Array.from({ length: N }, () => Array(M).fill(0));
    for (let i = 0; i < N; i++) {
        for (let j = 0; j < M; j++) {
            simMatrix[i][j] = getSimilarity(removals[i].content.trim(), additions[j].content.trim());
        }
    }

    for (let i = 1; i <= N; i++) {
        for (let j = 1; j <= M; j++) {
            const matchScore = simMatrix[i - 1][j - 1];
            const score = matchScore >= 0.2 ? matchScore : -10;

            const diag = dp[i - 1][j - 1] + score;
            const up = dp[i - 1][j];
            const left = dp[i][j - 1];

            if (diag >= up && diag >= left) {
                dp[i][j] = diag;
                choices[i][j] = 'diag';
            } else if (up >= left) {
                dp[i][j] = up;
                choices[i][j] = 'up';
            } else {
                dp[i][j] = left;
                choices[i][j] = 'left';
            }
        }
    }

    let i = N;
    let j = M;
    while (i > 0 || j > 0) {
        if (choices[i][j] === 'diag') {
            const matchScore = simMatrix[i - 1][j - 1];
            if (matchScore >= 0.2) {
                const rIdx = removals[i - 1].index;
                const aIdx = additions[j - 1].index;
                group[rIdx].pairContent = group[aIdx].parsed.content;
                group[aIdx].pairContent = group[rIdx].parsed.content;
            }
            i--;
            j--;
        } else if (choices[i][j] === 'up') {
            i--;
        } else {
            j--;
        }
    }
};

const blocksCache = new Map();
const streamingBlocksCache = new Map();

const MAX_CACHE_SIZE = 200;

export const parseMessageToBlocks = (msg, columns) => {
    if (!msg) return { completed: [], active: [] };
    const cacheKey = `${msg.id}-${msg.text?.length || 0}-${columns}-${msg.isStreaming}`;
    if (!msg.isStreaming && blocksCache.has(cacheKey)) {
        return blocksCache.get(cacheKey);
    }
    const text = cleanSignals(msg.text || '');

    const streamCacheKey = `${msg.id}-${columns}`;
    let cachedBlocks = new Map();
    if (msg.isStreaming) {
        const cached = streamingBlocksCache.get(streamCacheKey);
        if (cached && text.startsWith(cached.text)) {
            cachedBlocks = cached.blocksMap;
        }
    }

    const getBlock = (key, type, textContent, extra = {}) => {
        const existing = cachedBlocks.get(key);
        if (
            existing &&
            existing.text === textContent &&
            existing.type === type &&
            !!existing.isActiveBlock === !!extra.isActiveBlock &&
            !!existing.isStreaming === !!extra.isStreaming &&
            existing.pairContent === extra.pairContent
        ) {
            return existing;
        }
        return {
            key,
            msg,
            type,
            text: textContent,
            ...extra
        };
    };

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
            const block = getBlock(`${msg.id || Date.now()}-write-line-${idx}`, 'write-line', line, {
                gutterWidth,
                lineNum: idx + 1,
                isFirstLine: idx === 0,
                isLastLine: isLast
            });

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

        // Pre-parse and align diff lines so that DiffLine component doesn't need to do it repeatedly
        const parsedLines = diffLines.map(line => {
            return {
                line,
                parsed: parseLineInfo(line),
                pairContent: null
            };
        });

        let currentGroup = [];
        for (let i = 0; i < parsedLines.length; i++) {
            const item = parsedLines[i];
            if (item.parsed && (item.parsed.isR || item.parsed.isA)) {
                currentGroup.push(item);
            } else {
                if (currentGroup.length > 0) {
                    alignChangeGroup(currentGroup);
                    currentGroup = [];
                }
            }
        }
        if (currentGroup.length > 0) {
            alignChangeGroup(currentGroup);
        }

        const completedBlocks = [];
        let activeBlock = null;

        diffLines.forEach((line, i) => {
            const isLast = i === diffLines.length - 1;
            const block = getBlock(`${msg.id || Date.now()}-diff-${i}`, 'diff-line', line, {
                isFirstLine: i === 0,
                isLastLine: isLast,
                pairContent: parsedLines[i].pairContent
            });

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
            completed: [getBlock(`${msg.id || Date.now()}-full`, 'full-message', text)],
            active: []
        };
    }

    // It is a think or agent message (either streaming or completed)
    const completedBlocks = [];
    let activeBlock = null;

    if (msg.role === 'think') {
        completedBlocks.push(getBlock(`${msg.id}-header`, 'think-header', ''));
        const lines = text.split('\n');
        lines.forEach((line, idx) => {
            const isLast = idx === lines.length - 1;
            const block = getBlock(`${msg.id}-${idx}`, 'think-line', line, isLast && msg.isStreaming ? { isActiveBlock: true } : {});
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
                        const block = getBlock(`${msg.id}-code-${idx}`, 'agent-line', codeLines.join('\n'), isLast && msg.isStreaming && inCodeBlock ? { isActiveBlock: true } : {});
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
                    const block = getBlock(`${msg.id}-code-${idx}`, 'agent-line', codeLines.join('\n'), msg.isStreaming ? { isActiveBlock: true } : {});
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
                        activeBlock = getBlock(`${msg.id}-table-${idx}`, 'table', tableLines.join('\n'), { isStreaming: true, isActiveBlock: true });
                    } else {
                        completedBlocks.push(getBlock(`${msg.id}-table-${idx}`, 'table', tableLines.join('\n'), { isStreaming: false }));
                    }
                }
            } else {
                if (inTable) {
                    completedBlocks.push(getBlock(`${msg.id}-table-${idx}`, 'table', tableLines.join('\n'), { isStreaming: false }));
                    inTable = false;
                    tableLines = [];
                }

                const block = getBlock(`${msg.id}-${idx}`, 'agent-line', line, isLast && msg.isStreaming ? { isActiveBlock: true } : {});

                if (isLast && msg.isStreaming) {
                    activeBlock = block;
                } else {
                    completedBlocks.push(block);
                }
            }
        });

        if (!msg.isStreaming && msg.workedDuration) {
            completedBlocks.push(getBlock(`${msg.id}-worked-duration`, 'worked-duration', ''));
        }
    }

    const result = {
        completed: completedBlocks,
        active: activeBlock ? [activeBlock] : []
    };
    if (!msg.isStreaming) {
        blocksCache.set(cacheKey, result);
        if (blocksCache.size > MAX_CACHE_SIZE) {
            const firstKey = blocksCache.keys().next().value;
            blocksCache.delete(firstKey);
        }
        streamingBlocksCache.delete(streamCacheKey);
    } else {
        const blocksMap = new Map();
        completedBlocks.forEach(b => blocksMap.set(b.key, b));
        if (activeBlock) {
            blocksMap.set(activeBlock.key, activeBlock);
        }
        streamingBlocksCache.set(streamCacheKey, {
            text,
            blocksMap
        });
        if (streamingBlocksCache.size > MAX_CACHE_SIZE) {
            const firstKey = streamingBlocksCache.keys().next().value;
            streamingBlocksCache.delete(firstKey);
        }
    }
    return result;
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

// ============================================================================
// PRE-COMPILED REGEXES
// Hoisted out of cleanSignals to prevent V8 from re-compiling during stream GC
// ============================================================================
const REGEX_INITIAL_THINK = /<\/think>(\r?\n){2}/gi;
const REGEX_INITIAL_TOOL = /(\r?\n){2}(?=\[?(?:tool:functions|tool\.functions|\s*turn\s*:))/gi;
const REGEX_SYSTEM = /\[SYSTEM\][\s\S]*?\[\/SYSTEM\]/gi;
const REGEX_THINK = /<(think|thought)>[\s\S]*?(?:<\/(think|thought)>|$)/gi;
const REGEX_ANSWER = /\[ANSWER\][\s\S]*?(?:\[\/ANSWER\]|$)/gi;
const REGEX_TOOL_RES = /\[TOOL RESULT\]:?\s*/gi;
// The (\r?\n)? perfectly mimics the old .split().filter().join() behavior
const REGEX_SUCCESS_ERROR = /^\s*(SUCCESS|ERROR):.*(\r?\n)?/gm;
const REGEX_TURN_1 = /\[\s*turn\s*:\s*(continue|finish)\s*\]/gi;
const REGEX_END = /\[\[END\]\]/gi;
const REGEX_TURN_2 = /\[\s*turn\s*:?.*?$/gi;
const REGEX_TURN_3 = /\n\s*turn\s*:?.*?$/gi;
const REGEX_OPEN_BRACKET = /\[\s*$/gi;
const REGEX_RESPONDED = /\n\nResponded on .*/g;
const REGEX_PROMPTED = /\n\n\[Prompted on: .*\]/g;
const REGEX_ARROWS = /(\$?\\?\/?\\rightarrow\$?|\$\\rightarrow\$)/gi;
const REGEX_ARROWS_L = /(\$?\\?\/?\\leftarrow\$?|\$\\leftarrow\$)/gi;
const REGEX_ARROWS_U = /(\$?\\?\/?\\uparrow\$?|\$\\uparrow\$)/gi;
const REGEX_ARROWS_D = /(\$?\\?\/?\\downarrow\$?|\$\\downarrow\$)/gi;
const REGEX_ARROWS_LR = /(\$?\\?\/?\\leftrightarrow\$?|\$\\leftrightarrow\$)/gi;
const REGEX_TERMINAL = /@\[TerminalName:.*?, ProcessId:.*?\]/gi;
const REGEX_TOOLS = /\b(write_file|update_file|read_folder|view_file|exec_command|web_search|web_scrape|search_keyword|write_pdf|write_docx|generate_image)\b/gi;

export const cleanSignals = (text) => {
    if (!text) return text;

    let result = text
        .replace(REGEX_INITIAL_THINK, '</think>')
        .replace(REGEX_INITIAL_TOOL, '');

    const trigger = 'tool:functions.';

    // FAST PATH: Bypass the heavy while-loop entirely if the tool trigger isn't present
    if (result.toLowerCase().includes(trigger)) {
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
    }

    // Secondary cleanup for protocol signals and success/error markers
    return result
        .replaceAll(REGEX_SYSTEM, '')
        .replaceAll(REGEX_THINK, '')
        .replace(REGEX_ANSWER, '')
        .replaceAll(REGEX_TOOL_RES, '')
        .replaceAll(REGEX_SUCCESS_ERROR, '') // This replaces the memory-heavy .split().filter().join()
        .replaceAll(REGEX_TURN_1, '')
        .replaceAll(REGEX_END, '')
        .replaceAll(REGEX_TURN_2, '')
        .replaceAll(REGEX_TURN_3, '')
        .replaceAll(REGEX_OPEN_BRACKET, '')
        .replaceAll(REGEX_RESPONDED, '')
        .replaceAll(REGEX_PROMPTED, '')
        .replaceAll(REGEX_ARROWS, '→')
        .replaceAll(REGEX_ARROWS_L, '←')
        .replaceAll(REGEX_ARROWS_U, '↑')
        .replaceAll(REGEX_ARROWS_D, '↓')
        .replaceAll(REGEX_ARROWS_LR, '↔')
        .replaceAll(REGEX_TERMINAL, '')
        .replaceAll(REGEX_TOOLS, (match) => TOOL_LABELS[match.toLowerCase()] || match)
        .trim();
};

export const clearBlocksCache = () => {
    blocksCache.clear();
    streamingBlocksCache.clear();
};
