import { parseArgs } from '../utils/arg_parser.js';

/**
 * Wait Tool
 * Pauses execution synchronously for a specified number of seconds without throwing errors.
 * Clamps value between 10s and 120s, default 45s.
 *
 * [tool:functions.wait(seconds="45")]
 */
export const wait = async (args, context = {}) => {
    const parsed = parseArgs(args);
    const secVal = parsed.seconds ?? parsed.sec ?? parsed.time ?? parsed.timeout ?? 45;

    let seconds = parseFloat(secVal);
    if (isNaN(seconds)) {
        seconds = 45;
    }

    // Clamp between 10s and 120s
    if (seconds < 10) {
        seconds = 10;
    } else if (seconds > 120) {
        seconds = 120;
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
    return `Waited for ${formatted}${seconds === 120 ? " (Max: 120s)" : ""}${seconds === 10 ? " (Min: 10s)" : ""}.`;
};

export default wait;
