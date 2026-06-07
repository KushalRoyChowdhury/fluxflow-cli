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

export const applyPatches = (content, patches) => {
    let currentFileContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const strip = (t) => t.replace(/^```[\w]*\n?/, '').replace(/```\s*$/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    for (const pair of patches) {
        const content_to_replace = strip(pair.replace || '');
        const content_to_add = strip(pair.new || '');

        if (content_to_replace === '' && content_to_add === '') continue;

        // --- INDENTATION PRESERVATION ENGINE ---
        const getIndent = (line) => line.match(/^\s*/)[0];
        const getMinIndent = (text) => {
            const lines = text.split('\n').filter(l => l.trim() !== '');
            if (lines.length === 0) return '';
            let min = getIndent(lines[0]);
            for (const line of lines) {
                const indent = getIndent(line);
                if (indent.length < min.length) min = indent;
            }
            return min;
        };

        const adjustIndentation = (newText, originalMatch, leadingContext = '') => {
            if (!newText || originalMatch === undefined) return newText;
            const matchBaseIndent = getMinIndent(originalMatch);
            const targetBaseIndent = (leadingContext.match(/^\s*/) || [''])[0] + matchBaseIndent;
            const newBaseIndent = getMinIndent(newText);
            const delta = targetBaseIndent.length - newBaseIndent.length;
            const indentChar = (targetBaseIndent.match(/\s/) || originalMatch.match(/\s/) || [' '])[0];

            const newLines = newText.split('\n');
            return newLines.map((line, i) => {
                if (line.trim() === '' && i !== 0) return '';
                const currentLineIndent = getIndent(line).length;
                const shiftedIndentLength = Math.max(0, currentLineIndent + delta);
                const prependedIndentLength = (i === 0) ? Math.max(0, shiftedIndentLength - leadingContext.length) : shiftedIndentLength;
                return indentChar.repeat(prependedIndentLength) + line.trimStart();
            }).join('\n');
        };

        // --- MATCHER ---
        const exactPattern = content_to_replace.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        let matchRegex = null;

        if (content_to_replace !== '' && currentFileContent.includes(content_to_replace)) {
            matchRegex = new RegExp(exactPattern, 'g');
        } else {
            const fuzzyLines = content_to_replace.split('\n').map(line => line.trim()).filter(line => line.length > 0)
                .map(line => line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*'));

            if (fuzzyLines.length > 0) {
                const fuzzyPattern = fuzzyLines.join('\\s*');
                try { matchRegex = new RegExp(fuzzyPattern, 'g'); } catch (e) { matchRegex = new RegExp(exactPattern, 'g'); }
            } else { matchRegex = new RegExp(exactPattern, 'g'); }
        }

        const matches = [...currentFileContent.matchAll(matchRegex)];
        if (matches.length === 1) {
            const startPos = matches[0].index;
            const firstMatchContent = matches[0][0];
            const lineStart = currentFileContent.lastIndexOf('\n', startPos) + 1;
            const leadingContext = currentFileContent.substring(lineStart, startPos);

            const finalReplacement = adjustIndentation(content_to_add, firstMatchContent, leadingContext);
            currentFileContent = currentFileContent.substring(0, startPos) + finalReplacement + currentFileContent.substring(startPos + firstMatchContent.length);
        }
    }
    return currentFileContent;
};
