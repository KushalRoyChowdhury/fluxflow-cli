/**
 * High-fidelity word wrapping that preserves indentation and whitespace.
 * Uses regex tokenization to treat whitespace as distinct tokens.
 */
export const wrapText = (text, width) => {
    if (!text) return '';
    const sourceLines = text.split(/\r?\n/);
    let finalLines = [];

    sourceLines.forEach(sLine => {
        if (sLine.length <= width) {
            finalLines.push(sLine);
            return;
        }

        const tokens = sLine.split(/(\s+)/);
        let currentLine = '';
        let lastColumnStart = 0;
        let xPos = 0;

        // Detect leading indentation of the line
        const leadingSpaceMatch = sLine.match(/^(\s*)/);
        if (leadingSpaceMatch) {
            lastColumnStart = leadingSpaceMatch[1].length;
        }

        tokens.forEach((token, idx) => {
            if (token.length === 0) return;

            const isWhitespace = token.trim().length === 0;

            if (isWhitespace) {
                // If it's a significant gap (2+ spaces), it's likely a new column
                if (token.length >= 2) {
                    lastColumnStart = xPos + token.length;
                }
                
                // Keep whitespace if we're not at the start of a wrapped line
                if (currentLine.length > 0) {
                    currentLine += token;
                }
            } else {
                // It's a word. Check if it fits.
                if ((currentLine + token).length > width) {
                    if (currentLine.trim().length > 0) {
                        finalLines.push(currentLine.replace(/\s+$/, ''));
                        
                        // Smart Wrap: Indent to the last detected column start
                        const indent = ' '.repeat(lastColumnStart);
                        currentLine = indent + token;
                        // Reset xPos for the new line
                        xPos = indent.length;
                    } else {
                        // Ultra long word, force split
                        let word = token;
                        while (word.length > width) {
                            finalLines.push(word.substring(0, width));
                            word = word.substring(width);
                        }
                        currentLine = word;
                        xPos = word.length;
                    }
                } else {
                    currentLine += token;
                }
            }

            xPos += token.length;
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
        return `${(num / 1000000).toFixed(2)}m`;
    } else if (num >= 1000) {
        return `${(num / 1000).toFixed(2)}k`;
    }
    return num.toString();
};
