import React from 'react';
import { Box, Text } from 'ink';

export const TerminalBox = ({ command, output, completed = false }) => {
    // Clean output of \r and excessive trailing newlines
    const cleanOutput = (output || '')
        .replace(/\r/g, '')
        .trim();

    return (
        <Box flexDirection="column" borderStyle="round" borderColor={completed ? "#334155" : "cyan"} paddingX={2} paddingY={completed ? 0 : 1} width="100%">
            <Box justifyContent="space-between">
                <Box>
                    <Text color={completed ? "gray" : "cyan"} bold>{completed ? "🏁 FINISHED:" : "⚡ EXECUTING:"} </Text>
                    <Text color={completed ? "gray" : "white"}>{command}</Text>
                </Box>
                <Text color={completed ? "#475569" : "yellow"} bold>{completed ? "● ARCHIVED" : "● LIVE"}</Text>
            </Box>
            {cleanOutput ? (
                <Box marginTop={completed ? 0 : 1} backgroundColor="#0a0a0a" paddingX={1}>
                    <Text color={completed ? "gray" : "green"} wrap="anywhere">{cleanOutput}</Text>
                </Box>
            ) : !completed && (
                <Box marginTop={1} backgroundColor="#0a0a0a" paddingX={1}>
                    <Text color="gray" italic>Waiting for output...</Text>
                </Box>
            )}
            {!completed && (
                <Box marginTop={1}>
                    <Text color="gray" dimColor italic>Double-press ESC to terminate if hanging.</Text>
                </Box>
            )}
        </Box>
    );
};
