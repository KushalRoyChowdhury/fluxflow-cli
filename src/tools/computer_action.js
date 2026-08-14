import { parseArgs } from '../utils/arg_parser.js';
import { executeMouseAction, executeKeyboardAction } from '../utils/computer_use.js';

/**
 * Computer Action Tool for GUI Automation
 * Allows the agent to control mouse cursor and keyboard based on 720p gridded vision feedback.
 */
export const computer_action = async (args, context = {}) => {
    const parsed = parseArgs(args);
    const action = parsed.action || parsed.type || parsed.cmd;
    const target = parsed.target || parsed.grid || parsed.gridCode || parsed.location || parsed.input;

    if (!action) {
        return 'ERROR: Missing required "action" argument for computer_action (e.g. move, click, drag, scroll, type, key_press, key_combination).';
    }

    const lowerAction = action.toLowerCase();

    // Mouse actions
    if (lowerAction.startsWith('mouse_') || ['move', 'click', 'drag', 'scroll'].includes(lowerAction)) {
        const cleanMouseAction = lowerAction.replace('mouse_', '');
        return await executeMouseAction(cleanMouseAction, target, {
            button: parsed.button,
            clickType: parsed.clickType || parsed.type,
            from: parsed.from,
            to: parsed.to,
            direction: parsed.direction,
            amount: parsed.amount ? parseInt(parsed.amount, 10) : undefined
        });
    }

    // Keyboard actions
    if (lowerAction.startsWith('key_') || lowerAction === 'type' || lowerAction === 'press') {
        let cleanKeyAction = lowerAction;
        if (lowerAction === 'press') cleanKeyAction = 'key_press';
        const autoPressEnter = parsed.autoPressEnter === true || parsed.autoPressEnter === 'true' || parsed.enter === true || parsed.enter === 'true';
        return await executeKeyboardAction(cleanKeyAction, target || parsed.text || parsed.keys, {
            ...parsed,
            autoPressEnter
        });
    }

    return `ERROR: Unrecognized action "${action}". Supported actions: move, click, drag, scroll, type, key_press, key_combination.`;
};
