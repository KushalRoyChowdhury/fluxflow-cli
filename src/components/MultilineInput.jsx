import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Box, Text, useInput } from 'ink';

function expandTabs(text, tabSize) {
    return text.replace(/\t/g, ' '.repeat(tabSize));
}

function normalizeLineEndings(text) {
    if (text == null) return '';
    return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

// Hyper-optimized single-pass layout engine
// Computes all visual lines and maps the raw cursor to its visual coordinate matrix
function computeVisualMatrix(value, cursorIndex, wrapWidth, formatText) {
    const textBefore = (value || '').slice(0, cursorIndex);
    const visualCursorIdx = formatText(textBefore).length;
    const fullFormatted = formatText(value || '');

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
            visualLines.push({ text: '', globalStart: currentIdx });
            currentIdx += 1; // +1 for the stripped newline
            continue;
        }

        for (let j = 0; j < line.length; j += wrapWidth) {
            const chunk = line.slice(j, j + wrapWidth);
            const chunkStart = currentIdx + j;
            const chunkEnd = chunkStart + chunk.length;

            if (!foundCursor && visualCursorIdx >= chunkStart &&
                (visualCursorIdx < chunkEnd || (visualCursorIdx === chunkEnd && j + wrapWidth >= line.length && i === literalLines.length - 1))) {
                cursorLine = visualLines.length;
                cursorCol = visualCursorIdx - chunkStart;
                foundCursor = true;
            }

            visualLines.push({ text: chunk, globalStart: chunkStart });
        }
        currentIdx += line.length + 1;
    }

    // Edge case safety for trailing newlines or empty inputs
    if (!foundCursor) {
        if (visualLines.length === 0) {
            visualLines.push({ text: '', globalStart: 0 });
        } else {
            if (fullFormatted.endsWith('\n')) {
                visualLines.push({ text: '', globalStart: currentIdx });
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
    columns = 80
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
        return computeVisualMatrix(value, cursorIndex, wrapWidth, formatText);
    }, [value, cursorIndex, wrapWidth, formatText]);

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

    const cursorStyle = useMemo(() => ({
        ...textStyle,
        color: (showCursor && focus) ? 'white' : undefined,
        bold: showCursor && focus,
        inverse: showCursor && focus
    }), [textStyle, showCursor, focus]);

    return (
        <Box height={visibleRows} width={wrapWidth} overflow="hidden" flexDirection="column" flexGrow={0} flexShrink={0}>
            {visibleLines.map((lineObj, idx) => {
                const globalLineIdx = newScrollOffset + idx;
                const isCursorLine = globalLineIdx === cursorLine && focus && showCursor;

                if (!isCursorLine) {
                    // Static text line component. Extreme rendering efficiency.
                    return (
                        <Text key={globalLineIdx} {...textStyle} wrap="truncate">
                            {lineObj.text || (placeholder && value.length === 0 ? formatText(placeholder, true) : ' ')}
                        </Text>
                    );
                }

                // Splitting ONLY the target line containing the cursor active state
                const text = lineObj.text;
                const left = text.slice(0, cursorCol);
                const charAtCursor = text[cursorCol] || ' ';
                const right = text.slice(cursorCol + 1);

                return (
                    <Text key={globalLineIdx} {...textStyle} wrap="truncate">
                        <Text>{left}</Text>
                        <Text {...cursorStyle}>{charAtCursor}</Text>
                        <Text>{right}</Text>
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
    ...controlledProps
}) => {
    const [cursorIndex, setCursorIndex] = useState(value.length);
    const [pasteLength, setPasteLength] = useState(0);

    const cursorIndexRef = useRef(value.length);
    const valueRef = useRef(value);
    const pasteLengthRef = useRef(0);

    // The magic gatekeeper ref for timing ⏱️
    const lastArrowTimeRef = useRef(0);

    cursorIndexRef.current = cursorIndex;
    valueRef.current = value;
    pasteLengthRef.current = pasteLength;

    useEffect(() => {
        if (cursorIndexRef.current > value.length) {
            cursorIndexRef.current = value.length;
            setCursorIndex(value.length);
        }
    }, [value]);

    useCustomInput((input, key) => {
        if (input === '\x1b[I' || input === '\x1b[O' || input === '[I' || input === '[O') {
            return;
        }

        // Rate-limiting throttle for arrow keys
        const isArrowKey = key.upArrow || key.downArrow || key.leftArrow || key.rightArrow;
        if (isArrowKey) {
            const now = Date.now();
            if (now - lastArrowTimeRef.current < 33) {
                return; // Too fast! Drop this event to save Ink's CPU cycles
            }
            lastArrowTimeRef.current = now;
        }

        const curIdx = cursorIndexRef.current;
        const val = valueRef.current;
        const wrapWidth = Math.max(20, columns - 10);

        const submitKey = keyBindings?.submit ?? ((k) => k.return && k.ctrl);
        const newlineKey = keyBindings?.newline ?? ((k) => k.return);

        if (submitKey(key)) {
            onSubmit?.(val);
            return;
        } else if (newlineKey(key)) {
            const newValue = val.slice(0, curIdx) + '\n' + val.slice(curIdx);
            onChange(newValue);
            cursorIndexRef.current = curIdx + 1;
            setCursorIndex(curIdx + 1);
            setPasteLength(0);
            return;
        }

        if (key.tab || (key.shift && key.tab) || (key.ctrl && input === 'c')) {
            return;
        }

        const identity = (t) => t;

        if (key.upArrow || key.downArrow) {
            if (showCursor) {
                const { visualLines, cursorLine, cursorCol } = computeVisualMatrix(val, curIdx, wrapWidth, identity);
                const targetLine = key.upArrow ? cursorLine - 1 : cursorLine + 1;

                if (targetLine >= 0 && targetLine < visualLines.length) {
                    const targetLineObj = visualLines[targetLine];
                    const targetCol = Math.min(cursorCol, targetLineObj.text.length);

                    const newIndex = targetLineObj.globalStart + targetCol;
                    cursorIndexRef.current = newIndex;
                    setCursorIndex(newIndex);
                    setPasteLength(0);
                }
            }
        } else if (key.leftArrow) {
            if (showCursor) {
                const newIndex = Math.max(0, curIdx - 1);
                cursorIndexRef.current = newIndex;
                setCursorIndex(newIndex);
                setPasteLength(0);
            }
        } else if (key.rightArrow) {
            if (showCursor) {
                const newIndex = Math.min(val.length, curIdx + 1);
                cursorIndexRef.current = newIndex;
                setCursorIndex(newIndex);
                setPasteLength(0);
            }
        } else if (key.backspace) {
            if (curIdx > 0) {
                const newValue = val.slice(0, curIdx - 1) + val.slice(curIdx);
                onChange(newValue);
                cursorIndexRef.current = curIdx - 1;
                setCursorIndex(curIdx - 1);
                setPasteLength(0);
            }
        } else if (key.delete) {
            if (curIdx < val.length) {
                const newValue = val.slice(0, curIdx) + val.slice(curIdx + 1);
                onChange(newValue);
                setPasteLength(0);
            }
        } else {
            if (input) {
                const newValue = val.slice(0, curIdx) + input + val.slice(curIdx);
                onChange(newValue);
                const newIndex = curIdx + input.length;
                cursorIndexRef.current = newIndex;
                setCursorIndex(newIndex);
                setPasteLength(input.length > 1 ? input.length : 0);
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
        />
    );
};
