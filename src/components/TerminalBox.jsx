import React from 'react';
import { Box, Text } from 'ink';
import { wrapText } from '../utils/text.js';

export const TerminalBox = React.memo(({ command, output, completed = false, isFocused = false, columns = 80 }) => {
    // Clean output of \r and excessive trailing newlines
    const cleanOutput = (output || '')
        .replace(/\r/g, '')
        .trim();

    const wrappedOutput = cleanOutput ? wrapText(cleanOutput, columns - 6) : '';

    return (
        <Box flexDirection="column" borderStyle={isFocused ? 'double' : 'round'} borderColor={completed ? "#334155" : (isFocused ? "yellow" : "cyan")} paddingX={2} paddingY={completed ? 0 : 1} width="100%">
            <Box marginBottom={1}>
                <Text color={completed ? "gray" : (isFocused ? "yellow" : "cyan")} bold>{completed ? "🏁 FINISHED:" : "⚡ EXECUTING:"} </Text>
                <Text color={completed ? "gray" : "white"}>{command}</Text>
            </Box>
            
            {wrappedOutput ? (
                <Box marginTop={completed ? 0 : 1} backgroundColor="#0a0a0a" paddingX={1}>
                    <Text color={completed ? "gray" : "green"}>{wrappedOutput}</Text>
                </Box>
            ) : !completed && (
                <Box marginTop={1} backgroundColor="#0a0a0a" paddingX={1}>
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
