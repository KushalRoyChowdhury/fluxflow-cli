import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { loadHistory } from '../utils/history.js';
import { emojiSpace } from '../utils/terminal.js';

export default function ResumeModal({ onSelect, onDelete, onClose }) {
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

    return (
        <Box flexDirection="column" borderStyle="round" borderColor="gray" padding={0} width={80}>
            <Box paddingX={1} marginBottom={1}>
                <Text color="cyan" bold>💠 CHAT HISTORY: RESUME CONVERSATION</Text>
            </Box>

            {keys.length === 0 ? (
                <Box paddingX={2} paddingY={1}>
                    <Text italic color="gray">No saved chats found.</Text>
                </Box>
            ) : (
                <Box flexDirection="column">
                    {keys.map((id, index) => {
                        const chat = history[id];
                        const isSelected = index === selectedIndex;
                        return (
                            <Box
                                key={id}
                                paddingX={1}
                                backgroundColor={isSelected ? "#2a2a2a" : undefined}
                                width="100%"
                            >
                                <Box flexGrow={1}>
                                    <Text color={isSelected ? 'cyan' : 'white'} bold={isSelected}>
                                        {isSelected ? '❯ ' : '  '}{chat.name || id}
                                        <Text color="gray" dimColor={!isSelected}> [{id.slice(5)}]</Text>
                                    </Text>
                                </Box>
                                {isSelected && (
                                    <Box flexShrink={0}>
                                        <Text color="red" bold>[X] DELETE </Text>
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
                borderColor="gray"
            >
                <Text dimColor italic>↑↓ navigate • Enter select • x delete • Esc close</Text>
            </Box>
        </Box>
    );
}
