import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { readEncryptedJson, writeEncryptedJson } from '../utils/crypto.js';
import path from 'path';

const MEMORIES_PATH = path.join(process.cwd(), 'secret', 'memories.json');

export default function MemoryModal({ onClose }) {
    const [memories, setMemories] = useState([]);
    const [selectedIndex, setSelectedIndex] = useState(0);

    const loadMemories = () => {
        const data = readEncryptedJson(MEMORIES_PATH, []);
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
            writeEncryptedJson(MEMORIES_PATH, updated);
            setMemories(updated);
            if (selectedIndex >= updated.length && updated.length > 0) {
                setSelectedIndex(updated.length - 1);
            }
        }
    });

    const cleanDisplay = (text) => {
        return text.replace(/\[Saved on: .*?\]/g, '').trim();
    };

    return (
        <Box flexDirection="column" borderStyle="double" borderColor="yellow" padding={1} width={80}>
            <Box justifyContent="center" marginBottom={1}>
                <Text bold color="yellow">🧠 LONG-TERM MEMORY VAULT</Text>
            </Box>

            {memories.length === 0 ? (
                <Box justifyContent="center" paddingY={2}>
                    <Text italic color="gray">The vault is currently empty...</Text>
                </Box>
            ) : (
                memories.map((mem, idx) => (
                    <Box key={mem.id} paddingX={1} backgroundColor={idx === selectedIndex ? '#333' : undefined}>
                        <Text color={idx === selectedIndex ? 'yellow' : 'white'}>
                            {idx === selectedIndex ? '❯ ' : '  '}
                            {idx + 1}. {cleanDisplay(mem.memory)}
                        </Text>
                    </Box>
                ))
            )}

            <Box marginTop={1} borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false} paddingTop={1}>
                <Text color="gray">
                    ↑/↓ Navigate • <Text color="red">x</Text> Delete Memory • <Text color="cyan">Esc</Text> Back to Chat
                </Text>
            </Box>
        </Box>
    );
}
