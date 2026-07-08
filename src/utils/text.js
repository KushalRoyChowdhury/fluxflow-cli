import os from 'os';
import { DATA_DIR } from './paths';
import fs from 'fs';

export const flattenString = (str) => {
    if (typeof str !== 'string') return str;
    return str.length > 12 ? (str + '').replace('', '') : str;
};

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
                    // Cap continuation indent to avoid wild shifts on deeply-nested code
                    const cappedIndent = indent.substring(0, Math.min(indent.length, 8));
                    currentLine = cappedIndent + token;
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

    return flattenString(finalLines.join('\n'));
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
    if (!p || p.length <= maxLength) return flattenString(p);
    const half = Math.floor((maxLength - 3) / 2);
    return flattenString(p.substring(0, half) + '...' + p.substring(p.length - half).replaceAll('\\', '/'));
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

        // Detect whether the file uses tabs (preserve char style)
        const usesTabs = /^\t/m.test(originalMatch);
        const indentChar = usesTabs ? '\t' : ' ';

        // Anchor: align new content so its first non-empty line matches
        // the indent level of the first non-empty line of the original match.
        // This avoids GCD-based style detection which collapses on large files
        // with mixed nesting depths (e.g. GCD(4,6,8) = 2, not 4).
        const firstNonEmpty = (text) => text.split('\n').find(l => l.trim() !== '') ?? '';
        const origFirstIndent = firstNonEmpty(originalMatch).match(/^\s*/)[0].length;
        const newFirstIndent = firstNonEmpty(newText).match(/^\s*/)[0].length;

        // Raw character delta: positive = need to add indent, negative = need to remove
        const delta = origFirstIndent - newFirstIndent;

        // How many chars the leadingContext already contributes at the insertion point
        const leadingLen = (leadingContext.match(/^\s*/) || [''])[0].length;

        const newLines = newText.split('\n');
        return newLines.map((line, i) => {
            if (line.trim() === '' && i !== 0) return '';

            const currentIndent = line.match(/^\s*/)[0].length;
            let targetIndent = Math.max(0, currentIndent + delta);

            // First line: the leadingContext is already in the file before our text,
            // so subtract it to avoid double-indenting.
            if (i === 0) targetIndent = Math.max(0, targetIndent - leadingLen);

            return indentChar.repeat(targetIndent) + line.trimStart();
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
    return flattenString(diffText);
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
    const num = splitIdx !== -1 ? flattenString(rest.substring(0, splitIdx).trim()) : '';
    const content = splitIdx !== -1 ? flattenString(rest.substring(splitIdx + 1)) : flattenString(rest);

    return { isR, isA, num, content };
};

export const getSimilarity = (s1, s2) => {
    if (!s1 && !s2) return 1.0;
    if (!s1 || !s2) return 0.0;
    
    const l1 = s1.length;
    const l2 = s2.length;
    
    // Optimisation: Make sure s2 is the shorter string to save space/time
    let str1 = s1;
    let str2 = s2;
    if (l1 < l2) {
        str1 = s2;
        str2 = s1;
    }
    
    const n = str1.length;
    const m = str2.length;
    
    const prevRow = new Int32Array(m + 1);
    const currRow = new Int32Array(m + 1);
    
    for (let j = 0; j <= m; j++) {
        prevRow[j] = j;
    }
    
    for (let i = 1; i <= n; i++) {
        currRow[0] = i;
        const char1 = str1[i - 1];
        for (let j = 1; j <= m; j++) {
            if (char1 === str2[j - 1]) {
                currRow[j] = prevRow[j - 1];
            } else {
                currRow[j] = Math.min(prevRow[j], currRow[j - 1], prevRow[j - 1]) + 1;
            }
        }
        // Copy currRow to prevRow for next iteration
        prevRow.set(currRow);
    }
    
    const dist = prevRow[m];
    const maxLen = Math.max(l1, l2);
    if (maxLen === 0) return 1.0;
    return 1.0 - dist / maxLen;
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
const CHUNK_SIZE = 6; // Lines per Static batch (active buffer ≤ CHUNK_SIZE lines)

// Hoisted to module scope — avoids recreating a closure on every streaming tick
const indexBlockIntoMap = (b, map) => {
    map.set(b.key, b);
    if (b.type === 'chunk' && b.blocks) b.blocks.forEach(sub => indexBlockIntoMap(sub, map));
};

export const parseMessageToBlocks = (msg, columns) => {
    if (!msg) return { completed: [], active: [] };
    const cacheKey = `${msg.id}-${msg.text?.length || 0}-${columns}-${msg.isStreaming}`;
    if (!msg.isStreaming && blocksCache.has(cacheKey)) {
        return blocksCache.get(cacheKey);
    }
    const text = flattenString(cleanSignals(msg.text || ''));

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

        // V8 Memory Leak Fix: Flatten strings so cached blocks don't retain the giant growing streaming strings.
        const flatText = flattenString(textContent);

        const flatExtra = { ...extra };
        if (typeof flatExtra.pairContent === 'string') {
            flatExtra.pairContent = flattenString(flatExtra.pairContent);
        }
        if (Array.isArray(flatExtra.wrappedLines)) {
            flatExtra.wrappedLines = flatExtra.wrappedLines.map(flattenString);
        }

        return {
            key,
            isStreamingMsg: !!msg.isStreaming,
            workedDuration: msg.workedDuration,
            type,
            text: flatText,
            msg: type === 'full-message' ? msg : undefined, // Only full-message requires role/meta checks
            ...flatExtra
        };
    };

    if (text.includes('- Content Preview:')) {
        let extension = '';
        const fileMatch = text.match(/File\s+\[(.*?)\]/i);
        if (fileMatch) {
            extension = fileMatch[1].split('.').pop().toLowerCase();
        }

        const mainParts = text.split('- Content Preview:');
        const contentPart = mainParts[1] || '';
        const footerMarker = '[SYSTEM] Check the content preview for verification [/SYSTEM]';
        const content = contentPart.split(footerMarker)[0]?.trim() || '';

        const codeLines = content.split('\n').map(l => l.replace(/\r$/, ''));
        const gutterWidth = String(codeLines.length).length;

        const completedBlocks = [];
        let activeBlock = null;
        let writeChunk = [];

        const flushWrite = () => {
            if (!writeChunk.length) return;
            const batch = writeChunk;
            writeChunk = [];  // fresh array; old one handed off — no spread needed
            completedBlocks.push(batch.length === 1 ? batch[0] : {
                key: `${batch[0].key}-chunk`, type: 'chunk', blocks: batch
            });
        };

        const innerWidth = columns - (gutterWidth + 6);
        codeLines.forEach((line, idx) => {
            const isLast = idx === codeLines.length - 1;
            const wrappedLines = wrapText(line, innerWidth).split('\n');
            const block = getBlock(`${msg.id || Date.now()}-write-line-${idx}`, 'write-line', line, {
                gutterWidth, lineNum: idx + 1, isFirstLine: idx === 0, isLastLine: isLast, extension, wrappedLines
            });
            if (isLast && msg.isStreaming) {
                flushWrite();
                activeBlock = block;
            } else {
                writeChunk.push(block);
                if (writeChunk.length >= CHUNK_SIZE) flushWrite();
            }
        });
        flushWrite();

        return { completed: completedBlocks, active: activeBlock ? [activeBlock] : [] };
    }

    if (text.includes('[DIFF_START]')) {
        const match = text.match(/\[DIFF_START\]([\s\S]*?)(?:\[DIFF_END\]|$)/);
        const diffBody = match ? match[1].trim() : '';
        const diffLines = diffBody.split('\n').map(l => l.replace(/\r$/, ''));

        const parsedLines = diffLines.map(line => ({ line, parsed: parseLineInfo(line), pairContent: null }));

        let currentGroup = [];
        for (let i = 0; i < parsedLines.length; i++) {
            const item = parsedLines[i];
            if (item.parsed && (item.parsed.isR || item.parsed.isA)) {
                currentGroup.push(item);
            } else {
                if (currentGroup.length > 0) { alignChangeGroup(currentGroup); currentGroup = []; }
            }
        }
        if (currentGroup.length > 0) alignChangeGroup(currentGroup);

        const completedBlocks = [];
        let activeBlock = null;
        let diffChunk = [];

        const flushDiff = () => {
            if (!diffChunk.length) return;
            const batch = diffChunk;
            diffChunk = [];  // fresh array; old one handed off — no spread needed
            completedBlocks.push(batch.length === 1 ? batch[0] : {
                key: `${batch[0].key}-chunk`, type: 'chunk', blocks: batch
            });
        };

        diffLines.forEach((line, i) => {
            const isLast = i === diffLines.length - 1;
            const parsed = parsedLines[i].parsed;
            let wrappedLines = null;
            if (parsed) {
                wrappedLines = wrapText(parsed.content, columns - 17).split('\n');
            }
            const block = getBlock(`${msg.id || Date.now()}-diff-${i}`, 'diff-line', line, {
                isFirstLine: i === 0, isLastLine: isLast, pairContent: parsedLines[i].pairContent, wrappedLines
            });
            if (isLast && msg.isStreaming) {
                flushDiff();
                activeBlock = block;
            } else {
                diffChunk.push(block);
                if (diffChunk.length >= CHUNK_SIZE) flushDiff();
            }
        });
        flushDiff();

        return { completed: completedBlocks, active: activeBlock ? [activeBlock] : [] };
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

    // ── Chunk-batching infrastructure ────────────────────────────────────────
    // Per-line blocks are batched into groups of CHUNK_SIZE before being committed
    // to Static, reducing total block count and React reconciler work.
    let pendingChunk = [];
    let pendingChunkType = null;

    const flushPending = () => {
        if (!pendingChunk.length) return;
        const batch = pendingChunk;
        pendingChunk = [];  // fresh array; old one handed off — no spread needed
        pendingChunkType = null;
        completedBlocks.push(batch.length === 1 ? batch[0] : {
            key: `${msg.id || 'x'}-chunk-${batch[0].key}`,
            type: 'chunk',
            blocks: batch
        });
    };

    // Enqueue a per-line block. Flushes on type change or when CHUNK_SIZE is reached.
    const enqueue = (block, isLastOfMessage = false) => {
        if (pendingChunkType !== null && pendingChunkType !== block.type) flushPending();
        pendingChunk.push(block);
        pendingChunkType = block.type;
        if (pendingChunk.length >= CHUNK_SIZE) {
            if (msg.isStreaming && isLastOfMessage) return;
            flushPending();
        }
    };
    // ─────────────────────────────────────────────────────────────────────────

    if (msg.role === 'think') {
        completedBlocks.push(getBlock(`${msg.id}-header`, 'think-header', ''));
        const lines = text.split('\n');
        lines.forEach((line, idx) => {
            const isLast = idx === lines.length - 1;
            enqueue(getBlock(`${msg.id}-${idx}`, 'think-line', line, {}), isLast);
        });
        if (!msg.isStreaming) {
            flushPending();
            completedBlocks.push({ key: `${msg.id}-footer-padding`, type: 'think-footer-padding', text: '' });
        }
    } else {
        const lines = text.split('\n');
        let inTable = false;
        let tableLines = [];
        let inCodeBlock = false;
        let currentLang = '';
        let codeLineNum = 0;
        let codeStartIdx = 0;

        lines.forEach((line, idx) => {
            const isLast = idx === lines.length - 1;
            const isTableRow = line.trim().startsWith('|');
            const isCodeBlockMarker = line.trim().startsWith('```');

            if (inCodeBlock) {
                if (isCodeBlockMarker) {
                    inCodeBlock = false;
                    enqueue(getBlock(`${msg.id}-code-close-${codeStartIdx}`, 'code-fence-close', '', {}), isLast);
                } else {
                    codeLineNum++;
                    enqueue(getBlock(`${msg.id}-code-line-${idx}`, 'code-line', line, { lineNum: codeLineNum, lang: currentLang }), isLast);
                }
            } else if (isCodeBlockMarker) {
                inCodeBlock = true;
                codeStartIdx = idx;
                codeLineNum = 0;
                currentLang = line.trim().replace(/^```/, '').trim();
                enqueue(getBlock(`${msg.id}-code-open-${idx}`, 'code-fence-open', currentLang, {}), isLast);
            } else if (isTableRow) {
                inTable = true;
                tableLines.push(line);
                if (isLast) {
                    // Table at end of message — structural, handle directly
                    flushPending();
                    if (msg.isStreaming) {
                        activeBlock = getBlock(`${msg.id}-table-${idx}`, 'table', tableLines.join('\n'), { isStreaming: true });
                    } else {
                        completedBlocks.push(getBlock(`${msg.id}-table-${idx}`, 'table', tableLines.join('\n'), { isStreaming: false }));
                    }
                }
            } else {
                if (inTable) {
                    flushPending();
                    completedBlocks.push(getBlock(`${msg.id}-table-${idx}`, 'table', tableLines.join('\n'), { isStreaming: false }));
                    inTable = false;
                    tableLines = [];
                }
                enqueue(getBlock(`${msg.id}-${idx}`, 'agent-line', line, {}), isLast);
            }
        });

        if (!msg.isStreaming && msg.workedDuration) {
            flushPending();
            completedBlocks.push(getBlock(`${msg.id}-worked-duration`, 'worked-duration', ''));
        }
    }

    // Finalize: trailing pending chunk → activeBlock if streaming, else flush to completed
    if (msg.isStreaming && pendingChunk.length > 0) {
        // pendingChunk goes out of scope here — assign directly, no spread needed
        activeBlock = pendingChunk.length === 1 ? pendingChunk[0] : {
            key: `${msg.id || 'x'}-chunk-active-${pendingChunk[0].key}`,
            type: 'chunk',
            blocks: pendingChunk
        };
    } else {
        flushPending();
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
        // Index both top-level blocks and chunk sub-blocks for getBlock cache hits
        const blocksMap = new Map();
        completedBlocks.forEach(b => indexBlockIntoMap(b, blocksMap));
        if (activeBlock) indexBlockIntoMap(activeBlock, blocksMap);
        streamingBlocksCache.set(streamCacheKey, { text, blocksMap });
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
const REGEX_INITIAL_TOOL = /(\r?\n){2}(?=\[?(?:tool:functions|tool\.functions|agent:generalist|agent\.generalist|\s*turn\s*:))/gi;
const REGEX_CLEAN_SIGNALS = /\[SYSTEM\][\s\S]*?\[\/SYSTEM\]|<(think|thought)>[\s\S]*?(?:<\/(think|thought)>|$)|\[ANSWER\][\s\S]*?(?:\[\/ANSWER\]|$)|\[TOOL RESULT\]:?\s*|^\s*(SUCCESS|ERROR):.*(\r?\n)?|\[\s*turn\s*:\s*(continue|finish)\s*\]|\[\[END\]\]|\[\s*turn\s*:?.*?$|\n\s*turn\s*:?.*?$|\[\s*$|\n\nResponded on .*|\n\n\[Prompted on: .*\]|@\[TerminalName:.*?, ProcessId:.*?\]/gmi;
const REGEX_ARROWS_ALL = /(\$?\\?\/?\\rightarrow\$?|\$\\rightarrow\$)|(\$?\\?\/?\\leftarrow\$?|\$\\leftarrow\$)|(\$?\\?\/?\\uparrow\$?|\$\\uparrow\$)|(\$?\\?\/?\\downarrow\$?|\$\\downarrow\$)|(\$?\\?\/?\\leftrightarrow\$?|\$\\leftrightarrow\$)/gi;
const REGEX_TOOLS = /\b(write_file|update_file|read_folder|view_file|exec_command|web_search|web_scrape|search_keyword|write_pdf|write_docx|generate_image)\b/gi;

export const cleanSignals = (text) => {
    if (!text) return text;

    let result = text
        .replace(REGEX_INITIAL_THINK, '</think>')
        .replace(REGEX_INITIAL_TOOL, '');

    const trigger = 'tool:functions.';
    const subagentTrigger = 'agent:generalist.';

    // FAST PATH: Bypass the heavy while-loop entirely if the tool trigger isn't present
    if (result.toLowerCase().includes(trigger) || result.toLowerCase().includes(subagentTrigger)) {
        // Greedy loop to strip all tool calls
        while (true) {
            const lowerResult = result.toLowerCase();
            let triggerIdx = lowerResult.indexOf(trigger);
            let subagentIdx = lowerResult.indexOf(subagentTrigger);

            let currentTrigger = trigger;
            let triggerIdxToUse = triggerIdx;
            if (triggerIdx === -1 || (subagentIdx !== -1 && subagentIdx < triggerIdx)) {
                currentTrigger = subagentTrigger;
                triggerIdxToUse = subagentIdx;
            }
            if (triggerIdxToUse === -1) break;

            let startIdx = triggerIdxToUse;
            let hasOuterBracket = false;

            let k = triggerIdxToUse - 1;
            while (k >= 0 && /\s/.test(result[k])) k--;
            if (k >= 0 && result[k] === '[') {
                startIdx = k;
                hasOuterBracket = true;
            }

            let balance = 0;
            let foundStart = false;
            let inString = null;
            let j = triggerIdxToUse;

            while (j < result.length) {
                const char = result[j];
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
                if (j === result.length) {
                    result = result.substring(0, startIdx);
                    return result;
                }
            }
        }
    }

    // Consolidated regex pass eliminates string allocations scaling linearly with replace rules
    result = result.replace(REGEX_CLEAN_SIGNALS, '');

    // Single pass for all formatting arrows
    result = result.replace(REGEX_ARROWS_ALL, (match) => {
        const lower = match.toLowerCase();
        if (lower.includes('leftrightarrow')) return '↔';
        if (lower.includes('rightarrow')) return '→';
        if (lower.includes('leftarrow')) return '←';
        if (lower.includes('uparrow')) return '↑';
        if (lower.includes('downarrow')) return '↓';
        return match;
    });

    result = result.replace(REGEX_TOOLS, (match) => TOOL_LABELS[match.toLowerCase()] || match);

    return result.trim();
};

export const clearBlocksCache = () => {
    blocksCache.clear();
    streamingBlocksCache.clear();
};
