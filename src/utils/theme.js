/**
 * Centralized theme and color palette definitions for Flux Flow CLI.
 */

export const CHAOS_PRESETS = [
    {
        name: 'Cyan Cyberpunk',
        text: 'cyan',
        textMuted: '#4da6b8',
        textDim: '#2d6d7a',
        textInverted: 'black',
        border: 'cyan',
        borderMuted: '#1a5966',
        borderDim: '#0f3840',
        bg: undefined,
        cardBg: '#061e24',
        highlightBg: '#092b33',
        activeBg: '#0e3e4a',
        inputBg: '#092b33',
        inputBorder: '#092b33',
        inputText: 'cyan',
        inputPlaceholder: '#2d6d7a',
        inputPrompt: 'cyan',
        codeBg: '#020d10',
        codeBorder: '#1a5966',
        userMsgBg: '#092b33',
        userMsgBorder: '#092b33',
        userMsgText: 'cyan',
        diffRemovalBg: '#3a0c1a',
        diffAdditionBg: '#0c3a32',
        diffRemovalText: '#ff4d88',
        diffAdditionText: '#00ffaa',
        diffRemovalHighlightColor: '#ff1a66',
        diffRemovalHighlightBg: '#590022',
        diffAdditionHighlightColor: '#00ffcc',
        diffAdditionHighlightBg: '#00593b',
        diffRemovalNum: '#ff4d88',
        diffAdditionNum: '#00ffaa',
        diffRemovalPrefix: '#ff1a66',
        diffAdditionPrefix: '#00ffcc',
        primary: 'cyan',
        secondary: 'blue',
        accent: 'magenta',
        success: 'green',
        warning: 'yellow',
        danger: 'red',
        info: 'blue',
        statusOn: 'cyan',
        statusOff: '#2d6d7a',
        logoTextAnsi: '\x1b[1;36m',
        logoBodyAnsi: '\x1b[36m',
        logoMutedAnsi: '\x1b[90m',
        logoGradient: ['#00ffff', '#0088ff'],
    },
    {
        name: 'Magenta Vaporwave',
        text: 'magenta',
        textMuted: '#c451d6',
        textDim: '#7d2b8a',
        textInverted: 'black',
        border: 'magenta',
        borderMuted: '#5e1b69',
        borderDim: '#3b0f42',
        bg: undefined,
        cardBg: '#240729',
        highlightBg: '#310938',
        activeBg: '#470e52',
        inputBg: '#310938',
        inputBorder: '#310938',
        inputText: 'magenta',
        inputPlaceholder: '#7d2b8a',
        inputPrompt: 'magenta',
        codeBg: '#100312',
        codeBorder: '#5e1b69',
        userMsgBg: '#310938',
        userMsgBorder: '#310938',
        userMsgText: 'magenta',
        diffRemovalBg: '#3a0c20',
        diffAdditionBg: '#200c3a',
        diffRemovalText: '#ff4d94',
        diffAdditionText: '#aa4dff',
        diffRemovalHighlightColor: '#ff1a75',
        diffRemovalHighlightBg: '#59002b',
        diffAdditionHighlightColor: '#bb66ff',
        diffAdditionHighlightBg: '#3b0059',
        diffRemovalNum: '#ff4d94',
        diffAdditionNum: '#aa4dff',
        diffRemovalPrefix: '#ff1a75',
        diffAdditionPrefix: '#bb66ff',
        primary: 'magenta',
        secondary: 'cyan',
        accent: 'purple',
        success: 'green',
        warning: 'yellow',
        danger: 'red',
        info: 'blue',
        statusOn: 'magenta',
        statusOff: '#7d2b8a',
        logoTextAnsi: '\x1b[1;35m',
        logoBodyAnsi: '\x1b[35m',
        logoMutedAnsi: '\x1b[90m',
        logoGradient: ['#ff00ff', '#8800ff'],
    },
    {
        name: 'Glitch Matrix',
        text: '#00ff41',
        textMuted: '#00b32d',
        textDim: '#00661a',
        textInverted: 'black',
        border: '#00ff41',
        borderMuted: '#008020',
        borderDim: '#004d13',
        bg: undefined,
        cardBg: '#0d1f0d',
        highlightBg: '#122912',
        activeBg: '#1c3e1c',
        inputBg: '#122912',
        inputBorder: '#122912',
        inputText: '#00ff41',
        inputPlaceholder: '#00b32d',
        inputPrompt: '#ffff00',
        codeBg: '#040a04',
        codeBorder: '#008020',
        userMsgBg: '#122912',
        userMsgBorder: '#122912',
        userMsgText: '#00ff41',
        diffRemovalBg: '#3a001a',
        diffAdditionBg: '#003a10',
        diffRemovalText: '#ff0055',
        diffAdditionText: '#00ff66',
        diffRemovalHighlightColor: '#ff0033',
        diffRemovalHighlightBg: '#59001b',
        diffAdditionHighlightColor: '#33ff88',
        diffAdditionHighlightBg: '#005918',
        diffRemovalNum: '#ff0055',
        diffAdditionNum: '#00ff66',
        diffRemovalPrefix: '#ff0033',
        diffAdditionPrefix: '#33ff88',
        primary: '#00ff41',
        secondary: 'yellow',
        accent: 'cyan',
        success: '#00ff41',
        warning: 'yellow',
        danger: 'red',
        info: 'cyan',
        statusOn: '#00ff41',
        statusOff: '#00661a',
        logoTextAnsi: '\x1b[1;32m',
        logoBodyAnsi: '\x1b[32m',
        logoMutedAnsi: '\x1b[90m',
        logoGradient: ['#00ff41', '#ffff00'],
    },
    {
        name: 'Warm Sunset',
        text: '#ffaa55',
        textMuted: '#cc8844',
        textDim: '#885522',
        textInverted: 'black',
        border: '#ff9933',
        borderMuted: '#aa6622',
        borderDim: '#663311',
        bg: undefined,
        cardBg: '#24180f',
        highlightBg: '#2e1e12',
        activeBg: '#422c1b',
        inputBg: '#2e1e12',
        inputBorder: '#2e1e12',
        inputText: '#ffaa55',
        inputPlaceholder: '#885522',
        inputPrompt: '#ff7733',
        codeBg: '#120c08',
        codeBorder: '#aa6622',
        userMsgBg: '#2e1e12',
        userMsgBorder: '#2e1e12',
        userMsgText: '#ffaa55',
        diffRemovalBg: '#3d120c',
        diffAdditionBg: '#3a2e0c',
        diffRemovalText: '#ff5544',
        diffAdditionText: '#ffcc33',
        diffRemovalHighlightColor: '#ff3322',
        diffRemovalHighlightBg: '#591108',
        diffAdditionHighlightColor: '#ffee44',
        diffAdditionHighlightBg: '#594400',
        diffRemovalNum: '#ff5544',
        diffAdditionNum: '#ffcc33',
        diffRemovalPrefix: '#ff3322',
        diffAdditionPrefix: '#ffee44',
        primary: '#ffaa55',
        secondary: '#ff7733',
        accent: 'magenta',
        success: '#ffcc33',
        warning: '#ff7733',
        danger: '#ff3322',
        info: '#ffaa55',
        statusOn: '#ffaa55',
        statusOff: '#885522',
        logoTextAnsi: '\x1b[1;33m',
        logoBodyAnsi: '\x1b[33m',
        logoMutedAnsi: '\x1b[90m',
        logoGradient: ['#ff9933', '#ff0055'],
    },
    {
        name: 'Sakura Blossom',
        text: '#ffc0e0',
        textMuted: '#d98cb3',
        textDim: '#804d66',
        textInverted: 'black',
        border: '#ff99cc',
        borderMuted: '#aa4d7a',
        borderDim: '#662647',
        bg: undefined,
        cardBg: '#291320',
        highlightBg: '#331826',
        activeBg: '#472235',
        inputBg: '#331826',
        inputBorder: '#331826',
        inputText: '#ffc0e0',
        inputPlaceholder: '#804d66',
        inputPrompt: '#ff99cc',
        codeBg: '#140a10',
        codeBorder: '#aa4d7a',
        userMsgBg: '#331826',
        userMsgBorder: '#331826',
        userMsgText: '#ffc0e0',
        diffRemovalBg: '#3e0c1b',
        diffAdditionBg: '#1b3e2b',
        diffRemovalText: '#ff6699',
        diffAdditionText: '#66ffb3',
        diffRemovalHighlightColor: '#ff3377',
        diffRemovalHighlightBg: '#590022',
        diffAdditionHighlightColor: '#33ff99',
        diffAdditionHighlightBg: '#00592e',
        diffRemovalNum: '#ff6699',
        diffAdditionNum: '#66ffb3',
        diffRemovalPrefix: '#ff3377',
        diffAdditionPrefix: '#33ff99',
        primary: '#ffc0e0',
        secondary: '#ff99cc',
        accent: 'magenta',
        success: '#66ffb3',
        warning: 'yellow',
        danger: '#ff3377',
        info: '#ff99cc',
        statusOn: '#ffc0e0',
        statusOff: '#804d66',
        logoTextAnsi: '\x1b[1;35m',
        logoBodyAnsi: '\x1b[35m',
        logoMutedAnsi: '\x1b[90m',
        logoGradient: ['#ffb3d9', '#ff3399'],
    }
];

export const THEMES = {
    Dark: {
        id: 'Dark',
        name: 'Dark (Default)',
        // Base Colors
        text: 'white',
        textMuted: 'gray',
        textDim: 'grey',
        textInverted: 'black',
        
        // Borders
        border: 'white',
        borderMuted: 'gray',
        borderDim: 'grey',
        
        // Backgrounds
        bg: undefined,
        cardBg: '#1e1e1e',
        highlightBg: '#2a2a2a',
        activeBg: '#3a3a3a',
        
        // Input Box Colors
        inputBg: '#555555',
        inputBorder: '#555555',
        inputText: 'white',
        inputPlaceholder: '#cccccc',
        inputPrompt: 'white',
        
        // Code & Message Component Colors
        codeBg: '#1a1a1a',
        codeBorder: '#444444',
        userMsgBg: '#444444',
        userMsgBorder: '#444444',
        userMsgText: 'white',

        // Diff Component Palette
        diffRemovalBg: '#3a0c0c',
        diffAdditionBg: '#0c3a1a',
        diffRemovalText: '#885555',
        diffAdditionText: '#558866',
        diffRemovalHighlightColor: '#ff3333',
        diffRemovalHighlightBg: '#5a1818',
        diffAdditionHighlightColor: '#33ff66',
        diffAdditionHighlightBg: '#185a25',
        diffRemovalNum: '#d96868',
        diffAdditionNum: '#68d98c',
        diffRemovalPrefix: '#ff4d4d',
        diffAdditionPrefix: '#4dff88',
        
        // Accents & Indicators
        primary: 'white',
        secondary: 'cyan',
        accent: 'magenta',
        success: 'green',
        warning: 'yellow',
        danger: 'red',
        info: 'blue',
        
        // Status Indicators
        statusOn: 'white',
        statusOff: 'gray',

        // Logo / Terminal ANSI Colors
        logoTextAnsi: '\x1b[1;37m',
        logoBodyAnsi: '\x1b[37m',
        logoMutedAnsi: '\x1b[90m',
        logoGradient: ['#0077ff', '#ff00ff'],
    },
    Light: {
        id: 'Light',
        name: 'Light',
        // Base Colors
        text: 'black',
        textMuted: 'gray',
        textDim: 'grey',
        textInverted: 'white',
        
        // Borders
        border: 'black',
        borderMuted: 'gray',
        borderDim: 'grey',
        
        // Backgrounds
        bg: undefined,
        cardBg: '#e5e5e5',
        highlightBg: '#d4d4d4',
        activeBg: '#c0c0c0',
        
        // Input Box Colors
        inputBg: '#d0d0d0',
        inputBorder: '#d0d0d0',
        inputText: 'black',
        inputPlaceholder: '#555555',
        inputPrompt: 'black',
        
        // Code & Message Component Colors
        codeBg: '#e8e8e8',
        codeBorder: '#b0b0b0',
        userMsgBg: '#d0d0d0',
        userMsgBorder: '#d0d0d0',
        userMsgText: 'black',

        // Diff Component Palette
        diffRemovalBg: '#fce8e8',
        diffAdditionBg: '#e6f9e6',
        diffRemovalText: '#661111',
        diffAdditionText: '#115511',
        diffRemovalHighlightColor: '#440000',
        diffRemovalHighlightBg: '#f8b4b4',
        diffAdditionHighlightColor: '#003300',
        diffAdditionHighlightBg: '#a6ebad',
        diffRemovalNum: '#c02020',
        diffAdditionNum: '#188028',
        diffRemovalPrefix: '#d01010',
        diffAdditionPrefix: '#109020',
        
        // Accents & Indicators
        primary: 'black',
        secondary: 'blue',
        accent: 'magenta',
        success: 'green',
        warning: 'yellow',
        danger: 'red',
        info: 'blue',
        
        // Status Indicators
        statusOn: 'black',
        statusOff: 'gray',

        // Logo / Terminal ANSI Colors
        logoTextAnsi: '\x1b[1;30m',
        logoBodyAnsi: '\x1b[30m',
        logoMutedAnsi: '\x1b[38;5;244m',
        logoGradient: ['#0077ff', '#ff00ff'],
    },
    'GitHub Dark': {
        id: 'GitHub Dark',
        name: 'GitHub Dark',
        // Base Colors
        text: '#c9d1d9',
        textMuted: '#8b949e',
        textDim: '#6e7681',
        textInverted: '#0d1117',
        
        // Borders
        border: '#30363d',
        borderMuted: '#30363d',
        borderDim: '#21262d',
        
        // Backgrounds
        bg: undefined,
        cardBg: '#161b22',
        highlightBg: '#21262d',
        activeBg: '#30363d',
        
        // Input Box Colors
        inputBg: '#21262d',
        inputBorder: '#21262d',
        inputText: '#c9d1d9',
        inputPlaceholder: '#8b949e',
        inputPrompt: '#58a6ff',
        
        // Code & Message Component Colors
        codeBg: '#0d1117',
        codeBorder: '#30363d',
        userMsgBg: '#21262d',
        userMsgBorder: '#21262d',
        userMsgText: '#c9d1d9',

        // Diff Component Palette
        diffRemovalBg: '#3c1e1e',
        diffAdditionBg: '#11381e',
        diffRemovalText: '#f85149',
        diffAdditionText: '#3fb950',
        diffRemovalHighlightColor: '#ff7b72',
        diffRemovalHighlightBg: '#701c1c',
        diffAdditionHighlightColor: '#56d364',
        diffAdditionHighlightBg: '#116329',
        diffRemovalNum: '#f85149',
        diffAdditionNum: '#3fb950',
        diffRemovalPrefix: '#f85149',
        diffAdditionPrefix: '#3fb950',
        
        // Accents & Indicators
        primary: '#c9d1d9',
        secondary: '#58a6ff',
        accent: '#bc8cff',
        success: '#3fb950',
        warning: '#d29922',
        danger: '#f85149',
        info: '#58a6ff',
        
        // Status Indicators
        statusOn: '#58a6ff',
        statusOff: '#8b949e',

        // Logo / Terminal ANSI Colors
        logoTextAnsi: '\x1b[1;36m',
        logoBodyAnsi: '\x1b[37m',
        logoMutedAnsi: '\x1b[90m',
        logoGradient: ['#2ea043', '#56d364'],
    },
    'GitHub Light': {
        id: 'GitHub Light',
        name: 'GitHub Light',
        // Base Colors
        text: '#24292f',
        textMuted: '#57606a',
        textDim: '#6e7781',
        textInverted: '#ffffff',
        
        // Borders
        border: '#d0d7de',
        borderMuted: '#d0d7de',
        borderDim: '#e1e4e8',
        
        // Backgrounds
        bg: undefined,
        cardBg: '#f6f8fa',
        highlightBg: '#eaeef2',
        activeBg: '#d0d7de',
        
        // Input Box Colors
        inputBg: '#eaeef2',
        inputBorder: '#eaeef2',
        inputText: '#24292f',
        inputPlaceholder: '#57606a',
        inputPrompt: '#0969da',
        
        // Code & Message Component Colors
        codeBg: '#ffffff',
        codeBorder: '#d0d7de',
        userMsgBg: '#eaeef2',
        userMsgBorder: '#eaeef2',
        userMsgText: '#24292f',

        // Diff Component Palette
        diffRemovalBg: '#ffebe9',
        diffAdditionBg: '#e6ffec',
        diffRemovalText: '#cf222e',
        diffAdditionText: '#1a7f37',
        diffRemovalHighlightColor: '#82071e',
        diffRemovalHighlightBg: '#ffc1c0',
        diffAdditionHighlightColor: '#116329',
        diffAdditionHighlightBg: '#acf2bd',
        diffRemovalNum: '#cf222e',
        diffAdditionNum: '#1a7f37',
        diffRemovalPrefix: '#cf222e',
        diffAdditionPrefix: '#1a7f37',
        
        // Accents & Indicators
        primary: '#24292f',
        secondary: '#0969da',
        accent: '#8250df',
        success: '#1a7f37',
        warning: '#9a6700',
        danger: '#cf222e',
        info: '#0969da',
        
        // Status Indicators
        statusOn: '#0969da',
        statusOff: '#57606a',

        // Logo / Terminal ANSI Colors
        logoTextAnsi: '\x1b[1;34m',
        logoBodyAnsi: '\x1b[30m',
        logoMutedAnsi: '\x1b[38;5;244m',
        logoGradient: ['#1a7f37', '#2da44e'],
    },
    'Transparent Dark': {
        id: 'Transparent Dark',
        name: 'Transparent Dark',
        // Base Colors
        text: 'white',
        textMuted: 'gray',
        textDim: 'grey',
        textInverted: 'black',
        
        // Borders
        border: 'gray',
        borderMuted: 'gray',
        borderDim: 'grey',
        
        // Backgrounds (All transparent / undefined)
        bg: undefined,
        cardBg: undefined,
        highlightBg: '#2a2a2a',
        activeBg: '#3a3a3a',
        
        // Input Box Colors
        inputBg: '#555555',
        inputBorder: '#555555',
        inputText: 'white',
        inputPlaceholder: '#cccccc',
        inputPrompt: 'white',
        
        // Code & Message Component Colors
        codeBg: undefined,
        codeBorder: 'gray',
        userMsgBg: '#555555',
        userMsgBorder: '#555555',
        userMsgText: 'white',

        // Diff Component Palette (Transparent background, colored lines)
        diffRemovalBg: undefined,
        diffAdditionBg: undefined,
        diffRemovalText: '#ff6666',
        diffAdditionText: '#66ff66',
        diffRemovalHighlightColor: '#ff3333',
        diffRemovalHighlightBg: undefined,
        diffAdditionHighlightColor: '#33ff66',
        diffAdditionHighlightBg: undefined,
        diffRemovalNum: '#ff6666',
        diffAdditionNum: '#66ff66',
        diffRemovalPrefix: '#ff4d4d',
        diffAdditionPrefix: '#4dff88',
        
        // Accents & Indicators
        primary: 'white',
        secondary: 'cyan',
        accent: 'magenta',
        success: 'green',
        warning: 'yellow',
        danger: 'red',
        info: 'blue',
        
        // Status Indicators
        statusOn: 'white',
        statusOff: 'gray',

        // Logo / Terminal ANSI Colors
        logoTextAnsi: '\x1b[1;37m',
        logoBodyAnsi: '\x1b[37m',
        logoMutedAnsi: '\x1b[90m',
        logoGradient: ['#0077ff', '#ff00ff'],
    },
    'Transparent Light': {
        id: 'Transparent Light',
        name: 'Transparent Light',
        // Base Colors
        text: 'black',
        textMuted: 'gray',
        textDim: 'grey',
        textInverted: 'white',
        
        // Borders
        border: 'gray',
        borderMuted: 'gray',
        borderDim: 'grey',
        
        // Backgrounds (All transparent / undefined)
        bg: undefined,
        cardBg: undefined,
        highlightBg: '#d4d4d4',
        activeBg: '#c0c0c0',
        
        // Input Box Colors
        inputBg: '#d0d0d0',
        inputBorder: '#d0d0d0',
        inputText: 'black',
        inputPlaceholder: '#555555',
        inputPrompt: 'black',
        
        // Code & Message Component Colors
        codeBg: undefined,
        codeBorder: 'gray',
        userMsgBg: '#d0d0d0',
        userMsgBorder: '#d0d0d0',
        userMsgText: 'black',

        // Diff Component Palette (Transparent background, colored lines)
        diffRemovalBg: undefined,
        diffAdditionBg: undefined,
        diffRemovalText: '#c02020',
        diffAdditionText: '#188028',
        diffRemovalHighlightColor: '#800000',
        diffRemovalHighlightBg: undefined,
        diffAdditionHighlightColor: '#004000',
        diffAdditionHighlightBg: undefined,
        diffRemovalNum: '#c02020',
        diffAdditionNum: '#188028',
        diffRemovalPrefix: '#d01010',
        diffAdditionPrefix: '#109020',
        
        // Accents & Indicators
        primary: 'black',
        secondary: 'blue',
        accent: 'magenta',
        success: 'green',
        warning: 'yellow',
        danger: 'red',
        info: 'blue',
        
        // Status Indicators
        statusOn: 'black',
        statusOff: 'gray',

        // Logo / Terminal ANSI Colors
        logoTextAnsi: '\x1b[1;30m',
        logoBodyAnsi: '\x1b[30m',
        logoMutedAnsi: '\x1b[38;5;244m',
        logoGradient: ['#0077ff', '#ff00ff'],
    }
};

export const MYSTERY_PRESETS = CHAOS_PRESETS;

/**
 * Returns theme colors for a given theme name (defaults to 'Dark')
 * @param {string} themeName 
 * @returns {object} Theme color palette object
 */
export const getThemeColors = (themeName = 'Dark') => {
    if (themeName === 'Chaos' || themeName === 'Mystery') {
        const randomPreset = CHAOS_PRESETS[Math.floor(Math.random() * CHAOS_PRESETS.length)];
        return { ...randomPreset, id: 'Chaos' };
    }
    if (THEMES[themeName]) return THEMES[themeName];
    if (themeName === 'GitHub') return THEMES['GitHub Dark'];
    if (themeName === 'Transparent') return THEMES['Transparent Dark'];
    return THEMES.Dark;
};
