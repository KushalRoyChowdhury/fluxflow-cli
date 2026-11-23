import gradient from 'gradient-string';
import { STARTUP_QUOTES } from '../data/gemini_cli.js';
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

const now = new Date();
const month = now.getMonth();
const date = now.getDate();
const validHalloweenDate = (month === 9 && date >= 15) || (month === 10 && date <= 1);

// Check if we even need the assets
let loadedHalloweenModule = null;
if (process.env.SPOOKFEST === "true" || validHalloweenDate) {
    loadedHalloweenModule = await import("../data/custom-banner-art/halloween.js");
}

// Frostbyte: snowman banner Dec 24-31, new year banner Jan 1-2 (or forced via FROSTBYTE=true)
const isSnowmanDate = month === 11 && date >= 24;
const isNewYearDate = month === 0 && date <= 2;
const validFrostbyteDate = isSnowmanDate || isNewYearDate;

let loadedFrostbyteModule = null;
if (process.env.FROSTBYTE === "true" || validFrostbyteDate) {
    loadedFrostbyteModule = await import("../data/custom-banner-art/frostbyte.js");
}

// Lazy-load only the seasonal quotes file that is actually needed.
let loadedHalloweenQuotes = null;
if (process.env.SPOOKFEST === "true" || validHalloweenDate) {
    loadedHalloweenQuotes = (await import('../data/halloween_gemini_cli.js')).HALLOWEEN_STARTUP_QUOTES;
}

let loadedFrostbyteQuotes = null;
if (process.env.FROSTBYTE === "true" || validFrostbyteDate) {
    loadedFrostbyteQuotes = (await import('../data/frostbyte_gemini_cli.js')).FROSTBYTE_STARTUP_QUOTES;
}

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

    let prettyProvider = String(displayProvider).trim();
    const hostStart = prettyProvider.indexOf('//');
    const v1Index = prettyProvider.indexOf('/v1', hostStart >= 0 ? hostStart + 2 : 0);
    if (v1Index !== -1) prettyProvider = prettyProvider.slice(0, v1Index);
    if (prettyProvider.endsWith('/')) prettyProvider = prettyProvider.slice(0, -1);

    const textColor = colors.logoTextAnsi;
    const bodyColor = colors.logoBodyAnsi;
    const greyColor = colors.logoMutedAnsi;
    const reset = '\x1b[0m';


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

    // If date is OCT 15 - NOV 1
    const isHalloween = theme === 'Spookfest' || colors.id === 'Spookfest' || theme === 'Halloween' || colors.id === 'Halloween';
    const spookfestMode = (isHalloween && validHalloweenDate) || (process.env.SPOOKFEST === "true" && isHalloween);
    const isFrostbyte = theme === 'Frostbyte' || colors.id === 'Frostbyte';
    const frostbyteMode = (isFrostbyte && validFrostbyteDate) || (process.env.FROSTBYTE === "true" && isFrostbyte);
    const isNewYearBanner = frostbyteMode && isNewYearDate && !isSnowmanDate;

    let art = defaultArt;
    if (spookfestMode && loadedHalloweenModule) {
        process.env.HALLOWEEN_EEGG = 'true';
        process.env.FROSTBYTE_EEGG = 'false';
        const { halloweenArtSide, halloweenBat, halloweenArtUser } = loadedHalloweenModule;
        art = Math.random() > 0.9 && (month === 9 && date >= 30) ? halloweenBat : Math.random() > 0.5 ? halloweenArtSide : halloweenArtUser;
    } else if (frostbyteMode && loadedFrostbyteModule) {
        process.env.HALLOWEEN_EEGG = 'false';
        process.env.FROSTBYTE_EEGG = 'true';
        const { frostbyteSnowman, frostbyteNewYear } = loadedFrostbyteModule;
        art = isNewYearBanner ? frostbyteNewYear : frostbyteSnowman;
    } else {
        // Bug fix, downstream easter egg logic was always triggering,
        // after this IF block ran once in current session.
        process.env.HALLOWEEN_EEGG = 'false';
        process.env.FROSTBYTE_EEGG = 'false';
    }

    const quotesPool = (spookfestMode && loadedHalloweenQuotes) ? loadedHalloweenQuotes
        : (frostbyteMode && loadedFrostbyteQuotes) ? loadedFrostbyteQuotes
        : STARTUP_QUOTES;
    const bannerLabel = spookfestMode ? 'Pumpkin' : frostbyteMode ? (isNewYearBanner ? 'Happiness' : 'Snowman') : 'Provider';
    const themeSuffix = spookfestMode ? ': Spookfest' : frostbyteMode ? ': Frostbyte' : '';
    const quote = quotesPool[Math.floor(Math.random() * quotesPool.length)];

    const logoGradient = colors.logoGradient || ['#0077ff', '#ff00ff'];
    const coloredArt = gradient(logoGradient).multiline(art.join('\n')).split('\n');
    const grey = (t) => `${greyColor}${t}${reset}`;

    return `${coloredArt[0]}
${coloredArt[1]}  ${textColor}Selected ${bannerLabel}: ${prettyProvider}${reset}
${coloredArt[2]}
${coloredArt[3]}  ${textColor}FluxFlow${themeSuffix} ${grey('v' + version)}${reset}
${coloredArt[4]}
${coloredArt[5]}  ${bodyColor}See /help for additional commands.${reset}
${coloredArt[6]}  ${grey(quote)}
${coloredArt[7]}
`;
};
