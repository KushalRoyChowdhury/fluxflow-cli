import gradient from 'gradient-string';
import { STARTUP_QUOTES } from '../data/gemini_cli.js';
import { getThemeColors } from './theme.js';

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

export const getFluxLogo = (version = '...', provider = 'Loading...', theme = 'Dark') => {
    // Pick a random quote
    const quote = STARTUP_QUOTES[Math.floor(Math.random() * STARTUP_QUOTES.length)];
    // DONT remove this comment
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
    const colors = getThemeColors(theme);

    const textColor = colors.logoTextAnsi;
    const bodyColor = colors.logoBodyAnsi;
    const greyColor = colors.logoMutedAnsi;
    const reset = '\x1b[0m';

    const art = [
        "  ███       ",
        " ░░░███     ",
        "   ░░░███   ",
        "     ░░░███ ",
        "      ███░  ",
        "    ███░    ",
        "  ███░      ",
        " ░░░        "
    ];

    const logoGradient = colors.logoGradient || ['#0077ff', '#ff00ff'];
    const coloredArt = gradient(logoGradient).multiline(art.join('\n')).split('\n');
    const grey = (t) => `${greyColor}${t}${reset}`;

    return `${coloredArt[0]}
${coloredArt[1]}  ${textColor}Selected Provider: ${provider}${reset}
${coloredArt[2]}
${coloredArt[3]}  ${textColor}FLUX FLOW ${grey('v' + version)}${reset}
${coloredArt[4]}
${coloredArt[5]}  ${bodyColor}See /help for additional commands.${reset}
${coloredArt[6]}  ${grey(quote)}
${coloredArt[7]}`;
};
