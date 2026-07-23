import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { emojiSpace } from '../utils/terminal.js';
import { getThemeColors } from '../utils/theme.js';

const AskUserModal = ({ question, options, onResolve, theme = 'Dark' }) => {
    const colors = getThemeColors(theme);
    const [isSuggestingElse, setIsSuggestingElse] = useState(false);
    const [customInput, setCustomInput] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    let canceled = false;
    let allOptions = [];

    try {
        allOptions = [...options, { id: 'CUSTOM', label: 'Suggest something else...', description: 'Provide a custom response' }];
    } catch (e) {
        canceled = true;
    }

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
            if (selected?.id === 'CUSTOM') {
                setIsSuggestingElse(true);
            } else {
                if (canceled) onResolve('Selected Nothing');
                else onResolve(selected.label);
            }
        }
    });

    const s = emojiSpace(2);

    if (isSuggestingElse) {
        return (
            <Box
                flexDirection="column"
                borderStyle="single"
                borderLeft={true}
                borderRight={false}
                borderTop={false}
                borderBottom={false}
                borderColor={colors.codeBorder}
                paddingLeft={2}
                paddingRight={0}
                paddingTop={1}
                paddingBottom={1}
                backgroundColor={colors.codeBg}
                width="100%"
            >
                <Box paddingX={1}>
                    <Text color={colors.text} bold>SUGGEST SOMETHING ELSE</Text>
                </Box>
                <Box marginTop={1} paddingX={1}>
                    <Text italic color={colors.textMuted}>Replying to: {question}</Text>
                </Box>
                <Box marginTop={1} paddingX={1} flexDirection="row">
                    <TextInput
                        value={customInput}
                        onChange={setCustomInput}
                        onSubmit={() => onResolve(customInput)}
                    />
                </Box>
                <Box marginTop={1} paddingX={1} marginBottom={1}>
                    <Text color={colors.textMuted} italic>(Press Enter to send)</Text>
                </Box>
            </Box>
        );
    }

    return (
        <Box
            flexDirection="column"
            border={true}
            borderStyle={'round'}
            borderColor={colors.codeBorder}
            paddingLeft={2}
            paddingRight={0}
            paddingTop={1}
            paddingBottom={1}
            marginY={1}
            marginRight={1}
            width="100%"
        >
            <Box paddingX={1} marginBottom={1}>
                <Text color="yellow" bold>AGENT REQUEST: ACTION REQUIRED</Text>
            </Box>

            <Box paddingX={1} marginBottom={1}>
                <Text color={colors.text}>{question}</Text>
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
                            backgroundColor={isSelected ? colors.highlightBg : undefined}
                            paddingX={1}
                            marginBottom={idx === allOptions.length - 1 ? 0 : 1}
                        >
                            <Text color={isSelected ? colors.text : colors.textMuted} bold={isSelected}>
                                {isSelected ? '❯ ' : '  '}{opt.label}
                            </Text>
                            {opt.description && (
                                <Box marginLeft={4}>
                                    <Text color={colors.textMuted} italic>{opt.description}</Text>
                                </Box>
                            )}
                        </Box>
                    );
                })}
            </Box>

            <Box paddingX={1} marginTop={1} marginBottom={1}>
                <Text color={colors.textMuted} italic>(Use Arrows to navigate, Enter to confirm)</Text>
            </Box>
        </Box>
    );
};

export default AskUserModal;
