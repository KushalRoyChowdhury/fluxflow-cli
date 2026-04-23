import { saveChatTitle } from '../utils/history.js';
import { parseArgs } from '../utils/arg_parser.js';

/**
 * Chat management tool for the janitor.
 * Updates the title of the current session surgically.
 */
export const chat = async (rawArgs, context = {}) => {
    const title = parseArgs(rawArgs).title;
    // High-fidelity identity fallback
    const chatId = context.chatId || context.sessionId;

    if (!chatId) return "ERROR: No active chatId found in tool context.";
    if (!title) return "ERROR: Missing 'title' argument.";

    try {
        await saveChatTitle(chatId, title);
        return `SUCCESS: Chat title updated to [${title}] for session [${chatId}].`;
    } catch (err) {
        return `ERROR: Failed to update chat title: ${err.message}`;
    }
};
