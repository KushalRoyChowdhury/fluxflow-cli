import React from 'react';
import { Box, Text } from 'ink';
import { formatTokens, truncatePath } from '../utils/text.js';

const StatusBar = React.memo(({ mode, thinkingLevel, tokens = '0.0k', tokensTotal = '0.0k', chatId = 'NEW-SESSION', isMemoryEnabled = true, apiTier = 'Free', aiProvider = 'Google' }) => {
    // const modeIcon = mode === 'Flux' ? '⚡' : '🌊';
    const modeIcon = mode === 'Flux' ? '' : '';

    let maxLimit = 256000;
    if (aiProvider === 'DeepSeek' || aiProvider === 'NVIDIA' || (aiProvider === 'Google' && apiTier === 'Paid')) {
        maxLimit = 400000;
    }

    return (
        <Box
            flexDirection="row"
            justifyContent="space-between"
            paddingX={1}
            width="100%"
        >
            {/* 🛠️ MODE & THINKING ZONE */}
            <Box>
                <Box marginRight={1}>
                    <Text color="white" bold>{modeIcon} {mode.toUpperCase()}</Text>
                </Box>

                <Text color="gray" dimColor>┃ </Text>

                <Box marginX={1}>
                    <Text color="white" bold>{thinkingLevel.toUpperCase()}</Text>
                </Box>

                <Text color="gray" dimColor>┃ </Text>

                <Box marginX={1}>
                    <Text color="gray">MEM: </Text>
                    <Text color="white" bold>{isMemoryEnabled ? 'ON' : 'OFF'}</Text>
                </Box>
            </Box>

            {/* 📁 WORKSPACE TELEMETRY */}
            <Box flexGrow={1} justifyContent="center" paddingX={2}>
            <Text color="white" italic> {truncatePath(process.cwd(), 35)}</Text>
            </Box>

            {/* 🔋 PERFORMANCE & ID ZONE */}
            <Box>
                <Text color="gray" dimColor>┃ </Text>

                <Box marginX={1}>
                    <Text color="white"> {formatTokens(tokensTotal)} <Text dimColor>{((tokens / maxLimit) * 100).toFixed(0)}%</Text></Text>
                </Box>

                <Text color="gray" dimColor>┃ </Text>

                <Box marginLeft={1}>
                    <Text color="gray" italic> {chatId}</Text>
                    {(apiTier === 'Custom' || apiTier === 'Paid') && (
                        <Text color="gray" dimColor> | <Text color="gray" bold>PAID</Text></Text>
                    )}
                </Box>
            </Box>
        </Box>
    );
});

export default StatusBar;
