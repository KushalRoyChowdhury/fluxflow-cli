import React, { useState, useEffect, useRef } from 'react';
import { Box, Text } from 'ink';
import { TerminalBox } from './TerminalBox.jsx';
import { wrapText, cleanSignals } from '../utils/text.js';
import { emojiSpace, getFluxLogo } from '../utils/terminal.js';

const formatThinkText = (cleaned, columns = 80) => {
    if (!cleaned) return null;
    const availableWidth = columns - 10;
    const trimmed = cleaned.trim();

    if (!trimmed.includes('```')) {
        return (
            <Box width="100%" flexDirection="column">
                <MarkdownText text={trimmed} color="gray" columns={availableWidth} italic={true} />
            </Box>
        );
    }

    const parts = trimmed.split(/(```\w*\n?[\s\S]*?(?:```|$))/g);

    return (
        <Box width="100%" flexDirection="column">
            {parts.map((part, i) => {
                if (part.startsWith('```')) {
                    const match = part.match(/```(\w*)\n?([\s\S]*?)(?:```|$)/);
                    const code = match ? match[2] : part.replace(/^```\w*\n?/, '').replace(/```$/, '');
                    const wrappedCode = wrapText(code.trimEnd(), availableWidth);
                    return (
                        <Box key={i} flexDirection="column" width="100%">
                            {wrappedCode.split('\n').map((line, idx) => (
                                <Text key={idx} color="cyan">{line}</Text>
                            ))}
                        </Box>
                    );
                }
                let cleanPart = part;
                if (i > 0) {
                    cleanPart = cleanPart.replace(/^[\r\n]+/, '');
                }
                if (i < parts.length - 1) {
                    cleanPart = cleanPart.replace(/[\r\n]+$/, '');
                }
                if (!cleanPart) return null;
                return <MarkdownText key={i} text={cleanPart} color="gray" columns={availableWidth} italic={true} />;
            })}
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
        .replace(/\\sqrt\s*\{([^}]+)\}/g, '√($1)')
        .replace(/\\sqrt\s*(\w+|\d+)/g, '√($1)')
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
        .replace(/\\left\b|\\right\b/g, '') // strip lone left/right
        .replace(/\\left\(|\\right\)/g, match => match.includes('left') ? '(' : ')')
        .replace(/\\left\[|\\right\]/g, match => match.includes('left') ? '[' : ']')
        .replace(/\\\{|\\\}/g, match => match.includes('{') ? '{' : '}')
        .replace(/\\text\s*\{([^}]+)\}/g, '$1')
        .replace(/\\text\s+(\w+)/g, '$1')
        .replace(/\\%/g, '%');
};

const renderLatexText = (content, key) => {
    if (!content) return null;

    // Handle fractions: \frac{a}{b} -> (a/b)
    let formatted = content.replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '($1/$2)');

    // Replace math symbols
    formatted = parseMathSymbols(formatted);

    // Split by styling commands: \mathbf{...}, \textbf{...}, \textit{...}, \underline{...}, \texttt{...}
    const parts = formatted.split(/(\\(?:mathbf|textbf|textit|underline|texttt)\{[^{}]*\})/g);

    return (
        <React.Fragment key={key}>
            {parts.map((p, idx) => {
                if (p.startsWith('\\')) {
                    const match = p.match(/\\(\w+)\{([^{}]*)\}/);
                    if (match) {
                        const cmd = match[1];
                        const inner = match[2];
                        const isBold = cmd === 'mathbf' || cmd === 'textbf';
                        const isItalic = cmd === 'textit';
                        const isUnderline = cmd === 'underline';
                        const isMono = cmd === 'texttt';
                        return (
                            <Text key={idx} bold={isBold} italic={isItalic} underline={isUnderline} color={isMono ? 'cyan' : undefined}>
                                {inner}
                            </Text>
                        );
                    }
                }
                return p;
            })}
        </React.Fragment>
    );
};

const InlineMarkdown = React.memo(({ text, color, italic }) => {
    if (!text) return null;

    // Split by the outer-most markdown groups (check triple backticks BEFORE single ones, use non-greedy matching)
    const parts = text.split(/(```[\s\S]*?```|`[^`]+`|@\[.*?\]|\*\*.*?\*\*|\*.*?\*|\$.*?\$|\[.*?\]\s*\(.*?\)|\[.*?\]\s*\[.*?\]|https?:\/\/[^\s]+)/g);

    return (
        <Text color={color} wrap="anywhere" italic={italic}>
            {parts.map((part, j) => {
                if (!part) return null;

                // 🏷️ Fenced Code (Captured here to prevent single-backtick shadowing)
                if (part.startsWith('```') && part.endsWith('```')) {
                    // Render as inline to prevent <Box> inside <Text> crashes
                    const content = part.slice(3, -3);
                    return <Text key={j} color="cyan">{content}</Text>;
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
                    const content = part.slice(1, -1);
                    const formatted = content.replace(/@\[(.*?)\]/g, (match, p1) => {
                        return p1.split('/').pop().split('\\').pop().replace(/:L/gi, '#L');
                    });
                    const hasFileRef = content.includes('@[');
                    return <Text key={j} color="cyan" bold={hasFileRef}>{formatted}</Text>;
                }

                if (part.startsWith('@[') && part.endsWith(']')) {
                    const filePath = part.slice(2, -1);
                    const basename = filePath.split('/').pop().split('\\').pop().replace(/:L/gi, '#L');
                    return <Text key={j} color="cyan" bold>{basename}</Text>;
                }

                // 📐 Advanced LaTeX support
                if (part.startsWith('$') && part.endsWith('$')) {
                    const content = part.slice(1, -1);
                    return (
                        <Text key={j} color="yellow">
                            {renderLatexText(content, j)}
                        </Text>
                    );
                }

                // 🌐 Harmonized Link System
                if (part.startsWith('[') && (part.includes('](') || part.includes('] ('))) {
                    const match = part.match(/\[(.*?)\]\s*\((.*?)\)/);
                    if (match) return (
                        <Text key={j}>
                            <Text color="cyan" underline bold>{match[1]}</Text>
                            <Text color="gray" italic> ({match[2]})</Text>
                        </Text>
                    );
                }
                if (part.startsWith('[') && (part.includes('][') || part.includes('] ['))) {
                    const match = part.match(/\[(.*?)\]\s*\[(.*?)\]/);
                    if (match) return (
                        <Text key={j}>
                            <Text color="cyan" underline bold>{match[1]}</Text>
                            <Text color="gray" italic> [{match[2]}]</Text>
                        </Text>
                    );
                }
                if (part.startsWith('http')) {
                    return <Text key={j} color="cyan" underline italic>{part}</Text>;
                }

                return renderLatexText(part, j);
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
        // Table MarginY here
        <Box flexDirection="column" borderStyle="round" borderColor="#454545ff" paddingX={1} marginY={0} width="100%" flexGrow={1}>
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

const MarkdownText = React.memo(({ text, color = 'white', columns = 80, italic = false }) => {
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
                        <InlineMarkdown key={qi} text={line} color="gray" italic={italic} />
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
            const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)/);
            if (headingMatch) {
                const level = headingMatch[1].length;
                const hText = headingMatch[2];
                result.push(
                    <Box key={i} marginTop={1} marginBottom={0} width="100%">
                        <Text bold color={level === 1 ? 'cyan' : level === 2 ? 'purple' : level === 3 ? 'yellow' : level === 4 ? 'green' : level === 5 ? 'blue' : 'white'} underline>
                            {hText.toUpperCase()}
                        </Text>
                    </Box>
                );
                return;
            }

            const isUnordered = /^[\*\-\+]\s/.test(trimmed);
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
                    <InlineMarkdown text={content} color={color} italic={italic} />
                </Box>
            );
        }
    });

    flushBuffers('final');
    return <Box flexDirection="column" width={columns - 2}>{result}</Box>;
});

const DiffLine = React.memo(({ line, columns = 80, highlightInfo }) => {
    const isContext = line.includes('[UI_CONTEXT]');
    const cleanLine = line.replace('[UI_CONTEXT]', '');

    // Handle high-fidelity multi-patch separator
    if (isContext && cleanLine.includes('═')) {
        return (
            <Box paddingX={1} width={columns}>
                <Text color="gray">{'═'.repeat(Math.max(10, columns - 4))}</Text>
            </Box>
        );
    }

    const isRemoval = cleanLine.startsWith('-');
    const isAddition = cleanLine.startsWith('+');

    // Extract line number and content
    // Format: " 123 |content" or "-123|content" or "+123|content"
    const prefixChar = cleanLine[0];
    const rest = cleanLine.substring(1);
    const splitIdx = rest.indexOf('|');

    const lineNum = splitIdx !== -1 ? rest.substring(0, splitIdx).trim() : '';
    const content = splitIdx !== -1 ? rest.substring(splitIdx + 1) : rest;

    const bgColor = isRemoval ? '#3a0c0c' : isAddition ? '#0c3a1a' : '#1a1a1a';
    const textColor = isRemoval ? '#ff4d4d' : isAddition ? '#4dff88' : isContext ? 'white' : 'white';
    const numColor = isRemoval ? '#cf3a3a' : isAddition ? '#3acf65' : 'gray';

    const hasHighlight = highlightInfo && (highlightInfo.prefixLen > 0 || highlightInfo.suffixLen > 0);
    const rowBgColor = hasHighlight ? '#1a1a1a' : bgColor;

    if (hasHighlight) {
        const prefixLen = highlightInfo.prefixLen;
        const suffixLen = highlightInfo.suffixLen;
        const prefix = content.substring(0, prefixLen);
        const delta = content.substring(prefixLen, content.length - suffixLen);
        const suffix = content.substring(content.length - suffixLen);

        return (
            <Box backgroundColor={rowBgColor} paddingX={1} width={columns}>
                <Box width={3} flexShrink={0} justifyContent="flex-end">
                    <Text color={numColor} dimColor={isContext}>{lineNum}</Text>
                </Box>
                <Box width={1} flexShrink={0} marginLeft={1}>
                    <Text color={textColor} bold>{isRemoval ? '-' : isAddition ? '+' : ' '}</Text>
                </Box>
                <Box flexGrow={1} marginLeft={1}>
                    <Text color={textColor} dimColor={isContext}>
                        {prefix}
                        <Text backgroundColor={bgColor}>{delta}</Text>
                        {suffix}
                    </Text>
                </Box>
            </Box>
        );
    }

    return (
        <Box backgroundColor={rowBgColor} paddingX={1} width={columns}>
            <Box width={3} flexShrink={0} justifyContent="flex-end">
                <Text color={numColor} dimColor={isContext}>{lineNum}</Text>
            </Box>
            <Box width={1} flexShrink={0} marginLeft={1}>
                <Text color={textColor} bold>{isRemoval ? '-' : isAddition ? '+' : ' '}</Text>
            </Box>
            <Box flexGrow={1} marginLeft={1}>
                <Text color={textColor} dimColor={isContext}>{wrapText(content, columns - 14)}</Text>
            </Box>
        </Box>
    );
});

const DiffBlock = React.memo(({ text, columns = 80 }) => {
    const match = text.match(/\[DIFF_START\]([\s\S]*?)\[DIFF_END\]/);
    const diffBody = match ? match[1].trim() : '';
    const diffLines = diffBody.split('\n');

    const highlightInfos = React.useMemo(() => {
        const infos = Array(diffLines.length).fill(null);
        let idx = 0;

        while (idx < diffLines.length) {
            const removals = [];
            const additions = [];

            while (idx < diffLines.length) {
                const line = diffLines[idx];
                const cleanLine = line.replace('[UI_CONTEXT]', '');
                if (cleanLine.startsWith('-')) {
                    removals.push({ idx, line: cleanLine });
                    idx++;
                } else {
                    break;
                }
            }

            while (idx < diffLines.length) {
                const line = diffLines[idx];
                const cleanLine = line.replace('[UI_CONTEXT]', '');
                if (cleanLine.startsWith('+')) {
                    additions.push({ idx, line: cleanLine });
                    idx++;
                } else {
                    break;
                }
            }

            if (removals.length > 0 && additions.length > 0) {
                const pairCount = Math.min(removals.length, additions.length);
                for (let k = 0; k < pairCount; k++) {
                    const r = removals[k];
                    const a = additions[k];

                    const rRest = r.line.substring(1);
                    const rSplit = rRest.indexOf('|');
                    const rContent = rSplit !== -1 ? rRest.substring(rSplit + 1) : rRest;

                    const aRest = a.line.substring(1);
                    const aSplit = aRest.indexOf('|');
                    const aContent = aSplit !== -1 ? aRest.substring(aSplit + 1) : aRest;

                    let prefixLen = 0;
                    while (prefixLen < rContent.length && prefixLen < aContent.length && rContent[prefixLen] === aContent[prefixLen]) {
                        prefixLen++;
                    }

                    let suffixLen = 0;
                    const maxSuffix = Math.min(rContent.length - prefixLen, aContent.length - prefixLen);
                    while (suffixLen < maxSuffix && rContent[rContent.length - 1 - suffixLen] === aContent[aContent.length - 1 - suffixLen]) {
                        suffixLen++;
                    }

                    if (prefixLen > 0 || suffixLen > 0) {
                        infos[r.idx] = { prefixLen, suffixLen };
                        infos[a.idx] = { prefixLen, suffixLen };
                    }
                }
            }

            if (removals.length === 0 && additions.length === 0) {
                idx++;
            }
        }

        return infos;
    }, [diffLines]);

    return (
        <Box flexDirection="column" width={columns - 3} marginBottom={1}>
            <Box flexDirection="column" paddingY={0} width="100%">
                <Box backgroundColor="#1a1a1a" paddingX={1} width="100%">
                    <Box width={5} flexShrink={0} />
                    <Box width={2} flexShrink={0} marginLeft={1} />
                    <Box flexGrow={1} marginLeft={1}>
                        <Text>{' '}</Text>
                    </Box>
                </Box>
                {diffLines.map((line, i) => (
                    <DiffLine key={i} line={line} columns={columns - 3} highlightInfo={highlightInfos[i]} />
                ))}
                <Box backgroundColor="#1a1a1a" paddingX={1} width="100%">
                    <Box width={5} flexShrink={0} />
                    <Box width={2} flexShrink={0} marginLeft={1} />
                    <Box flexGrow={1} marginLeft={1}>
                        <Text>{' '}</Text>
                    </Box>
                </Box>
            </Box>
        </Box>
    );
});

export const CodeRenderer = React.memo(({ text, columns = 80 }) => {
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
        const footerMarker = '[SYSTEM] Check the content preview for verification [/SYSTEM]';
        const contentAndFooter = contentPart.split(footerMarker);
        const content = contentAndFooter[0]?.trim() || '';
        const footer = contentAndFooter[1] ? `${footerMarker}${contentAndFooter[1]}` : '';

        const codeLines = content.split('\n');
        const gutterWidth = String(codeLines.length).length;

        return (
            <Box flexDirection="column" width={columns - 3}>
                <Box
                    flexDirection="column"
                    borderStyle="single"
                    borderLeft={true}
                    borderRight={false}
                    borderTop={false}
                    borderBottom={false}
                    borderColor="#444444"
                    paddingLeft={2}
                    paddingRight={0}
                    width="100%"
                    marginBottom={1}
                    backgroundColor={'#1a1a1a'}
                >
                    <Box flexDirection="column" width="100%">
                        <Box width="100%">
                            <Box width={gutterWidth + 2} flexShrink={0}>
                                <Text>{' '}</Text>
                            </Box>
                            <Box flexGrow={1}>
                                <Text>{' '}</Text>
                            </Box>
                        </Box>
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
                        <Box width="100%">
                            <Box width={gutterWidth + 2} flexShrink={0}>
                                <Text>{' '}</Text>
                            </Box>
                            <Box flexGrow={1}>
                                <Text>{' '}</Text>
                            </Box>
                        </Box>
                    </Box>
                </Box>
            </Box>
        );
    }

    // SCENARIO 3: Standard Markdown Fenced Code Blocks (Streaming-friendly)
    if (text.includes('```')) {
        const parts = text.split(/(```\w*\n?[\s\S]*?(?:```|$))/g);
        return (
            <Box flexDirection="column" width={columns - 3}>
                {parts.map((part, i) => {
                    if (part.startsWith('```')) {
                        const match = part.match(/```(\w*)\n?([\s\S]*?)(?:```|$)/);
                        const lang = match ? match[1] : 'code';
                        const code = match ? match[2] : part.replace(/^```\w*\n?/, '').replace(/```$/, '');
                        const codeLines = code.trimEnd().split('\n');
                        const gutterWidth = String(codeLines.length).length;

                        return (
                            <Box
                                key={i}
                                flexDirection="column"
                                marginY={1}
                                borderStyle="single"
                                borderLeft={true}
                                borderRight={false}
                                borderTop={false}
                                borderBottom={false}
                                borderColor="#444444"
                                paddingLeft={2}
                                paddingRight={0}
                                width="100%"
                            >
                                <Box marginBottom={1}>
                                    <Text color="gray" bold>💻 {lang.toUpperCase() || 'CODE'}</Text>
                                </Box>
                                <Box flexDirection="column" width="100%">
                                    {codeLines.map((line, idx) => (
                                        <Box key={idx} width="100%">
                                            <Box width={gutterWidth + 2} flexShrink={0}>
                                                <Text color="gray">{String(idx + 1).padStart(gutterWidth, ' ')} </Text>
                                            </Box>
                                            <Box flexGrow={1}>
                                                {/* yellow */}
                                                <Text color="#fcfca4ff">{line}</Text>
                                            </Box>
                                        </Box>
                                    ))}
                                </Box>
                            </Box>
                        );
                    }
                    let cleanPart = part;
                    if (i > 0) {
                        cleanPart = cleanPart.replace(/^[\r\n]+/, '');
                    }
                    if (i < parts.length - 1) {
                        cleanPart = cleanPart.replace(/[\r\n]+$/, '');
                    }
                    if (!cleanPart) return null;
                    return <MarkdownText key={i} text={cleanPart} columns={columns - 3} />;
                })}
            </Box>
        );
    }

    // SCENARIO 4: Standard Markdown
    return <MarkdownText text={text} columns={columns - 3} />;
});

const formatThinkingDuration = (ms) => {
    const totalSecs = Math.round(ms / 1000);
    if (totalSecs <= 0) return '0s';
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    if (m > 0) {
        return `${m}m ${s}s`;
    }
    return `${totalSecs}s`;
};

export const MessageItem = React.memo(({ msg, showFullThinking, columns = 80, aiProvider, version }) => {
    // Show tool results ONLY if they contain high-fidelity markers like [DIFF_START] or Content Preview
    const isDiffResult = msg.role === 'system' && (msg.text?.includes('[DIFF_START]') || msg.text?.includes('- Content Preview:'));
    const isPatchError = msg.role === 'system' && msg.text?.includes('[TOOL RESULT]: ERROR:') &&
        !msg.text?.includes('[DIFF_START]') &&
        (msg.toolName === 'update_file' || msg.text?.includes('Could not find exact match'));
    const isTerminalRecord = msg.isTerminalRecord;
    const isHomeWarning = msg.isHomeWarning;

    if (isHomeWarning) {
        return (
            <Box marginBottom={1} paddingX={1} width="100%">
                <Box flexDirection="column" borderStyle="round" borderColor="white" dimColor padding={0} width="100%">
                    <Box paddingX={1}>
                        <Text color="white" bold>{msg.text}</Text>
                    </Box>
                    <Box paddingX={1} marginTop={0} marginBottom={0}>
                        <Text color="white">{msg.subText}</Text>
                    </Box>
                </Box>
            </Box>
        );
    }

    if (msg.isLogo) {
        return (
            <Box flexDirection="column" alignItems="flex-start" width="100%" marginY={1}>
                <Text>{getFluxLogo(version, aiProvider)}</Text>
            </Box>
        );
    }

    if (msg.id && String(msg.id).startsWith('welcome')) {
        return (
            <Box flexDirection="column" alignItems="center" width="100%" marginY={1}>
                <Box borderStyle="round" borderColor="grey" paddingX={3} paddingY={0}>
                    <Text color="white" bold>{msg.text.trim()}</Text>
                </Box>
            </Box>
        );
    }

    if (msg.isVisualFeedback) {
        return (
            // [SPACE POINT]
            <Box marginBottom={0} marginTop={0} paddingX={0} width="100%">
                <Text color="white">{msg.text}</Text>
            </Box>
        );
    }

    if (isPatchError) {
        return (
            <Box marginBottom={1}>
                <Box flexDirection="column" borderStyle="round" borderColor="white" paddingX={1} paddingY={0}>
                    <Text color="white" bold underline>✗ PATCH FAILED</Text>
                    <Box marginTop={1}>
                        <Text color="grey" bold>Model generated malformed edit.</Text>
                    </Box>
                </Box>
            </Box>
        );
    }

    if (msg.role === 'system' && msg.text?.includes('[TOOL RESULT]') && !isDiffResult && !isTerminalRecord && !isPatchError) return null;

    if (msg.isImageStats) {
        return (
            <Box marginBottom={1} paddingX={1} width="100%">
                <Box flexDirection="column" borderStyle="round" borderColor="grey" padding={0} width="100%">
                    <Box paddingX={1} backgroundColor="#0e1b21">
                        <Text color="white" bold>IMAGE STATS</Text>
                    </Box>
                    <Box paddingX={1} marginTop={1} marginBottom={1} flexDirection="column">
                        {msg.text.split('\n').map((line, i) => (
                            <Text key={i} color="grey">{line}</Text>
                        ))}
                    </Box>
                </Box>
            </Box>
        );
    }

    if (msg.isAskRecord) {
        const selectionMatch = msg.text.match(/Selection: (.*)/);
        const selection = selectionMatch ? selectionMatch[1] : 'No selection';
        const s = emojiSpace(2);

        return (
            <Box marginBottom={0} paddingX={1} width="100%">
                <Box flexDirection="column" borderStyle="round" borderColor="gray" padding={0} width="100%">
                    <Box paddingX={1}>
                        <Text color="white" bold>AGENT REQUEST: RESOLVED</Text>
                    </Box>
                    <Box paddingX={1} marginTop={1} marginBottom={1}>
                        <Text color="white">Selection: <Text color="grey" bold>{selection}</Text></Text>
                    </Box>
                </Box>
            </Box>
        );
    }

    if (msg.isAboutRecord) {
        return (
            <Box marginBottom={0} paddingX={1} width="100%">
                <Box flexDirection="column" borderStyle="round" borderColor="gray" padding={0} width="100%">
                    <Box paddingX={1}>
                        <Text color="white" bold>ABOUT FLUX FLOW</Text>
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
                        <Text color="white" bold>UPDATE AVAILABLE</Text>
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
            { cmd: '/compress', desc: 'Summarize and compress chat history' },
            { cmd: '/clear', desc: 'Clear terminal screen' },
            { cmd: '/resume', desc: 'Load previous session' },
            { cmd: '/revert', desc: 'Revert codebase to checkpoint' },
            { cmd: '/save', desc: 'Force save current chat' },
            { cmd: '/export', desc: 'Export current chat in a .txt file' },
            { cmd: '/chats', desc: 'List all chat sessions' },
            { cmd: '/btw', desc: 'Send raw inquiry mid-turn' },
            { cmd: '/image', desc: 'Generate images' },
            { cmd: '/budget', desc: 'Set or View budget limits' },
            { cmd: '/mode', desc: 'Toggle Flux/Flow modes' },
            { cmd: '/thinking', desc: 'Set AI reasoning depth' },
            { cmd: '/model', desc: 'Switch AI model' },
            { cmd: '/settings', desc: 'Configure system prefs' },
            { cmd: '/key', desc: 'Manage API keys' },
            { cmd: '/profile', desc: 'Edit developer persona' },
            { cmd: '/memory', desc: 'Manage agent memory' },
            { cmd: '/stats', desc: 'Show session usage' },
            { cmd: '/reset', desc: 'Wipe all project data' },
            { cmd: '/about', desc: 'Project info & credits' },
            { cmd: '/changelog', desc: 'View latest updates' },
            { cmd: '/docs', desc: 'View documentation' },
            { cmd: '/fluxflow', desc: 'Project management' },
            { cmd: '/update', desc: 'Check/Install updates' }
        ];


        return (
            <Box marginBottom={1} paddingX={1} width="100%">
                <Box flexDirection="column" borderStyle="round" borderColor="grey" paddingX={2} paddingY={1} width="100%">
                    <Text color="white" bold underline>COMMAND REFERENCE</Text>
                    <Box flexDirection="column" marginTop={1}>
                        {commandList.map((c, i) => (
                            <Box key={i} flexDirection="row">
                                <Box width={15}>
                                    <Text color="white" bold>{c.cmd}</Text>
                                </Box>
                                <Text color="gray"> - {c.desc}</Text>
                            </Box>
                        ))}
                    </Box>
                </Box>
            </Box>
        );
    }

    if (msg.isTerminalRecord) {
        const cmdMatch = msg.text.match(/COMMAND: (.*)/);
        const ptyMatch = msg.text.match(/PTY: (true|false)/);
        const outputMatch = msg.text.match(/OUTPUT: ([\s\S]*)/);
        const cmd = cmdMatch ? cmdMatch[1] : 'Unknown';
        const isPty = ptyMatch ? ptyMatch[1] === 'true' : false;
        const outputList = outputMatch ? outputMatch[1] : '';

        return (
            <Box marginBottom={0} paddingX={1} width="100%">
                <TerminalBox command={cmd} output={outputList} completed={true} columns={columns} isPty={isPty} />
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
        // [SPACE POINT]
        <Box marginBottom={msg.role === 'think' ? 0 : msg.role === 'user' ? 0 : msg.role === 'agent' ? 0 : 0} marginTop={msg.role === 'think' ? 0 : msg.role === 'user' ? 0 : msg.role === 'agent' ? 0 : 0} flexDirection="column" flexShrink={0} width="100%" flexGrow={1}>
            {msg.role === 'user' ? (
                <Box flexDirection="column" width={columns - 1}>
                    <Box width={columns - 1} height={1} overflow="hidden">
                        <Text color="#444444">{'▄'.repeat(Math.max(1, columns - 1))}</Text>
                    </Box>
                    <Box
                        backgroundColor="#444444"
                        paddingX={1}
                        paddingY={0}
                        width={columns - 1}
                        flexDirection="column"
                    >
                        {wrapText(
                            finalContent
                                .replace(/\r\n/g, '\n')
                                .replace(/\r/g, '\n')
                                .replace(/\\\n/g, '\n')
                                .replace(/\\$/, ''),
                            columns - 7
                        )
                            .split('\n')
                            .map((line, lineIdx) => (
                                <Box key={lineIdx} flexDirection="row" width="100%">
                                    <Box flexShrink={0} width={2}>
                                        <Text bold color="white">{lineIdx === 0 ? '>' : ' '}</Text>
                                    </Box>
                                    <Box flexGrow={1} marginLeft={1}>
                                        <InlineMarkdown text={line} color={msg.color || "white"} />
                                    </Box>
                                </Box>
                            ))}
                    </Box>
                    <Box width={columns - 1} height={1} overflow="hidden">
                        <Text color="#444444">{'▀'.repeat(Math.max(1, columns - 1))}</Text>
                    </Box>
                </Box>

            ) : msg.role === 'think' ? (
                <Box flexDirection="column" marginTop={0} marginBottom={0} paddingX={1} width="100%">
                    {msg.isStreaming && !msg.duration ? (
                        <Text bold color="white">✧ Thinking...</Text>
                    ) : (
                        <Text bold color="white">
                            ✦ Thought{msg.duration ? (
                                <Text color="gray"> for <Text bold color="white">{formatThinkingDuration(msg.duration)}</Text></Text>
                            ) : '...'}
                        </Text>
                    )}
                    {/* [SPACE POINT] */}
                    <Box borderStyle="single" borderLeft borderRight={false} borderTop={false} borderBottom={false} paddingLeft={2} paddingTop={1} paddingBottom={1} flexDirection="column" width="100%">
                        {formatThinkText(finalContent, columns)}
                    </Box>
                </Box>
            ) : (
                <Box flexDirection="column" paddingX={1} marginTop={0} width="100%">
                    <CodeRenderer text={finalContent.replace(/ \|\n\n/g, ' |\n')} columns={columns} />
                    {msg.memoryUpdated && (
                        <Box marginTop={1} width="100%">
                            <Text color="white" italic>[Memory Updated]</Text>
                        </Box>
                    )}
                    {msg.role === 'agent' && msg.workedDuration ? (
                        <Box marginTop={1} marginBottom={2} width="100%">
                            <Text>[</Text><Text color="gray">
                                Worked for <Text bold color="white">{formatThinkingDuration(msg.workedDuration)}</Text>
                            </Text><Text>]</Text>
                        </Box>
                    ) : null}
                </Box>
            )}
        </Box>
    );
});

export const BlockItem = React.memo(({ block, columns = 80, showFullThinking, aiProvider, version }) => {
    const { msg, type, text, isStreaming } = block;

    if (type === 'full-message') {
        return (
            <MessageItem
                msg={msg}
                showFullThinking={showFullThinking}
                columns={columns}
                aiProvider={aiProvider}
                version={version}
            />
        );
    }

    if (type === 'think-header') {
        return (
            <Box flexDirection="column" paddingX={1} width="100%" marginTop={0} marginBottom={0}>
                {msg.isStreaming ? (
                    <Text bold color="white">✧ Thinking...</Text>
                ) : (
                    <Text bold color="white">✦ Thought...</Text>
                )}
                {showFullThinking && (
                    <Box flexDirection="row" width="100%">
                        <Text color="gray">│ </Text>
                    </Box>
                )}
            </Box>
        );
    }

    if (type === 'think-line') {
        if (!showFullThinking) return null;
        if (!text || text.trim() === '') {
            return (
                <Box flexDirection="row" width="100%" paddingX={1}>
                    <Text color="gray">│ </Text>
                </Box>
            );
        }

        const trimmed = text.trim();
        const isUnordered = /^[\*\-\+]\s/.test(trimmed);
        const isOrdered = /^\d+\.\s/.test(trimmed);

        let content = text;
        if (isUnordered || isOrdered) {
            const bullet = isUnordered ? '  • ' : trimmed.match(/^\d+\.\s/)[0];
            const indent = ' '.repeat(bullet.length);
            const wrappedPart = wrapText(trimmed.replace(/^[\*\-\d+\.]+\s/, ''), columns - (bullet.length + 10));
            content = bullet + wrappedPart.split('\n').join('\n' + indent);
        } else {
            content = wrapText(text, columns - 10);
        }

        const wrappedLines = content.split('\n');
        return (
            <Box flexDirection="column" paddingX={1} width="100%">
                {wrappedLines.map((wLine, idx) => (
                    <Box key={idx} flexDirection="row" width="100%">
                        <Text color="gray">│ </Text>
                        <Box flexGrow={1} marginLeft={1}>
                            <InlineMarkdown text={wLine} color="gray" italic />
                        </Box>
                    </Box>
                ))}
            </Box>
        );
    }

    if (type === 'think-footer-padding') {
        if (!showFullThinking) return null;
        return (
            <Box flexDirection="row" width="100%" paddingX={1}>
                <Text color="gray">│ </Text>
            </Box>
        );
    }

    if (type === 'agent-line') {
        if (!text || text.trim() === '') {
            return <Box height={1} />;
        }
        return (
            <Box flexDirection="column" paddingX={1} width="100%">
                <CodeRenderer text={text} columns={columns} />
            </Box>
        );
    }

    if (type === 'table') {
        return (
            <Box flexDirection="column" paddingX={1} width="100%">
                <TableRenderer buffer={text.split('\n')} terminalWidth={columns} />
            </Box>
        );
    }

    if (type === 'diff-line') {
        const { isFirstLine, isLastLine } = block;

        const renderPaddingLine = (isEnd = false) => (
            <Box backgroundColor="#1a1a1a" paddingX={1} width={columns} marginBottom={isEnd ? 1 : 0}>
                <Box width={3} flexShrink={0} />
                <Box width={1} flexShrink={0} marginLeft={1} />
                <Box flexGrow={1} marginLeft={1}>
                    <Text>{' '}</Text>
                </Box>
            </Box>
        );

        return (
            <Box flexDirection="column">
                {isFirstLine && renderPaddingLine(false)}
                <DiffLine
                    line={text}
                    columns={columns}
                    highlightInfo={block.highlightInfo}
                />
                {isLastLine && renderPaddingLine(true)}
            </Box>
        );
    }

    if (type === 'write-header') {
        return (
            <Box flexDirection="column" paddingX={1} width={columns}>
                <MarkdownText text={text} columns={columns} />
            </Box>
        );
    }

    if (type === 'write-line') {
        const { gutterWidth, lineNum, isFirstLine, isLastLine } = block;

        const renderPaddingLine = (isEnd = false) => (
            <Box
                flexDirection="row"
                width={columns}
                borderStyle="single"
                borderLeft={true}
                borderRight={false}
                borderTop={false}
                borderBottom={false}
                borderColor="#444444"
                paddingLeft={2}
                paddingRight={0}
                backgroundColor={'#1a1a1a'}
                marginBottom={isEnd ? 1 : 0}
            >
                <Box width={gutterWidth + 2} flexShrink={0}>
                    <Text>{' '.repeat(gutterWidth + 2)}</Text>
                </Box>
                <Box flexGrow={1}>
                    <Text>{' '}</Text>
                </Box>
            </Box>
        );

        return (
            <Box flexDirection="column">
                {isFirstLine && renderPaddingLine(false)}
                <Box
                    flexDirection="row"
                    width={columns}
                    borderStyle="single"
                    borderLeft={true}
                    borderRight={false}
                    borderTop={false}
                    borderBottom={false}
                    borderColor="#444444"
                    paddingLeft={2}
                    paddingRight={0}
                    backgroundColor={'#1a1a1a'}
                >
                    <Box width={gutterWidth + 2} flexShrink={0}>
                        <Text color="gray" dimColor>{String(lineNum).padStart(gutterWidth, ' ')} </Text>
                    </Box>
                    <Box flexGrow={1}>
                        <Text color="white">{text}</Text>
                    </Box>
                </Box>
                {isLastLine && renderPaddingLine(true)}
            </Box>
        );
    }

    if (type === 'write-footer') {
        return (
            <Box flexDirection="column" paddingX={1} width={columns} marginTop={1} marginBottom={1}>
                <MarkdownText text={text} columns={columns} />
            </Box>
        );
    }

    if (type === 'worked-duration') {
        return (
            <Box marginTop={1} marginBottom={2} paddingX={1} width="100%">
                <Text>[</Text><Text color="gray">
                    Worked for <Text bold color="white">{formatThinkingDuration(msg.workedDuration)}</Text>
                </Text><Text>]</Text>
            </Box>
        );
    }

    return null;
});

const ChatLayout = React.memo(({ messages, showFullThinking, columns = 80, aiProvider, version }) => {
    return (
        <Box flexDirection="column" width="100%">
            {messages.map((msg, idx) => (
                <MessageItem
                    key={msg.id || idx}
                    msg={msg}
                    showFullThinking={showFullThinking}
                    columns={columns}
                    aiProvider={aiProvider}
                    version={version}
                />
            ))}
        </Box>
    );
});

export default ChatLayout;
