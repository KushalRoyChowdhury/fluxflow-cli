import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { loadHistory } from '../utils/history.js';

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

    return (
        <Box flexDirection="column" borderStyle="double" borderColor="cyan" padding={1} width={80}>
            <Box justifyContent="center" marginBottom={1}>
                <Text bold color="cyan"> 📂 RESUME SESSION </Text>
            </Box>
            
            {keys.length === 0 ? (
                <Text italic color="gray"> No saved chats found. </Text>
            ) : (
                keys.map((id, index) => {
                    const chat = history[id];
                    const isSelected = index === selectedIndex;
                    return (
                        <Box key={id} paddingX={1}>
                            <Text color={isSelected ? 'cyan' : 'white'}>
                                {isSelected ? '❯ ' : '  '}
                                <Text bold={isSelected}>{chat.name || id}</Text>
                                <Text color="gray"> [{id.slice(5)}]</Text>
                            </Text>
                            {isSelected && (
                                <Box marginLeft="auto">
                                    <Text color="red"> (x to delete) </Text>
                                </Box>
                            )}
                        </Box>
                    );
                })
            )}

            <Box marginTop={1} justifyContent="center" borderStyle="single" borderColor="gray">
                <Text dimColor> ↑↓ navigate • Enter select • x delete • Esc close </Text>
            </Box>
        </Box>
    );
}
