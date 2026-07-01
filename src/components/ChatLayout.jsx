import React, { useState, useEffect, useRef } from 'react';
import fs from 'fs';
import { Box, Text } from 'ink';
import { TerminalBox } from './TerminalBox.jsx';
import { wrapText, cleanSignals, parseLineInfo, getSimilarity, alignChangeGroup } from '../utils/text.js';
import { emojiSpace, getFluxLogo } from '../utils/terminal.js';
import { diffWordsWithSpace } from 'diff';

const useStreamingText = (targetText, isStreaming, isActiveBlock) => {
    return targetText;
};

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

// ============================================================================
// PRE-COMPILED REGEXES (Prevents V8 recompilation during React render loop)
// ============================================================================
const REGEX_MD_TOKENS = /(```[\s\S]*?```|`[^`]+`|@\[.*?\]|\*\*.*?\*\*|\*.*?\*|\$.*?\$|\[.*?\]\s*\(.*?\)|\[.*?\]\s*\[.*?\]|https?:\/\/[^\s]+)/g;
const REGEX_FENCED_CODE = /```(\w*)\n?([\s\S]*?)(?:```|$)/;
const REGEX_LATEX_FRAC = /\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g;
const REGEX_LATEX_STYLE = /(\\(?:mathbf|textbf|textit|underline|texttt)\{[^{}]*\})/g;
const REGEX_HEADING = /^(#{1,6})\s+(.*)/;

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

const SYNTAX_KEYWORDS = /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|import|export|from|default|class|extends|new|this|typeof|instanceof|try|catch|finally|throw|async|await|yield|public|private|protected|static|void|int|float|double|char|bool|boolean|def|elif|fn|pub|mut|struct|impl|enum|type|interface|package|namespace|using|include|define|nil|None|self|lambda)\b/;
const SYNTAX_RULES = [
    // Include paths
    /((?<=\binclude\s+)(?:<[^>]+>|"[^"]+"))/.source,
    // Import paths
    /((?<=\b(?:from|import|require\s*\(\s*)\s*)(?:'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"))/.source,
    // Comments
    /(\/\/.*|#.*)/.source,
    // Strings
    /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^\`\\])*`)/.source,
    SYNTAX_KEYWORDS.source,
    /\b([a-zA-Z_][a-zA-Z0-9_]*)(?=\s*\()/.source,
    /\b(true|false|null|undefined|nil|None)\b/.source,
    /\b(\d+(?:\.\d+)?|0x[0-9a-fA-F]+)\b/.source
];
const REGEX_SYNTAX = new RegExp(SYNTAX_RULES.join('|'), 'g');
const tokenCache = new Map();
const MAX_TOKEN_CACHE_SIZE = 1000;

const tokenizeLine = (line, lang) => {
    if (!line) return [];
    const cacheKey = `${lang}:${line}`;
    if (tokenCache.has(cacheKey)) {
        return tokenCache.get(cacheKey);
    }

    let lastIndex = 0;
    const tokens = [];
    let match;
    REGEX_SYNTAX.lastIndex = 0; // Reset stateful global regex pointer

    while ((match = REGEX_SYNTAX.exec(line)) !== null) {
        const matchText = match[0];
        const matchIndex = match.index;
        if (matchIndex > lastIndex) {
            tokens.push({ text: line.substring(lastIndex, matchIndex) });
        }
        let color = undefined;
        let bold = false;
        if (match[1] || match[2]) {
            color = '#ce9178'; // Brownish/orange for include & import paths
        } else if (match[3]) {
            color = '#9ece6a'; // Comment (green)
        } else if (match[4]) {
            color = '#fcfca4'; // String (light yellow)
        } else if (match[5]) {
            color = '#ff7b72';
            bold = true;
        } else if (match[6]) {
            color = '#b392f0';
        } else if (match[7] || match[8]) {
            color = '#ff9e64';
        }
        tokens.push({ text: matchText, color, bold });
        lastIndex = REGEX_SYNTAX.lastIndex;
    }
    if (lastIndex < line.length) {
        tokens.push({ text: line.substring(lastIndex) });
    }

    if (tokenCache.size >= MAX_TOKEN_CACHE_SIZE) {
        const firstKey = tokenCache.keys().next().value;
        tokenCache.delete(firstKey);
    }
    tokenCache.set(cacheKey, tokens);
    return tokens;
};

const renderHighlightedLine = (line, lang, defaultColor = undefined) => {
    if (!line) return <Text>{' '}</Text>;
    const tokens = tokenizeLine(line, lang);
    return (
        <Text color={defaultColor}>
            {tokens.map((token, idx) => (
                <Text key={idx} color={token.color || defaultColor} bold={token.bold}>
                    {token.text}
                </Text>
            ))}
        </Text>
    );
};

const renderLatexText = (content, key) => {
    if (!content) return null;

    let formatted = content.replace(REGEX_LATEX_FRAC, '($1/$2)');
    formatted = parseMathSymbols(formatted);
    const parts = formatted.split(REGEX_LATEX_STYLE);

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

    // Use cached regex to prevent GC thrashing during stream renders
    const parts = text.split(REGEX_MD_TOKENS);

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
                    return <Text key={j} italic color="white"><InlineMarkdown text={part.slice(1, -1)} color="white" italic={italic} /></Text>;
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

            const linesOfContent = content.split('\n');
            result.push(
                <Box key={i} flexDirection="column" width="100%">
                    {linesOfContent.map((l, lIdx) => (
                        <InlineMarkdown key={lIdx} text={l} color={color} italic={italic} />
                    ))}
                </Box>
            );
        }
    });

    flushBuffers('final');
    return <Box flexDirection="column" width={columns - 2}>{result}</Box>;
});

const DiffLine = React.memo(({ line, pairContent, parentText, columns = 80, extension }) => {
    const isContext = line.includes('[UI_CONTEXT]');
    const cleanLine = line.replace('[UI_CONTEXT]', '');

    // Handle high-fidelity multi-patch separator
    if (isContext && cleanLine.includes('═')) {
        return (
            <Box backgroundColor="#1a1a1a" paddingX={1} width={columns}>
                <Text color="gray">{'═'.repeat(Math.max(10, columns - 4))}</Text>
            </Box>
        );
    }

    const parsedCurrent = parseLineInfo(line);
    if (!parsedCurrent) {
        return (
            <Box backgroundColor="#1a1a1a" paddingX={1} width={columns}>
                <Box width={3} flexShrink={0} />
                <Box width={1} flexShrink={0} marginLeft={1} />
                <Box flexGrow={1} marginLeft={1}>
                    <Text color="gray">{wrapText(cleanLine, columns - 14)}</Text>
                </Box>
            </Box>
        );
    }

    const { isR: isRemoval, isA: isAddition, num: lineNum, content } = parsedCurrent;

    let finalPairContent = pairContent;

    // 🔍 1. Compute fine-grained tokens
    let words = [];
    if (finalPairContent !== undefined && finalPairContent !== null) {
        const oldStr = isRemoval ? content : finalPairContent;
        const newStr = isRemoval ? finalPairContent : content;
        try {
            words = diffWordsWithSpace(oldStr, newStr);
        } catch (e) {
            words = [];
        }
    }

    // 🔍 2. Check if text is a modified slice or pure block
    const hasInlineChange = words.some(part => (isRemoval && part.removed) || (isAddition && part.added));
    const isPureUnpairedBlock = (!finalPairContent && (isRemoval || isAddition));

    // 🎨 Unified solid block backgrounds for the inner text container
    const innerBgColor = isRemoval ? '#3a0c0c' : (isAddition ? '#0c3a1a' : undefined);

    // Row indicator colors
    const finalNumColor = (isRemoval || isAddition) ? (isRemoval ? '#d96868' : '#68d98c') : 'gray';
    const finalPrefixColor = isRemoval ? '#ff4d4d' : '#4dff88';
    const displayPrefix = isRemoval ? '-' : (isAddition ? '+' : ' ');

    const renderInlineDiff = () => {
        // Case A: Pure completely brand new line block layout
        if (isPureUnpairedBlock) {
            const blockColor = isRemoval ? '#ffdddd' : '#ddffdd';
            const wrappedLines = wrapText(content, columns - 14).split('\n');
            return (
                <Box flexDirection="column">
                    {wrappedLines.map((wl, idx) => (
                        <Box key={idx}>
                            {renderHighlightedLine(wl, extension, blockColor)}
                        </Box>
                    ))}
                </Box>
            );
        }

        // Case B: Truly unchanged boilerplate context lines get full soft tint
        if (!(isRemoval || isAddition) || words.length === 0 || !hasInlineChange) {
            const textColor = isRemoval ? '#885555' : (isAddition ? '#558866' : 'gray');
            const wrappedLines = wrapText(content, columns - 14).split('\n');
            return (
                <Box flexDirection="column">
                    {wrappedLines.map((wl, idx) => (
                        <Box key={idx}>
                            {renderHighlightedLine(wl, extension, textColor)}
                        </Box>
                    ))}
                </Box>
            );
        }

        // Case C: Surgical inline changes with high-contrast normal-weight coloring 🎯
        return (
            <Text wrap="anywhere">
                {words.map((part, idx) => {
                    const isWhitespace = /^\s+$/.test(part.value);

                    // 🔴 REMOVAL ROW TREATMENT
                    if (isRemoval) {
                        const isSurroundedByRemoval = (words[idx - 1]?.removed) || (words[idx + 1]?.removed);

                        // NO bold! High-contrast neon red pops out changes instead
                        if (part.removed || (isWhitespace && isSurroundedByRemoval)) {
                            return (
                                <Text key={idx} color="#ff3333" backgroundColor="#5a1818">
                                    {part.value}
                                </Text>
                            );
                        }
                        if (part.added) return null;

                        // Unchanged syntax components stay muted darker red
                        return <Text key={idx} color="#885555">{part.value}</Text>;
                    }

                    // 🟢 ADDITION ROW TREATMENT
                    if (isAddition) {
                        const isSurroundedByAddition = (words[idx - 1]?.added) || (words[idx + 1]?.added);

                        // NO bold! High-contrast neon green pops out changes instead
                        if (part.added || (isWhitespace && isSurroundedByAddition)) {
                            return (
                                <Text key={idx} color="#33ff66" backgroundColor="#185a25">
                                    {part.value}
                                </Text>
                            );
                        }
                        if (part.removed) return null;

                        // Unchanged syntax components stay muted darker green
                        return <Text key={idx} color="#558866">{part.value}</Text>;
                    }

                    return <Text key={idx} color="gray">{part.value}</Text>;
                })}
            </Text>
        );
    };

    return (
        <Box backgroundColor="#1a1a1a" paddingX={1} width={columns}>
            {/* Gutter Line Number */}
            <Box width={3} flexShrink={0} justifyContent="flex-end">
                <Text color={finalNumColor}>{lineNum}</Text>
            </Box>

            {/* Gutter Prefix Symbol */}
            <Box width={1} flexShrink={0} marginLeft={1}>
                <Text color={finalPrefixColor}>
                    {displayPrefix}
                </Text>
            </Box>

            {/* Content Wrapper */}
            <Box marginLeft={1} backgroundColor={innerBgColor} flexShrink={1}>
                {renderInlineDiff()}
            </Box>
        </Box>
    );
});

const DiffBlock = React.memo(({ text, columns = 80, extension }) => {
    const match = text.match(/\[DIFF_START\]([\s\S]*?)(?:\[DIFF_END\]|$)/);
    const diffBody = match ? match[1].trim() : '';
    const diffLines = diffBody.split('\n');

    // Parse all lines
    const parsedLines = diffLines.map(line => {
        return {
            line,
            parsed: parseLineInfo(line),
            pairContent: null
        };
    });

    // Group contiguous changes and align them
    let currentGroup = [];
    for (let i = 0; i < parsedLines.length; i++) {
        const item = parsedLines[i];
        if (item.parsed && (item.parsed.isR || item.parsed.isA)) {
            currentGroup.push(item);
        } else {
            if (currentGroup.length > 0) {
                alignChangeGroup(currentGroup);
                currentGroup = [];
            }
        }
    }
    if (currentGroup.length > 0) {
        alignChangeGroup(currentGroup);
    }

    return (
        <Box flexDirection="column" width={columns - 3} marginBottom={1}>
            <Box flexDirection="column" paddingY={0} width="100%">
                <Box backgroundColor="#1a1a1a" paddingX={1} width="100%">
                    <Box width={3} flexShrink={0} />
                    <Box width={1} flexShrink={0} marginLeft={1} />
                    <Box flexGrow={1} marginLeft={1}>
                        <Text>{' '}</Text>
                    </Box>
                </Box>
                {parsedLines.map((item, i) => (
                    <DiffLine
                        key={i}
                        line={item.line}
                        pairContent={item.pairContent}
                        columns={columns - 3}
                        extension={extension}
                    />
                ))}
                <Box backgroundColor="#1a1a1a" paddingX={1} width="100%">
                    <Box width={3} flexShrink={0} />
                    <Box width={1} flexShrink={0} marginLeft={1} />
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

    let extension = '';
    const fileMatch = text.match(/File\s+\[(.*?)\]/i);
    if (fileMatch) {
        extension = fileMatch[1].split('.').pop().toLowerCase();
    }

    // SCENARIO 1: Surgical Diff [DIFF_START]
    if (text.includes('[DIFF_START]')) {
        return <DiffBlock text={text} columns={columns} extension={extension} />;
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
                                    {renderHighlightedLine(line, extension, 'white')}
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
                                    <Text color="gray" bold>▶_ {lang.toUpperCase() || 'CODE'}</Text>
                                </Box>
                                <Box flexDirection="column" width="100%">
                                    {codeLines.map((line, idx) => (
                                        <Box key={idx} width="100%">
                                            <Box width={gutterWidth + 2} flexShrink={0}>
                                                <Text color="gray">{String(idx + 1).padStart(gutterWidth, ' ')} </Text>
                                            </Box>
                                            <Box flexGrow={1}>
                                                {renderHighlightedLine(line, lang, '#e1e4e8')}
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
                    paddingTop={1}
                    paddingBottom={1}
                    backgroundColor="#1a1a1a"
                    width="100%"
                >
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
                    paddingTop={1}
                    paddingBottom={1}
                    backgroundColor="#1a1a1a"
                    width="100%"
                >
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
                    paddingTop={1}
                    paddingBottom={1}
                    backgroundColor="#1a1a1a"
                    width="100%"
                >
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
    const { msg, type, text, isStreamingMsg, workedDuration } = block;

    // Batch chunk — renders up to CHUNK_SIZE sub-blocks committed together to <Static>
    if (type === 'chunk') {
        return (
            <Box flexDirection="column" width="100%">
                {block.blocks.map(b => (
                    <BlockItem
                        key={b.key}
                        block={b}
                        columns={columns}
                        showFullThinking={showFullThinking}
                        aiProvider={aiProvider}
                        version={version}
                    />
                ))}
            </Box>
        );
    }

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
                {isStreamingMsg ? (
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

        const animatedText = useStreamingText(text, isStreamingMsg, block.isActiveBlock);
        const trimmed = animatedText.trim();
        const isUnordered = /^[\*\-\+]\s/.test(trimmed);
        const isOrdered = /^\d+\.\s/.test(trimmed);

        let content = animatedText;
        if (isUnordered || isOrdered) {
            const bullet = isUnordered ? '  • ' : trimmed.match(/^\d+\.\s/)[0];
            const indent = ' '.repeat(bullet.length);
            const wrappedPart = wrapText(trimmed.replace(/^[\*\-\d+\.]+\s/, ''), columns - (bullet.length + 10));
            content = bullet + wrappedPart.split('\n').join('\n' + indent);
        } else {
            content = wrapText(animatedText, columns - 10);
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
        const animatedText = useStreamingText(text, isStreamingMsg, block.isActiveBlock);
        return (
            <Box flexDirection="column" paddingX={1} width="100%">
                <CodeRenderer text={animatedText} columns={columns} />
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
                    pairContent={block.pairContent}
                    parentText={undefined} // No longer needed
                    columns={columns}
                />
                {isLastLine && renderPaddingLine(true)}
            </Box>
        );
    }

    // ── Streaming code-block lines ────────────────────────────────────────────
    // Each of these types maps to one row of a fenced code block so that every
    // completed line is immediately committed to <Static> scrollback.

    if (type === 'code-fence-open') {
        // Empty border row (top padding) + header row — mirrors write-line's renderPaddingLine pattern.
        const borderProps = {
            borderStyle: 'single', borderLeft: true, borderRight: false,
            borderTop: false, borderBottom: false, borderColor: '#444444', paddingLeft: 2, width: '100%'
        };
        return (
            <Box flexDirection="column" marginTop={1} width="100%">
                {/* Empty pad row with left border — sits above the ▶_ header */}
                <Box flexDirection="row" {...borderProps}>
                    <Text> </Text>
                </Box>
                <Box flexDirection="row" {...borderProps}>
                    <Text color="gray" bold>▶_ {(text || 'CODE').toUpperCase()}</Text>
                </Box>
            </Box>
        );
    }

    if (type === 'code-line') {
        // Renders one source line with a 3-char gutter. Fixed width avoids
        // needing to know the total line count up-front during streaming.
        const { lineNum, lang } = block;
        return (
            <Box
                flexDirection="row"
                borderStyle="single"
                borderLeft borderRight={false} borderTop={false} borderBottom={false}
                borderColor="#444444"
                paddingLeft={2}
                width="100%"
            >
                <Box width={4} flexShrink={0}>
                    <Text color="gray" dimColor>{String(lineNum).padStart(3, ' ')} </Text>
                </Box>
                <Box flexGrow={1}>
                    {renderHighlightedLine(text, lang, '#e1e4e8')}
                </Box>
            </Box>
        );
    }

    if (type === 'code-fence-close') {
        // Renders the closing spacer row that gives the block bottom breathing room.
        return (
            <Box
                flexDirection="row"
                borderStyle="single"
                borderLeft borderRight={false} borderTop={false} borderBottom={false}
                borderColor="#444444"
                paddingLeft={2}
                marginBottom={1}
                width="100%"
            >
                <Text> </Text>
            </Box>
        );
    }
    // ─────────────────────────────────────────────────────────────────────────

    if (type === 'write-header') {
        return (
            <Box flexDirection="column" paddingX={1} width={columns}>
                <MarkdownText text={text} columns={columns} />
            </Box>
        );
    }

    if (type === 'write-line') {
        const { gutterWidth, lineNum, isFirstLine, isLastLine, extension, wrappedLines } = block;

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
                    <Box flexGrow={1} flexDirection="column">
                        {(wrappedLines || [text]).map((wl, idx) => (
                            <Box key={idx}>
                                {renderHighlightedLine(wl, extension, 'white')}
                            </Box>
                        ))}
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
                    Worked for <Text bold color="white">{formatThinkingDuration(workedDuration)}</Text>
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
