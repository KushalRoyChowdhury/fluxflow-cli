import React from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import { getThemeColors } from '../utils/theme.js';

const CustomItem = ({ label, isSelected, theme = 'Dark' }) => {
    const colors = getThemeColors(theme);
    const isCancel = label === 'Cancel' || label === 'Back' || label.toLowerCase().includes('exit') || label.toLowerCase().includes('back');

    return (
        <Box
            marginTop={isCancel ? 1 : 0}
            backgroundColor={isSelected ? colors.highlightBg : undefined}
            paddingX={1}
            width="100%"
        >
            <Text color={isSelected ? colors.text : colors.textMuted} bold={isSelected}>
                {isSelected ? '❯ ' : '  '}{label}
            </Text>
        </Box>
    );
};

export default function CommandMenu({ title, subtitle, items, onSelect, theme = 'Dark' }) {
    const colors = getThemeColors(theme);

    return (
        <Box
            flexDirection="column"
            borderStyle="round"
            borderColor={colors.borderMuted}
            padding={0}
            marginTop={0}
            flexShrink={0}
            width="100%"
        >
            {title && <Box paddingX={1} paddingY={0} marginBottom={subtitle ? 0 : 1}>
                <Text color={colors.text} bold>{typeof title === 'string' ? title.toUpperCase() : title}</Text>
            </Box>}

            {subtitle && (
                <Box paddingX={1} marginBottom={1}>
                    <Text color={colors.textMuted} italic>   {subtitle}</Text>
                </Box>
            )}

            <Box flexDirection="column" width="100%">
                <SelectInput
                    items={items}
                    onSelect={onSelect}
                    itemComponent={(props) => <CustomItem {...props} theme={theme} />}
                    indicatorComponent={() => null}
                />
            </Box>

            <Box paddingX={1} marginTop={1}>
                <Text color={colors.textMuted} italic>(Arrows to select • Enter to confirm)</Text>
            </Box>
        </Box>
    );
}
