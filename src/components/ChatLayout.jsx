import React, { useState, useEffect, useRef } from 'react';
import { Box, Text } from 'ink';
import { TerminalBox } from './TerminalBox.jsx';
import { wrapText } from '../utils/text.js';
import { emojiSpace } from '../utils/terminal.js';

const TOOL_LABELS = {
    'write_file': 'WriteFile',
    'update_file': 'UpdateFile',
    'read_folder': 'ReadFolder',
    'view_file': 'ViewFile',
    'exec_command': 'ExecuteCommand',
    'web_search': 'WebSearch',
    'web_scrape': 'ReadSite',
    'search_keyword': 'FindFiles',
    'write_pdf': 'CreatePDF',
    'write_pptx': 'CreatePresentation',
    'write_docx': 'CreateDocument',
};

const cleanSignals = (text) => {
    if (!text) return text;

    let result = text;
    const trigger = 'tool:functions.';

    // Greedy loop to strip all tool calls
    while (true) {
        const lowerResult = result.toLowerCase();
        let triggerIdx = lowerResult.indexOf(trigger);
        if (triggerIdx === -1) break;

        // [HARDENING] Check for outer bracket
        let startIdx = triggerIdx;
        let hasOuterBracket = false;

        // Look back for '[' (ignoring whitespace)
        let k = triggerIdx - 1;
        while (k >= 0 && /\s/.test(result[k])) k--;
        if (k >= 0 && result[k] === '[') {
            startIdx = k;
            hasOuterBracket = true;
        }

        let balance = 0;
        let foundStart = false;
        let inString = null;
        let j = triggerIdx;

        while (j < result.length) {
            const char = result[j];

            // String immunity
            if (!inString && (char === "'" || char === '"' || char === '`')) {
                inString = char;
            } else if (inString && char === inString && result[j - 1] !== '\\') {
                inString = null;
            }

            if (!inString) {
                if (char === '(') {
                    balance++;
                    foundStart = true;
                } else if (char === ')') {
                    balance--;
                }
            }

            if (foundStart && balance === 0 && !inString) {
                // If we have outer bracket, look for closing ']'
                let endIdx = j;
                if (hasOuterBracket) {
                    let m = j + 1;
                    while (m < result.length && /\s/.test(result[m])) m++;
                    if (m < result.length && result[m] === ']') {
                        endIdx = m;
                    }
                }
                result = result.substring(0, startIdx) + result.substring(endIdx + 1);
                break;
            }

            j++;

            // [SAFETY] If we reached the end without finding a closing boundary,
            // it's a partial call. Strip it and break to prevent infinite loop.
            if (j === result.length) {
                result = result.substring(0, startIdx);
                return result; // Immediate exit
            }
        }
    }

    // Secondary cleanup for protocol signals and success/error markers
    return result
        .replace(/^\[TOOL_RESULT\]:\s*/gi, '')
        .split('\n')
        .filter(line => !line.trim().startsWith('SUCCESS:') && !line.trim().startsWith('ERROR:'))
        .join('\n')
        .replace(/\[\s*turn\s*:\s*(continue|finish)\s*\]/gi, '')
        .replace(/\[\s*turn\s*:?.*?$/gi, '')
        .replace(/\n\s*turn\s*:?.*?$/gi, '')
        .replace(/\[\s*$/gi, '')
        .replace(/\n\nResponded on .*/g, '')
        .replace(/\n\n\[Prompted on: .*\]/g, '')
        .replace(/(\$?\\?\/?\\rightarrow\$?|\$\\rightarrow\$)/gi, '→')
        .replace(/(\$?\\?\/?\\leftarrow\$?|\$\\leftarrow\$)/gi, '←')
        .replace(/(\$?\\?\/?\\uparrow\$?|\$\\uparrow\$)/gi, '↑')
        .replace(/(\$?\\?\/?\\downarrow\$?|\$\\downarrow\$)/gi, '↓')
        .replace(/(\$?\\?\/?\\leftrightarrow\$?|\$\\leftrightarrow\$)/gi, '↔')
        .replace(/\[\/n\]?/g, '\\\\n')
        .replace(/@\[TerminalName:.*?, ProcessId:.*?\]/gi, '')
        .replace(/\b(write_file|update_file|read_folder|view_file|exec_command|web_search|web_scrape|search_keyword|write_pdf|write_pptx|write_docx)\b/gi, (match) => TOOL_LABELS[match.toLowerCase()] || match)
        .trim();
};

const formatThinkText = (cleaned, columns = 80) => {
    if (!cleaned) return null;
    const availableWidth = columns - 10;
    const wrapped = wrapText(cleaned.trim(), availableWidth);

    return (
        <Box width="100%">
            <Text italic color="gray">
                {wrapped}
            </Text>
        </Box>
    );
};

const parseMathSymbols = (content) => {
    return content
        .replace(/\\multiply|\\mul|\\times/g, '×')
        .replace(/\\div/g, '÷')
        .replace(/\\cdot/g, '⋅')
        .replace(/\\infty/g, '∞')
        .replace(/\\pm/g, '±')
        .replace(/\\leq/g, '≤')
        .replace(/\\geq/g, '≥')
        .replace(/\\neq/g, '≠')
        .replace(/\\sqrt\{?(.*?)\}?/g, (_, p1) => `√(${p1})`)
        .replace(/\\alpha/g, 'α')
        .replace(/\\beta/g, 'β')
        .replace(/\\theta/g, 'θ')
        .replace(/\\pi/g, 'π')
        .replace(/\\approx/g, '≈')
        .replace(/\\Delta/g, 'Δ')
        .replace(/\\sigma/g, 'σ')
        .replace(/\\sum/g, 'Σ')
        .replace(/\\prod/g, 'Π')
        .replace(/\\rightarrow|\\to/g, '→')
        .replace(/\\leftarrow/g, '←')
        .replace(/\\leftrightarrow/g, '↔')
        .replace(/\\left\(|\\right\)/g, match => match.includes('left') ? '(' : ')')
        .replace(/\\left\[|\\right\]/g, match => match.includes('left') ? '[' : ']')
        .replace(/\\\{|\\\}/g, match => match.includes('{') ? '{' : '}')
        .replace(/\\text\{?(.*?)\}?/g, '$1');
};

const InlineMarkdown = React.memo(({ text, color }) => {
    if (!text) return null;

    // Split by the outer-most markdown groups (check triple backticks BEFORE single ones, use non-greedy matching)
    const parts = text.split(/(```[\s\S]*?```|`[^`]+`|\*\*.*?\*\*|\*.*?\*|\$.*?\$|\[.*?\]\s*\(.*?\)|\[.*?\]\s*\[.*?\]|https?:\/\/[^\s]+)/g);

    return (
        <Text color={color} wrap="anywhere">
            {parts.map((part, j) => {
                if (!part) return null;

                // 🏷️ Fenced Code (Captured here to prevent single-backtick shadowing)
                if (part.startsWith('```') && part.endsWith('```')) {
                    // Pass to CodeRenderer for full block treatment
                    return <CodeRenderer key={j} text={part} />;
                }

                // 🏷️ Recursive Bold
                if (part.startsWith('**') && part.endsWith('**')) {
                    return <Text key={j} bold color="white"><InlineMarkdown text={part.slice(2, -2)} color="white" /></Text>;
                }

                // 🏷️ Recursive Italic
                if (part.startsWith('*') && part.endsWith('*')) {
                    return <Text key={j} italic color="gray"><InlineMarkdown text={part.slice(1, -1)} color="gray" /></Text>;
                }

                if (part.startsWith('`') && part.endsWith('`')) {
                    return <Text key={j} color="cyan" backgroundColor="#003333"> {part.slice(1, -1)} </Text>;
                }

                // 📐 Advanced LaTeX support
                if (part.startsWith('$') && part.endsWith('$')) {
                    const content = part.slice(1, -1);
                    const latexParts = content.split(/(\\(?:mathbf|textbf|textit|underline|text|mathrm|textsf|texttt)\{.*?\})/g);

                    return (
                        <Text key={j} color="yellow">
                            {latexParts.map((lp, lpi) => {
                                if (lp.startsWith('\\')) {
                                    const match = lp.match(/\\(\w+)\{(.*?)\}/);
                                    if (match) {
                                        const cmd = match[1];
                                        const inner = match[2];
                                        const isBold = cmd === 'mathbf' || cmd === 'textbf';
                                        const isItalic = cmd === 'textit';
                                        const isUnderline = cmd === 'underline';
                                        const isMono = cmd === 'texttt';

                                        return (
                                            <Text key={lpi} bold={isBold} italic={isItalic} underline={isUnderline} color={isMono ? 'cyan' : undefined}>
                                                {parseMathSymbols(inner)}
                                            </Text>
                                        );
                                    }
                                }
                                return (
                                    <Text key={lpi}>{parseMathSymbols(lp)}</Text>
                                );
                            })}
                        </Text>
                    );
                }

                // 🌐 Harmonized Link System
                if (part.startsWith('[') && (part.includes('](') || part.includes('] ('))) {
                    const match = part.match(/\[(.*?)\]\s*\((.*?)\)/);
                    if (match) return (
                        <Text key={j}>
                            <Text color="cyan" underline bold>{match[1]}</Text>
                            <Text color="gray" dimColor italic> ({match[2]})</Text>
                        </Text>
                    );
                }
                if (part.startsWith('[') && (part.includes('][') || part.includes('] ['))) {
                    const match = part.match(/\[(.*?)\]\s*\[(.*?)\]/);
                    if (match) return (
                        <Text key={j}>
                            <Text color="cyan" underline bold>{match[1]}</Text>
                            <Text color="gray" dimColor italic> [{match[2]}]</Text>
                        </Text>
                    );
                }
                if (part.startsWith('http')) {
                    return <Text key={j} color="cyan" underline italic>{part}</Text>;
                }

                return part;
            })}
        </Text>
    );
});

// Helper: Wrap text to a specific width without breaking words

const TableRenderer = React.memo(({ buffer, terminalWidth = 80 }) => {
    if (buffer.length < 2) return null;

    const rows = buffer.map(line => {
        const parts = line.split('|');
        if (parts[0] !== undefined && parts[0].trim() === '') parts.shift();
        if (parts.length > 0 && parts[parts.length - 1].trim() === '') parts.pop();
        return parts.map(cell => cell.trim());
    });

    const header = rows[0];
    const data = rows.slice(2);

    // Distribution Logic
    const colPercentage = Math.floor(100 / header.length);
    const availableWidth = terminalWidth - 8; // Margin/Border buffer
    const colChars = Math.floor(availableWidth / header.length) - 2; // Padding buffer

    return (
        <Box flexDirection="column" borderStyle="round" borderColor="#333" paddingX={1} marginY={1} width="100%" flexGrow={1}>
            {/* Header with Integrated Divider */}
            <Box flexDirection="row" borderStyle="single" borderBottom borderTop={false} borderLeft={false} borderRight={false} borderColor="#444" marginBottom={1} paddingBottom={0} width="100%">
                {header.map((cell, i) => (
                    <Box key={i} flexBasis={`${colPercentage}%`} flexGrow={1} flexShrink={0} paddingRight={2}>
                        <InlineMarkdown text={wrapText(cell, colChars)} color="cyan" />
                    </Box>
                ))}
            </Box>

            {/* Rows */}
            {data.map((row, ri) => (
                <Box key={ri} flexDirection="row" marginBottom={ri === data.length - 1 ? 0 : 1} width="100%">
                    {row.map((cell, ci) => (
                        <Box key={ci} flexBasis={`${colPercentage}%`} flexGrow={1} flexShrink={0} paddingRight={2} flexDirection="column">
                            <InlineMarkdown text={wrapText(cell, colChars)} color="white" />
                        </Box>
                    ))}
                </Box>
            ))}
        </Box>
    );
});

const MarkdownText = React.memo(({ text, color = 'white', columns = 80 }) => {
    if (!text) return null;

    const lines = text.split('\n');
    const result = [];
    let tableBuffer = [];
    let quoteBuffer = [];

    const flushBuffers = (key) => {
        if (tableBuffer.length > 0) {
            result.push(<TableRenderer key={`table-${key}`} buffer={[...tableBuffer]} terminalWidth={columns} />);
            tableBuffer = [];
        }
        if (quoteBuffer.length > 0) {
            result.push(
                <Box key={`quote-${key}`} borderStyle="bold" borderLeft borderRight={false} borderTop={false} borderBottom={false} borderColor="gray" paddingLeft={1} marginY={1} flexDirection="column">
                    {quoteBuffer.map((line, qi) => (
                        <InlineMarkdown key={qi} text={line} color="gray" />
                    ))}
                </Box>
            );
            quoteBuffer = [];
        }
    };

    lines.forEach((line, i) => {
        const trimmed = line.trim();
        const isTableRow = trimmed.startsWith('|');
        const isQuote = trimmed.startsWith('>');

        if (isTableRow) {
            if (quoteBuffer.length > 0) flushBuffers(i); // Only flush OTHER buffers
            tableBuffer.push(line);
        } else if (isQuote) {
            if (tableBuffer.length > 0) flushBuffers(i); // Only flush OTHER buffers
            quoteBuffer.push(trimmed.replace(/^>\s*/, ''));
        } else {
            flushBuffers(i); // Flush everything for normal text

            if (trimmed === '') {
                result.push(<Box key={i} height={1} />);
                return;
            }
            // Horizontal Rule
            if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
                result.push(<Box key={i} marginY={1} borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false} width="100%" borderColor="#333" />);
                return;
            }

            // Headings
            const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)/);
            if (headingMatch) {
                const level = headingMatch[1].length;
                const hText = headingMatch[2];
                result.push(
                    <Box key={i} marginTop={1} marginBottom={0} width="100%">
                        <Text bold color={level === 1 ? 'cyan' : level === 2 ? 'magenta' : 'yellow'} underline>
                            {hText.toUpperCase()}
                        </Text>
                    </Box>
                );
                return;
            }

            const isUnordered = trimmed.startsWith('* ') || trimmed.startsWith('- ');
            const isOrdered = /^\d+\.\s/.test(trimmed);
            const isAsciiArt = line.includes('█') || line.includes('╔') || line.includes('╚') || line.includes('═');

            let content = '';
            if (isAsciiArt) {
                content = line; // Preserve exactly as is
            } else if (isUnordered || isOrdered) {
                const bullet = isUnordered ? '  • ' : trimmed.match(/^\d+\.\s/)[0];
                const indent = ' '.repeat(bullet.length);
                const wrappedPart = wrapText(trimmed.replace(/^[\*\-\d+\.]+\s/, ''), columns - (bullet.length + 6));
                content = bullet + wrappedPart.split('\n').join('\n' + indent);
            } else {
                content = wrapText(trimmed, columns - 4);
            }

            result.push(
                <Box key={i} width="100%">
                    <InlineMarkdown text={content} color={color} />
                </Box>
            );
        }
    });

    flushBuffers('final');
    return <Box flexDirection="column" width={columns - 2}>{result}</Box>;
});

const DiffLine = React.memo(({ line, columns = 80 }) => {
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
                <Text color={textColor}>{wrapText(content, columns - 10)}</Text>
            </Box>
        </Box>
    );
});

const DiffBlock = React.memo(({ text, columns = 80 }) => {
    const beforeDiff = text.substring(0, text.indexOf('[DIFF_START]')).trim();
    const afterDiff = text.substring(text.indexOf('[DIFF_END]') + 10).trim();
    const match = text.match(/\[DIFF_START\]([\s\S]*?)\[DIFF_END\]/);
    const diffBody = match ? match[1].trim() : '';
    const diffLines = diffBody.split('\n');

    return (
        <Box flexDirection="column" width="100%">
            {beforeDiff && <MarkdownText text={beforeDiff} columns={columns} />}
            <Box flexDirection="column" marginTop={1} backgroundColor="#1a1a1a" paddingY={0} width="100%">
                {diffLines.map((line, i) => (
                    <DiffLine key={i} line={line} columns={columns} />
                ))}
            </Box>
            {afterDiff && <MarkdownText text={afterDiff} columns={columns} />}
        </Box>
    );
});

const CodeRenderer = React.memo(({ text, columns = 80 }) => {
    if (!text) return null;

    // SCENARIO 1: Surgical Diff [DIFF_START]
    if (text.includes('[DIFF_START]')) {
        return <DiffBlock text={text} columns={columns} />;
    }

    // SCENARIO 2: Write File Content Preview
    if (text.includes('- Content Preview:')) {
        const mainParts = text.split('- Content Preview:');
        const headerText = mainParts[0];
        const contentPart = mainParts[1] || '';
        
        // Split content from footer
        const footerMarker = 'Check if Starting and Ending matches';
        const contentAndFooter = contentPart.split(footerMarker);
        const content = contentAndFooter[0]?.trim() || '';
        const footer = contentAndFooter[1] ? `${footerMarker}${contentAndFooter[1]}` : '';

        const codeLines = content.split('\n');
        const gutterWidth = String(codeLines.length).length;

        return (
            <Box flexDirection="column" width="100%">
                <Box flexDirection="column" borderStyle="round" borderColor="#444" paddingX={1} width="100%">
                    <Box alignSelf="flex-end" marginTop={-1} marginRight={1}>
                        <Text backgroundColor="#444" color="white"> FILE SNAPSHOT </Text>
                    </Box>
                    <Box flexDirection="column" paddingY={1} width="100%">
                        {codeLines.map((line, idx) => (
                            <Box key={idx} width="100%">
                                <Box width={gutterWidth + 2} flexShrink={0}>
                                    <Text color="gray" dimColor>{String(idx + 1).padStart(gutterWidth, ' ')} </Text>
                                </Box>
                                <Box flexGrow={1}>
                                    <Text color="white">{line}</Text>
                                </Box>
                            </Box>
                        ))}
                    </Box>
                </Box>
            </Box>
        );
    }

    // SCENARIO 3: Standard Markdown Fenced Code Blocks (Streaming-friendly)
    if (text.includes('```')) {
        const parts = text.split(/(```\w*\n?[\s\S]*?(?:```|$))/g);
        return (
            <Box flexDirection="column" width="100%">
                {parts.map((part, i) => {
                    if (part.startsWith('```')) {
                        const match = part.match(/```(\w*)\n?([\s\S]*?)(?:```|$)/);
                        const lang = match ? match[1] : 'code';
                        const code = match ? match[2] : part.replace(/^```\w*\n?/, '').replace(/```$/, '');
                        const codeLines = code.trimEnd().split('\n');
                        const gutterWidth = String(codeLines.length).length;

                        return (
                            <Box key={i} flexDirection="column" marginY={1} backgroundColor="#111" borderStyle="round" borderColor="#333" paddingX={1} width="100%">
                                <Box alignSelf="flex-end" marginTop={-1} marginRight={1}>
                                    <Text backgroundColor="#333" color="white"> {lang.toUpperCase()} </Text>
                                </Box>
                                <Box flexDirection="column" paddingY={1} width="100%">
                                    {codeLines.map((line, idx) => (
                                        <Box key={idx} width="100%">
                                            <Box width={gutterWidth + 2} flexShrink={0}>
                                                <Text color="gray" dimColor>{String(idx + 1).padStart(gutterWidth, ' ')} </Text>
                                            </Box>
                                            <Box flexGrow={1}>
                                                <Text color="cyan">{line}</Text>
                                            </Box>
                                        </Box>
                                    ))}
                                </Box>
                            </Box>
                        );
                    }
                    return <MarkdownText key={i} text={part} columns={columns} />;
                })}
            </Box>
        );
    }

    // SCENARIO 4: Standard Markdown
    return <MarkdownText text={text} columns={columns} />;
});

export const MessageItem = React.memo(({ msg, showFullThinking, columns = 80 }) => {
    // Show tool results ONLY if they contain high-fidelity markers like [DIFF_START] or Content Preview
    const isDiffResult = msg.role === 'system' && (msg.text?.includes('[DIFF_START]') || msg.text?.includes('- Content Preview:'));
    const isPatchError = msg.role === 'system' && msg.text?.includes('[TOOL_RESULT]: ERROR:') &&
        (msg.toolName === 'update_file' || msg.text?.includes('Could not find exact match'));
    const isTerminalRecord = msg.isTerminalRecord;
    const isHomeWarning = msg.isHomeWarning;

    if (isHomeWarning) {
        return (
            <Box marginBottom={1} paddingX={1} width="100%">
                <Box flexDirection="column" borderStyle="round" borderColor="red" padding={0} width="100%">
                    <Box paddingX={1} backgroundColor="#3a0000">
                        <Text color="red" bold>{msg.text}</Text>
                    </Box>
                    <Box paddingX={1} marginTop={1} marginBottom={1}>
                        <Text color="white">{msg.subText}</Text>
                    </Box>
                </Box>
            </Box>
        );
    }

    if (msg.isLogo) {
        return (
            <Box flexDirection="column" alignItems="center" width="100%" marginY={1}>
                <Text>{msg.text}</Text>
            </Box>
        );
    }

    if (msg.id && String(msg.id).startsWith('welcome')) {
        return (
            <Box flexDirection="column" alignItems="center" width="100%" marginY={1}>
                <Box borderStyle="round" borderColor="gray" paddingX={3} paddingY={0}>
                    <Text color="cyan" bold>{msg.text.trim()}</Text>
                </Box>
            </Box>
        );
    }

    if (msg.isVisualFeedback) {
        return (
            <Box marginBottom={1} paddingX={1} width="100%">
                <Text color="white">{msg.text}</Text>
            </Box>
        );
    }

    if (isPatchError) {
        return (
            <Box marginBottom={1}>
                <Box flexDirection="column" borderStyle="round" borderColor="red" paddingX={1} paddingY={0}>
                    <Text color="red" bold underline>❌ PATCH FAILED</Text>
                    <Box marginTop={1}>
                        <Text color="red">Patch failed: <Text color="white" bold>Model generated malformed edit.</Text></Text>
                    </Box>
                </Box>
            </Box>
        );
    }

    if (msg.role === 'system' && msg.text?.includes('[TOOL_RESULT]') && !isDiffResult && !isTerminalRecord && !isPatchError) return null;

    if (msg.isAskRecord) {
        const selectionMatch = msg.text.match(/Selection: (.*)/);
        const selection = selectionMatch ? selectionMatch[1] : 'No selection';
        const s = emojiSpace(2);

        return (
            <Box marginBottom={1} paddingX={1} width="100%">
                <Box flexDirection="column" borderStyle="round" borderColor="gray" padding={0} width="100%">
                    <Box paddingX={1}>
                        <Text color="cyan" bold>💬 AGENT REQUEST: RESOLVED</Text>
                    </Box>
                    <Box paddingX={1} marginTop={1} marginBottom={1}>
                        <Text color="white">Selection: <Text color="yellow" bold>{selection}</Text></Text>
                    </Box>
                </Box>
            </Box>
        );
    }

    if (msg.isAboutRecord) {
        return (
            <Box marginBottom={1} paddingX={1} width="100%">
                <Box flexDirection="column" borderStyle="round" borderColor="gray" padding={0} width="100%">
                    <Box paddingX={1}>
                        <Text color="cyan" bold>💠 ABOUT FLUX FLOW</Text>
                    </Box>
                    <Box paddingX={1} marginTop={1} marginBottom={1}>
                        <Text>{msg.text}</Text>
                    </Box>
                </Box>
            </Box>
        );
    }

    if (msg.isUpdateNotification) {
        return (
            <Box marginBottom={1} paddingX={1} width="100%">
                <Box flexDirection="column" borderStyle="round" borderColor="gray" padding={0} width="100%">
                    <Box paddingX={1}>
                        <Text color="cyan" bold>🚀 FLUX FLOW UPDATE AVAILABLE</Text>
                    </Box>
                    <Box paddingX={1} marginTop={1} marginBottom={1}>
                        <CodeRenderer text={msg.text} columns={columns} />
                    </Box>
                </Box>
            </Box>
        );
    }

    if (msg.isHelpRecord) {
        const commandList = [
            { cmd: '/quit', desc: 'Exit and shutdown Flux' },
            { cmd: '/help', desc: 'Show all available commands' },
            { cmd: '/clear', desc: 'Clear terminal screen' },
            { cmd: '/resume', desc: 'Load previous session' },
            { cmd: '/save', desc: 'Force save current chat' },
            { cmd: '/chats', desc: 'List all chat sessions' },
            {
                cmd: '/mode', desc: 'Toggle Flux/Flow modes', subs: [
                    { cmd: 'flux', desc: 'Enable Dev toolset' },
                    { cmd: 'flow', desc: 'Enable Chat mode' }
                ]
            },
            {
                cmd: '/thinking', desc: 'Set AI reasoning depth', subs: [
                    { cmd: 'low', desc: 'Fastest reasoning' },
                    { cmd: 'medium', desc: 'Balanced depth' },
                    { cmd: 'high', desc: 'Complex coding' },
                    { cmd: 'max', desc: 'Architectural depth' },
                    { cmd: 'show', desc: 'Show full thoughts' },
                    { cmd: 'hide', desc: 'Show concise thoughts' }
                ]
            },
            {
                cmd: '/model', desc: 'Switch AI model', subs: [
                    { cmd: 'gemma-4-31b-it', desc: 'Standard Default (Free, Recommended)' },
                    { cmd: 'gemini-3.1-pro-preview', desc: 'Most Capable (Paid)' },
                    { cmd: 'gemini-3-flash-preview', desc: 'Fast & Lightweight (Paid, Free limited quota)' },
                    { cmd: 'gemini-3.1-flash-lite-preview', desc: 'Ultra Fast (Paid, Free limited quota)' }
                ]
            },
            { cmd: '/settings', desc: 'Configure system prefs' },
            { cmd: '/key', desc: 'Manage API keys' },
            { cmd: '/profile', desc: 'Edit developer persona' },
            { cmd: '/memory', desc: 'Manage agent memory' },
            { cmd: '/stats', desc: 'Show session usage' },
            { cmd: '/reset', desc: 'Wipe all project data' },
            { cmd: '/about', desc: 'Project info & credits' },
            { cmd: '/changelog', desc: 'View latest updates' },
            {
                cmd: '/fluxflow', desc: 'Project management', subs: [
                    { cmd: 'init', desc: 'Create FluxFlow.md template' }
                ]
            },
            {
                cmd: '/update', desc: 'Check/Install updates', subs: [
                    { cmd: 'check', desc: 'Check for new version' },
                    { cmd: 'latest', desc: 'Install latest release' }
                ]
            }
        ];

        return (
            <Box marginBottom={1} paddingX={1} width="100%">
                <Box flexDirection="column" borderStyle="round" borderColor="magenta" paddingX={2} paddingY={1} width="100%">
                    <Text color="magenta" bold underline>📜 COMMAND REFERENCE</Text>
                    <Box flexDirection="column" marginTop={1}>
                        {commandList.map((c, i) => (
                            <Box key={i} flexDirection="row">
                                <Box width={15}>
                                    <Text color="cyan" bold>{c.cmd}</Text>
                                </Box>
                                <Text color="gray"> - {c.desc}</Text>
                            </Box>
                        ))}
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
                <TerminalBox command={cmd} output={outputList} completed={true} columns={columns} />
            </Box>
        );
    }

    const [animationDone, setAnimationDone] = React.useState(!msg.isStreaming);
    const content = React.useMemo(() => cleanSignals(msg.text), [msg.text]);

    // Reset animation state if message ID changes (rare but possible)
    React.useEffect(() => {
        if (msg.isStreaming) setAnimationDone(false);
    }, [msg.id]);

    const finalContent = React.useMemo(() => {
        if (msg.role === 'think' && !showFullThinking) {
            return 'Thinking...';
        }
        return msg.isStreaming ? content : content.trimEnd();
    }, [content, msg.role, showFullThinking, msg.isStreaming]);

    return (
        <Box marginBottom={1} flexDirection="column" flexShrink={0} width="100%" flexGrow={1}>
            {msg.role === 'user' ? (
                <Box
                    backgroundColor="#262626"
                    paddingX={1}
                    paddingY={1}
                    width="100%"
                    flexDirection="column"
                >
                    {wrapText(
                        finalContent
                            .replace(/\r\n/g, '\n')
                            .replace(/\r/g, '\n')
                            .replace(/\\\n/g, '\n')
                            .replace(/\\$/, ''),
                        columns - 6
                    )
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
                        {formatThinkText(finalContent, columns)}
                    </Box>
                </Box>
            ) : (
                <Box flexDirection="column" paddingX={1} marginTop={isDiffResult ? 0 : 1} width="100%">
                    <CodeRenderer text={finalContent} columns={columns} />
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

const ChatLayout = React.memo(({ messages, showFullThinking, columns = 80 }) => {
    return (
        <Box flexDirection="column" width="100%">
            {messages.map((msg, idx) => (
                <MessageItem
                    key={msg.id || idx}
                    msg={msg}
                    showFullThinking={showFullThinking}
                    columns={columns}
                />
            ))}
        </Box>
    );
});

export default ChatLayout;