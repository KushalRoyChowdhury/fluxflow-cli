import gradient from 'gradient-string';

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

export const getFluxLogo = (version = '2.0.0', provider = 'Google') => {
    const art = [
        " ▗▄",
        "  ▗▟▀",
        "   ▝▜▄",
        "  ▗▟▀",
        " ▝▀"
    ];
    const coloredArt = gradient(['#00ffff', '#0077ff', '#ff00ff']).multiline(art.join('\n')).split('\n');

    return `${coloredArt[0]}     Fluxflow CLI v${version}
${coloredArt[1]}
${coloredArt[2]}
${coloredArt[3]}    Selected Provider: ${provider}
${coloredArt[4]}`;
};
