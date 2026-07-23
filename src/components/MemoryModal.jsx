import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { readEncryptedJson, writeEncryptedJson, readAesEncryptedJson } from '../utils/crypto.js';
import { MEMORIES_FILE, SETTINGS_FILE } from '../utils/paths.js';
import { emojiSpace } from '../utils/terminal.js';
import { getThemeColors } from '../utils/theme.js';

export default function MemoryModal({ onClose, theme = 'Dark' }) {
    const colors = getThemeColors(theme);
    const { stdout } = useStdout();
    const columns = stdout?.columns || 80;
    const [memories, setMemories] = useState([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isMemoryOn, setIsMemoryOn] = useState(true);

    const loadMemories = () => {
        const data = readEncryptedJson(MEMORIES_FILE, []);
        setMemories(data);

        try {
            const settings = readAesEncryptedJson(SETTINGS_FILE, {});
            const memoryOn = settings.systemSettings?.memory !== false;
            setIsMemoryOn(memoryOn);
        } catch (e) {
            setIsMemoryOn(true);
        }
    };

    useEffect(() => {
        loadMemories();
    }, []);

    useInput((input, key) => {
        if (key.escape) onClose();
        if (key.upArrow) setSelectedIndex(prev => Math.max(0, prev - 1));
        if (key.downArrow) setSelectedIndex(prev => Math.min(memories.length - 1, prev + 1));
        if (input === 'x' && memories.length > 0) {
            const idToDelete = memories[selectedIndex].id;
            const updated = memories.filter(m => m.id !== idToDelete);
            writeEncryptedJson(MEMORIES_FILE, updated);
            setMemories(updated);
            if (selectedIndex >= updated.length && updated.length > 0) {
                setSelectedIndex(updated.length - 1);
            }
        }
    });

    const formatMemory = (text, idx, isSelected) => {
        if (!text) return '';
        const clean = text.replace(/\[Saved on: .*?\]/g, '').replace(/\\+'/g, "'").trim();

        const prefix = `${isSelected ? '❯ ' : '  '}${idx + 1}. `;
        const prefixLen = prefix.length;
        const rightPadding = isSelected ? 22 : 2;

        const parts = clean.split('\n');
        return parts.map((part, partIdx) => {
            const isFirstPart = partIdx === 0;
            const firstLineMax = Math.max(10, columns - 4 - (isFirstPart ? prefixLen : 3) - rightPadding);
            const subLineMax = Math.max(10, columns - 4 - 3 - rightPadding);

            const words = part.split(/(\s+)/);
            const lines = [];
            let currentLine = '';

            words.forEach(word => {
                if (word.length === 0) return;
                const currentLimit = lines.length === 0 ? firstLineMax : subLineMax;
                if (currentLine.length + word.length > currentLimit) {
                    if (currentLine.trim().length > 0) {
                        lines.push(currentLine.trimEnd());
                        currentLine = word;
                    } else {
                        lines.push(word.substring(0, currentLimit));
                        currentLine = word.substring(currentLimit);
                    }
                } else {
                    currentLine += word;
                }
            });
            if (currentLine.trimEnd().length > 0) {
                lines.push(currentLine.trimEnd());
            }

            if (lines.length === 0) return '';
            const wrapped = lines.join('\n' + '     ');
            return isFirstPart ? wrapped : '     ' + wrapped;
        }).join('\n');
    };

    const totalCapacity = 4 * 1024 * 2; // 8192 chars
    const currentLength = memories.reduce((acc, m) => acc + (m.memory?.length || 0), 0);
    const usagePercent = Math.min(100, Math.round((currentLength / totalCapacity) * 100));

    const barWidth = 12;
    const filledCount = Math.round((usagePercent / 100) * barWidth);
    const barStr = '█'.repeat(filledCount) + '░'.repeat(Math.max(0, barWidth - filledCount));

    const getBarColor = () => {
        if (usagePercent < 50) return colors.textMuted;
        if (usagePercent < 90) return colors.warning;
        return colors.danger;
    };

    const s = emojiSpace(2);

    return (
        <Box flexDirection="column" borderStyle="round" borderColor={colors.borderMuted} padding={0} width="100%">
            <Box paddingX={1} marginBottom={1} justifyContent="space-between">
                <Text color={colors.text} bold>SAVED MEMORIES</Text>
                <Box>
                    <Text color={colors.textMuted}>Vault: </Text>
                    <Text color={getBarColor()}>{barStr}</Text>
                    <Text color={colors.text} bold> {usagePercent}%</Text>
                </Box>
            </Box>

            {!isMemoryOn && memories.length > 0 ? (
                <Box paddingX={2} paddingY={1}>
                    <Text italic color={colors.textMuted}>Memory is currently Off...</Text>
                </Box>
            ) : memories.length === 0 ? (
                <Box paddingX={2} paddingY={1}>
                    <Text italic color={colors.textMuted}>{isMemoryOn ? "Learning..." : "Memory not available..."}</Text>
                </Box>
            ) : (
                <Box flexDirection="column">
                    {memories.map((mem, idx) => {
                        const isSelected = idx === selectedIndex;
                        return (
                            <Box
                                key={mem.id}
                                paddingX={1}
                                backgroundColor={isSelected ? colors.highlightBg : undefined}
                                width="100%"
                            >
                                <Box flexGrow={1}>
                                    <Text color={isSelected ? colors.text : colors.textMuted} bold={isSelected}>
                                        {isSelected ? '❯ ' : '  '}{idx + 1}. {formatMemory(mem.memory, idx, isSelected)}
                                    </Text>
                                </Box>
                                {isSelected && (
                                    <Box flexShrink={0}>
                                        <Text color={colors.textMuted} dimColor> [<Text italic>{mem.score}</Text>] </Text>
                                        <Text color={colors.danger} bold>[X] WIPE </Text>
                                    </Box>
                                )}
                            </Box>
                        );
                    })}
                </Box>
            )}

            <Box
                marginTop={1}
                paddingX={1}
                borderStyle="single"
                borderLeft={false}
                borderRight={false}
                borderBottom={false}
                borderColor={colors.borderMuted}
            >
                <Text color={colors.textMuted} italic>↑↓ navigate • x wipe memory • Esc close</Text>
            </Box>
        </Box>
    );
}
