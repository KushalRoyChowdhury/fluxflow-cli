import os from 'os';
/**
 * High-fidelity word wrapping that preserves indentation and whitespace.
 * Uses regex tokenization to treat whitespace as distinct tokens.
 */
export const wrapText = (text, width) => {
    if (!text) return '';
    const sourceLines = text.split(/\r?\n/);
    let finalLines = [];

    if (width <= 5) return text;

    sourceLines.forEach(sLine => {
        if (sLine.length <= width) {
            finalLines.push(sLine);
            return;
        }

        const tokens = sLine.split(/(\s+)/);
        let currentLine = '';
        let originalXPos = 0;
        let lastSignificantGap = 0;
        const leadingSpaceMatch = sLine.match(/^(\s*)/);
        if (leadingSpaceMatch) {
            lastSignificantGap = leadingSpaceMatch[1].length;
        }

        // Detect list markers (e.g., "- ", "* ", "1. ")
        const listMatch = sLine.match(/^\s*([-*]|\d+\.)\s+/);
        if (listMatch) {
            lastSignificantGap = listMatch[0].length;
        }

        tokens.forEach((token, idx) => {
            if (token.length === 0) return;

            const isWhitespace = token.trim().length === 0;

            if (isWhitespace) {
                // Track significant gaps for table-like alignment
                if (token.length >= 2) {
                    lastSignificantGap = originalXPos + token.length;
                }

                if (currentLine.length > 0) {
                    currentLine += token;
                }
            } else {
                // Handle markdown table pipes as column markers
                if (token.includes('|') || token.includes('│')) {
                    const pipeIdx = token.includes('|') ? token.indexOf('|') : token.indexOf('│');
                    lastSignificantGap = originalXPos + pipeIdx + 1;
                }

                if ((currentLine + token).length > width) {
                    if (currentLine.trim().length > 0) {
                        finalLines.push(currentLine.replace(/\s+$/, ''));

                        // Use the last significant gap or leading indent
                        const safeIndent = Math.min(lastSignificantGap, Math.max(0, width - 12));
                        const indent = ' '.repeat(safeIndent);
                        currentLine = indent + token;

                        // Ensure we don't overflow again
                        while (currentLine.length > width && width > 20) {
                            finalLines.push(currentLine.substring(0, width));
                            currentLine = indent + currentLine.substring(width);
                        }
                    } else {
                        // Ultra long word or narrow width
                        let word = token;
                        while (word.length > width && width > 5) {
                            finalLines.push(word.substring(0, width));
                            word = word.substring(width);
                        }
                        currentLine = word;
                    }
                } else {
                    currentLine += token;
                }
            }

            originalXPos += token.length;
        });

        if (currentLine) finalLines.push(currentLine.replace(/\s+$/, ''));
    });

    return finalLines.join('\n');
};

/**
 * Formats token counts into human-readable strings (e.g., 1.5k, 2.1m)
 */
export const formatTokens = (tokens) => {
    if (!tokens && tokens !== 0) return '0.0k';
    const num = typeof tokens === 'string' ? parseFloat(tokens) : tokens;

    if (num >= 1000000) {
        return `${(num / 1000000).toFixed(1)}m`;
    } else if (num >= 1000) {
        return `${(num / 1000).toFixed(1)}k`;
    }
    return num.toString();
};

/**
 * Middle-truncates a string (usually a path) to fit within a maximum length.
 */
export const truncatePath = (p, maxLength = 40) => {
    // represent home dir by ~
    p = p.replace(os.homedir(), '~');
    if (!p || p.length <= maxLength) return p;
    const half = Math.floor((maxLength - 3) / 2);
    return p.substring(0, half) + '...' + p.substring(p.length - half);
};
