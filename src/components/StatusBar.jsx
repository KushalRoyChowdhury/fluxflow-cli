import React from 'react';
import { Box, Text } from 'ink';
import { formatTokens, truncatePath } from '../utils/text.js';

const StatusBar = React.memo(({ mode, thinkingLevel, tokens = '0.0k', tokensTotal = '0.0k', chatId = 'NEW-SESSION', isMemoryEnabled = true }) => {
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
                <Text color="blue" dimColor italic>{truncatePath(process.cwd(), 40)}</Text>
            </Box>

            <Box>
                <Text color="gray">MEM: </Text>
                <Text color={memStatus === 'ON' ? 'green' : 'red'}>{memStatus}</Text>
                <Text color="gray"> │ </Text>
                <Text color="blue">{formatTokens(tokensTotal)} ({Math.round((tokens / 254000) * 100)}%)</Text>
                <Text color="gray"> │ </Text>
                <Text color="dim">{chatId} </Text>
            </Box>
        </Box>
    );
});

export default StatusBar;
