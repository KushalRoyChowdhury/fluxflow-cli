import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { emojiSpace } from '../utils/terminal.js';
import { downloadWasm, isParserInstalled, deleteParser } from '../utils/parsers.js';

const EXTENSIONS = [
  { label: 'JavaScript', file: 'tree-sitter-javascript.wasm', exts: ['js', 'jsx'] },
  { label: 'TypeScript', file: 'tree-sitter-typescript.wasm', exts: ['ts'] },
  { label: 'TSX', file: 'tree-sitter-tsx.wasm', exts: ['tsx'] },
  { label: 'Python', file: 'tree-sitter-python.wasm', exts: ['py'] },
  { label: 'C', file: 'tree-sitter-c.wasm', exts: ['c'] },
  { label: 'C++', file: 'tree-sitter-cpp.wasm', exts: ['cpp'] },
  { label: 'Java', file: 'tree-sitter-java.wasm', exts: ['java'] },
  { label: 'HTML', file: 'tree-sitter-html.wasm', exts: ['html'] }
];

export default function ParserDownloadModal({ onClose }) {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [status, setStatus] = useState({}); // { [file]: 'idle' | 'downloading' | 'ready' | 'error' }

    useEffect(() => {
        const initialStatus = {};
        EXTENSIONS.forEach(item => {
            if (isParserInstalled(item.file)) {
                initialStatus[item.file] = 'ready';
            } else {
                initialStatus[item.file] = 'idle';
            }
        });
        setStatus(initialStatus);
    }, []);

    useInput(async (input, key) => {
        if (key.escape) onClose();
        if (key.upArrow) setSelectedIndex(prev => Math.max(0, prev - 1));
        if (key.downArrow) setSelectedIndex(prev => Math.min(EXTENSIONS.length - 1, prev + 1));

        const item = EXTENSIONS[selectedIndex];

        if (input === 'x' || input === 'X') {
            if (status[item.file] === 'downloading') return;
            try {
                await deleteParser(item.file);
                setStatus(prev => ({ ...prev, [item.file]: 'idle' }));
            } catch (err) {
                setStatus(prev => ({ ...prev, [item.file]: `error: ${err.message}` }));
            }
        }

        if (key.return) {
            if (status[item.file] === 'downloading') return;

            setStatus(prev => ({ ...prev, [item.file]: 'downloading' }));

            try {
                await downloadWasm(item.file);
                setStatus(prev => ({ ...prev, [item.file]: 'ready' }));
            } catch (err) {
                setStatus(prev => ({ ...prev, [item.file]: `error: ${err.message}` }));
            }
        }
    });

    return (
        <Box flexDirection="column" borderStyle="round" borderColor="gray" padding={0} width="100%">
            <Box paddingX={1} marginBottom={1}>
                <Text color="white" bold>LANGUAGE PARSER MANAGER</Text>
            </Box>

            <Box flexDirection="column">
                {EXTENSIONS.map((item, idx) => {
                    const isSelected = idx === selectedIndex;
                    const itemStatus = status[item.file] || 'idle';

                    let statusText = '[ DOWNLOAD ]';
                    let statusColor = 'gray';

                    if (itemStatus === 'downloading') {
                        statusText = '[ DOWNLOADING... ]';
                        statusColor = 'yellow';
                    } else if (itemStatus === 'ready') {
                        statusText = '[ READY ]';
                        statusColor = 'green';
                    } else if (itemStatus.startsWith('error')) {
                        statusText = `[ ${itemStatus.toUpperCase()} ]`;
                        statusColor = 'red';
                    }

                    const labelText = `${item.label} (${item.exts.join(', ')})`;
                    const dotsCount = Math.max(2, 45 - labelText.length);
                    const dots = '.'.repeat(dotsCount);

                    return (
                        <Box
                            key={item.file}
                            paddingX={1}
                            backgroundColor={isSelected ? "#2a2a2a" : undefined}
                            width="100%"
                        >
                            <Box>
                                <Text color={isSelected ? 'white' : 'grey'} bold={isSelected}>
                                    {isSelected ? '❯ ' : '  '}{item.label} <Text dimColor>({item.exts.join(', ')})</Text>
                                </Text>
                            </Box>
                            <Box flexGrow={1}>
                                <Text color="gray" dimColor>{dots}</Text>
                            </Box>
                            <Box width={20}>
                                <Text color={statusColor} bold>{statusText}</Text>
                            </Box>
                        </Box>
                    );
                })}
            </Box>

            <Box
                marginTop={1}
                paddingX={1}
                borderStyle="single"
                borderLeft={false}
                borderRight={false}
                borderBottom={false}
                borderColor="gray"
            >
                <Text color="grey" italic>↑↓ navigate • Enter download • x delete • Esc close</Text>
            </Box>
        </Box>
    );
}
