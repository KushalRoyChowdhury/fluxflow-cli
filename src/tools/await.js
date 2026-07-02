import { parseArgs } from '../utils/arg_parser.js';

/**
 * Await Tool
 * Pauses execution for a specified number of seconds without blocking the event loop.
 *
 * [tool:functions.await(time="seconds")]
 */
export const awaitTool = async (args, context = {}) => {
    const parsed = parseArgs(args);
    const timeStr = parsed.time;

    if (!timeStr) {
        return 'ERROR: Missing "time" argument for await.';
    }

    let seconds = parseFloat(timeStr);
    if (isNaN(seconds)) {
        return `ERROR: Invalid time value "${timeStr}". Must be a number.`;
    }

    // Clamp between 5s and 120s as requested
    if (seconds < 10) {
        seconds = 10;
    } else if (seconds > 180) {
        seconds = 180;
    }

    const formatTime = (s) => {
        if (s >= 60) {
            const m = Math.floor(s / 60);
            const rem = s % 60;
            return `${m}m${rem > 0 ? ` ${rem}s` : ''}`;
        }
        return `${s}s`;
    };

    const formatted = formatTime(seconds);



    await new Promise(resolve => setTimeout(resolve, seconds * 1000));
    return `SUCCESS: Waited for ${formatted}${seconds > 180 ? " (Max: 180s)" : ""}${seconds < 10 ? " (Min: 10s)" : ""}.`;
};
