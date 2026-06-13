import gradient from 'gradient-string';
import { STARTUP_QUOTES } from '../data/gemini_cli.js';

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
    // Pick a random quote
    const quote = STARTUP_QUOTES[Math.floor(Math.random() * STARTUP_QUOTES.length)];

    // const art = [
    //     " ███           ██████████   ███        ███      ███ ███      ███ ██████████ ███        █████████  ███      ███ ███",
    //     "░░░███        ░░███░░░░░█  ░███      ░░███    ░░███░░███    ███░░███░░░░░█ ░░███      ███░░░░░███ ░░███    ░░███░░███",
    //     "  ░░░███       ░███  █ ░   ░███       ░███     ░███ ░░███  ███  ░███  █ ░   ░███     ███     ░███  ░███     ░███ ░███",
    //     "    ░░░███     ░██████     ░███       ░███     ░███  ░░█████    ░██████     ░███    ░███     ░███  ░███  █  ░███ ░███",
    //     "     ███░      ░███░░█     ░███     █ ░███     ░███   ███░░███  ░███░░█     ░███    ░███     ░███  ░███ ███ ░███ ░███",
    //     "   ███░        ░███ ░      ░███    ██ ░░███    ███   ███  ░░███ ░███ ░      ░███    ░░███   ░░███  ░░██████████  ███",
    //     " ███░          █████       ██████████  ░░████████   █████   ██████████       ██████████░░█████████   ░░████ ████ █████",
    //     "░░░            ░░░░░       ░░░░░░░░░░   ░░░░░░░░    ░░░░░   ░░░░░░░░░░       ░░░░░░░░░░  ░░░░░░░░░     ░░░░░ ░░░░░ ░░░░░"
    // ];
    const art = [
        "    ███       ",
        "   ░░░███     ",
        "     ░░░███   ",
        "       ░░░███ ",
        "        ███░  ",
        "      ███░    ",
        "    ███░      ",
        "   ░░░        "
    ];

    const coloredArt = gradient(['#0077ff', '#ff00ff']).multiline(art.join('\n')).split('\n');
    const grey = (t) => `\x1b[90m${t}\x1b[0m`;

    return `${coloredArt[0]}
${coloredArt[1]}  \x1b[1;37mSelected Provider: ${provider}\x1b[0m
${coloredArt[2]}
${coloredArt[3]}  \x1b[1;37mFLUX FLOW ${grey('v' + version)}\x1b[0m
${coloredArt[4]}
${coloredArt[5]}  \x1b[37mSee /help for additional commands.\x1b[0m
${coloredArt[6]}  ${grey(quote)}
${coloredArt[7]}`;
};
