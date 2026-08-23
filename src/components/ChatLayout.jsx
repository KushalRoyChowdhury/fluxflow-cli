import React, { useState, useEffect, useRef } from 'react';
import fs from 'fs';
import { Box, Text } from 'ink';
import { TerminalBox } from './TerminalBox.jsx';
import { wrapText, cleanSignals, parseLineInfo, getSimilarity, alignChangeGroup, flattenString } from '../utils/text.js';
import { emojiSpace, getFluxLogo } from '../utils/terminal.js';
import { diffWordsWithSpace } from 'diff';
import { isAbsolute } from 'path';
import { getThemeColors } from '../utils/theme.js';

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
                <MarkdownText text={trimmed} color="#969696" columns={availableWidth} italic={true} />
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
const REGEX_MD_TOKENS = /(```[\s\S]*?```|`[^`\r\n]+`|@\[.*?\]|\*\*.*?\*\*|\*.*?\*|\\\(.*?\\\)|\\\[.*?\\\]|\$.*?\$|\[.*?\]\s*\(.*?\)|\[.*?\]\s*\[.*?\]|https?:\/\/[^\s]+)/g;
const REGEX_FENCED_CODE = /```(\w*)\n?([\s\S]*?)(?:```|$)/;
const REGEX_LATEX_FRAC = /\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g;
const REGEX_LATEX_STYLE = /(\\(?:mathbf|textbf|textit|underline|texttt)\{[^{}]*\})/g;
const REGEX_HEADING = /^(#{1,6})\s+(.*)/;

// Additional hoisted regexes to prevent V8 recompilation during render loops
const REGEX_MATH_MULT = /\\multiply|\\mul|\\times/g;
const REGEX_MATH_DIV = /\\div/g;
const REGEX_MATH_CDOT = /\\cdot/g;
const REGEX_MATH_INFTY = /\\infty/g;
const REGEX_MATH_PM = /\\pm/g;
const REGEX_MATH_LEQ = /\\leq/g;
const REGEX_MATH_GEQ = /\\geq/g;
const REGEX_MATH_NEQ = /\\neq/g;
const REGEX_MATH_SQRT1 = /\\sqrt\s*\{([^}]+)\}/g;
const REGEX_MATH_SQRT2 = /\\sqrt\s*(\w+|\d+)/g;
const REGEX_MATH_ALPHA = /\\alpha/g;
const REGEX_MATH_BETA = /\\beta/g;
const REGEX_MATH_THETA = /\\theta/g;
const REGEX_MATH_PI = /\\pi/g;
const REGEX_MATH_APPROX = /\\approx/g;
const REGEX_MATH_DELTA = /\\Delta/g;
const REGEX_MATH_SIGMA = /\\sigma/g;
const REGEX_MATH_SUM = /\\sum/g;
const REGEX_MATH_PROD = /\\prod/g;
const REGEX_MATH_ARROW = /\\rightarrow|\\to/g;
const REGEX_MATH_LONE_LR = /\\left\b|\\right\b/g;
const REGEX_MATH_LR_PAREN = /\\left\(|\\right\)/g;
const REGEX_MATH_LR_BRACK = /\\left\[|\\right\]/g;
const REGEX_MATH_LR_CURLY = /\\\{|\\\}/g;
const REGEX_MATH_TEXT1 = /\\text\s*\{([^}]+)\}/g;
const REGEX_MATH_TEXT2 = /\\text\s+(\w+)/g;
const REGEX_MATH_PCT = /\\%/g;
const REGEX_MATH_BARE_PAREN = /\\\(|\\\)/g;
const REGEX_MATH_BARE_BRACK = /\\\[|\\\]/g;
const REGEX_AT_REF = /@\[(.*?)\]/g;
const REGEX_COLON_L = /:L/gi;
const REGEX_MD_LINK_PAREN = /\[(.*?)\]\s*\((.*?)\)/;
const REGEX_MD_LINK_BRACKET = /\[(.*?)\]\s*\[(.*?)\]/;
const REGEX_LATEX_CMD = /\\(\w+)\{([^{}]*)\}/;

const parseMathSymbols = (content) => {
    return content
        .replace(REGEX_MATH_BARE_PAREN, match => match.includes('(') ? '(' : ')')
        .replace(REGEX_MATH_BARE_BRACK, match => match.includes('[') ? '[' : ']')
        .replace(REGEX_MATH_MULT, '×')
        .replace(REGEX_MATH_DIV, '÷')
        .replace(REGEX_MATH_CDOT, '⋅')
        .replace(REGEX_MATH_INFTY, '∞')
        .replace(REGEX_MATH_PM, '±')
        .replace(REGEX_MATH_LEQ, '≤')
        .replace(REGEX_MATH_GEQ, '≥')
        .replace(REGEX_MATH_NEQ, '≠')
        .replace(REGEX_MATH_SQRT1, '√($1)')
        .replace(REGEX_MATH_SQRT2, '√($1)')
        .replace(REGEX_MATH_ALPHA, 'α')
        .replace(REGEX_MATH_BETA, 'β')
        .replace(REGEX_MATH_THETA, 'θ')
        .replace(REGEX_MATH_PI, 'π')
        .replace(REGEX_MATH_APPROX, '≈')
        .replace(REGEX_MATH_DELTA, 'Δ')
        .replace(REGEX_MATH_SIGMA, 'σ')
        .replace(REGEX_MATH_SUM, 'Σ')
        .replace(REGEX_MATH_PROD, 'Π')
        .replace(REGEX_MATH_ARROW, '→')
        .replace(REGEX_MATH_LONE_LR, '')
        .replace(REGEX_MATH_LR_PAREN, match => match.includes('left') ? '(' : ')')
        .replace(REGEX_MATH_LR_BRACK, match => match.includes('left') ? '[' : ']')
        .replace(REGEX_MATH_LR_CURLY, match => match.includes('{') ? '{' : '}')
        .replace(REGEX_MATH_TEXT1, '$1')
        .replace(REGEX_MATH_TEXT2, '$1')
        .replace(REGEX_MATH_PCT, '%');
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
            tokens.push({ text: flattenString(line.substring(lastIndex, matchIndex)) });
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
        tokens.push({ text: flattenString(matchText), color, bold });
        lastIndex = REGEX_SYNTAX.lastIndex;
    }
    if (lastIndex < line.length) {
        tokens.push({ text: flattenString(line.substring(lastIndex)) });
    }

    if (tokenCache.size >= MAX_TOKEN_CACHE_SIZE) {
        const firstKey = tokenCache.keys().next().value;
        tokenCache.delete(firstKey);
    }
    tokenCache.set(cacheKey, tokens);
    return tokens;
};

const renderHighlightedLine = (line, lang, defaultColor = undefined, defaultBgColor = undefined) => {
    if (!line) return <Text backgroundColor={defaultBgColor}>{' '}</Text>;
    const tokens = tokenizeLine(line, lang);
    return (
        <Text color={defaultColor} backgroundColor={defaultBgColor}>
            {tokens.map((token, idx) => (
                <Text key={idx} color={token.color || defaultColor} backgroundColor={defaultBgColor} bold={token.bold}>
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
                    const match = p.match(REGEX_LATEX_CMD);
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

const InlineMarkdown = React.memo(({ text, color, italic, theme = 'Dark' }) => {
    if (!text) return null;
    const colors = getThemeColors(theme);
    const textColor = color || colors.text;
    const highlightColor = colors.codeText || (colors.logoGradient && colors.logoGradient[0]) || colors.info || colors.secondary || 'cyan';

    // Use cached regex to prevent GC thrashing during stream renders
    const parts = text.split(REGEX_MD_TOKENS);

    return (
        <Text color={textColor} wrap="anywhere" italic={italic}>
            {parts.map((part, j) => {
                if (!part) return null;

                // 🏷️ Fenced Code (Captured here to prevent single-backtick shadowing)
                if (part.startsWith('```') && part.endsWith('```')) {
                    // Render as inline to prevent <Box> inside <Text> crashes
                    const content = part.slice(3, -3);
                    return <Text key={j} color={highlightColor}>{content}</Text>;
                }

                // 🏷️ Recursive Bold
                if (part.startsWith('**') && part.endsWith('**')) {
                    return <Text key={j} bold color={textColor}><InlineMarkdown text={part.slice(2, -2)} color={textColor} theme={theme} /></Text>;
                }

                // 🏷️ Recursive Italic
                if (part.startsWith('*') && part.endsWith('*')) {
                    return <Text key={j} italic color={textColor}><InlineMarkdown text={part.slice(1, -1)} color={textColor} italic={italic} theme={theme} /></Text>;
                }

                if (part.startsWith('`')) {
                    if (part.endsWith('`') && part.length > 1) {
                        const content = part.slice(1, -1);
                        const formatted = content.replace(REGEX_AT_REF, (match, p1) => {
                            return p1.split('/').pop().split('\\').pop().replace(REGEX_COLON_L, '#L');
                        });
                        const hasFileRef = content.includes('@[');
                        return <Text key={j} color={highlightColor} bold={hasFileRef}>{formatted}</Text>;
                    } else {
                        // Unclosed backtick span while streaming — render as code text so it doesn't freeze or hide trailing tokens
                        return <Text key={j} color={highlightColor}>{part.slice(1)}</Text>;
                    }
                }

                if (part.startsWith('@[') && part.endsWith(']')) {
                    const filePath = part.slice(2, -1);
                    const basename = filePath.split('/').pop().split('\\').pop().replace(REGEX_COLON_L, '#L');
                    return <Text key={j} color={highlightColor} bold>{basename}</Text>;
                }

                // 📐 Advanced LaTeX support (\( ... \), \[ ... \], $ ... $)
                if ((part.startsWith('\\(') && part.endsWith('\\)')) || (part.startsWith('\\[') && part.endsWith('\\]'))) {
                    const content = part.slice(2, -2);
                    return (
                        <Text key={j} color="yellow">
                            {renderLatexText(content, j)}
                        </Text>
                    );
                }

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
                    const match = part.match(REGEX_MD_LINK_PAREN);
                    if (match) return (
                        <Text key={j}>
                            <Text color={highlightColor} underline bold>{match[1]}</Text>
                            <Text color="gray" italic> ({match[2]})</Text>
                        </Text>
                    );
                }
                if (part.startsWith('[') && (part.includes('][') || part.includes('] ['))) {
                    const match = part.match(REGEX_MD_LINK_BRACKET);
                    if (match) return (
                        <Text key={j}>
                            <Text color={highlightColor} underline bold>{match[1]}</Text>
                            <Text color="gray" italic> [{match[2]}]</Text>
                        </Text>
                    );
                }
                if (part.startsWith('http')) {
                    return <Text key={j} color={highlightColor} underline italic>{part}</Text>;
                }

                return renderLatexText(part, j);
            })}
        </Text>
    );
});

// Helper: Wrap text to a specific width without breaking words

const TableRenderer = React.memo(({ buffer, terminalWidth = 80, theme = 'Dark' }) => {
    if (buffer.length < 2) return null;
    const colors = getThemeColors(theme);
    const headerColor = colors.codeText || colors.secondary || colors.info || 'cyan';

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
        <Box flexDirection="column" borderStyle="round" borderColor={colors.borderMuted} paddingX={1} marginY={0} width={terminalWidth - 2}>
            {/* Header with Integrated Divider */}
            <Box flexDirection="row" borderStyle="single" borderBottom borderTop={false} borderLeft={false} borderRight={false} borderColor={colors.borderMuted} marginBottom={1} paddingBottom={0} width="100%">
                {header.map((cell, i) => (
                    <Box key={i} flexBasis={`${colPercentage}%`} flexGrow={1} flexShrink={0} paddingRight={2}>
                        <InlineMarkdown text={wrapText(cell, colChars)} color={headerColor} theme={theme} />
                    </Box>
                ))}
            </Box>

            {/* Rows */}
            {data.map((row, ri) => (
                <Box key={ri} flexDirection="row" marginBottom={ri === data.length - 1 ? 0 : 1} width="100%">
                    {row.map((cell, ci) => (
                        <Box key={ci} flexBasis={`${colPercentage}%`} flexGrow={1} flexShrink={0} paddingRight={2} flexDirection="column">
                            <InlineMarkdown text={wrapText(cell, colChars)} color={colors.text} theme={theme} />
                        </Box>
                    ))}
                </Box>
            ))}
        </Box>
    );
});

const MarkdownText = React.memo(({ text, color, columns = 80, italic = false, theme = 'Dark' }) => {
    if (!text) return null;
    const colors = getThemeColors(theme);
    const textColor = color || colors.text;

    const lines = text.split('\n');
    const result = [];
    let tableBuffer = [];
    let quoteBuffer = [];

    const flushBuffers = (key) => {
        if (tableBuffer.length > 0) {
            result.push(<TableRenderer key={`table-${key}`} buffer={[...tableBuffer]} terminalWidth={columns} theme={theme} />);
            tableBuffer = [];
        }
        if (quoteBuffer.length > 0) {
            const quoteWidth = columns - 6; // Account for border, padding, and outer box margins
            const wrappedQuoteLines = quoteBuffer.flatMap(line => wrapText(line, quoteWidth).split('\n'));
            result.push(
                <Box key={`quote-${key}`} borderStyle="bold" borderLeft borderRight={false} borderTop={false} borderBottom={false} borderColor={colors.borderMuted} paddingLeft={1} marginY={1} flexDirection="column">
                    {wrappedQuoteLines.map((line, qi) => (
                        <InlineMarkdown key={qi} text={line} color={colors.textMuted} italic={italic} theme={theme} />
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
                result.push(<Box key={i} marginY={0} borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false} width="100%" borderColor={colors.borderMuted} />);
                return;
            }

            // Headings
            const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)/);
            if (headingMatch) {
                const level = headingMatch[1].length;
                const hText = headingMatch[2];
                result.push(
                    <Box key={i} marginTop={1} marginBottom={0} width="100%">
                        <Text bold color={level === 1 ? 'cyan' : level === 2 ? 'magenta' : level === 3 ? 'yellow' : level === 4 ? 'green' : level === 5 ? 'blue' : colors.text} underline>
                            {hText}
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
                <Box key={i} flexDirection="column" width="100%">
                    <InlineMarkdown text={content} color={textColor} italic={italic} theme={theme} />
                </Box>
            );
        }
    });

    flushBuffers('final');
    return <Box flexDirection="column" width={columns - 2}>{result}</Box>;
});

const DiffLine = React.memo(({ line, pairContent, parentText, columns = 80, extension, theme = 'Dark' }) => {
    const colors = getThemeColors(theme);
    const isContext = line.includes('[UI_CONTEXT]');
    const cleanLine = line.replace('[UI_CONTEXT]', '');

    // Handle high-fidelity multi-patch separator
    if (isContext && cleanLine.includes('═')) {
        return (
            <Box backgroundColor={colors.codeBg} paddingX={1} width={columns}>
                <Text color="gray">{'═'.repeat(Math.max(10, columns - 4))}</Text>
            </Box>
        );
    }

    const parsedCurrent = parseLineInfo(line);
    if (!parsedCurrent) {
        return (
            <Box backgroundColor={colors.codeBg} paddingX={1} width={columns}>
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
    const innerBgColor = isRemoval ? colors.diffRemovalBg : (isAddition ? colors.diffAdditionBg : undefined);

    // Row indicator colors
    const finalNumColor = (isRemoval || isAddition) ? (isRemoval ? colors.diffRemovalNum : colors.diffAdditionNum) : colors.textMuted;
    const finalPrefixColor = isRemoval ? colors.diffRemovalPrefix : colors.diffAdditionPrefix;
    const displayPrefix = isRemoval ? '-' : (isAddition ? '+' : ' ');

    const renderInlineDiff = () => {
        // Case A: Pure completely brand new line block layout
        if (isPureUnpairedBlock) {
            const textBgColor = isRemoval ? colors.diffRemovalHighlightBg : colors.diffAdditionHighlightBg;
            return (
                <Box flexDirection="column">
                    {renderHighlightedLine(wrapText(content, columns - 15), extension, undefined, textBgColor)}
                </Box>
            );
        }

        // Case B: Truly unchanged boilerplate context lines get full soft tint
        if (!(isRemoval || isAddition) || words.length === 0 || !hasInlineChange) {
            const textColor = isRemoval ? colors.diffRemovalText : (isAddition ? colors.diffAdditionText : colors.textMuted);
            const textBgColor = undefined;
            return (
                <Box flexDirection="column">
                    {renderHighlightedLine(wrapText(content, columns - 15), extension, textColor, textBgColor)}
                </Box>
            );
        }

        // Case C: Surgical inline changes with high-contrast normal-weight coloring & smart word wrapping 🎯
        const maxLen = Math.max(10, columns - 15);
        const wrappedLines = wrapText(content, maxLen).split('\n');

        const validWords = [];
        words.forEach((part, idx) => {
            const isWhitespace = /^\s+$/.test(part.value);
            if (isRemoval) {
                const isSurroundedByRemoval = (words[idx - 1]?.removed) || (words[idx + 1]?.removed);
                if (part.removed || (isWhitespace && isSurroundedByRemoval)) {
                    validWords.push({ text: part.value, isHighlight: true });
                } else if (!part.added) {
                    validWords.push({ text: part.value, isHighlight: false });
                }
            } else if (isAddition) {
                const isSurroundedByAddition = (words[idx - 1]?.added) || (words[idx + 1]?.added);
                if (part.added || (isWhitespace && isSurroundedByAddition)) {
                    validWords.push({ text: part.value, isHighlight: true });
                } else if (!part.removed) {
                    validWords.push({ text: part.value, isHighlight: false });
                }
            }
        });

        if (wrappedLines.length <= 1) {
            return (
                <Text wrap="wrap">
                    {validWords.map((part, idx) => {
                        if (isRemoval) {
                            if (part.isHighlight) {
                                return (
                                    <React.Fragment key={idx}>
                                        {renderHighlightedLine(part.text, extension, colors.diffRemovalHighlightColor, colors.diffRemovalHighlightBg)}
                                    </React.Fragment>
                                );
                            }
                            return <React.Fragment key={idx}>{renderHighlightedLine(part.text, extension, colors.diffRemovalText)}</React.Fragment>;
                        }
                        if (isAddition) {
                            if (part.isHighlight) {
                                return (
                                    <React.Fragment key={idx}>
                                        {renderHighlightedLine(part.text, extension, colors.diffAdditionHighlightColor, colors.diffAdditionHighlightBg)}
                                    </React.Fragment>
                                );
                            }
                            return <React.Fragment key={idx}>{renderHighlightedLine(part.text, extension, colors.diffAdditionText)}</React.Fragment>;
                        }
                        return <React.Fragment key={idx}>{renderHighlightedLine(part.text, extension, colors.textMuted)}</React.Fragment>;
                    })}
                </Text>
            );
        }

        let wordIdx = 0;
        let charIdx = 0;

        const leadingSpaceMatch = content.match(/^(\s*)/);
        const indent = leadingSpaceMatch ? leadingSpaceMatch[1] : '';
        const cappedIndent = indent.substring(0, Math.min(indent.length, 8));

        const lineSpans = wrappedLines.map((wl, lineIdx) => {
            const spans = [];
            let lineTextToMatch = wl;

            if (lineIdx > 0 && cappedIndent && wl.startsWith(cappedIndent)) {
                const currentAvail = validWords[wordIdx] ? validWords[wordIdx].text.substring(charIdx) : '';
                if (!currentAvail.startsWith(cappedIndent)) {
                    spans.push({ text: cappedIndent, isHighlight: false });
                    lineTextToMatch = wl.substring(cappedIndent.length);
                }
            }

            let neededLength = lineTextToMatch.length;

            while (neededLength > 0 && wordIdx < validWords.length) {
                const vw = validWords[wordIdx];
                const avail = vw.text.length - charIdx;

                if (avail <= 0) {
                    wordIdx++;
                    charIdx = 0;
                    continue;
                }

                const takeLen = Math.min(neededLength, avail);
                spans.push({
                    text: vw.text.substring(charIdx, charIdx + takeLen),
                    isHighlight: vw.isHighlight
                });

                charIdx += takeLen;
                neededLength -= takeLen;

                if (charIdx >= vw.text.length) {
                    wordIdx++;
                    charIdx = 0;
                }
            }

            while (wordIdx < validWords.length) {
                const vw = validWords[wordIdx];
                const rem = vw.text.substring(charIdx);
                if (/^\s+$/.test(rem)) {
                    wordIdx++;
                    charIdx = 0;
                } else if (rem.startsWith(' ') || rem.startsWith('\t')) {
                    let skipCount = 0;
                    while (skipCount < rem.length && (rem[skipCount] === ' ' || rem[skipCount] === '\t')) {
                        skipCount++;
                    }
                    charIdx += skipCount;
                    if (charIdx >= vw.text.length) {
                        wordIdx++;
                        charIdx = 0;
                    }
                    break;
                } else {
                    break;
                }
            }

            return spans;
        });

        if (wordIdx < validWords.length) {
            const lastSpans = lineSpans[lineSpans.length - 1];
            while (wordIdx < validWords.length) {
                const vw = validWords[wordIdx];
                lastSpans.push({
                    text: vw.text.substring(charIdx),
                    isHighlight: vw.isHighlight
                });
                wordIdx++;
                charIdx = 0;
            }
        }

        return (
            <Box flexDirection="column">
                {lineSpans.map((spans, lIdx) => (
                    <Box key={lIdx}>
                        <Text wrap="wrap">
                            {spans.map((part, sIdx) => {
                                if (isRemoval) {
                                    if (part.isHighlight) {
                                        return (
                                            <React.Fragment key={sIdx}>
                                                {renderHighlightedLine(part.text, extension, colors.diffRemovalHighlightColor, colors.diffRemovalHighlightBg)}
                                            </React.Fragment>
                                        );
                                    }
                                    return <React.Fragment key={sIdx}>{renderHighlightedLine(part.text, extension, colors.diffRemovalText)}</React.Fragment>;
                                }
                                if (isAddition) {
                                    if (part.isHighlight) {
                                        return (
                                            <React.Fragment key={sIdx}>
                                                {renderHighlightedLine(part.text, extension, colors.diffAdditionHighlightColor, colors.diffAdditionHighlightBg)}
                                            </React.Fragment>
                                        );
                                    }
                                    return <React.Fragment key={sIdx}>{renderHighlightedLine(part.text, extension, colors.diffAdditionText)}</React.Fragment>;
                                }
                                return <React.Fragment key={sIdx}>{renderHighlightedLine(part.text, extension, colors.textMuted)}</React.Fragment>;
                            })}
                        </Text>
                    </Box>
                ))}
            </Box>
        );
    };

    return (
        <Box backgroundColor={colors.codeBg} paddingX={1} width={columns}>
            {/* Gutter Line Number */}
            <Box width={4} flexShrink={0} justifyContent="flex-end">
                <Text color={finalNumColor}>{lineNum}</Text>
            </Box>

            {/* Gutter Prefix Symbol */}
            <Box width={1} flexShrink={0} marginLeft={1}>
                <Text color={finalPrefixColor}>
                    {displayPrefix}
                </Text>
            </Box>

            {/* Content Wrapper */}
            <Box marginLeft={1} backgroundColor={innerBgColor} flexGrow={1}>
                {renderInlineDiff()}
            </Box>
        </Box>
    );
});

const DiffBlock = React.memo(({ text, columns = 80, extension, theme = 'Dark' }) => {
    const colors = getThemeColors(theme);
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
                <Box backgroundColor={colors.codeBg} paddingX={1} width="100%">
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
                        theme={theme}
                    />
                ))}
                <Box backgroundColor={colors.codeBg} paddingX={1} width="100%">
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

export const CodeRenderer = React.memo(({ text, columns = 80, theme = 'Dark' }) => {
    if (!text) return null;
    const colors = getThemeColors(theme);

    let extension = '';
    const fileMatch = text.match(/File\s+\[(.*?)\]/i);
    if (fileMatch) {
        extension = fileMatch[1].split('.').pop().toLowerCase();
    }

    // SCENARIO 1: Surgical Diff [DIFF_START]
    if (text.includes('[DIFF_START]')) {
        return <DiffBlock text={text} columns={columns} extension={extension} theme={theme} />;
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
                    borderLeft={false}
                    borderRight={false}
                    borderTop={false}
                    borderBottom={false}
                    borderColor={colors.codeBorder}
                    paddingLeft={2}
                    paddingRight={0}
                    width="100%"
                    marginBottom={1}
                    backgroundColor={colors.codeBg}
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
                                    {renderHighlightedLine(line, extension, colors.text)}
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
                        const raw = match ? match[2] : part.replace(/^```\w*\n?/, '').replace(/```$/, '');
                        const rawLines = raw.trimEnd().split('\n');
                        const gutterWidth = String(rawLines.length).length;
                        const codeWidth = columns - 7 - gutterWidth;
                        const code = codeWidth > 5 ? wrapText(raw, codeWidth) : raw;
                        const codeLines = code.trimEnd().split('\n');
                        return (
                            <Box
                                key={i}
                                flexDirection="column"
                                marginY={0}
                                paddingLeft={2}
                                paddingRight={0}
                                width="100%"
                            >
                                <Box>
                                    <Text color="gray" bold>▶_ {lang.toUpperCase() || 'TEXT'}</Text>
                                </Box>
                                <Box flexDirection="column" width="100%">
                                    {codeLines.map((line, idx) => {
                                        const wrappedCodeLine = wrapText(line, Math.max(10, codeWidth));
                                        const subLines = wrappedCodeLine.split('\n');
                                        return (
                                            <Box key={idx} flexDirection="column" width="100%">
                                                {subLines.map((subLine, subIdx) => (
                                                    <Box key={subIdx} width="100%">
                                                        <Box width={gutterWidth + 2} flexShrink={0}>
                                                            <Text color="gray">{subIdx === 0 ? String(idx + 1).padStart(gutterWidth, ' ') + ' ' : ' '.repeat(gutterWidth + 1)}</Text>
                                                        </Box>
                                                        <Box flexGrow={1}>
                                                            {renderHighlightedLine(subLine, lang, colors.text)}
                                                        </Box>
                                                    </Box>
                                                ))}
                                            </Box>
                                        );
                                    })}
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
                    return <MarkdownText key={i} text={cleanPart} columns={columns - 3} theme={theme} />;
                })}
            </Box>
        );
    }

    // SCENARIO 4: Standard Markdown
    return <MarkdownText text={text} columns={columns - 3} theme={theme} />;
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

export const MessageItem = React.memo(({ msg, showFullThinking, columns = 80, aiProvider, version, theme = 'Dark' }) => {
    const colors = getThemeColors(theme);
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
                <Box flexDirection="column" borderStyle="round" borderColor={colors.border} dimColor padding={0} width="100%">
                    <Box paddingX={1}>
                        <Text color={colors.text} bold>{msg.text}</Text>
                    </Box>
                    <Box paddingX={1} marginTop={0} marginBottom={0}>
                        <Text color={colors.text}>{msg.subText}</Text>
                    </Box>
                </Box>
            </Box>
        );
    }

    if (msg.isLogo) {
        return (
            <Box flexDirection="column" alignItems="flex-start" width="100%" marginY={1}>
                <Text>{getFluxLogo(version, aiProvider, theme)}</Text>
            </Box>
        );
    }

    if (msg.id && String(msg.id).startsWith('welcome')) {
        return (
            <Box flexDirection="column" alignItems="center" width="100%" marginY={1}>
                <Box borderStyle="round" borderColor={colors.borderMuted} paddingX={3} paddingY={0}>
                    <Text color={colors.text} bold>{msg.text.trim()}</Text>
                </Box>
            </Box>
        );
    }

    if (msg.isVisualFeedback) {
        return (
            // [SPACE POINT]
            <Box marginBottom={0} marginTop={0} paddingX={0} width="100%">
                <Text color={colors.text}>{msg.text}</Text>
            </Box>
        );
    }

    if (isPatchError) {
        return (
            <Box marginBottom={1}>
                <Box flexDirection="column" borderStyle="round" borderColor={colors.border} paddingX={1} paddingY={0}>
                    <Text color={colors.text} bold underline>✗ PATCH FAILED</Text>
                    <Box marginTop={1}>
                        <Text color={colors.textMuted} bold>Model generated malformed edit.</Text>
                    </Box>
                </Box>
            </Box>
        );
    }

    if (msg.role === 'system' && msg.text?.includes('[TOOL RESULT]') && !isDiffResult && !isTerminalRecord && !isPatchError) return null;

    if (msg.isImageStats) {
        return (
            <Box marginBottom={1} paddingX={1} width="100%">
                <Box flexDirection="column" borderStyle="round" borderColor={colors.borderMuted} padding={0} width="100%">
                    <Box paddingX={1} backgroundColor={colors.codeBg}>
                        <Text color={colors.text} bold>IMAGE STATS</Text>
                    </Box>
                    <Box paddingX={1} marginTop={1} marginBottom={1} flexDirection="column">
                        {msg.text.split('\n').map((line, i) => (
                            <Text key={i} color={colors.textMuted}>{line}</Text>
                        ))}
                    </Box>
                </Box>
            </Box>
        );
    }

    if (msg.isAskRecord) {
        const selectionMatch = msg.text.match(/Selection: (.*)/);
        const selection = selectionMatch ? selectionMatch[1] : 'No selection';
        const questionMatch = msg.text.match(/Question: (.*)/);
        const question = questionMatch ? questionMatch[1] : null;

        return (
            <Box marginBottom={0} paddingX={1} width="100%">
                <Box
                    flexDirection="column"
                    borderStyle="single"
                    borderLeft={false}
                    borderRight={false}
                    borderTop={true}
                    borderBottom={true}
                    borderColor={colors.codeBorder}
                    paddingLeft={2}
                    paddingRight={0}
                    paddingTop={1}
                    paddingBottom={1}
                    marginY={1}
                    width={columns - 2}
                >
                    <Box paddingX={1}>
                        <Text color={colors.success} bold>AGENT REQUEST: RESOLVED</Text>
                    </Box>
                    {question && (
                        <Box paddingX={1} marginTop={1}>
                            <Text color={colors.secondary}>{question}</Text>
                        </Box>
                    )}
                    <Box paddingX={1} marginTop={1} marginBottom={0}>
                        <Text color={colors.text}>Selection: <Text color={colors.textMuted} bold>{selection}</Text></Text>
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
                    borderStyle="round"
                    border={true}
                    paddingLeft={2}
                    paddingRight={0}
                    paddingTop={1}
                    paddingBottom={1}
                    backgroundColor={colors.codeBg}
                    width="100%"
                >
                    <Box paddingX={1}>
                        <Text color={colors.text} bold>ABOUT FLUX FLOW</Text>
                    </Box>
                    <Box paddingX={1} marginTop={1} marginBottom={1}>
                        <Text color={colors.text}>{msg.text}</Text>
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
                    borderStyle="round"
                    border={true}
                    paddingLeft={2}
                    paddingRight={0}
                    paddingTop={1}
                    paddingBottom={1}
                    backgroundColor={colors.codeBg}
                    width="100%"
                >
                    <Box paddingX={1}>
                        <Text color={colors.text} bold>UPDATE AVAILABLE</Text>
                    </Box>
                    <Box paddingX={1} marginTop={1} marginBottom={1}>
                        <CodeRenderer text={msg.text} columns={columns} theme={theme} />
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
            { cmd: '/truncate', desc: 'Truncate tool results in chat history' },
            { cmd: '/clear', desc: 'Clear terminal screen' },
            { cmd: '/resume', desc: 'Load previous session' },
            { cmd: '/revert', desc: 'Revert codebase to checkpoint' },
            { cmd: '/save', desc: 'Force save current chat' },
            { cmd: '/export', desc: 'Export current chat or error logs' },
            { cmd: '/chats', desc: 'List all chat sessions' },
            { cmd: '/btw', desc: 'Send raw inquiry mid-turn' },
            // { cmd: '/image', desc: 'Generate images' },
            { cmd: '/budget', desc: 'Set or View budget limits' },
            { cmd: '/mode', desc: 'Toggle Flux/Flow modes' },
            { cmd: '/thinking', desc: 'Set AI reasoning depth' },
            { cmd: '/model', desc: 'Switch AI model' },
            { cmd: '/wildcard-tooling', desc: 'Use if the model lacks Tooling Capability' },
            { cmd: '/provider', desc: 'Select AI Provider' },
            { cmd: '/settings', desc: 'Configure system prefs' },
            { cmd: '/theme', desc: 'Customize UI color theme' },
            { cmd: '/key', desc: 'Manage API keys' },
            { cmd: '/profile', desc: 'Edit developer persona' },
            { cmd: '/memory', desc: 'Manage agent memory' },
            { cmd: '/stats', desc: 'Show session usage' },
            { cmd: '/reset', desc: 'Wipe all saved FluxFlow AppData' },
            { cmd: '/about', desc: 'Project info & credits' },
            { cmd: '/changelog', desc: 'View latest updates' },
            { cmd: '/docs', desc: 'View documentation' },
            { cmd: '/fluxflow', desc: 'Project management' },
            { cmd: '/update', desc: 'Check/Install updates' }
        ];

        return (
            <Box marginBottom={1} paddingX={1} width="100%">
                <Box flexDirection="column" borderStyle="round" borderColor={colors.borderMuted} paddingX={2} paddingY={1} width="100%">
                    <Text color={colors.text} bold underline>AVAILABLE COMMANDS IN FLUX-FLOW</Text>
                    <Box flexDirection="column" marginTop={1}>
                        {commandList.map((c, i) => (
                            <Box key={i} flexDirection="row">
                                <Box width={20}>
                                    <Text color={colors.text} bold>{c.cmd}</Text>
                                </Box>
                                <Text color={colors.textMuted}> - {c.desc}</Text>
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
        const cmd = cmdMatch ? cmdMatch[1] : 'No Command';
        const isPty = ptyMatch ? ptyMatch[1] === 'true' : false;
        const outputList = outputMatch ? outputMatch[1] : '';

        return (
            <Box marginBottom={0} paddingX={1} width="100%">
                <TerminalBox command={cmd} output={outputList} completed={true} columns={columns} isPty={isPty} theme={theme} />
            </Box>
        );
    }

    const [animationDone, setAnimationDone] = React.useState(!msg.isStreaming);
    const content = React.useMemo(() => cleanSignals(msg.text, msg.role === 'think'), [msg.text, msg.role]);

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

    if (msg.role === 'agent' && finalContent.trim() === '') {
        return null;
    }

    return (
        <Box marginBottom={msg.role === 'think' ? 0 : msg.role === 'user' ? 0 : msg.role === 'agent' ? 0 : 0} marginTop={msg.role === 'think' ? 0 : msg.role === 'user' ? 0 : msg.role === 'agent' ? 0 : 0} flexDirection="column" flexShrink={0} width="100%" flexGrow={1}>
            {msg.role === 'user' ? (
                <Box flexDirection="column" width={columns - 1}>
                    <Box width={columns - 1} height={1} overflow="hidden">
                        <Text color={colors.userMsgBorder}>{'▄'.repeat(Math.max(1, columns - 1))}</Text>
                    </Box>
                    <Box
                        backgroundColor={colors.userMsgBg}
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
                                        <Text bold color={colors.userMsgText}>{lineIdx === 0 ? '>' : ' '}</Text>
                                    </Box>
                                    <Box flexGrow={1} marginLeft={1}>
                                        <InlineMarkdown text={line} color={msg.color || colors.userMsgText} theme={theme} />
                                    </Box>
                                </Box>
                            ))}
                    </Box>
                    <Box width={columns - 1} height={1} overflow="hidden">
                        <Text color={colors.userMsgBorder}>{'▀'.repeat(Math.max(1, columns - 1))}</Text>
                    </Box>
                </Box>

            ) : msg.role === 'think' ? (
                <Box flexDirection="column" marginTop={0} marginBottom={0} paddingX={0} width="100%">
                    {msg.isStreaming && !msg.duration ? (
                        <Text bold color={colors.text}>✧ Thinking...</Text>
                    ) : (
                        <Text bold color={colors.text}>
                            ✦ Thought{msg.duration ? (
                                <Text color={colors.textMuted}> for <Text bold color={colors.text}>{formatThinkingDuration(msg.duration)}</Text></Text>
                            ) : 's...'}
                        </Text>
                    )}
                    <Box borderStyle="single" borderLeft borderRight={false} borderTop={false} borderBottom={false} borderColor={colors.borderMuted} paddingLeft={2} paddingTop={0} paddingBottom={0} flexDirection="column" width="100%">
                        {formatThinkText(finalContent, columns)}
                    </Box>
                </Box>
            ) : (
                <Box flexDirection="column" paddingX={1} marginTop={0} width="100%">
                    <CodeRenderer text={finalContent.replace(/ \|\n\n/g, ' |\n')} columns={columns} theme={theme} />
                    {msg.memoryUpdated && (
                        <Box marginTop={1} width="100%">
                            <Text color={colors.text} italic>[Memory Updated]</Text>
                        </Box>
                    )}
                    {msg.role === 'agent' && msg.workedDuration ? (
                        <Box marginTop={1} marginBottom={2} width="100%">
                            <Text color={colors.textMuted}>[</Text><Text color={colors.textMuted}>
                                Worked for <Text bold color={colors.text}>{formatThinkingDuration(msg.workedDuration)}</Text>
                            </Text><Text color={colors.textMuted}>]</Text>
                        </Box>
                    ) : null}
                </Box>
            )}
        </Box>
    );
});

export const BlockItem = React.memo(({ block, columns = 80, showFullThinking, aiProvider, version, theme = 'Dark' }) => {
    const colors = getThemeColors(theme);
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
                        theme={theme}
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
                theme={theme}
            />
        );
    }

    if (type === 'think-header') {
        return (
            <Box flexDirection="column" paddingX={1} width="100%" marginTop={0} marginBottom={0}>
                {isStreamingMsg ? (
                    <Text bold color={colors.text}>✧ Thinking...</Text>
                ) : (
                    <Text bold color={colors.text}>✦ Thoughts...</Text>
                )}
                {/* [TEMORARY SOLUTION] */}
                {showFullThinking && (
                    <Box flexDirection="row" width="100%">
                        <Text color={colors.textMuted}>│ </Text>
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
                    <Text color={colors.textMuted}>│ </Text>
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
                        <Text color={colors.textMuted}>│ </Text>
                        <Box flexGrow={1} marginLeft={1}>
                            <InlineMarkdown text={wLine} color={colors.textMuted} italic theme={theme} />
                        </Box>
                    </Box>
                ))}
            </Box>
        );
    }

    // [TEMORARY SOLUTION]
    if (type === 'think-footer-padding') {
        if (!showFullThinking) return null;
        return (
            <Box flexDirection="row" width="100%" paddingX={1}>
                <Text color={colors.textMuted}>│ </Text>
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
                <CodeRenderer text={animatedText} columns={columns} theme={theme} />
            </Box>
        );
    }

    if (type === 'table') {
        return (
            <Box flexDirection="column" paddingX={1} width="100%">
                <TableRenderer buffer={text.split('\n')} terminalWidth={columns} theme={theme} />
            </Box>
        );
    }

    if (type === 'diff-line') {
        const { isFirstLine, isLastLine } = block;

        const renderPaddingLine = (isEnd = false) => (
            <Box backgroundColor={colors.codeBg} paddingX={1} width={columns} marginBottom={isEnd ? 1 : 0}>
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
                    parentText={undefined}
                    columns={columns}
                    theme={theme}
                />
                {isLastLine && renderPaddingLine(true)}
            </Box>
        );
    }

    if (type === 'code-fence-open') {
        const borderProps = {
            paddingLeft: 2, width: '100%'
        };
        return (
            <Box flexDirection="column" marginTop={0} marginBottom={0} width="100%">
                <Box flexDirection="row" {...borderProps}>
                    <Text> </Text>
                </Box>
                <Box flexDirection="row" {...borderProps}>
                    <Text color="gray" bold>▶_ {(text || 'TEXT').toUpperCase()}</Text>
                </Box>
            </Box>
        );
    }

    if (type === 'code-line') {
        const { lineNum, lang } = block;
        const availableCodeWidth = columns - 12;
        const wrappedLine = wrapText(text, Math.max(10, availableCodeWidth));
        const subLines = wrappedLine.split('\n');
        return (
            <Box flexDirection="column" width="100%">
                {subLines.map((subLine, subIdx) => (
                    <Box
                        key={subIdx}
                        flexDirection="row"
                        borderColor={colors.codeBorder}
                        paddingLeft={2}
                        width="100%"
                    >
                        <Box width={5} flexShrink={0}>
                            <Text color="gray" dimColor>{subIdx === 0 ? String(lineNum).padStart(4, ' ') + ' ' : '     '}</Text>
                        </Box>
                        <Box flexGrow={1}>
                            {renderHighlightedLine(subLine, lang, colors.text)}
                        </Box>
                    </Box>
                ))}
            </Box>
        );
    }

    if (type === 'code-fence-close') {
        return (
            <Box
                flexDirection="row"
                paddingLeft={2}
                marginBottom={1}
                width="100%"
            >
                <Text> </Text>
            </Box>
        );
    }

    if (type === 'write-header') {
        return (
            <Box flexDirection="column" paddingX={1} width={columns}>
                <MarkdownText text={text} columns={columns} theme={theme} />
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
                borderLeft={false}
                borderRight={false}
                borderTop={false}
                borderBottom={false}
                borderColor={colors.codeBorder}
                paddingLeft={2}
                paddingRight={0}
                backgroundColor={colors.codeBg}
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
                    borderLeft={false}
                    borderRight={false}
                    borderTop={false}
                    borderBottom={false}
                    borderColor={colors.codeBorder}
                    paddingLeft={2}
                    paddingRight={0}
                    backgroundColor={colors.codeBg}
                >
                    <Box width={gutterWidth + 2} flexShrink={0}>
                        <Text color="gray" dimColor>{String(lineNum).padStart(gutterWidth, ' ')} </Text>
                    </Box>
                    <Box flexGrow={1} flexDirection="column">
                        {(wrappedLines || [text]).map((wl, idx) => (
                            <Box key={idx}>
                                {renderHighlightedLine(wl, extension, colors.text)}
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
                <MarkdownText text={text} columns={columns} theme={theme} />
            </Box>
        );
    }

    if (type === 'worked-duration') {
        return (
            <Box marginTop={1} marginBottom={2} paddingX={1} width="100%">
                <Text color={colors.textMuted}>[</Text><Text color={colors.textMuted}>
                    Worked for <Text bold color={colors.text}>{formatThinkingDuration(workedDuration)}</Text>
                </Text><Text color={colors.textMuted}>]</Text>
            </Box>
        );
    }

    return null;
});

const ChatLayout = React.memo(({ messages, showFullThinking, columns = 80, aiProvider, version, theme = 'Dark' }) => {
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
                    theme={theme}
                />
            ))}
        </Box>
    );
});

export default ChatLayout;
