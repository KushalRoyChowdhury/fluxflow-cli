import { parseArgs } from '../utils/arg_parser.js';
import { executeMouseAction } from '../utils/computer_use.js';

/**
 * Drag Tool for GUI Automation
 * Accepts fromGridId and toGridId.
 */
export const drag = async (args, context = {}) => {
    const parsed = parseArgs(args);
    const fromGridId = parsed.fromGridId || parsed.from || parsed.start;
    const toGridId = parsed.toGridId || parsed.to || parsed.end;

    if (!fromGridId || !toGridId) {
        return 'ERROR: Drag requires both "fromGridId" and "toGridId" parameters.';
    }

    return await executeMouseAction('drag', fromGridId, {
        from: fromGridId,
        to: toGridId
    });
};
