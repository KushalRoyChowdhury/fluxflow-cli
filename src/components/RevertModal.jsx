import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { emojiSpace } from '../utils/terminal.js';

export default function RevertModal({ prompts, onSelect, onClose }) {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useInput((input, key) => {
        if (key.escape) onClose();
        if (key.upArrow) setSelectedIndex(prev => Math.max(0, prev - 1));
        if (key.downArrow) setSelectedIndex(prev => Math.min(prompts.length - 1, prev + 1));
        if (key.return && prompts[selectedIndex]) onSelect(prompts[selectedIndex].id);
    });

    const s = emojiSpace(2);

    const MAX_VISIBLE = 10;
    let startIndex = 0;
    if (prompts.length > MAX_VISIBLE) {
        const half = Math.floor(MAX_VISIBLE / 2);
        startIndex = selectedIndex - half;
        if (startIndex < 0) {
            startIndex = 0;
        } else if (startIndex + MAX_VISIBLE > prompts.length) {
            startIndex = prompts.length - MAX_VISIBLE;
        }
    }
    const visiblePrompts = prompts.slice(startIndex, startIndex + MAX_VISIBLE);

    return (
        <Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={0} width={95}>
            <Box paddingX={1} marginBottom={1}>
                <Text color="cyan" bold>🔄 CODEBASE TIME TRAVEL: SELECT UNDO POINT</Text>
            </Box>

            <Box paddingX={2} marginBottom={1}>
                <Text>Select a prompt to revert the codebase back to the state <Text bold color="blue">immediately before</Text> it was executed:</Text>
            </Box>

            {prompts.length === 0 ? (
                <Box paddingX={2} paddingY={1}>
                    <Text italic color="gray">No prompt checkpoints found for this session.</Text>
                </Box>
            ) : (
                <Box flexDirection="column" width="100%">
                    {startIndex > 0 && (
                        <Box paddingX={2} marginBottom={1}>
                            <Text color="gray" dimColor>▲ (+{startIndex} more prompts above)</Text>
                        </Box>
                    )}

                    {visiblePrompts.map((p, index) => {
                        const actualIndex = startIndex + index;
                        const isSelected = actualIndex === selectedIndex;
                        const dateStr = formatDate(p.timestamp);
                        const fileCount = p.changes ? p.changes.length : 0;

                        return (
                            <Box
                                key={p.id}
                                paddingX={1}
                                backgroundColor={isSelected ? "#1a2a3a" : undefined}
                                width="100%"
                            >
                                <Box flexGrow={1}>
                                    <Text color={isSelected ? 'cyan' : 'white'} bold={isSelected}>
                                        {isSelected ? '❯ ' : '  '}
                                        "{formatPromptPreview(p.prompt)}"
                                        <Text color="gray" dimColor={!isSelected}> [{dateStr} • {fileCount} file(s) changed]</Text>
                                    </Text>
                                </Box>
                            </Box>
                        );
                    })}

                    {startIndex + MAX_VISIBLE < prompts.length && (
                        <Box paddingX={2} marginTop={1}>
                            <Text color="gray" dimColor>▼ (+{prompts.length - (startIndex + MAX_VISIBLE)} more prompts below)</Text>
                        </Box>
                    )}
                </Box>
            )}

            <Box
                marginTop={1}
                paddingX={1}
                borderStyle="single"
                borderLeft={false}
                borderRight={false}
                borderBottom={false}
                borderColor="cyan"
            >
                <Text dimColor italic>↑↓ navigate • Enter select undo point • Esc close</Text>
            </Box>
        </Box>
    );
}

function formatPromptPreview(prompt) {
    if (!prompt) return '';
    const firstLine = prompt.split('\n')[0] || '';
    const words = firstLine.split(/\s+/).filter(Boolean);
    if (words.length > 50) {
        return words.slice(0, 50).join(' ') + '...';
    }
    if (prompt.includes('\n')) {
        return firstLine + '...';
    }
    return firstLine;
}

function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return 'N/A';
    const pad = (n) => String(n).padStart(2, '0');
    const hh = pad(d.getHours());
    const min = pad(d.getMinutes());
    const sec = pad(d.getSeconds());
    return `${hh}:${min}:${sec}`;
}
