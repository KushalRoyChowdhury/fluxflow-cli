import { subagentProgress } from '../utils/subagent_state.js';
import { parseArgs } from '../utils/arg_parser.js';
// import fs from 'fs';

export const invoke = async (args, context = {}) => {
    const { runSubagent } = await import('../utils/ai.js');
    const parsed = parseArgs(args);
    const task = parsed.task || parsed.instruction || parsed.prompt;
    const model = parsed.model || null;
    const title = parsed.title || null;
    const toolsRaw = parsed.tools || null;

    if (!task) {
        return 'ERROR: Missing "task" argument for invoke.';
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

    const taskId = `subagent-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const taskEntry = {
        id: taskId,
        title: title || task.substring(0, 30),
        task: task,
        status: 'running',
        progress: [] // Array of arrays containing logs for each turn
    };

    // setInterval(() => {
    //     fs.writeFileSync(`SUBAGENT_DEBUG_ENTRY-{${taskEntry.id}}.json`, JSON.stringify(taskEntry, null, 4));
    // }, 1000);

    subagentProgress.push(taskEntry);
    if (context.onSubagentUpdate) {
        context.onSubagentUpdate();
    }

    // Run the subagent asynchronously
    let currentTurnLogs = [];
    const subagentContext = { ...context, onVisualFeedback: null };
    runSubagent(task, subagentContext, model, allowedTools, 20, (logMessage) => {
        if (logMessage.startsWith('[Subagent Turn')) {
            if (currentTurnLogs.length > 0) {
                taskEntry.progress.push([...currentTurnLogs]);
                currentTurnLogs = [];
            }
        }

        if (logMessage.includes('[Executing Tool]')) {
            const m = logMessage.match(/\[Executing Tool\]\s*([a-zA-Z0-9_]+)/);
            if (m) {
                taskEntry.currentTool = m[1];
            }
        }

        let displayLog = logMessage;
        if (displayLog.startsWith('[Tool Result]')) {
            const lines = displayLog.split('\n');
            if (lines.length > 5) {
                displayLog = lines.slice(0, 4).join('\n') + '\n... [Content/Diff Truncated from Logs] ...';
            }
        }

        currentTurnLogs.push(displayLog);
        if (context.onSubagentUpdate) {
            context.onSubagentUpdate();
        }
    }).then((finalAnswer) => {
        currentTurnLogs.push(`[SUBAGENT SUCCESS] Final Answer:\n${finalAnswer}`);
        taskEntry.progress.push([...currentTurnLogs]);
        taskEntry.status = 'completed';
        taskEntry.finalAnswer = finalAnswer;
        if (context.onSubagentUpdate) {
            context.onSubagentUpdate();
        }
    }).catch((err) => {
        currentTurnLogs.push(`[SUBAGENT FAILURE] Error: ${err.message}`);
        taskEntry.progress.push([...currentTurnLogs]);
        taskEntry.status = 'failed';
        taskEntry.error = err.message;
        if (context.onSubagentUpdate) {
            context.onSubagentUpdate();
        }
    });

    return `SUCCESS: Background subagent started. Task ID: ${taskId}`;
};
