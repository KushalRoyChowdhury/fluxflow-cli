import React, { useState, useMemo, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
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

export default function CommandMenu({ title, subtitle, items = [], onSelect, theme = 'Dark', searchable = false }) {
    const colors = getThemeColors(theme);
    const [query, setQuery] = useState('');
    const [cursor, setCursor] = useState(0);
    const [mode, setMode] = useState('list'); // 'list' or 'search'

    const filteredItems = useMemo(() => {
        if (!searchable || !query.trim()) return items;
        const q = query.toLowerCase().trim();
        return items.filter(it => it.label && it.label.toLowerCase().includes(q));
    }, [items, query, searchable]);

    useEffect(() => {
        setCursor(0);
    }, [query]);

    useInput((input, key) => {
        if (!searchable) return;

        if (key.upArrow) {
            setMode('list');
            setCursor(prev => (filteredItems.length > 0 ? (prev > 0 ? prev - 1 : filteredItems.length - 1) : 0));
            return;
        }

        if (key.downArrow) {
            setMode('list');
            setCursor(prev => (filteredItems.length > 0 ? (prev < filteredItems.length - 1 ? prev + 1 : 0) : 0));
            return;
        }

        if (key.return) {
            if (filteredItems.length > 0 && filteredItems[cursor]) {
                onSelect(filteredItems[cursor]);
            }
            return;
        }

        if (key.escape) {
            if (query) {
                setQuery('');
                setMode('list');
                setCursor(0);
            } else {
                const backItem = items.find(it => it.value === 'Back' || it.label === 'Back' || it.value === 'Cancel' || it.label === 'Cancel');
                if (backItem) onSelect(backItem);
            }
            return;
        }

        if (key.backspace || key.delete) {
            setMode('search');
            setQuery(prev => prev.slice(0, -1));
            return;
        }

        if (input && !key.ctrl && !key.meta && !key.tab) {
            setMode('search');
            setQuery(prev => prev + input);
            return;
        }
    }, { isActive: searchable });

    if (!searchable) {
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
            {title && (
                <Box paddingX={1} paddingY={0} marginBottom={subtitle ? 0 : 0}>
                    <Text color={colors.text} bold>{typeof title === 'string' ? title.toUpperCase() : title}</Text>
                </Box>
            )}

            {subtitle && (
                <Box paddingX={1} marginBottom={0}>
                    <Text color={colors.textMuted} italic>   {subtitle}</Text>
                </Box>
            )}

            <Box paddingX={1} marginTop={1} marginBottom={1} flexDirection="row">
                <Text color={mode === 'search' ? (colors.primary || "cyan") : colors.textMuted} bold={mode === 'search'}>
                    🔍 Search: 
                </Text>
                <Text color={colors.text} bold>
                    {' '}{query}
                </Text>
                {mode === 'search' ? (
                    <Text color={colors.primary || "cyan"}>█</Text>
                ) : (
                    !query ? <Text color={colors.textMuted} italic> (type to search...)</Text> : null
                )}
            </Box>

            <Box flexDirection="column" width="100%">
                {filteredItems.length === 0 ? (
                    <Box paddingX={1} marginY={0}>
                        <Text color={colors.warning || "yellow"} italic>   No matching items found</Text>
                    </Box>
                ) : (
                    filteredItems.map((item, index) => {
                        const isSelected = index === cursor;
                        const isCancel = item.label === 'Cancel' || item.label === 'Back' || item.label.toLowerCase().includes('exit') || item.label.toLowerCase().includes('back');
                        return (
                            <Box
                                key={item.value ?? item.label ?? index}
                                marginTop={isCancel ? 1 : 0}
                                backgroundColor={isSelected ? colors.highlightBg : undefined}
                                paddingX={1}
                                width="100%"
                            >
                                <Text color={isSelected ? colors.text : colors.textMuted} bold={isSelected}>
                                    {isSelected ? '❯ ' : '  '}{item.label}
                                </Text>
                            </Box>
                        );
                    })
                )}
            </Box>

            <Box paddingX={1} marginTop={1}>
                <Text color={colors.textMuted} italic>
                    {mode === 'search'
                        ? '(Type letters to search • Arrows for list mode • Enter to select)'
                        : '(Arrows to navigate • Type letters to search • Enter to select)'}
                </Text>
            </Box>
        </Box>
    );
}

