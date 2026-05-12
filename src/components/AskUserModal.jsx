import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { emojiSpace } from '../utils/terminal.js';

const AskUserModal = ({ question, options, onResolve }) => {
    const [isSuggestingElse, setIsSuggestingElse] = useState(false);
    const [customInput, setCustomInput] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);

    const allOptions = [...options, { id: 'CUSTOM', label: 'Suggest something else...', description: 'Provide a custom response' }];

    useInput((input, key) => {
        if (isSuggestingElse) return;

        if (key.leftArrow || key.upArrow) {
            setSelectedIndex(prev => Math.max(0, prev - 1));
        }
        if (key.rightArrow || key.downArrow) {
            setSelectedIndex(prev => Math.min(allOptions.length - 1, prev + 1));
        }
        if (key.return) {
            const selected = allOptions[selectedIndex];
            if (selected.id === 'CUSTOM') {
                setIsSuggestingElse(true);
            } else {
                onResolve(selected.label);
            }
        }
    });

    const s = emojiSpace(2);

    if (isSuggestingElse) {
        return (
            <Box flexDirection="column" borderStyle="round" borderColor="gray" padding={0} width="100%">
                <Box paddingX={1}>
                    <Text color="cyan" bold>💬{s}SUGGEST SOMETHING ELSE</Text>
                </Box>
                <Box marginTop={1} paddingX={1}>
                    <Text italic color="gray">Replying to: {question}</Text>
                </Box>
                <Box marginTop={1} paddingX={1} flexDirection="row">
                    <Text color="cyan" bold>💠 </Text>
                    <TextInput
                        value={customInput}
                        onChange={setCustomInput}
                        onSubmit={() => onResolve(customInput)}
                    />
                </Box>
                <Box marginTop={1} paddingX={1} marginBottom={1}>
                    <Text color="gray" dimColor italic>(Press Enter to send)</Text>
                </Box>
            </Box>
        );
    }

    return (
        <Box flexDirection="column" borderStyle="round" borderColor="gray" padding={0} width="100%">
            <Box paddingX={1} marginBottom={1}>
                <Text color="cyan" bold>💬AGENT REQUEST: ACTION REQUIRED</Text>
            </Box>

            <Box paddingX={1} marginBottom={1}>
                <Text bold color="white">{question}</Text>
            </Box>

            {/* Vertical Options for better scannability */}
            <Box flexDirection="column" width="100%">
                {allOptions.map((opt, idx) => {
                    const isSelected = idx === selectedIndex;
                    return (
                        <Box
                            key={opt.id}
                            flexDirection="column"
                            width="100%"
                            backgroundColor={isSelected ? "#2a2a2a" : undefined}
                            paddingX={1}
                        >
                            <Text color={isSelected ? 'cyan' : 'white'} bold={isSelected}>
                                {isSelected ? '❯ ' : '  '}{opt.label}
                            </Text>
                            {opt.description && (
                                <Box marginLeft={4}>
                                    <Text color="gray" italic dimColor>{opt.description}</Text>
                                </Box>
                            )}
                        </Box>
                    );
                })}
            </Box>

            <Box paddingX={1} marginTop={1} marginBottom={1}>
                <Text color="gray" dimColor italic>(Use Arrows to navigate, Enter to confirm)</Text>
            </Box>
        </Box>
    );
};

export default AskUserModal;
