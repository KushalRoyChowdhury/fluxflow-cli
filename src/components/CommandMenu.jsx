import React from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';

const CustomItem = ({ label, isSelected }) => {
    const isCancel = label === 'Cancel' || label === 'Back' || label.toLowerCase().includes('exit') || label.toLowerCase().includes('back');

    return (
        <Box
            marginTop={isCancel ? 1 : 0}
            backgroundColor={isSelected ? "#2a2a2a" : undefined}
            paddingX={1}
            width="100%"
        >
            <Text color={isSelected ? 'cyan' : 'white'} bold={isSelected}>
                {isSelected ? '❯ ' : '  '}{label}
            </Text>
        </Box>
    );
};

export default function CommandMenu({ title, subtitle, items, onSelect }) {
    return (
        <Box
            flexDirection="column"
            borderStyle="round"
            borderColor="gray"
            padding={0}
            marginTop={1}
            flexShrink={0}
            width="100%"
        >
            <Box paddingX={1} paddingY={0} marginBottom={subtitle ? 0 : 1}>
                <Text color="magenta" bold>🔧 {title.toUpperCase()}</Text>
            </Box>

            {subtitle && (
                <Box paddingX={1} marginBottom={1}>
                    <Text color="yellow" dimColor italic>   {subtitle}</Text>
                </Box>
            )}

            <Box flexDirection="column" width="100%">
                <SelectInput
                    items={items}
                    onSelect={onSelect}
                    itemComponent={CustomItem}
                    indicatorComponent={() => null}
                />
            </Box>

            <Box paddingX={1} marginTop={1}>
                <Text color="gray" dimColor italic>(Arrows to select • Enter to confirm)</Text>
            </Box>
        </Box>
    );
}
