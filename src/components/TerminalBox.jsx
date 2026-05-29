import React from 'react';
import { Box, Text } from 'ink';
import { wrapText } from '../utils/text.js';

export const TerminalBox = React.memo(({ command, output, completed = false, isFocused = false, columns = 80, isPty = false }) => {
    // Clean output: handle complex node-pty line endings and ANSI noise
    const processOutput = (text) => {
        if (!text) return '';
        // 1. Convert all combinations of CRLF, lone CR, and lone LF to standard LF
        // 2. Preserve vertical space and leading indentation
        return text
            .split(/\r\n|\r|\n/)
            .map(line => line.trimEnd())
            .join('\n')
            .replace(/^\n+|\n+$/g, ''); // Trim only excessive leading/trailing newlines
    };

    const cleanOutput = processOutput(output);
    // Bypass wrapText for PTY output to let the native terminal handling do its work
    const displayOutput = isPty ? cleanOutput : (cleanOutput ? wrapText(cleanOutput, columns - 6) : '');

    return (
        <Box flexDirection="column" borderStyle={isFocused ? 'double' : 'round'} borderColor={completed ? "#334155" : (isFocused ? "yellow" : "cyan")} paddingX={2} paddingY={completed ? 0 : 1} width="100%">
            <Box marginBottom={1} justifyContent="space-between" width="100%">
                <Box flexShrink={1} paddingRight={2}>
                    <Text>
                        <Text color={completed ? "gray" : (isFocused ? "yellow" : "cyan")} bold>{completed ? "🏁 FINISHED:" : "⚡ EXECUTING:"} </Text>
                        <Text color={completed ? "gray" : "white"}>{command}</Text>
                    </Text>
                </Box>
                {isPty && (
                    <Box flexShrink={0} paddingX={1}>
                        <Text color={completed ? "gray" : "magenta"} bold>ADVANCE</Text>
                    </Box>
                )}
            </Box>
            
            {displayOutput ? (
                <Box marginTop={completed ? 0 : 1} backgroundColor={isPty ? undefined : "#0a0a0a"} paddingX={1}>
                    {/* Only apply green color if completed; let ANSI colors show during live execution */}
                    <Text color={completed ? "gray" : undefined}>{displayOutput}</Text>
                </Box>
            ) : !completed && (
                <Box marginTop={1} backgroundColor={isPty ? undefined : "#0a0a0a"} paddingX={1}>
                    <Text color="gray" italic>Waiting for output...</Text>
                </Box>
            )}

            <Box justifyContent="space-between" marginTop={1}>
                {!completed ? (
                    <Text color="gray" dimColor italic>Double-press ESC to terminate if hanging.</Text>
                ) : <Box />}
                <Text color={completed ? "#475569" : (isFocused ? "yellow" : "cyan")} bold>
                    {completed ? "● ARCHIVED" : (isFocused ? "▶ TERMINAL FOCUSED" : "● LIVE (Press TAB to focus)")}
                </Text>
            </Box>
        </Box>
    );
});
