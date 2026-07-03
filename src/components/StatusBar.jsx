import React from 'react';
import { Box, Text } from 'ink';
import { formatTokens, truncatePath } from '../utils/text.js';
import { useState, useEffect, useRef } from 'react';

let activeGetMemoryInfo = null;

export function getMemoryInfo() {
    if (activeGetMemoryInfo) {
        activeGetMemoryInfo();
    }
}

const getLatencyColor = (delay) => {
    if (delay <= 400) return '#00a564'; // Deep green
    if (delay >= 5000) return '#ff0000'; // Pure red

    const points = [
        { t: 400, r: 0, g: 165, b: 100 },
        { t: 800, r: 120, g: 220, b: 80 },
        { t: 1500, r: 250, g: 210, b: 40 },
        { t: 3000, r: 255, g: 120, b: 0 },
        { t: 5000, r: 255, g: 0, b: 0 }
    ];

    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i+1];
        if (delay >= p1.t && delay <= p2.t) {
            const ratio = (delay - p1.t) / (p2.t - p1.t);
            const r = Math.round(p1.r + (p2.r - p1.r) * ratio);
            const g = Math.round(p1.g + (p2.g - p1.g) * ratio);
            const b = Math.round(p1.b + (p2.b - p1.b) * ratio);
            return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
        }
    }
    return '#ff0000';
};

const StatusBar = React.memo(({ mode, thinkingLevel, tokens = '0.0k', tokensTotal = '0.0k', chatId = 'NEW-SESSION', isMemoryEnabled = true, apiTier = 'Free', aiProvider = 'Google', activeModel = '', isProcessing = false, lastChunkTime = 0 }) => {
    // const modeIcon = mode === 'Flux' ? '⚡' : '🌊';
    const modeIcon = mode === 'Flux' ? '' : '';
    const [memoryUsage, setMemoryUsage] = useState(0);
    const [memoryLimit, setMemoryLimit] = useState(0);
    const [memoryUnit, setMemoryUnit] = useState('MB');

    const [dotColor, setDotColor] = useState('green');
    const chunkTimesRef = useRef([]);

    useEffect(() => {
        if (!isProcessing) {
            chunkTimesRef.current = [];
            return;
        }

        if (lastChunkTime > 0) {
            const times = chunkTimesRef.current;
            if (times.length === 0 || times[times.length - 1] !== lastChunkTime) {
                times.push(lastChunkTime);
                if (times.length > 5) {
                    times.shift();
                }
            }
        }

        const checkLatency = () => {
            if (!lastChunkTime) {
                setDotColor('#00a564');
                return;
            }
            const times = chunkTimesRef.current;
            let averageInterval = 0;
            if (times.length > 1) {
                let sum = 0;
                for (let i = 1; i < times.length; i++) {
                    sum += (times[i] - times[i - 1]);
                }
                averageInterval = sum / (times.length - 1);
            }
            const timeSinceLast = Date.now() - lastChunkTime;
            const delay = Math.max(averageInterval, timeSinceLast);
            setDotColor(getLatencyColor(delay));
        };

        checkLatency();
        const timer = setInterval(checkLatency, 100);
        return () => clearInterval(timer);
    }, [isProcessing, lastChunkTime]);

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
                {isProcessing ? (
                    <Box marginRight={0}>
                        <Text color={dotColor}>●</Text>
                    </Box>
                ) : <Text> </Text>}
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
