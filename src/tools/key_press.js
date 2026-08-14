import { parseArgs } from '../utils/arg_parser.js';
import { executeKeyboardAction } from '../utils/computer_use.js';

/**
 * KeyPress Tool for GUI Automation
 * Accepts key or ;-separated key combination (e.g., "enter", "ctrl;c", "alt;tab").
 */
export const key_press = async (args, context = {}) => {
    const parsed = parseArgs(args);
    const key = parsed.key || parsed.keys || parsed.input || parsed.shortcut;

    if (!key) {
        return 'ERROR: Missing required "key" parameter for KeyPress tool.';
    }

    const cleanKeyStr = String(key).trim().toLowerCase();

    if (cleanKeyStr === 'clearinput' || cleanKeyStr === 'clear_input' || cleanKeyStr === 'clear') {
        return await executeKeyboardAction('clear_input');
    }

    if (cleanKeyStr.includes(';') || cleanKeyStr.includes('+')) {
        const keysArr = cleanKeyStr.split(/[;+]/).map(k => k.trim()).filter(Boolean);
        return await executeKeyboardAction('key_combination', keysArr);
    }

    return await executeKeyboardAction('key_press', cleanKeyStr);
};
