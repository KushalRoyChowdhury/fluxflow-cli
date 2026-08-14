import { parseArgs } from '../utils/arg_parser.js';
import { executeMouseAction } from '../utils/computer_use.js';

/**
 * Scroll Tool for GUI Automation
 * Accepts direction ("up" or "down") and amount (integer px).
 */
export const scroll = async (args, context = {}) => {
    const parsed = parseArgs(args);
    const direction = (parsed.direction || 'down').toLowerCase();
    const amount = parsed.amount ? parseInt(parsed.amount, 10) : 100;

    return await executeMouseAction('scroll', null, {
        direction,
        amount
    });
};
