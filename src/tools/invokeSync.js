import { parseArgs } from '../utils/arg_parser.js';

export const invokeSync = async (args, context = {}) => {
    const { runSubagent } = await import('../utils/ai.js');
    const parsed = parseArgs(args);
    const task = parsed.task || parsed.instruction || parsed.prompt;
    const model = parsed.model || null;
    const toolsRaw = parsed.tools || null;

    if (!task) {
        return 'ERROR: Missing "task" argument for invokeSync.';
    }

    // Parse allowed tools array if provided
    let allowedTools = null;
    if (toolsRaw) {
        try {
            let cleaned = toolsRaw.trim();
            if (cleaned.startsWith('[') && cleaned.endsWith(']')) {
                cleaned = cleaned.substring(1, cleaned.length - 1);
            }
            allowedTools = cleaned.split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
        } catch (e) {
            // fallback
        }
    }

    const title = parsed.title || task.substring(0, 30);

    try {
        if (context.onVisualFeedback) {
            context.onVisualFeedback(`\x1b[95mSubAgent\x1b[0m: \x1b[32mGeneralist\x1b[0m → ${title}`);
        }
        // Support multi-turn operations for sync agents
        const result = await runSubagent(task, context, model, allowedTools, 50);
        if (context.onVisualFeedback) {
            context.onVisualFeedback(`\x1b[95mSubAgent\x1b[0m: \x1b[32mGeneralist\x1b[0m → ${title} [COMPLETED]\n`);
        }
        return result;
    } catch (err) {
        const { isTerminationSignaled } = await import('../utils/ai.js');
        const isCancelled = err.message === 'Subagent task was cancelled by user.' || isTerminationSignaled();
        if (context.onVisualFeedback) {
            const statusLabel = isCancelled ? '[CANCELLED]' : '[FAILED]';
            context.onVisualFeedback(`\x1b[95mSubAgent\x1b[0m: \x1b[32mGeneralist\x1b[0m → ${title} ${statusLabel}\n`);
        }
        return `ERROR: Subagent execution failed: ${err.message}`;
    }
};
