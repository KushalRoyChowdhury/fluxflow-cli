import React from 'react';
import { Box, Text } from 'ink';
import { wrapText } from '../utils/text.js';

export const TerminalBox = React.memo(({ command, output, completed = false, isFocused = false, columns = 80, isPty = false }) => {
    // A smart carriage return resolver that simulates terminal overwrites for Ink
    const processPTY = (text) => {
        if (!text) return '';
        // 1. Strip trailing \r right before \n to prevent dropping lines ending in \r\n or \r\r\n
        const noTrailingCr = text.replace(/\r+\n/g, '\n');
        // 2. Resolve true inline \r (spinners/progress bars) by taking the last overwrite
        return noTrailingCr.split('\n').map(line => {
            const parts = line.split('\r');
            return parts[parts.length - 1];
        }).join('\n');
    };

    // For standard spawn we do minor cleanup, but for PTY we use the smart resolver
    const cleanOutput = isPty ? processPTY(output) : (output || '').replace(/\r\n/g, '\n');
    
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
                    <Text color="gray" dimColor italic>{isFocused ? "Press TAB to unfocus, then double-press ESC to terminate." : "Double-press ESC to terminate if hanging."}</Text>
                ) : <Box />}
                <Text color={completed ? "#475569" : (isFocused ? "yellow" : "cyan")} bold>
                    {completed ? "● ARCHIVED" : (isFocused ? "▶ TERMINAL FOCUSED" : "● LIVE (Press TAB to focus)")}
                </Text>
            </Box>
        </Box>
    );
});
