import React from 'react';
import { Box, Text } from 'ink';
import { formatTokens, truncatePath } from '../utils/text.js';
import { useState, useEffect } from 'react';

let activeGetMemoryInfo = null;

export function getMemoryInfo() {
    if (activeGetMemoryInfo) {
        activeGetMemoryInfo();
    }
}

const StatusBar = React.memo(({ mode, thinkingLevel, tokens = '0.0k', tokensTotal = '0.0k', chatId = 'NEW-SESSION', isMemoryEnabled = true, apiTier = 'Free', aiProvider = 'Google', activeModel = '' }) => {
    // const modeIcon = mode === 'Flux' ? '⚡' : '🌊';
    const modeIcon = mode === 'Flux' ? '' : '';
    const [memoryUsage, setMemoryUsage] = useState(0);
    const [memoryLimit, setMemoryLimit] = useState(0);
    const [memoryUnit, setMemoryUnit] = useState('MB');

    const updateMemory = () => {
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

    useEffect(() => {
        activeGetMemoryInfo = updateMemory;
        updateMemory();
        const interval = setInterval(() => {
            updateMemory();
        }, 30000);

        // Keep it clean! 🧹
        return () => {
            clearInterval(interval);
            if (activeGetMemoryInfo === updateMemory) {
                activeGetMemoryInfo = null;
            }
        };
    }, []);



    let maxLimit = 262144;
    if (aiProvider === 'NVIDIA' && (activeModel?.includes('glm') || activeModel?.includes('gpt') || activeModel?.includes('qwen'))) {
        maxLimit = 128000;
    } else if (aiProvider === 'DeepSeek' || (aiProvider === 'Google' && apiTier === 'Paid')) {
        maxLimit = 409600;
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
