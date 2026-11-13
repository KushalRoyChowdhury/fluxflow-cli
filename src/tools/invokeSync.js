import { subagentProgress } from '../utils/subagent_state.js';
import { parseArgs } from '../utils/arg_parser.js';

export const invokeSync = async (args, context = {}) => {
    const { runSubagent } = await import('../utils/ai.js');
    const parsed = parseArgs(args, ['task', 'instruction', 'prompt', 'model', 'tools', 'title', 'id']);
    const task = parsed.task || parsed.instruction || parsed.prompt;
    const model = parsed.model || null;
    const toolsRaw = parsed.tools || null;
    const requestedId = parsed.id && parsed.id !== 'null' && parsed.id !== 'undefined' && parsed.id !== '' ? String(parsed.id).trim() : null;

    if (!task) {
        return 'ERROR: Missing "task" argument for invokeSync.';
    }

    // Check if resuming existing subagent session
    let existingEntry = null;
    let notFoundNote = '';
    if (requestedId) {
        existingEntry = subagentProgress.find(t => t.id === requestedId);
    }

    // If model specified an ID, honor it! Otherwise generate random subagent-sync- ID
    const taskId = existingEntry ? existingEntry.id : (requestedId || `subagent-sync-${Date.now()}-${Math.floor(Math.random() * 1000)}`);
    const history = existingEntry?.history || [];

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

    const title = parsed.title || (existingEntry ? existingEntry.title : task.substring(0, 30));

    // Create or update task entry in subagentProgress so history is retained
    let taskEntry = existingEntry;
    if (!taskEntry) {
        taskEntry = {
            id: taskId,
            title: title,
            task: task,
            status: 'running',
            startedAt: Date.now(),
            progress: [],
            history: []
        };
        subagentProgress.push(taskEntry);
    } else {
        taskEntry.status = 'running';
        taskEntry.task = task;
    }

    const syncContext = {
        ...context,
        taskId: taskId,
        onHistoryUpdate: (updatedHistory) => {
            taskEntry.history = [...updatedHistory];
        }
    };

    try {
        if (context.onVisualFeedback) {
            context.onVisualFeedback(`\x1b[95mSubAgent\x1b[0m: \x1b[32mGeneralist\x1b[0m → ${title}${existingEntry ? ' (Resumed)' : ''}`);
        }
        // Support multi-turn operations for sync agents with context retention
        const result = await runSubagent(task, syncContext, model, allowedTools, null, null, false, history);
        taskEntry.status = 'completed';
        taskEntry.finalAnswer = `Subagent task completed. (ID: ${taskId})\nFinal Answer:\n${result}`;
        if (context.onVisualFeedback) {
            context.onVisualFeedback(`\x1b[95mSubAgent\x1b[0m: \x1b[32mGeneralist\x1b[0m → ${title} [COMPLETED]\n`);
        }
        const finalOutput = `Subagent task completed. (ID: ${taskId})\nFinal Answer:\n${result}`;
        return notFoundNote ? `${finalOutput}${notFoundNote}` : finalOutput;
    } catch (err) {
        taskEntry.status = 'failed';
        taskEntry.error = err.message;
        const { isTerminationSignaled } = await import('../utils/ai.js');
        const isCancelled = err.message === 'Subagent task was cancelled by user.' || isTerminationSignaled();
        if (context.onVisualFeedback) {
            const statusLabel = isCancelled ? '[CANCELLED]' : '[FAILED]';
            context.onVisualFeedback(`\x1b[95mSubAgent\x1b[0m: \x1b[32mGeneralist\x1b[0m → ${title} ${statusLabel}\n`);
        }
        return `ERROR: Subagent execution failed: ${err.message}${notFoundNote}`;
    }
};
