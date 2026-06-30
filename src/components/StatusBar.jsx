import React from 'react';
import { Box, Text } from 'ink';
import { formatTokens, truncatePath } from '../utils/text.js';
import { useState, useEffect } from 'react';

const StatusBar = React.memo(({ mode, thinkingLevel, tokens = '0.0k', tokensTotal = '0.0k', chatId = 'NEW-SESSION', isMemoryEnabled = true, apiTier = 'Free', aiProvider = 'Google' }) => {
    // const modeIcon = mode === 'Flux' ? '⚡' : '🌊';
    const modeIcon = mode === 'Flux' ? '' : '';
    const [memoryUsage, setMemoryUsage] = useState(0);
    const [memoryLimit, setMemoryLimit] = useState(0);
    const [memoryUnit, setMemoryUnit] = useState('MB');

    useEffect(() => {
        const getMemoryInfo = () => {
            const usage = process.memoryUsage();

            // 1. Determine the unit based on heapTotal (if >= 1GB, use GB)
            const isGB = usage.heapTotal / (1024 * 1024) >= 1024;
            const currentUnit = isGB ? 'GB' : 'MB';

            // 2. Helper function to turn bytes into a clean, parsed number
            const formatToNumber = (bytes, toGB) => {
                const converted = bytes / (1024 * 1024 * (toGB ? 1024 : 1));
                // Keep 2 decimal places for GB, or round to whole numbers for MB
                return toGB ? parseFloat(converted.toFixed(2)) : Math.round(converted);
            };

            // 3. Update all three states!
            setMemoryUnit(currentUnit);
            setMemoryLimit(formatToNumber(usage.heapTotal, isGB));
            setMemoryUsage(formatToNumber(usage.heapUsed, isGB));
        }
        getMemoryInfo();
        const interval = setInterval(() => {
            getMemoryInfo();
        }, 3000);

        // Keep it clean! 🧹
        return () => clearInterval(interval);
    }, []);



    let maxLimit = 256000;
    if (aiProvider === 'DeepSeek' || (aiProvider === 'Google' && apiTier === 'Paid')) {
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
                    <Text color="white" bold>{mode.toUpperCase()}</Text>
                </Box>

                <Text color="gray" dimColor>┃</Text>

                <Box marginX={1}>
                    <Text color="white" bold>{thinkingLevel.toUpperCase()}</Text>
                </Box>

                <Text color="gray" dimColor>┃</Text>

                <Box marginX={1}>
                    <Text color="gray" bold>MEM: </Text>
                    <Text color="white" bold>{isMemoryEnabled ? 'ON' : 'OFF'}</Text>
                </Box>
            </Box>

            {/* 📁 WORKSPACE TELEMETRY */}
            <Box flexGrow={1} justifyContent="center" paddingX={2}>
                <Text color="white" italic>{truncatePath(process.cwd(), 35)}</Text>
            </Box>

            {/* 🔋 PERFORMANCE & ID ZONE */}
            <Box>
                <Text color="gray" dimColor>┃</Text>

                <Box marginX={1}>
                    <Text color="white">{formatTokens(tokensTotal)} <Text dimColor>{((tokens / maxLimit) * 100).toFixed(0)}%</Text></Text>
                </Box>

                <Text color="gray" dimColor>┃</Text>

                <Box marginX={1}>
                    <Text color="grey" bold>{memoryUsage}/{memoryLimit} {memoryUnit}</Text>
                </Box>

                <Text color="gray" dimColor>┃</Text>

                <Box marginLeft={1}>
                    <Text color="gray" bold>{chatId}</Text>
                    {(apiTier === 'Custom' || apiTier === 'Paid') && (
                        <Box><Text color="gray" dimColor> ┃ </Text><Text color="gray" bold>PAID</Text></Box>
                    )}
                </Box>
            </Box>
        </Box>
    );
});

export default StatusBar;
