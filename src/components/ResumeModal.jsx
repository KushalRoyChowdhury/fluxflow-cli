import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { loadHistory } from '../utils/history.js';
import { emojiSpace } from '../utils/terminal.js';
import { getThemeColors } from '../utils/theme.js';

export default function ResumeModal({ onSelect, onDelete, onClose, theme = 'Dark' }) {
    const colors = getThemeColors(theme);
    const [history, setHistory] = useState({});
    const [keys, setKeys] = useState([]);
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => {
        const fetchHistory = async () => {
            const h = await loadHistory();
            setHistory(h);
            setKeys(Object.keys(h).sort((a, b) => (h[b].updatedAt || 0) - (h[a].updatedAt || 0)));
        };
        fetchHistory();
    }, []);

    useInput((input, key) => {
        if (key.escape) onClose();
        if (key.upArrow) setSelectedIndex(prev => Math.max(0, prev - 1));
        if (key.downArrow) setSelectedIndex(prev => Math.min(keys.length - 1, prev + 1));
        if (key.return && keys[selectedIndex]) onSelect(keys[selectedIndex]);

        if (input === 'x' && keys[selectedIndex]) {
            const targetId = keys[selectedIndex];
            onDelete(targetId).then(newHistory => {
                const safeHistory = newHistory || {};
                setHistory(safeHistory);
                const newKeys = Object.keys(safeHistory).sort((a, b) => (safeHistory[b]?.updatedAt || 0) - (safeHistory[a]?.updatedAt || 0));
                setKeys(newKeys);
                setSelectedIndex(prev => Math.max(0, Math.min(newKeys.length - 1, prev)));
            });
        }
    });

    const s = emojiSpace(2);

    const MAX_VISIBLE = 15;
    let startIndex = 0;
    if (keys.length > MAX_VISIBLE) {
        const half = Math.floor(MAX_VISIBLE / 2);
        startIndex = selectedIndex - half;
        if (startIndex < 0) {
            startIndex = 0;
        } else if (startIndex + MAX_VISIBLE > keys.length) {
            startIndex = keys.length - MAX_VISIBLE;
        }
    }
    const visibleKeys = keys.slice(startIndex, startIndex + MAX_VISIBLE);

    return (
        <Box flexDirection="column" borderStyle="round" borderColor={colors.borderMuted} padding={0} width="100%">
            <Box paddingX={1} marginBottom={1}>
                <Text color={colors.text} bold>CHAT HISTORY: RESUME CONVERSATION</Text>
            </Box>

            {keys.length === 0 ? (
                <Box paddingX={2} paddingY={1}>
                    <Text italic color={colors.textMuted}>No saved chats found.</Text>
                </Box>
            ) : (
                <Box flexDirection="column" width="100%">
                    {startIndex > 0 && (
                        <Box paddingX={2} marginBottom={1}>
                            <Text color={colors.textMuted}>▲ (+{startIndex} more chats above)</Text>
                        </Box>
                    )}

                    {visibleKeys.map((id, index) => {
                        const chat = history[id];
                        const actualIndex = startIndex + index;
                        const isSelected = actualIndex === selectedIndex;
                        const dateStr = formatDate(chat?.updatedAt);

                        return (
                            <Box
                                key={id}
                                paddingX={1}
                                backgroundColor={isSelected ? colors.highlightBg : undefined}
                                width="100%"
                            >
                                <Box flexGrow={1}>
                                    <Text color={isSelected ? colors.text : colors.textMuted} bold={isSelected}>
                                        {isSelected ? '❯ ' : '  '}
                                        {(() => {
                                            if (chat?.name && !chat.name.startsWith('Session')) return chat.name;
                                            if (chat?.prompt) return chat.prompt;
                                            return chat?.name || id;
                                        })()}
                                        <Text color={colors.textMuted}> [{dateStr} • {id}]</Text>
                                    </Text>
                                </Box>
                                {isSelected && (
                                    <Box flexShrink={0}>
                                        <Text color={colors.danger} bold>[X] DELETE </Text>
                                    </Box>
                                )}
                            </Box>
                        );
                    })}

                    {startIndex + MAX_VISIBLE < keys.length && (
                        <Box paddingX={2} marginTop={1}>
                            <Text color={colors.textMuted}>▼ (+{keys.length - (startIndex + MAX_VISIBLE)} more chats below)</Text>
                        </Box>
                    )}
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
                <Text color={colors.textMuted} italic>↑↓ navigate • Enter select • x delete • Esc close</Text>
            </Box>
        </Box>
    );
}

function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return 'N/A';
    const pad = (n) => String(n).padStart(2, '0');
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const min = pad(d.getMinutes());
    return `${mm}-${dd} ${hh}:${min}`;
}
