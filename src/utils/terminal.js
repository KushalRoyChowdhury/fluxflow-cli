import gradient from 'gradient-string';
import { STARTUP_QUOTES } from '../data/gemini_cli.js';
import { HALLOWEEN_STARTUP_QUOTES } from '../data/halloween_gemini_cli.js';
import { getThemeColors } from './theme.js';
import { SETTINGS_FILE } from './paths.js';
import { readAesEncryptedJson } from './crypto.js';

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
    // DONT remove these comments
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

    // const halloweenArt = [
    //     "    _,,,_   ",
    //     "   / . . \\  ",
    //     "  /   ^   \\ ",
    //     "  \\ \\___/ / ",
    //     "   '-----'  ",
    //     "  🎃 SPOOKY ",
    //     "   ░░░░░░   ",
    //     "            "
    // ];
    const colors = getThemeColors(theme);

    let displayProvider = provider;
    if (provider === 'c_openai' || provider === 'Custom (OpenAI)') {
        try {
            const savedSettings = readAesEncryptedJson(SETTINGS_FILE, {});
            const baseUrl = savedSettings?.systemSettings?.customOpenAIBaseUrl;
            if (baseUrl) {
                displayProvider = baseUrl;
            }
        } catch (e) {
            // fallback to original provider string
        }
    }

    const textColor = colors.logoTextAnsi;
    const bodyColor = colors.logoBodyAnsi;
    const greyColor = colors.logoMutedAnsi;
    const reset = '\x1b[0m';

    const isHalloween = theme === 'Spookfest' || colors.id === 'Spookfest' || theme === 'Halloween' || colors.id === 'Halloween';

    const defaultArt = [
        "  ███       ",
        " ░░░███     ",
        "   ░░░███   ",
        "     ░░░███ ",
        "      ███░  ",
        "    ███░    ",
        "  ███░      ",
        " ░░░        "
    ];

    const halloweenArtSide = [
        "     ▄██▄     ",
        "   ▄██████▄   ",
        "  ████ ██ ██  ",
        "  ████ ██ ██  ",
        "  ██████████  ",
        "  ██████████  ",
        "  ██  ██  ██  ",
        "  ▀▀  ▀▀  ▀▀  "
    ];
    const halloweenArtUser = [
        "     ▄██▄     ",
        "   ▄██████▄   ",
        "  ███ ██ ███  ",
        "  ███ ██ ███  ",
        "  ██████████  ",
        "  ██████████  ",
        "  ██  ██  ██  ",
        "  ▀▀  ▀▀  ▀▀  "
    ];

    const now = new Date();
    const month = now.getMonth();
    const date = now.getDate();

    // If date is OCT 20 - NOV 2
    const validHalloweenDate = (month === 9 && date >= 20) || (month === 10 && date <= 2);
    const spookfestMode = (isHalloween && validHalloweenDate) || (process.env.SPOOKFEST === "true" && isHalloween);
    const art = spookfestMode ? (Math.random() > 0.5 ? halloweenArtSide : halloweenArtUser) : defaultArt;
    if (spookfestMode) process.env.HALLOWEEN_EEGG = true;

    const quotesPool = spookfestMode ? HALLOWEEN_STARTUP_QUOTES : STARTUP_QUOTES;
    const quote = quotesPool[Math.floor(Math.random() * quotesPool.length)];

    const logoGradient = colors.logoGradient || ['#0077ff', '#ff00ff'];
    const coloredArt = gradient(logoGradient).multiline(art.join('\n')).split('\n');
    const grey = (t) => `${greyColor}${t}${reset}`;

    return `${coloredArt[0]}
${coloredArt[1]}  ${textColor}Selected ${spookfestMode ? 'Pumpkin' : 'Provider'}: ${displayProvider}${reset}
${coloredArt[2]}
${coloredArt[3]}  ${textColor}FluxFlow${spookfestMode ? ': Spookfest' : ''} ${grey('v' + version)}${reset}
${coloredArt[4]}
${coloredArt[5]}  ${bodyColor}See /help for additional commands.${reset}
${coloredArt[6]}  ${grey(quote)}
${coloredArt[7]}
`;
};
