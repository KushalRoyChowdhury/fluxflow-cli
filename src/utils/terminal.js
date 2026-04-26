/**
 * Terminal capability detection and normalization.
 * Handles the "Emoji Gap" disparity between VS Code and Windows Terminal.
 */

export const getTerminalEnv = () => {
    if (process.env.TERM_PROGRAM === 'vscode') return 'vscode';
    if (process.env.WT_SESSION) return 'wt';
    return 'default';
};

/**
 * Returns normalized spacing for emojis based on terminal rendering characteristics.
 * @param {number} baseSpaces - The desired visual spaces (default 2).
 * @returns {string} The adjusted space string.
 */
export const emojiSpace = (baseSpaces = 2) => {
    const env = getTerminalEnv();
    
    // Windows Terminal (wt) handles emoji widths natively and tends to show
    // more space than VS Code for the same character sequence.
    if (env === 'wt') {
        return ' '.repeat(Math.max(1, baseSpaces - 1));
    }
    
    // VS Code integrated terminal often collapses the visual gap after an emoji.
    if (env === 'vscode') {
        return ' '.repeat(baseSpaces);
    }

    return ' '.repeat(baseSpaces);
};
