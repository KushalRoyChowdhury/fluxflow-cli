import { parseArgs } from '../utils/arg_parser.js';
import { executeMouseAction } from '../utils/computer_use.js';

/**
 * Scroll Tool for GUI Automation
 * Accepts direction ("up" or "down"), amount (integer scroll steps or px), and optional gridId/target to hover before scrolling.
 */
export const scroll = async (args, context = {}) => {
    const parsed = parseArgs(args);
    const direction = (parsed.direction || 'down').toLowerCase();
    const amount = parsed.amount ? parseInt(parsed.amount, 10) : 5;
    const gridId = parsed.gridId || parsed.grid || parsed.coordinate || parsed.target || parsed.id || null;

    return await executeMouseAction('scroll', gridId, {
        direction,
        amount
    });
};
