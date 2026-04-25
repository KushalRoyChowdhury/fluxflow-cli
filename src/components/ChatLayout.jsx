import React from 'react';
import { Box, Text } from 'ink';
import { TerminalBox } from './TerminalBox.jsx';

const cleanSignals = (text) => {
    if (!text) return text;
    
    const parts = [];
    let i = 0;
    while (i < text.length) {
        const trigger = 'tool:functions.';
        if (text.substring(i, i + trigger.length).toLowerCase() === trigger) {
             let balance = 0;
             let foundStart = false;
             let j = i;
             
             // Seek forward to balance original brackets
             while (j < text.length) {
                 if (text[j] === '(') {
                     balance++;
                     foundStart = true;
                 } else if (text[j] === ')') {
                     balance--;
                 }
                 j++;
                 if (foundStart && balance === 0) break;
             }
             i = j; // Skip the tool call
        } else {
             parts.push(text[i]);
             i++;
        }
    }

    // Secondary cleanup for protocol signals
    return parts.join('')
        .replace(/^\[TOOL_RESULT\]:\s*/gi, '')
        .split('\n')
        .filter(line => !line.trim().startsWith('SUCCESS:') && !line.trim().startsWith('ERROR:'))
        .join('\n')
        .replace(/\[\s*(turn\s*:)?\s*(continue|finish)\s*\]/gi, '')
        .replace(/\n\s*turn\s*:\s*(continue|finish)\s*$/gi, '')
        .replace(/\n\nResponded on .*/g, '')
        .replace(/\n\n\[Prompted on: .*\]/g, '')
        .replace(/(\$?\\?\/?\\rightarrow\$?|\$\\rightarrow\$)/gi, '→')
        .trim();
};

const formatThinkText = (cleaned) => {
    if (!cleaned) return null;
    const lines = cleaned.split('\n').filter(l => l.trim() !== '');

    return lines.map((line, i) => {
        const trimmed = line.trim();

        // Headings (Bold white)
        if ((trimmed.startsWith('**') && trimmed.endsWith('**')) || trimmed.startsWith('#')) {
            return (
                <Box key={i} marginTop={i === 0 ? 0 : 1} marginBottom={0} width="100%">
                    <Text bold color="white">{trimmed.replace(/\*|#/g, '').trim()}</Text>
                </Box>
            );
        }

        // Steps (Bullet + Italics gray)
        const isBullet = trimmed.startsWith('*');
        return (
            <Box key={i} marginLeft={isBullet ? 2 : 0} width="100%">
                <Text italic color="gray" wrap="anywhere">{isBullet ? '• ' : ''}{trimmed.replace(/^\*|\s\*/g, '').trim()}</Text>
            </Box>
        );
    });
};

const MarkdownText = React.memo(({ text, color = 'white' }) => {
    if (!text) return null;

    const lines = text.split('\n');
    return (
        <Box flexDirection="column" width="100%">
            {lines.map((line, i) => {
                const trimmed = line.trim();

                // Horizontal Rule
                if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
                    return <Box key={i} marginY={1} borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false} width="100%" borderColor="#333" />;
                }

                // Headings
                const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)/);
                if (headingMatch) {
                    const level = headingMatch[1].length;
                    const hText = headingMatch[2];
                    return (
                        <Box key={i} marginTop={1} marginBottom={0} width="100%">
                            <Text bold color={level === 1 ? 'cyan' : level === 2 ? 'magenta' : 'yellow'} underline>
                                {hText.toUpperCase()}
                            </Text>
                        </Box>
                    );
                }

                const isUnordered = trimmed.startsWith('* ') || trimmed.startsWith('- ');
                const isOrdered = /^\d+\.\s/.test(trimmed);

                let content = trimmed;
                if (isUnordered || isOrdered) {
                    content = (isUnordered ? '  • ' : '') + trimmed.replace(/^[\*\-\d+\.]+\s/, '');
                }

                // Split by Bold, Italic, and Inline Code
                const parts = content.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);

                return (
                    <Box key={i} width="100%">
                        <Text color={color} wrap="anywhere">
                            {parts.map((part, j) => {
                                if (part.startsWith('**') && part.endsWith('**')) {
                                    return <Text key={j} bold color="white">{part.slice(2, -2)}</Text>;
                                }
                                if (part.startsWith('*') && part.endsWith('*')) {
                                    return <Text key={j} italic color="gray">{part.slice(1, -1)}</Text>;
                                }
                                if (part.startsWith('`') && part.endsWith('`')) {
                                    return <Text key={j} color="cyan" backgroundColor="#003333"> {part.slice(1, -1)} </Text>;
                                }
                                return part;
                            })}
                        </Text>
                    </Box>
                );
            })}
        </Box>
    );
});

const DiffLine = React.memo(({ line }) => {
    const isContext = line.includes('[UI_CONTEXT]');
    const cleanLine = line.replace('[UI_CONTEXT]', '');
    const isRemoval = cleanLine.startsWith('-');
    const isAddition = cleanLine.startsWith('+');
    const parts = cleanLine.substring(1).split('|');
    const lineNum = parts[0]?.trim() || '';
    const content = parts.slice(1).join('|');

    const bgColor = isRemoval ? '#3a0c0c' : isAddition ? '#0c3a1a' : '#1a1a1a';
    const textColor = isRemoval ? '#ff4d4d' : isAddition ? '#4dff88' : 'white';

    return (
        <Box backgroundColor={bgColor} paddingX={1} width="100%">
            <Box width={5} flexShrink={0}>
                <Text color={isRemoval ? '#cf3a3a' : isAddition ? '#3acf65' : 'gray'} dimColor>{lineNum}</Text>
            </Box>
            <Box width={2} flexShrink={0} marginLeft={1}>
                <Text color={textColor} bold>{isRemoval ? '-' : isAddition ? '+' : ' '}</Text>
            </Box>
            <Box flexGrow={1} marginLeft={1}>
                <Text color={textColor} wrap="anywhere">{content}</Text>
            </Box>
        </Box>
    );
});

const DiffBlock = React.memo(({ text }) => {
    const beforeDiff = text.substring(0, text.indexOf('[DIFF_START]')).trim();
    const afterDiff = text.substring(text.indexOf('[DIFF_END]') + 10).trim();
    const match = text.match(/\[DIFF_START\]([\s\S]*?)\[DIFF_END\]/);
    const diffBody = match ? match[1].trim() : '';
    const diffLines = diffBody.split('\n');

    return (
        <Box flexDirection="column" width="100%">
            {beforeDiff && <MarkdownText text={beforeDiff} />}
            <Box flexDirection="column" marginTop={1} backgroundColor="#1a1a1a" paddingY={0} width="100%">
                {diffLines.map((line, i) => (
                    <DiffLine key={i} line={line} />
                ))}
            </Box>
            {afterDiff && <MarkdownText text={afterDiff} />}
        </Box>
    );
});

const CodeRenderer = React.memo(({ text }) => {
    if (!text) return null;

    // SCENARIO 1: Surgical Diff [DIFF_START]
    if (text.includes('[DIFF_START]')) {
        return <DiffBlock text={text} />;
    }

    // SCENARIO 2: Standard Markdown Fenced Code Blocks ```
    if (text.includes('```')) {
        const parts = text.split(/(```[\s\S]*?```)/g);
        return (
            <Box flexDirection="column" width="100%">
                {parts.map((part, i) => {
                    if (part.startsWith('```') && part.endsWith('```')) {
                        const match = part.match(/```(\w*)\n([\s\S]*?)```/);
                        const lang = match ? match[1] : 'code';
                        const code = match ? match[2] : part.slice(3, -3);

                        return (
                            <Box key={i} flexDirection="column" marginY={1} backgroundColor="#111" borderStyle="round" borderColor="#333" paddingX={1} width="100%">
                                <Box alignSelf="flex-end" marginTop={-1} marginRight={1}>
                                    <Text backgroundColor="#333" color="white"> {lang.toUpperCase()} </Text>
                                </Box>
                                <Box paddingY={1} width="100%">
                                    <Text color="cyan" wrap="anywhere">{code.trim()}</Text>
                                </Box>
                            </Box>
                        );
                    }
                    return <MarkdownText key={i} text={part} />;
                })}
            </Box>
        );
    }

    // SCENARIO 3: Standard Markdown
    return <MarkdownText text={text} />;
});

export const MessageItem = React.memo(({ msg, showFullThinking }) => {
    // Show tool results ONLY if they contain high-fidelity markers like [DIFF_START]
    const isDiffResult = msg.role === 'system' && msg.text.includes('[DIFF_START]');
    const isTerminalRecord = msg.isTerminalRecord;

    if (msg.role === 'system' && msg.text.includes('[TOOL_RESULT]') && !isDiffResult && !isTerminalRecord) return null;

    if (msg.isAskRecord) {
        const selectionMatch = msg.text.match(/Selection: (.*)/);
        const selection = selectionMatch ? selectionMatch[1] : 'No selection';

        return (
            <Box marginBottom={1} paddingX={1} width="100%">
                <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={2} paddingY={0} width="100%">
                    <Text color="cyan" bold underline>💬 ASK USER</Text>
                    <Box marginTop={0}>
                        <Text color="white">Selection: <Text color="yellow" bold>{selection}</Text></Text>
                    </Box>
                </Box>
            </Box>
        );
    }

    if (msg.isUpdateNotification) {
        return (
            <Box marginBottom={1} paddingX={1} width="100%">
                <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={2} paddingY={1} width="100%">
                    <Text color="yellow" bold underline>🚀 UPDATE AVAILABLE</Text>
                    <Box marginTop={1}>
                        <CodeRenderer text={msg.text} />
                    </Box>
                </Box>
            </Box>
        );
    }

    if (isTerminalRecord) {
        const cmdMatch = msg.text.match(/COMMAND: (.*)\n/);
        const outputMatch = msg.text.match(/OUTPUT: ([\s\S]*)$/);
        const cmd = cmdMatch ? cmdMatch[1] : 'Unknown';
        const outputList = outputMatch ? outputMatch[1] : '';

        return (
            <Box marginBottom={1} paddingX={1} width="100%">
                <TerminalBox command={cmd} output={outputList} completed={true} />
            </Box>
        );
    }

    const content = React.useMemo(() => cleanSignals(msg.text), [msg.text]);

    // Handle Thinking Visibility
    const finalContent = React.useMemo(() => {
        if (msg.role === 'think' && !showFullThinking) {
            const lines = content.split('\n')
                .filter(line => {
                    const trimmed = line.trim();
                    const isHeading = trimmed.startsWith('# ');
                    const isActionStep = trimmed.startsWith('**') && trimmed.endsWith('**');
                    return isHeading || isActionStep;
                });
            
            if (lines.length === 0) return '*Reasoning...*';
            return lines.join('\n');
        }
        return content;
    }, [content, msg.role, showFullThinking]);

    return (
        <Box marginBottom={1} flexDirection="column" flexShrink={0} width="100%">
            {msg.role === 'user' ? (
                <Box
                    backgroundColor="#262626"
                    paddingX={1}
                    paddingY={1}
                    width="100%"
                    flexDirection="column"
                >
                    {finalContent
                        .replace(/\r\n/g, '\n')
                        .replace(/\r/g, '\n')
                        .replace(/\\\n/g, '\n')
                        .replace(/\\$/, '')
                        .split('\n')
                        .map((line, lineIdx) => (
                            <Box key={lineIdx} flexDirection="row" width="100%">
                                <Box flexShrink={0} width={2}>
                                    <Text bold color="white">{lineIdx === 0 ? '❯' : ' '}</Text>
                                </Box>
                                <Box flexGrow={1} marginLeft={1}>
                                    <Text color={msg.color || "white"} wrap="anywhere">{line}</Text>
                                </Box>
                            </Box>
                        ))}
                </Box>

            ) : msg.role === 'think' ? (
                <Box flexDirection="column" marginTop={1} paddingX={1} width="100%">
                    <Text bold color="white">Thinking...</Text>
                    <Box borderStyle="single" borderLeft borderRight={false} borderTop={false} borderBottom={false} paddingLeft={2} flexDirection="column" width="100%">
                        {formatThinkText(finalContent)}
                    </Box>
                </Box>
            ) : (
                <Box flexDirection="column" paddingX={1} marginTop={1} width="100%">
                    <CodeRenderer text={finalContent} />
                    {msg.memoryUpdated && (
                        <Box marginTop={1} width="100%">
                            <Text color="yellow" italic>✨ [Memory Updated]</Text>
                        </Box>
                    )}
                </Box>
            )}
        </Box>
    );
});

const ChatLayout = React.memo(({ messages, showFullThinking }) => {
    return (
        <Box flexDirection="column" width="100%">
            {messages.map((msg, idx) => (
                <MessageItem 
                    key={msg.id || idx} 
                    msg={msg} 
                    showFullThinking={showFullThinking} 
                />
            ))}
        </Box>
    );
});

export default ChatLayout;