import React from 'react';
import { Box, Text } from 'ink';
import { formatTokens, truncatePath } from '../utils/text.js';
import { useState, useEffect, useRef } from 'react';
import { getThemeColors } from '../utils/theme.js';

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
        { t: 370, r: 0, g: 165, b: 100 }, // deep green
        { t: 550, r: 40, g: 195, b: 80 }, // green
        { t: 800, r: 120, g: 220, b: 50 }, // lime-green
        { t: 1100, r: 190, g: 225, b: 20 }, // yellow-green
        { t: 1500, r: 250, g: 210, b: 15 }, // yellow
        { t: 2000, r: 255, g: 170, b: 0 }, // amber
        { t: 2800, r: 255, g: 110, b: 0 }, // orange
        { t: 3800, r: 255, g: 50, b: 0 }, // deep orange
        { t: 5000, r: 255, g: 0, b: 0 }  // red
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

const StatusBar = React.memo(({ mode, thinkingLevel, tokens = '0.0k', tokensTotal = '0.0k', chatId = 'NEW-SESSION', isMemoryEnabled = true, apiTier = 'Free', aiProvider = 'Google', activeModel = '', isProcessing = false, lastChunkTime = 0, theme = 'Dark', wps = 0, showTPMEstimate = false }) => {
    const colors = getThemeColors(theme);
    const modeIcon = mode === 'Flux' ? '' : '';
    const [memoryUsage, setMemoryUsage] = useState(0);
    const [memoryLimit, setMemoryLimit] = useState(0);
    const [memoryUnit, setMemoryUnit] = useState('MB');

    const [dotColor, setDotColor] = useState('green');
    const [displayedWps, setDisplayedWps] = useState(0);
    const chunkTimesRef = useRef([]);
    const smoothedDelayRef = useRef(370); // EMA of delay, starts at fast/green
    const wpsHistoryRef = useRef([]);
    const lastChunkTimeRef = useRef(lastChunkTime);
    useEffect(() => {
        lastChunkTimeRef.current = lastChunkTime;
    }, [lastChunkTime]);

    // Collect WPS samples into moving average history ref
    useEffect(() => {
        if (!isProcessing) {
            wpsHistoryRef.current = [];
            return;
        }
        if (wps > 0) {
            const history = wpsHistoryRef.current;
            history.push(wps);
            if (history.length > 3) {
                history.shift();
            }
        }
    }, [isProcessing, wps, lastChunkTime]);

    // Display update timer (ticks every 250ms for real-time responsive updates)
    useEffect(() => {
        if (!isProcessing) {
            setDisplayedWps(0);
            return;
        }

        const timer = setInterval(() => {
            const lastTime = lastChunkTimeRef.current;
            const timeSinceLast = lastTime > 0 ? (Date.now() - lastTime) : 0;

            if (lastTime > 0 && timeSinceLast > 1500) {
                wpsHistoryRef.current = [];
                setDisplayedWps(0);
            } else if (lastTime > 0 && timeSinceLast > 600) {
                // If chunks pause for >600ms, start decaying recent WPS history
                if (wpsHistoryRef.current.length > 0) {
                    wpsHistoryRef.current.shift();
                }
                const history = wpsHistoryRef.current;
                if (history.length > 0) {
                    const sum = history.reduce((acc, val) => acc + val, 0);
                    const avg = Math.round((sum / history.length) * 10) / 10;
                    setDisplayedWps(avg);
                } else {
                    setDisplayedWps(0);
                }
            } else {
                const history = wpsHistoryRef.current;
                if (history.length > 0) {
                    const sum = history.reduce((acc, val) => acc + val, 0);
                    const avg = Math.round((sum / history.length) * 10) / 10;
                    setDisplayedWps(avg);
                } else if (wps > 0) {
                    setDisplayedWps(wps);
                }
            }
        }, 1350);

        return () => clearInterval(timer);
    }, [isProcessing]);

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

            const STALL_THRESHOLD = 2500;
            const isStalled = timeSinceLast >= STALL_THRESHOLD;
            const cappedTimeSinceLast = (!isStalled && averageInterval > 0)
                ? Math.min(timeSinceLast, averageInterval * 3)
                : timeSinceLast;
            const rawDelay = Math.max(averageInterval, cappedTimeSinceLast);

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

        const isGB = usage.heapTotal / (1024 * 1024) >= 1024;
        const currentUnit = isGB ? 'GB' : 'MB';

        const formatToNumber = (bytes, toGB) => {
            const converted = bytes / (1024 * 1024 * (toGB ? 1024 : 1));
            return toGB ? parseFloat(converted.toFixed(2)) : Math.round(converted);
        };

        setMemoryUnit(currentUnit);
        setMemoryLimit(formatToNumber(usage.heapTotal, isGB));
        setMemoryUsage(formatToNumber(usage.heapUsed, isGB));
    }

    useEffect(() => {
        activeGetMemoryInfo = updateMemory;
        updateMemory();
        const interval = setInterval(() => {
            updateMemory();
        }, 60000);

        return () => {
            clearInterval(interval);
            if (activeGetMemoryInfo === updateMemory) {
                activeGetMemoryInfo = null;
            }
        };
    }, []);

    let maxLimit = 262144;
    const hc = process.env.HIGH_CONTEXT;
    if (hc && hc !== 'false') {
        const val = parseInt(hc, 10);
        if (!isNaN(val) && val >= 256000 && val <= 1000000) {
            maxLimit = val;
        }
    }
    // ~128k fixed cap for limited-context models; HIGH_CONTEXT is ignored for these.
    if ((aiProvider === 'NVIDIA' && (activeModel?.includes('glm') || activeModel?.includes('gpt') || activeModel?.includes('qwen') || activeModel?.includes('medium'))) || aiProvider === 'Mistral') {
        maxLimit = 128000;
    }

    return (
        <Box
            flexDirection="row"
            justifyContent="space-between"
            paddingX={1}
            width="100%"
        >
            {/* 🛠️ MODE & CWD TELEMETRY ZONE */}
            <Box>
                {mode.toLowerCase() === 'flow' && (
                    <>
                        <Box marginRight={1}>
                            <Text color={colors.text} bold>{mode.toUpperCase()}</Text>
                            <Text color={colors.textMuted}> (Limited Tools)</Text>
                        </Box>

                        <Text color={colors.textMuted} dimColor>┃ </Text>
                    </>
                )}

                <Box>
                    <Text color={colors.text} italic>{truncatePath(process.cwd(), 35)}</Text>
                </Box>

                {/* {isMemoryEnabled && (
                    <Box flexDirection="row">
                        <Text color={colors.textMuted} dimColor>┃</Text>
                        <Box marginX={1}>
                            <Text color={colors.text} dimColor bold>MEMORY</Text>
                        </Box>
                    </Box>
                )} */}
            </Box>

            {/* 🔋 PERFORMANCE & TELEMETRY ZONE */}
            <Box>
                {isProcessing ? (
                    <Box>
                        <Text color={dotColor}>●</Text>
                        {showTPMEstimate && (
                            <>
                                <Text color={colors.textMuted} bold> {displayedWps} tps</Text>
                                <Text color={colors.textMuted} dimColor> ┃</Text>
                            </>
                        )}
                    </Box>
                ) : null}
                {tokens > 0 &&
                    <>
                        <Box marginX={1}>
                            <Text color={colors.text}>
                                {formatTokens(tokensTotal)}{' '}
                                {(() => {
                                    const pct = (tokens / maxLimit) * 100;
                                    const color = pct < 60 ? colors.text : pct < 80 ? colors.warning : colors.danger;
                                    return <Text color={color} dimColor>{pct.toFixed(0)}%</Text>;
                                })()}
                            </Text>
                        </Box>

                        <Text color={colors.textMuted} dimColor>┃</Text>
                    </>}

                <Box marginLeft={1}>
                    <Text color={colors.textMuted} bold>{memoryUsage} {memoryUnit}</Text>
                    {/* <Text color={colors.textMuted} bold>{memoryUsage}/{memoryLimit} {memoryUnit}</Text> */}

                    {/* {(apiTier === 'Custom' || apiTier === 'Paid') && (
                        <Box><Text color={colors.textMuted} dimColor> ┃ </Text><Text color={colors.textMuted} bold>PAID</Text></Box>
                    )} */}
                </Box>
            </Box>
        </Box>
    );
});

export default StatusBar;
