import React from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';

const CustomItem = ({ label, isSelected }) => {
    const isCancel = label === 'Cancel' || label.toLowerCase().includes('exit');
    return (
        <Box marginTop={isCancel ? 1 : 0}>
            <Text color={isSelected ? 'cyan' : 'white'}>
                {isSelected ? '❯ ' : '  '}{label}
            </Text>
        </Box>
    );
};

export default function CommandMenu({ title, items, onSelect }) {
    return (
        <Box flexDirection="column" borderStyle="round" borderColor="magenta" padding={1} marginTop={1} flexShrink={0}>
            <Text color="magenta" bold>{title}</Text>
            <Box marginTop={1} flexDirection="column">
                <SelectInput 
                    items={items} 
                    onSelect={onSelect} 
                    itemComponent={CustomItem}
                    indicatorComponent={() => null}
                />
            </Box>
            <Text color="gray" dimColor marginTop={1}>(Use Up/Down arrows to select, Enter to confirm)</Text>
        </Box>
    );
}
