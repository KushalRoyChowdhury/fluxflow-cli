import { loadHistory, saveChat } from '../utils/history.js';

/**
 * Summary tool for the janitor.
 * Replaces a range of messages with a high-density summary.
 */
export const summary = async (rawArgs, context = {}) => {
    // Reuse our robust parser
    const parseArg = (key) => {
        const regex = new RegExp(`${key}\\s*=\\s*(["'])(.*?)\\1(?=\\s*[,)]|\\s+\\w+\\s*=|$)`, 's');
        const match = rawArgs.match(regex);
        return match ? match[2].trim() : null;
    };

    const content = parseArg('content');
    const chatId = context.chatId;
    const { startIndex, endIndex } = context.summarizedIndices || {};

    if (!chatId) return "ERROR: No active chatId found in tool context.";
    if (!content) return "ERROR: Missing 'content' argument.";
    
    // Safety check: if no indices provided, we can't replace anything
    if (startIndex === undefined || endIndex === undefined) {
        return "ERROR: Summary tool called without target range indices in context.";
    }

    try {
        const history = await loadHistory();
        if (history[chatId]) {
            const messages = history[chatId].messages;
            
            // Create the summary message
            const summaryMsg = {
                id: `summary-${Date.now()}`,
                role: 'system',
                text: content
            };

            // Replace the range [startIndex, endIndex] with the summaryMsg
            // splice(start, count, items)
            // Safety: Ensure we don't splice beyond bounds if history changed
            const actualStart = Math.min(startIndex, messages.length - 1);
            const actualEnd = Math.min(endIndex, messages.length - 1);
            const count = (actualEnd - actualStart) + 1;
            
            if (count > 0) {
                messages.splice(actualStart, count, summaryMsg);
                await saveChat(chatId, history[chatId].name, messages);
                return `SUCCESS: Compressed ${count} turns into a summary block.`;
            }
            return "ERROR: Targeted range for summarization is invalid or empty.";
        }
        return "ERROR: Chat session not found.";
    } catch (err) {
        return `ERROR: Failed to save summary: ${err.message}`;
    }
};
