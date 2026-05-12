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
        if (val.trim().toLowerCase() === '/cancel') {
            onCancel();
            return;
        }
        
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
        <Box 
            borderStyle="round" 
            borderColor="gray" 
            padding={0} 
            marginTop={1} 
            flexShrink={0} 
            flexDirection="column"
            width="100%"
        >
            <Box paddingX={1} marginBottom={1}>
                <Text color="magenta" bold>👤 DEVELOPER PROFILE CONFIGURATION</Text>
            </Box>

            <Box paddingX={1} flexDirection="column">
                <Box>
                    <Text color="cyan" bold>{steps[step].label}</Text>
                    <TextInput
                        value={currentInput}
                        onChange={setCurrentInput}
                        onSubmit={handleSubmit}
                    />
                </Box>
                
                <Box marginTop={1}>
                    <Text color="gray" dimColor italic>Step {step + 1} of {steps.length}</Text>
                </Box>
            </Box>

            <Box paddingX={1} marginTop={1}>
                <Text color="gray" dimColor italic>(Enter to submit • Type /cancel to abort)</Text>
            </Box>
        </Box>
    );
}
