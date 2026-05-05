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

        let currentLine = '';
        const words = sLine.split(/(\s+)/); // Capture whitespace as tokens to preserve indentation
        
        words.forEach(word => {
            if ((currentLine + word).length > width) {
                if (currentLine) finalLines.push(currentLine.replace(/\s+$/, ''));
                
                // If it's just whitespace that exceeded the width, don't start the new line with it
                if (word.trim().length === 0) {
                    currentLine = '';
                } else {
                    currentLine = word;
                    // Handle ultra-long words
                    while (currentLine.length > width) {
                        finalLines.push(currentLine.substring(0, width));
                        currentLine = currentLine.substring(width);
                    }
                }
            } else {
                currentLine += word;
            }
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
