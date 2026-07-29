import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { getThemeColors } from '../utils/theme.js';

export default function ProfileForm({ initialData, onSave, onCancel, theme = 'Dark' }) {
    const colors = getThemeColors(theme);
    const [step, setStep] = useState(0);
    const [currentInput, setCurrentInput] = useState('');
    const [profile, setProfile] = useState(() => ({
        name: initialData?.name || '',
        nickname: initialData?.nickname || '',
        instructions: initialData?.instructions || ''
    }));

    const steps = [
        { key: 'name', label: 'Enter your Name: ', maxLength: 20 },
        { key: 'nickname', label: 'Enter a Nickname: ', maxLength: 20 },
        { key: 'instructions', label: 'System Instructions: ', maxLength: 200 }
    ];

    const currentStep = steps[step];

    useEffect(() => {
        const currentKey = steps[step].key;
        setCurrentInput((profile[currentKey] || '').slice(0, steps[step].maxLength));
    }, [step, profile]);

    const handleInputChange = (val) => {
        if (val.length > currentStep.maxLength) {
            setCurrentInput(val.slice(0, currentStep.maxLength));
        } else {
            setCurrentInput(val);
        }
    };

    const handleSubmit = (val) => {
        if (val.trim().toLowerCase() === '/cancel') {
            onCancel();
            return;
        }

        const currentKey = currentStep.key;
        const newProfile = { ...profile, [currentKey]: val.trim().slice(0, currentStep.maxLength) };
        setProfile(newProfile);
        setCurrentInput('');

        if (step < steps.length - 1) {
            setStep(step + 1);
        } else {
            onSave(newProfile);
        }
    };

    const isAtMax = currentInput.length >= currentStep.maxLength;

    return (
        <Box
            borderStyle="round"
            borderColor={colors.borderMuted}
            padding={0}
            marginTop={1}
            flexShrink={0}
            flexDirection="column"
            width="100%"
        >
            <Box paddingX={1} marginBottom={1}>
                <Text color={colors.text} bold>DEVELOPER PROFILE CONFIGURATION</Text>
            </Box>

            <Box paddingX={1} flexDirection="column">
                <Box>
                    <Text color={colors.text} bold>{currentStep.label}</Text>
                    <TextInput
                        value={currentInput}
                        onChange={handleInputChange}
                        onSubmit={handleSubmit}
                    />
                </Box>

                <Box marginTop={1} justifyContent="space-between">
                    <Text color={colors.textMuted} italic>Step {step + 1} of {steps.length}</Text>
                    <Text color={isAtMax ? (colors.warning || 'yellow') : colors.textMuted}>
                        [{currentInput.length}/{currentStep.maxLength}]
                    </Text>
                </Box>
            </Box>

            <Box paddingX={1} marginTop={1}>
                <Text color={colors.textMuted} italic>(Enter to submit • Type /cancel to abort)</Text>
            </Box>
        </Box>
    );
}
