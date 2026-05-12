import React from 'react';
import { Box, Text } from 'ink';
import { formatTokens, truncatePath } from '../utils/text.js';

const StatusBar = React.memo(({ mode, thinkingLevel, tokens = '0.0k', tokensTotal = '0.0k', chatId = 'NEW-SESSION', isMemoryEnabled = true }) => {
    const modeColor = mode === 'Flux' ? 'yellow' : 'cyan';
    const modeIcon = mode === 'Flux' ? '⚡' : '🌊';

    return (
        <Box
            borderStyle="round"
            borderColor="gray"
            flexDirection="row"
            justifyContent="space-between"
            paddingX={1}
            width="100%"
        >
            {/* 🛠️ MODE & THINKING ZONE */}
            <Box>
                <Box marginRight={1}>
                    <Text color={modeColor} bold>{modeIcon} {mode.toUpperCase()}</Text>
                </Box>

                <Text color="gray" dimColor>┃ </Text>

                <Box marginX={1}>
                    <Text color="magenta">🧠 {thinkingLevel}</Text>
                </Box>

                <Text color="gray" dimColor>┃ </Text>

                <Box marginX={1}>
                    <Text color="gray">MEM: </Text>
                    <Text color={isMemoryEnabled ? 'green' : 'red'} bold>{isMemoryEnabled ? 'ON' : 'OFF'}</Text>
                </Box>
            </Box>

            {/* 📁 WORKSPACE TELEMETRY */}
            <Box flexGrow={1} justifyContent="center" paddingX={2}>
            <Text>📁</Text><Text color="gray" italic> {truncatePath(process.cwd(), 35)}</Text>
            </Box>

            {/* 🔋 PERFORMANCE & ID ZONE */}
            <Box>
                <Text color="gray" dimColor>┃ </Text>

                <Box marginX={1}>
                    <Text>✨</Text><Text color="blue"> {formatTokens(tokensTotal)} <Text dimColor>({Math.round((tokens / 254000) * 100)}%)</Text></Text>
                </Box>

                <Text color="gray" dimColor>┃ </Text>

                <Box marginLeft={1}>
                    <Text>🆔</Text><Text color="gray" dimColor italic> {chatId}</Text>
                </Box>
            </Box>
        </Box>
    );
});

export default StatusBar;
