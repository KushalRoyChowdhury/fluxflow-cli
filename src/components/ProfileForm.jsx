import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

export default function ProfileForm({ onSave, onCancel }) {
    const [step, setStep] = useState(0);
    const [currentInput, setCurrentInput] = useState('');
    const [profile, setProfile] = useState({ name: '', nickname: '', instructions: '' });

    const steps = [
        { key: 'name', label: 'Enter your Name: ' },
        { key: 'nickname', label: 'Enter a Nickname (Agent will use this): ' },
        { key: 'instructions', label: 'System Instructions (Persona overrides): ' }
    ];

    const handleSubmit = (val) => {
        const currentKey = steps[step].key;
        const newProfile = { ...profile, [currentKey]: val.trim() };
        setProfile(newProfile);
        setCurrentInput('');

        if (step < steps.length - 1) {
            setStep(step + 1);
        } else {
            onSave(newProfile);
        }
    };

    return (
        <Box borderStyle="round" borderColor="magenta" padding={1} marginTop={1} flexShrink={0} flexDirection="column">
            <Text color="magenta" bold>👤 Edit Profile Configuration</Text>
            <Box marginTop={1}>
                <Text color="cyan">{steps[step].label}</Text>
                <TextInput
                    value={currentInput}
                    onChange={setCurrentInput}
                    onSubmit={handleSubmit}
                />
            </Box>
            <Text color="gray" dimColor marginTop={1}>(Press Enter to submit, type /cancel to abort)</Text>
        </Box>
    );
}
