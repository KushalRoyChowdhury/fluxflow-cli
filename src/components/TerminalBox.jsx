import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { wrapText } from '../utils/text.js';
import { getThemeColors } from '../utils/theme.js';

export const TerminalBox = React.memo(({ command, output, completed = false, isFocused = false, columns = 80, isPty = false, terminalHeight = 24, theme = 'Dark' }) => {
    const colors = getThemeColors(theme);
    // A smart terminal output resolver that simulates a terminal grid for Ink
    const processPTY = (text) => {
        if (!text) return '';

        // Each line is an array of cell objects: { char, style }
        const lines = [[]];
        let cursorRow = 0;
        let cursorCol = 0;
        let currentStyle = '';

        const ansiRegex = /\x1b\[([0-9;]*?)([a-zA-Z])/g;
        let lastIndex = 0;
        let match;

        const writeText = (plainText) => {
            for (let i = 0; i < plainText.length; i++) {
                const char = plainText[i];
                if (char === '\n') {
                    cursorRow++;
                    cursorCol = 0;
                    while (cursorRow >= lines.length) {
                        lines.push([]);
                    }
                } else if (char === '\r') {
                    cursorCol = 0;
                } else {
                    while (cursorRow >= lines.length) {
                        lines.push([]);
                    }
                    const line = lines[cursorRow];
                    while (cursorCol > line.length) {
                        line.push({ char: ' ', style: '' });
                    }
                    line[cursorCol] = { char, style: currentStyle };
                    cursorCol++;
                }
            }
        };

        while ((match = ansiRegex.exec(text)) !== null) {
            writeText(text.substring(lastIndex, match.index));

            const params = match[1];
            const command = match[2];
            const paramValues = params ? params.split(';').map(Number) : [];

            if (command === 'A') {
                const count = paramValues[0] || 1;
                cursorRow = Math.max(0, cursorRow - count);
            } else if (command === 'B') {
                const count = paramValues[0] || 1;
                cursorRow = cursorRow + count;
                while (cursorRow >= lines.length) {
                    lines.push([]);
                }
            } else if (command === 'C') {
                const count = paramValues[0] || 1;
                cursorCol = cursorCol + count;
            } else if (command === 'D') {
                const count = paramValues[0] || 1;
                cursorCol = Math.max(0, cursorCol - count);
            } else if (command === 'G') {
                const col = (paramValues[0] || 1) - 1;
                cursorCol = Math.max(0, col);
            } else if (command === 'H' || command === 'f') {
                const row = (paramValues[0] || 1) - 1;
                const col = (paramValues[1] || 1) - 1;
                cursorRow = Math.max(0, row);
                cursorCol = Math.max(0, col);
                while (cursorRow >= lines.length) {
                    lines.push([]);
                }
            } else if (command === 'K') {
                const mode = paramValues[0] || 0;
                if (cursorRow < lines.length) {
                    const line = lines[cursorRow];
                    if (mode === 0) {
                        line.length = cursorCol;
                    } else if (mode === 1) {
                        for (let c = 0; c < cursorCol && c < line.length; c++) {
                            line[c] = { char: ' ', style: '' };
                        }
                    } else if (mode === 2) {
                        line.length = 0;
                    }
                }
            } else if (command === 'J') {
                const mode = paramValues[0] || 0;
                if (mode === 2 || mode === 3) {
                    lines.length = 0;
                    lines.push([]);
                    cursorRow = 0;
                    cursorCol = 0;
                }
            } else if (command === 'm') {
                const escSeq = match[0];
                if (escSeq === '\x1b[0m') {
                    currentStyle = '';
                } else {
                    currentStyle = escSeq;
                }
            }

            lastIndex = ansiRegex.lastIndex;
        }

        writeText(text.substring(lastIndex));

        const resultLines = lines.map(line => {
            let lineStr = '';
            let activeStyle = '';
            for (let i = 0; i < line.length; i++) {
                const cell = line[i] || { char: ' ', style: '' };
                if (cell.style !== activeStyle) {
                    if (activeStyle) {
                        lineStr += '\x1b[0m';
                    }
                    lineStr += cell.style;
                    activeStyle = cell.style;
                }
                lineStr += cell.char;
            }
            if (activeStyle) {
                lineStr += '\x1b[0m';
            }
            return lineStr;
        });

        while (resultLines.length > 0 && resultLines[resultLines.length - 1] === '') {
            resultLines.pop();
        }

        return resultLines.join('\n');
    };

    const cleanOutput = processPTY(output).replace(/\n{3,}/g, '\n\n');
    const wrapWidth = Math.max(10, (columns || 80) - 6);

    // Compute actual visual rendered lines (accounting for word/character terminal wrapping)
    const rawLines = cleanOutput
        ? cleanOutput.split('\n').flatMap(line => (line ? wrapText(line, wrapWidth).split('\n') : ['']))
        : [];

    const [isExpanded, setIsExpanded] = useState(false);
    const [scrollOffset, setScrollOffset] = useState(0); // 0 = pinned to bottom/tail

    // Auto-scroll to bottom whenever terminal is unfocused
    useEffect(() => {
        if (!isFocused) {
            setScrollOffset(0);
        }
    }, [isFocused]);

    // Effective physical terminal rows from props or process.stdout
    const effectiveRows = (terminalHeight && terminalHeight > 0) ? terminalHeight : (process.stdout.rows || 24);
    const isCompactTerminal = effectiveRows <= 24;

    // Strict adaptive limit:
    // When executing live: TerminalBox header + footer + borders = 5-7 lines.
    // Together with input box & status bar (6 lines), total fixed UI is 11-13 lines.
    const overhead = completed ? (isCompactTerminal ? 7 : 9) : (isCompactTerminal ? 11 : 14);
    const maxAllowed = Math.max(1, effectiveRows - overhead);

    // On compact/split IDE terminals:
    // rows <= 16: max 2 lines
    // rows <= 22: max 3 lines
    // rows <= 28: max 4 lines
    // taller: up to maxAllowed
    const liveCap = effectiveRows <= 16 ? 4 : (effectiveRows <= 22 ? 5 : (effectiveRows <= 28 ? 6 : 10));
    const limit = completed ? Math.min(isCompactTerminal ? 4 : 10, maxAllowed) : Math.min(liveCap, maxAllowed);

    const hasCollapsibleContent = rawLines.length > limit;
    const maxScroll = Math.max(0, rawLines.length - limit);

    useInput((input, key) => {
        if (!isFocused) return;

        const isPgUp = key.pageUp || input === '\x1b[5~' || input === '[5~';
        const isPgDn = key.pageDown || input === '\x1b[6~' || input === '[6~';

        if (key.ctrl && (input === 'o' || input === '\x0f')) {
            setIsExpanded(prev => !prev);
            setScrollOffset(0);
        } else if (isPgUp) {
            setScrollOffset(prev => Math.min(maxScroll, prev + 5));
        } else if (isPgDn) {
            setScrollOffset(prev => Math.max(0, prev - 5));
        }
    }, { isActive: isFocused });

    let visibleLines;
    if (!hasCollapsibleContent || isExpanded) {
        visibleLines = rawLines;
    } else {
        const startIdx = Math.max(0, rawLines.length - limit - scrollOffset);
        const endIdx = startIdx + limit;
        visibleLines = rawLines.slice(startIdx, endIdx);
    }

    const displayOutput = (visibleLines || []).join('\n').trim();
    const renderedOutput = (visibleLines || []).join('\n');

    const linesAbove = hasCollapsibleContent && !isExpanded ? Math.max(0, rawLines.length - limit - scrollOffset) : 0;
    const linesBelow = hasCollapsibleContent && !isExpanded ? scrollOffset : 0;

    // Format command to max 1 line with truncation if too long
    const headerPrefix = completed ? "🏁 FINISHED: " : "⚡ EXECUTING: ";
    const cmdHeaderWidth = Math.max(10, (columns || 80) - (isPty ? 24 : 14));
    const commandLines = wrapText((command || '').replace(/\r?\n/g, ' ').trim(), cmdHeaderWidth).split('\n');
    let displayedCommand = (command || '').replace(/\r?\n/g, ' ').trim();
    if (commandLines.length > 1) {
        displayedCommand = commandLines[0].length > 3 ? commandLines[0].slice(0, -3) + '...' : commandLines[0] + '...';
    }

    return (
        <Box
            flexDirection="column"
            borderStyle={isFocused ? 'double' : 'single'}
            borderLeft={false}
            borderRight={false}
            borderTop={true}
            borderBottom={true}
            borderColor={colors.codeBorder}
            paddingLeft={2}
            paddingRight={0}
            paddingTop={isCompactTerminal ? 0 : 1}
            paddingBottom={1}
            marginY={isCompactTerminal ? 0 : 1}
            width={columns - 2}
        >
            <Box marginBottom={isCompactTerminal ? 0 : 1} justifyContent="space-between" width="100%">
                <Box flexShrink={1} paddingRight={2}>
                    <Text>
                        <Text color={colors.text} bold>{headerPrefix}</Text>
                        <Text color={colors.text}>{displayedCommand}</Text>
                    </Text>
                </Box>
                {isPty && (
                    <Box flexShrink={0} paddingX={1}>
                        <Text color="green" bold>ADVANCE</Text>
                    </Box>
                )}
            </Box>

            {displayOutput ? (
                <Box flexDirection="column" marginTop={0} backgroundColor={isPty ? undefined : colors.codeBg} paddingX={1} width="100%">
                    {linesAbove > 0 && (
                        <Box marginBottom={0}>
                            <Text color="magenta">▲ ...{linesAbove} lines above (Use PageUp to scroll)...</Text>
                        </Box>
                    )}
                    {/* Only apply gray color if completed; let ANSI colors show during live execution */}
                    <Text color={completed ? colors.text : colors.text}>{renderedOutput}</Text>
                    {linesBelow > 0 && (
                        <Box marginTop={0}>
                            <Text color="magenta">▼ ...{linesBelow} lines below (Use PageDown to scroll)...</Text>
                        </Box>
                    )}
                </Box>
            ) : !completed && (
                <Box marginTop={isCompactTerminal ? 0 : 1} backgroundColor={isPty ? undefined : colors.codeBg} paddingX={1} width="100%">
                    <Text color={colors.textMuted} italic>Waiting for output...</Text>
                </Box>
            )}

            <Box justifyContent="space-between" marginTop={isCompactTerminal ? 0 : 1}>
                {!completed ? (
                    <Text color={colors.textMuted} italic>{isFocused ? "Use PgUp/PgDn to scroll • Ctrl+O to expand • TAB to unfocus • CTRL+C to stop." : "Press TAB to focus • CTRL+C to terminate."}</Text>
                ) : (
                    <Text color={colors.textMuted} italic>{isFocused ? "Use PgUp/PgDn to scroll • Ctrl+O to expand/collapse • TAB to unfocus." : "Press TAB to focus & scroll."}</Text>
                )}
                <Text color={colors.textMuted} bold>
                    {completed ? (isFocused ? "● ARCHIVED (FOCUSED) " : "● ARCHIVED ") : (isFocused ? "▶ TERMINAL FOCUSED " : "● LIVE (Press TAB to focus) ")}
                </Text>
            </Box>
        </Box>
    );
});
