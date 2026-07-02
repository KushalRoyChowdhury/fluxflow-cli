import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import { wrapText } from '../utils/text.js';

function expandTabs(text, tabSize) {
    return text.replace(/\t/g, ' '.repeat(tabSize));
}

function normalizeLineEndings(text) {
    if (text == null) return '';
    return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function formattedToRaw(formattedIdx, pasteBlocks, value) {
    let rawIdx = formattedIdx;
    const sortedBlocks = [...pasteBlocks].sort((a, b) => a.start - b.start);
    let currentFormattedOffset = 0;

    for (const block of sortedBlocks) {
        const formattedStart = block.start - currentFormattedOffset;
        const lines = normalizeLineEndings(block.text).split('\n').length;
        const chars = block.text.length;
        const placeholderLength = (lines > 3 ? `[Pasted ${lines} lines]` : `[Pasted ${chars} chars]`).length;
        const formattedEnd = formattedStart + placeholderLength;

        if (formattedIdx <= formattedStart) {
            break;
        } else if (formattedIdx < formattedEnd) {
            rawIdx = block.end;
            break;
        } else {
            const delta = block.text.length - placeholderLength;
            rawIdx += delta;
            currentFormattedOffset += delta;
        }
    }
    return Math.min(rawIdx, value.length);
}

// Hyper-optimized single-pass layout engine
// Computes all visual lines and maps the raw cursor to its visual coordinate matrix
function computeVisualMatrix(value, cursorIndex, wrapWidth, formatText, pasteBlocks = []) {
    const textBefore = (value || '').slice(0, cursorIndex);
    let visualCursorIdx = formatText(textBefore).length;
    let fullFormatted = formatText(value || '');

    // Sort blocks descending to replace right-to-left, keeping earlier indices correct
    const sortedBlocks = [...pasteBlocks].sort((a, b) => b.start - a.start);

    for (const block of sortedBlocks) {
        const formattedStart = formatText(value.slice(0, block.start)).length;
        const formattedPasted = formatText(block.text);
        const formattedEnd = formattedStart + formattedPasted.length;

        const lines = normalizeLineEndings(block.text).split('\n').length;
        const chars = block.text.length;
        const placeholderText = lines > 3 ? `[Pasted ${lines} lines]` : `[Pasted ${chars} chars]`;

        fullFormatted = fullFormatted.slice(0, formattedStart) + placeholderText + fullFormatted.slice(formattedEnd);

        if (visualCursorIdx > formattedStart && visualCursorIdx < formattedEnd) {
            visualCursorIdx = formattedStart + placeholderText.length;
        } else if (visualCursorIdx >= formattedEnd) {
            visualCursorIdx = visualCursorIdx - (formattedEnd - formattedStart) + placeholderText.length;
        }
    }

    const literalLines = fullFormatted.split('\n');
    const visualLines = [];
    let currentIdx = 0;
    let cursorLine = 0;
    let cursorCol = 0;
    let foundCursor = false;

    for (let i = 0; i < literalLines.length; i++) {
        const line = literalLines[i];

        if (line.length === 0) {
            if (!foundCursor && visualCursorIdx === currentIdx) {
                cursorLine = visualLines.length;
                cursorCol = 0;
                foundCursor = true;
            }
            visualLines.push({ text: '', globalStart: formattedToRaw(currentIdx, pasteBlocks, value), formattedStart: currentIdx });
            currentIdx += 1; // +1 for the stripped newline
            continue;
        }

        const wrapped = wrapText(line, wrapWidth);
        const wrappedLines = wrapped.split('\n');
        let lastMatchEnd = 0;

        const chunks = [];
        for (let j = 0; j < wrappedLines.length; j++) {
            const wLine = wrappedLines[j];
            const trimmed = wLine.trim();
            if (trimmed.length === 0) {
                const spaceLength = wLine.length || 1;
                chunks.push({
                    text: wLine,
                    start: lastMatchEnd,
                    length: spaceLength
                });
                lastMatchEnd += spaceLength;
            } else {
                const idx = line.indexOf(trimmed, lastMatchEnd);
                if (idx !== -1) {
                    const start = lastMatchEnd;
                    const nextTrimmed = j < wrappedLines.length - 1 ? wrappedLines[j + 1].trim() : '';
                    let end = line.length;
                    if (nextTrimmed.length > 0) {
                        const nextIdx = line.indexOf(nextTrimmed, idx + trimmed.length);
                        if (nextIdx !== -1) {
                            end = nextIdx;
                        }
                    }
                    chunks.push({
                        text: line.slice(start, end),
                        start: start,
                        length: end - start
                    });
                    lastMatchEnd = end;
                } else {
                    chunks.push({
                        text: wLine,
                        start: lastMatchEnd,
                        length: wLine.length
                    });
                    lastMatchEnd += wLine.length;
                }
            }
        }

        for (let idx = 0; idx < chunks.length; idx++) {
            const chunkObj = chunks[idx];
            const chunk = chunkObj.text;
            const chunkStart = currentIdx + chunkObj.start;
            const chunkEnd = chunkStart + chunkObj.length;

            if (!foundCursor && visualCursorIdx >= chunkStart &&
                (visualCursorIdx < chunkEnd || (visualCursorIdx === chunkEnd && idx === chunks.length - 1))) {
                cursorLine = visualLines.length;
                cursorCol = visualCursorIdx - chunkStart;
                foundCursor = true;
            }

            visualLines.push({
                text: chunk,
                globalStart: formattedToRaw(chunkStart, pasteBlocks, value),
                formattedStart: chunkStart
            });
        }
        currentIdx += line.length + 1;
    }

    // Edge case safety for trailing newlines or empty inputs
    if (!foundCursor) {
        if (visualLines.length === 0) {
            visualLines.push({ text: '', globalStart: 0, formattedStart: 0 });
        } else {
            if (fullFormatted.endsWith('\n')) {
                visualLines.push({
                    text: '',
                    globalStart: formattedToRaw(currentIdx, pasteBlocks, value),
                    formattedStart: currentIdx
                });
                cursorLine = visualLines.length - 1;
                cursorCol = 0;
            } else {
                cursorLine = visualLines.length - 1;
                cursorCol = visualLines[cursorLine].text.length;
            }
        }
    }

    return { visualLines, cursorLine, cursorCol };
}

export const ControlledMultilineInput = ({
    value,
    rows,
    maxRows,
    highlightStyle,
    textStyle,
    placeholder = '',
    mask,
    showCursor = true,
    focus = true,
    tabSize = 4,
    cursorIndex = 0,
    highlight,
    columns = 80,
    pasteBlocks = []
}) => {
    const scrollOffsetRef = useRef(0);
    const wrapWidth = useMemo(() => Math.max(20, columns - 10), [columns]);

    const formatText = useCallback(
        (text, isPlaceholder = false) => {
            const normalized = normalizeLineEndings(text);
            if (!isPlaceholder && mask) {
                return normalized.replace(/[^\n]/g, mask);
            }
            const expanded = expandTabs(normalized, tabSize);
            if (isPlaceholder) return expanded;
            return expanded.replace(/@\[(.*?)\]/g, (match, p1) => {
                const hashIdx = p1.indexOf('#');
                const colonIdx = p1.indexOf(':L');
                let pathOnly = p1;
                let suffix = '';
                if (hashIdx !== -1) {
                    pathOnly = p1.slice(0, hashIdx);
                    suffix = p1.slice(hashIdx);
                } else if (colonIdx !== -1) {
                    pathOnly = p1.slice(0, colonIdx);
                    suffix = p1.slice(colonIdx);
                }
                let rel = pathOnly.replace(/\\/g, '/');
                const cwd = (process.cwd() || '').replace(/\\/g, '/');
                if (cwd && rel.toLowerCase().startsWith(cwd.toLowerCase() + '/')) {
                    rel = rel.slice(cwd.length + 1);
                } else if (rel.startsWith('./')) {
                    rel = rel.slice(2);
                }
                const parts = rel.split('/');
                const basename = parts[parts.length - 1];
                return `[${basename}${suffix}]`;
            });
        },
        [tabSize, mask]
    );

    // Generate our high-performance text matrix
    const { visualLines, cursorLine, cursorCol } = useMemo(() => {
        return computeVisualMatrix(value, cursorIndex, wrapWidth, formatText, pasteBlocks);
    }, [value, cursorIndex, wrapWidth, formatText, pasteBlocks]);

    const contentHeight = visualLines.length;
    const visibleRows = useMemo(() => {
        return Math.max(rows ?? maxRows ?? 1, Math.min(maxRows ?? rows ?? 1, contentHeight));
    }, [rows, maxRows, contentHeight]);

    // Fast viewport calculation
    const cursorLineEnd = cursorLine + 1;
    const viewportEnd = scrollOffsetRef.current + visibleRows;
    let newScrollOffset = scrollOffsetRef.current;

    if (cursorLineEnd <= scrollOffsetRef.current) {
        newScrollOffset = Math.max(0, cursorLineEnd - 1);
    } else if (cursorLineEnd > viewportEnd) {
        newScrollOffset = cursorLineEnd - visibleRows;
    } else if (contentHeight) {
        if (contentHeight < visibleRows) {
            newScrollOffset = 0;
        } else if (contentHeight < viewportEnd) {
            newScrollOffset = contentHeight - visibleRows;
        }
    }
    scrollOffsetRef.current = newScrollOffset;

    // Windowed lines selection (Virtualization!)
    const visibleLines = useMemo(() => {
        return visualLines.slice(newScrollOffset, newScrollOffset + visibleRows);
    }, [visualLines, newScrollOffset, visibleRows]);

    const [blink, setBlink] = useState(true);

    useEffect(() => {
        setBlink(true);
        if (!focus || !showCursor) return;
        const timer = setInterval(() => {
            setBlink(prev => !prev);
        }, 530);
        return () => clearInterval(timer);
    }, [focus, showCursor, value, cursorIndex]);

    const cursorStyle = useMemo(() => ({
        ...textStyle,
        color: (showCursor && focus && blink) ? 'white' : undefined,
        bold: showCursor && focus && blink,
        inverse: showCursor && focus && blink
    }), [textStyle, showCursor, focus, blink]);

    const renderLineText = (text, isCursor, col, cStyle) => {
        if (!text) {
            const emptyText = placeholder && value.length === 0 ? formatText(placeholder, true) : '';
            if (isCursor) {
                const charAtCursor = emptyText[0] || ' ';
                const right = emptyText.slice(1);
                return (
                    <Text>
                        <Text {...cStyle}>{charAtCursor}</Text>
                        <Text color="gray" dimColor>{right}</Text>
                    </Text>
                );
            }
            return <Text color="gray" dimColor>{emptyText || ' '}</Text>;
        }

        const regex = /(\[Pasted \d+ (?:lines|chars)\])/g;
        const parts = text.split(regex);
        let currentOffset = 0;
        const rendered = [];

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (part === '') continue;

            const isPlaceholder = part.match(/^\[Pasted \d+ (?:lines|chars)\]$/);
            const partLength = part.length;
            const partEnd = currentOffset + partLength;

            if (isCursor && col >= currentOffset && col < partEnd) {
                const localCol = col - currentOffset;
                const left = part.slice(0, localCol);
                const charAtCursor = part[localCol] || ' ';
                const right = part.slice(localCol + 1);

                rendered.push(
                    <Text key={i}>
                        <Text color={isPlaceholder ? 'magenta' : undefined}>{left}</Text>
                        <Text {...cStyle}>{charAtCursor}</Text>
                        <Text color={isPlaceholder ? 'magenta' : undefined}>{right}</Text>
                    </Text>
                );
            } else {
                rendered.push(
                    <Text key={i} color={isPlaceholder ? 'magenta' : undefined}>
                        {part}
                    </Text>
                );
            }
            currentOffset = partEnd;
        }

        if (isCursor && col >= text.length) {
            rendered.push(
                <Text key="cursor-end" {...cStyle}> </Text>
            );
        }

        return <>{rendered}</>;
    };

    return (
        <Box height={visibleRows} width={wrapWidth + 1} overflow="hidden" flexDirection="column" flexGrow={0} flexShrink={0}>
            {visibleLines.map((lineObj, idx) => {
                const globalLineIdx = newScrollOffset + idx;
                const isCursorLine = globalLineIdx === cursorLine && focus && showCursor;

                return (
                    <Text key={globalLineIdx} {...textStyle} wrap="truncate">
                        {renderLineText(lineObj.text, isCursorLine, cursorCol, cursorStyle)}
                    </Text>
                );
            })}
        </Box>
    );
};

export const MultilineInput = ({
    value,
    onChange,
    onSubmit,
    keyBindings,
    showCursor = true,
    highlightPastedText = false,
    focus = true,
    columns = 80,
    useCustomInput = (inputHandler, isActive) => useInput(inputHandler, { isActive }),
    onPasteStateChange,
    ...controlledProps
}) => {
    const [cursorIndex, setCursorIndex] = useState(value.length);
    const [pasteLength, setPasteLength] = useState(0);
    const [pasteBlocks, setPasteBlocks] = useState([]);

    const cursorIndexRef = useRef(value.length);
    const valueRef = useRef(value);
    const pasteLengthRef = useRef(0);
    const pasteBlocksRef = useRef([]);

    // Paste accumulator state refs
    const pasteBufferRef = useRef('');
    const pasteBufferStartRef = useRef(-1);
    const pasteTimerRef = useRef(null);

    // The magic gatekeeper ref for timing ⏱️
    const lastArrowTimeRef = useRef(0);

    cursorIndexRef.current = cursorIndex;
    valueRef.current = value;
    pasteLengthRef.current = pasteLength;
    pasteBlocksRef.current = pasteBlocks;

    useEffect(() => {
        if (cursorIndexRef.current > value.length) {
            cursorIndexRef.current = value.length;
            setCursorIndex(value.length);
        }
        if (!value) {
            setPasteBlocks([]);
            setPasteLength(0);
        } else {
            // Drop any blocks whose boundaries are no longer valid within the text
            setPasteBlocks(prev => prev.filter(b => b.end <= value.length && b.start <= value.length));
        }
    }, [value]);

    useEffect(() => {
        onPasteStateChange?.(pasteBlocks.length > 0);
    }, [pasteBlocks, onPasteStateChange]);

    const finalizePasteTransaction = () => {
        const accumulated = pasteBufferRef.current;
        const start = pasteBufferStartRef.current;
        const end = start + accumulated.length;

        const val = valueRef.current;
        const newValue = val.slice(0, start) + accumulated + val.slice(start);

        onChange(newValue);
        cursorIndexRef.current = end;
        setCursorIndex(end);
        setPasteLength(accumulated.length > 1 ? accumulated.length : 0);

        const lines = normalizeLineEndings(accumulated).split('\n').length;
        const chars = accumulated.length;

        if (chars > 50 && (lines > 3 || (lines <= 3 && chars > 200))) {
            const newBlock = {
                start: start,
                end: end,
                text: accumulated
            };
            setPasteBlocks(prev => {
                const delta = accumulated.length;
                const adjusted = prev.map(block => {
                    if (start <= block.start) {
                        return {
                            ...block,
                            start: block.start + delta,
                            end: block.end + delta
                        };
                    }
                    return block;
                });
                return [...adjusted, newBlock];
            });
        }

        pasteBufferRef.current = '';
        pasteBufferStartRef.current = -1;
        pasteTimerRef.current = null;
    };

    const flushPasteTransaction = () => {
        if (pasteTimerRef.current) {
            clearTimeout(pasteTimerRef.current);
            finalizePasteTransaction();
        }
    };

    useCustomInput((input, key) => {
        if (input === '\x1b[I' || input === '\x1b[O' || input === '[I' || input === '[O') {
            return;
        }

        let cleanInput = input;
        let isBracketedStart = false;
        let isBracketedEnd = false;

        if (cleanInput && typeof cleanInput === 'string') {
            if (cleanInput.includes('\x1b[200~')) {
                isBracketedStart = true;
                cleanInput = cleanInput.replace(/\x1b\[200~/g, '');
            }
            if (cleanInput.includes('\x1b[201~')) {
                isBracketedEnd = true;
                cleanInput = cleanInput.replace(/\x1b\[201~/g, '');
            }
        }

        const curIdx = cursorIndexRef.current;
        const val = valueRef.current;
        const currentPasteBlocks = pasteBlocksRef.current;
        const wrapWidth = Math.max(20, columns - 10);

        const adjustPasteBlocksOnEdit = (editStart, delta) => {
            if (currentPasteBlocks.length === 0) return;
            const updated = currentPasteBlocks.map(block => {
                if (editStart <= block.start) {
                    return {
                        ...block,
                        start: block.start + delta,
                        end: block.end + delta
                    };
                }
                if (editStart > block.start && editStart < block.end) {
                    return null;
                }
                return block;
            }).filter(Boolean);
            setPasteBlocks(updated);
        };

        const adjustIndex = (idx) => {
            for (const block of currentPasteBlocks) {
                if (idx > block.start && idx < block.end) {
                    return block.start;
                }
            }
            return idx;
        };

        // Support Ctrl+O to expand collapsed paste blocks
        if (key.ctrl && (cleanInput === 'o' || cleanInput === '\x0f')) {
            setPasteBlocks([]);
            return;
        }

        // Support Ctrl+R refresh shortcut (swallowed here so it doesn't type 'r')
        if (key.ctrl && (cleanInput.toLowerCase() === 'r' || cleanInput === '\x12' || cleanInput === '\u0012')) {
            return;
        }

        // Rate-limiting throttle for arrow keys
        const isArrowKey = key.upArrow || key.downArrow || key.leftArrow || key.rightArrow;
        if (isArrowKey) {
            flushPasteTransaction();
            const now = Date.now();
            if (now - lastArrowTimeRef.current < 33) {
                return; // Too fast! Drop this event to save Ink's CPU cycles
            }
            lastArrowTimeRef.current = now;
        }

        const submitKey = keyBindings?.submit ?? ((k) => k.return && k.ctrl);
        const newlineKey = keyBindings?.newline ?? ((k) => k.return);

        if (submitKey(key)) {
            flushPasteTransaction();
            onSubmit?.(val);
            return;
        } else if (newlineKey(key)) {
            flushPasteTransaction();
            adjustPasteBlocksOnEdit(curIdx, 1);
            const newValue = val.slice(0, curIdx) + '\n' + val.slice(curIdx);
            onChange(newValue);
            cursorIndexRef.current = curIdx + 1;
            setCursorIndex(curIdx + 1);
            setPasteLength(0);
            return;
        }

        if (key.tab || (key.shift && key.tab) || (key.ctrl && cleanInput === 'c')) {
            return;
        }

        const identity = (t) => t;

        if (key.upArrow || key.downArrow) {
            flushPasteTransaction();
            if (showCursor) {
                const { visualLines, cursorLine, cursorCol } = computeVisualMatrix(val, curIdx, wrapWidth, identity, currentPasteBlocks);
                const targetLine = key.upArrow ? cursorLine - 1 : cursorLine + 1;

                if (targetLine >= 0 && targetLine < visualLines.length) {
                    // Normal line-to-line navigation
                    const targetLineObj = visualLines[targetLine];
                    const targetCol = Math.min(cursorCol, targetLineObj.text.length);

                    const targetFormattedIdx = targetLineObj.formattedStart + targetCol;
                    let newIndex = formattedToRaw(targetFormattedIdx, currentPasteBlocks, val);
                    newIndex = adjustIndex(newIndex);
                    cursorIndexRef.current = newIndex;
                    setCursorIndex(newIndex);
                    setPasteLength(0);
                } else if (key.upArrow && cursorLine === 0) {
                    // Up arrow on the first line -> Move to the very start of the text! ↖️
                    cursorIndexRef.current = 0;
                    setCursorIndex(0);
                    setPasteLength(0);
                } else if (key.downArrow && cursorLine === visualLines.length - 1) {
                    // Down arrow on the last line -> Move to the very end of the text! ↘️
                    const lastLineObj = visualLines[visualLines.length - 1];
                    const targetFormattedIdx = lastLineObj.formattedStart + lastLineObj.text.length;
                    let newIndex = formattedToRaw(targetFormattedIdx, currentPasteBlocks, val);
                    newIndex = adjustIndex(newIndex);

                    cursorIndexRef.current = newIndex;
                    setCursorIndex(newIndex);
                    setPasteLength(0);
                }
            }
        } else if (key.leftArrow) {
            flushPasteTransaction();
            if (showCursor) {
                let newIndex = Math.max(0, curIdx - 1);
                const activeBlock = currentPasteBlocks.find(b => curIdx === b.end);
                if (activeBlock) {
                    newIndex = activeBlock.start;
                }
                cursorIndexRef.current = newIndex;
                setCursorIndex(newIndex);
                setPasteLength(0);
            }
        } else if (key.rightArrow) {
            flushPasteTransaction();
            if (showCursor) {
                let newIndex = Math.min(val.length, curIdx + 1);
                const activeBlock = currentPasteBlocks.find(b => curIdx === b.start);
                if (activeBlock) {
                    newIndex = activeBlock.end;
                }
                cursorIndexRef.current = newIndex;
                setCursorIndex(newIndex);
                setPasteLength(0);
            }
        } else if (key.backspace) {
            flushPasteTransaction();
            const targetBlockIndex = currentPasteBlocks.findIndex(b => curIdx === b.end);
            if (targetBlockIndex !== -1) {
                const targetBlock = currentPasteBlocks[targetBlockIndex];
                const delta = -(targetBlock.end - targetBlock.start);
                const newValue = val.slice(0, targetBlock.start) + val.slice(targetBlock.end);
                onChange(newValue);
                cursorIndexRef.current = targetBlock.start;
                setCursorIndex(targetBlock.start);
                setPasteLength(0);
                const updatedBlocks = currentPasteBlocks
                    .filter((_, idx) => idx !== targetBlockIndex)
                    .map(block => {
                        if (block.start >= targetBlock.end) {
                            return {
                                ...block,
                                start: block.start + delta,
                                end: block.end + delta
                            };
                        }
                        return block;
                    });
                setPasteBlocks(updatedBlocks);
            } else if (curIdx > 0) {
                adjustPasteBlocksOnEdit(curIdx - 1, -1);
                const newValue = val.slice(0, curIdx - 1) + val.slice(curIdx);
                onChange(newValue);
                cursorIndexRef.current = curIdx - 1;
                setCursorIndex(curIdx - 1);
                setPasteLength(0);
            }
        } else if (key.delete) {
            flushPasteTransaction();
            const targetBlockIndex = currentPasteBlocks.findIndex(b => curIdx === b.start);
            if (targetBlockIndex !== -1) {
                const targetBlock = currentPasteBlocks[targetBlockIndex];
                const delta = -(targetBlock.end - targetBlock.start);
                const newValue = val.slice(0, targetBlock.start) + val.slice(targetBlock.end);
                onChange(newValue);
                setPasteLength(0);
                const updatedBlocks = currentPasteBlocks
                    .filter((_, idx) => idx !== targetBlockIndex)
                    .map(block => {
                        if (block.start >= targetBlock.end) {
                            return {
                                ...block,
                                start: block.start + delta,
                                end: block.end + delta
                            };
                        }
                        return block;
                    });
                setPasteBlocks(updatedBlocks);
            } else {
                adjustPasteBlocksOnEdit(curIdx, -1);
                if (curIdx < val.length) {
                    const newValue = val.slice(0, curIdx) + val.slice(curIdx + 1);
                    onChange(newValue);
                    setPasteLength(0);
                }
            }
        } else if (key.home || key.end) {
            flushPasteTransaction();
            // Home and End key behaviour 🏠🔚
            if (showCursor) {
                const { visualLines, cursorLine } = computeVisualMatrix(val, curIdx, wrapWidth, identity, currentPasteBlocks);
                const currentLineObj = visualLines[cursorLine];

                if (currentLineObj) {
                    let newIndex;
                    if (key.home) {
                        // Move to the start of the current visual line
                        newIndex = formattedToRaw(currentLineObj.formattedStart, currentPasteBlocks, val);
                    } else if (key.end) {
                        // Move to the end of the current visual line
                        newIndex = formattedToRaw(currentLineObj.formattedStart + currentLineObj.text.length, currentPasteBlocks, val);
                    }

                    newIndex = adjustIndex(newIndex);
                    cursorIndexRef.current = newIndex;
                    setCursorIndex(newIndex);
                    setPasteLength(0);
                }
            }
        }
        else {
            if (cleanInput !== '' || isBracketedStart || isBracketedEnd) {
                const isPaste = isBracketedStart || isBracketedEnd || cleanInput.length > 1 || pasteTimerRef.current !== null;

                if (isPaste) {
                    if (pasteTimerRef.current) {
                        clearTimeout(pasteTimerRef.current);
                        pasteBufferRef.current += cleanInput;
                    } else {
                        pasteBufferStartRef.current = curIdx;
                        pasteBufferRef.current = cleanInput;
                    }

                    if (isBracketedEnd) {
                        pasteTimerRef.current = null;
                        finalizePasteTransaction();
                    } else {
                        pasteTimerRef.current = setTimeout(() => {
                            finalizePasteTransaction();
                        }, 80);
                    }
                } else {
                    adjustPasteBlocksOnEdit(curIdx, cleanInput.length);
                    const newValue = val.slice(0, curIdx) + cleanInput + val.slice(curIdx);
                    onChange(newValue);
                    const newIndex = curIdx + cleanInput.length;
                    cursorIndexRef.current = newIndex;
                    setCursorIndex(newIndex);
                    setPasteLength(0);
                }
            }
        }
    }, focus);

    return (
        <ControlledMultilineInput
            {...controlledProps}
            value={value}
            cursorIndex={cursorIndex}
            showCursor={showCursor}
            focus={focus}
            columns={columns}
            pasteBlocks={pasteBlocks}
        />
    );
};
