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
