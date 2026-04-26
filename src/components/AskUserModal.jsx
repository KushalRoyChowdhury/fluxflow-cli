import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';

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

    if (isSuggestingElse) {
        return (
            <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={2} paddingY={1} width="100%">
                <Text color="cyan" bold underline>💬 SUGGEST SOMETHING ELSE</Text>
                <Box marginTop={1}>
                    <Text italic color="gray">Replying to: {question}</Text>
                </Box>
                <Box marginTop={1} flexDirection="row">
                    <Text color="yellow">❯ </Text>
                    <TextInput
                        value={customInput}
                        onChange={setCustomInput}
                        onSubmit={() => onResolve(customInput)}
                    />
                </Box>
                <Box marginTop={1}>
                    <Text color="gray" dimColor italic>(Press Enter to send)</Text>
                </Box>
            </Box>
        );
    }

    return (
        <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={2} paddingY={1} width="100%">
            <Text color="cyan" bold underline>💬 ASK USER</Text>

            <Box marginTop={1} marginBottom={1}>
                <Text bold>{question}</Text>
            </Box>

            {/* Horizontal Options */}
            <Box flexDirection="row" flexWrap="wrap" width="100%">
                {options.map((opt, idx) => {
                    const isSelected = idx === selectedIndex;
                    return (
                        <Box key={opt.id} flexDirection="column" marginRight={4} marginBottom={1} width={30}>
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

            <Box marginTop={1}>
                <Text color={selectedIndex === options.length ? 'cyan' : 'white'} bold={selectedIndex === options.length}>
                    {selectedIndex === options.length ? '❯ ' : '  '}Suggest something else...
                </Text>
            </Box>

            <Box marginTop={1}>
                <Text color="gray" dimColor italic>(Use Arrows to navigate, Enter to confirm)</Text>
            </Box>
        </Box>
    );
};

export default AskUserModal;
