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
    if (delay <= 370) return '#00a564'; // Deep green
    if (delay >= 5000) return '#ff0000'; // Pure red

    // More stops = smoother perceptual gradient across the full range
    const points = [
        { t:  370, r:   0, g: 165, b: 100 }, // deep green
        { t:  550, r:  40, g: 195, b:  80 }, // green
        { t:  800, r: 120, g: 220, b:  50 }, // lime-green
        { t: 1100, r: 190, g: 225, b:  20 }, // yellow-green
        { t: 1500, r: 250, g: 210, b:  15 }, // yellow
        { t: 2000, r: 255, g: 170, b:   0 }, // amber
        { t: 2800, r: 255, g: 110, b:   0 }, // orange
        { t: 3800, r: 255, g:  50, b:   0 }, // deep orange
        { t: 5000, r: 255, g:   0, b:   0 }  // red
    ];

    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        if (delay >= p1.t && delay <= p2.t) {
            // Smoothstep easing so mid-range transitions feel less abrupt
            let ratio = (delay - p1.t) / (p2.t - p1.t);
            ratio = ratio * ratio * (3 - 2 * ratio); // smoothstep
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
    const smoothedDelayRef = useRef(370); // EMA of delay, starts at fast/green

    useEffect(() => {
        if (!isProcessing) {
            chunkTimesRef.current = [];
            return;
        }

        if (lastChunkTime > 0) {
            const times = chunkTimesRef.current;
            if (times.length === 0 || times[times.length - 1] !== lastChunkTime) {
                times.push(lastChunkTime);
                if (times.length > 10) {
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

            // Two-zone logic:
            // • Brief pause  (<2.5s): cap at 3× avg so tool calls / context pauses
            //   don't catastrophize the color.
            // • Genuine stall (≥2.5s): bypass cap entirely so the dot turns red,
            //   signalling the model is dead — not just thinking.
            const STALL_THRESHOLD = 2500;
            const isStalled = timeSinceLast >= STALL_THRESHOLD;
            const cappedTimeSinceLast = (!isStalled && averageInterval > 0)
                ? Math.min(timeSinceLast, averageInterval * 3)
                : timeSinceLast;
            const rawDelay = Math.max(averageInterval, cappedTimeSinceLast);

            // EMA: react faster (α=0.4) during a stall so red arrives in ~3 ticks,
            // stay slow (α=0.2) during normal streaming to absorb spikes.
            const alpha = isStalled ? 0.4 : 0.2;
            smoothedDelayRef.current = smoothedDelayRef.current * (1 - alpha) + rawDelay * alpha;
            setDotColor(getLatencyColor(smoothedDelayRef.current));
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
    } else if (aiProvider === 'DeepSeek' || (aiProvider === 'Google' && apiTier === 'Paid') || (aiProvider === 'NVIDIA' && activeModel.includes('deepseek'))) {
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
                    <Text color="white">
                        {formatTokens(tokensTotal)}{' '}
                        {(() => {
                            const pct = (tokens / maxLimit) * 100;
                            const color = pct < 60 ? 'white' : pct < 80 ? 'yellow' : 'red';
                            return <Text color={color} dimColor>{pct.toFixed(0)}%</Text>;
                        })()}
                    </Text>
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
