import os from 'os';
/**
 * High-fidelity word wrapping that preserves indentation and whitespace.
 * ANSI-aware: does not count escape sequences in width calculation.
 */
export const wrapText = (text, width) => {
    if (!text) return '';
    const ansiRegex = /\x1B\[[0-?]*[ -/]*[@-~]/g;
    
    // Split by standard newline only, since processOutput already normalized it
    const sourceLines = text.split('\n');
    let finalLines = [];

    if (width <= 5) return text;

    const getVisibleLength = (str) => str.replace(ansiRegex, '').length;

    sourceLines.forEach(sLine => {
        const visibleLength = getVisibleLength(sLine);
        
        if (visibleLength <= width) {
            finalLines.push(sLine);
            return;
        }

        // For lines that need wrapping, we split into words but preserve spaces
        const tokens = sLine.split(/(\s+)/);
        let currentLine = '';
        let currentVisibleLength = 0;
        
        const leadingSpaceMatch = sLine.match(/^(\s*)/);
        const indent = leadingSpaceMatch ? leadingSpaceMatch[1] : '';

        tokens.forEach((token, idx) => {
            if (token.length === 0) return;

            const tokenVisibleLength = getVisibleLength(token);

            if (currentVisibleLength + tokenVisibleLength > width) {
                if (currentLine.trim().length > 0) {
                    finalLines.push(currentLine.trimEnd());
                    // Start new line with the current indent + the token
                    currentLine = indent + token;
                    currentVisibleLength = getVisibleLength(currentLine);
                } else {
                    // Ultra long token (e.g. long path or string)
                    // If it has ANSI, we can't easily slice it, so we just push it
                    if (ansiRegex.test(token)) {
                        finalLines.push(token);
                        currentLine = indent;
                        currentVisibleLength = getVisibleLength(currentLine);
                    } else {
                        // Safe to slice non-ANSI long tokens
                        let word = token;
                        while (getVisibleLength(word) > width && width > 10) {
                            finalLines.push(word.substring(0, width));
                            word = word.substring(width);
                        }
                        currentLine = word;
                        currentVisibleLength = getVisibleLength(currentLine);
                    }
                }
            } else {
                currentLine += token;
                currentVisibleLength += tokenVisibleLength;
            }
        });

        if (currentLine.trimEnd().length > 0 || currentLine === indent) {
            finalLines.push(currentLine.trimEnd());
        }
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
