import { parseArgs } from '../utils/arg_parser.js';
import { executeKeyboardAction } from '../utils/computer_use.js';

/**
 * KeyboardTyping Tool for GUI Automation
 * Accepts text to type into active window/element.
 */
export const keyboard_typing = async (args, context = {}) => {
    const parsed = parseArgs(args);
    const text = parsed.text || parsed.input || parsed.value || '';
    const autoPressEnter = parsed.autoPressEnter === true || parsed.autoPressEnter === 'true' || parsed.enter === true || parsed.enter === 'true';

    if (text === undefined || text === null) {
        return 'ERROR: Missing required "text" parameter for KeyboardTyping tool.';
    }

    return await executeKeyboardAction('type', String(text), { autoPressEnter });
};
