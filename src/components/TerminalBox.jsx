import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { wrapText } from '../utils/text.js';

export const TerminalBox = React.memo(({ command, output, completed = false, isFocused = false, columns = 80, isPty = false, terminalHeight = 24 }) => {
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

    // Bypass wrapText for PTY output to let the native terminal handling do its work
    const rawLines = isPty 
        ? (cleanOutput ? cleanOutput.split('\n') : [])
        : (cleanOutput ? wrapText(cleanOutput, columns - 6).split('\n') : []);

    const [isExpanded, setIsExpanded] = useState(false);

    useInput((input, key) => {
        if (isFocused && key.ctrl && (input === 'o' || input === '\x0f')) {
            setIsExpanded(prev => !prev);
        }
    }, { isActive: isFocused });

    const limit = Math.max(5, completed ? (terminalHeight - 10) : (terminalHeight - 20));
    const hasCollapsibleContent = rawLines.length > limit;
    const collapsedCount = rawLines.length - limit;

    const visibleLines = (hasCollapsibleContent && !isExpanded)
        ? rawLines.slice(rawLines.length - limit)
        : rawLines;

    const renderedOutput = visibleLines.join('\n');
    const displayOutput = rawLines.length > 0;

    return (
        <Box
            flexDirection="column"
            borderStyle={isFocused ? 'double' : 'single'}
            borderLeft={true}
            borderRight={false}
            borderTop={false}
            borderBottom={false}
            borderColor="#555555"
            paddingLeft={2}
            paddingRight={0}
            paddingY={1}
            marginTop={1}
            width="100%"
        >
            <Box marginBottom={1} justifyContent="space-between" width="100%">
                <Box flexShrink={1} paddingRight={2}>
                    <Text>
                        <Text color="gray" bold>{completed ? "🏁 FINISHED:" : "⚡ EXECUTING:"} </Text>
                        <Text color="white">{command}</Text>
                    </Text>
                </Box>
                {isPty && (
                    <Box flexShrink={0} paddingX={1}>
                        <Text color="gray" bold>ADVANCE</Text>
                    </Box>
                )}
            </Box>

            {displayOutput ? (
                <Box flexDirection="column" marginTop={0} backgroundColor={isPty ? undefined : "#0a0a0a"} paddingX={1}>
                    {hasCollapsibleContent && !isExpanded && (
                        <Box marginBottom={1}>
                            <Text color="magenta">...{collapsedCount} lines collapsed... Press CTRL + O to expand.</Text>
                        </Box>
                    )}
                    {/* Only apply gray color if completed; let ANSI colors show during live execution */}
                    <Text color={completed ? "gray" : undefined}>{renderedOutput}</Text>
                </Box>
            ) : !completed && (
                <Box marginTop={1} backgroundColor={isPty ? undefined : "#0a0a0a"} paddingX={1}>
                    <Text color="white" italic>Waiting for output...</Text>
                </Box>
            )}

            <Box justifyContent="space-between" marginTop={1}>
                {!completed ? (
                    <Text color="gray" italic>{isFocused ? "Press TAB to unfocus, then double-press ESC to terminate." : "Double-press ESC to terminate if hanging."}</Text>
                ) : <Box />}
                <Text color="gray" bold>
                    {completed ? "● ARCHIVED" : (isFocused ? "▶ TERMINAL FOCUSED" : "● LIVE (Press TAB to focus)")}
                </Text>
            </Box>
        </Box>
    );
});
