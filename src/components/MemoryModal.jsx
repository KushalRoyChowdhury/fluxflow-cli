import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { readEncryptedJson, writeEncryptedJson } from '../utils/crypto.js';
import { MEMORIES_FILE } from '../utils/paths.js';
import { emojiSpace } from '../utils/terminal.js';

export default function MemoryModal({ onClose }) {
    const [memories, setMemories] = useState([]);
    const [selectedIndex, setSelectedIndex] = useState(0);

    const loadMemories = () => {
        const data = readEncryptedJson(MEMORIES_FILE, []);
        setMemories(data);
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

    const cleanDisplay = (text) => {
        return text.replace(/\[Saved on: .*?\]/g, '').trim();
    };

    const s = emojiSpace(2);

    return (
        <Box flexDirection="column" borderStyle="round" borderColor="gray" padding={0} width={80}>
            <Box paddingX={1} marginBottom={1}>
                <Text color="cyan" bold>🧠 AGENT MEMORY: LONG-TERM KNOWLEDGE</Text>
            </Box>

            {memories.length === 0 ? (
                <Box paddingX={2} paddingY={1}>
                    <Text italic color="gray">Still Learning...</Text>
                </Box>
            ) : (
                <Box flexDirection="column">
                    {memories.map((mem, idx) => {
                        const isSelected = idx === selectedIndex;
                        return (
                            <Box
                                key={mem.id}
                                paddingX={1}
                                backgroundColor={isSelected ? "#2a2a2a" : undefined}
                                width="100%"
                            >
                                <Box flexGrow={1}>
                                    <Text color={isSelected ? 'cyan' : 'white'} bold={isSelected}>
                                        {isSelected ? '❯ ' : '  '}{idx + 1}. {cleanDisplay(mem.memory)}
                                    </Text>
                                </Box>
                                {isSelected && (
                                    <Box flexShrink={0}>
                                        <Text color="red" bold>[X] WIPE </Text>
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
                <Text dimColor italic>↑↓ navigate • x wipe memory • Esc close</Text>
            </Box>
        </Box>
    );
}
