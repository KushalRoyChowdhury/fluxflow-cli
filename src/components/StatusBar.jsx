import React from 'react';
import { Box, Text } from 'ink';

const StatusBar = React.memo(({ mode, thinkingLevel, tokens = '0.0k', chatId = 'NEW-SESSION', isMemoryEnabled = true }) => {
    const modeColor = mode === 'Flux' ? 'yellow' : 'cyan';
    const modeIcon = mode === 'Flux' ? '⚡' : '🌊';

    const memStatus = isMemoryEnabled ? 'ON' : 'OFF';

    return (
        <Box
            borderStyle="single"
            borderColor="gray"
            flexDirection="row"
            justifyContent="space-between"
            paddingX={1}
            width="100%"
        >
            <Box>
                <Text color={modeColor} bold>{modeIcon} {mode.toUpperCase()}</Text>
                <Text color="gray"> │ </Text>
                <Text color="magenta">🧠 {thinkingLevel}</Text>
            </Box>

            {/* CURRECT DIRECTORY TELEMETRY */}
            <Box flexGrow={1} justifyContent="center" paddingX={2}>
                <Text color="gray" dimColor>📁 </Text>
                <Text color="blue" dimColor italic>{process.cwd()}</Text>
            </Box>

            <Box>
                <Text color="gray">MEM: </Text>
                <Text color={memStatus === 'ON' ? 'green' : 'red'}>{memStatus}</Text>
                <Text color="gray"> │ </Text>
                <Text color="blue"> Tokens {tokens > 1000 ? `${(tokens / 1000).toFixed(1)}k` : tokens} ({Math.round((tokens / 254000) * 100)}%)</Text>
                <Text color="gray"> │ </Text>
                <Text color="dim">ID: {chatId} </Text>
            </Box>
        </Box>
    );
});

export default StatusBar;
