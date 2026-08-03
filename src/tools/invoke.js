import { subagentProgress, addPendingNudge } from '../utils/subagent_state.js';
import { parseArgs } from '../utils/arg_parser.js';
import fs from 'fs';

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

    let _resolveCompletion = null;
    let _rejectCompletion = null;
    const completionPromise = new Promise((res, rej) => {
        _resolveCompletion = res;
        _rejectCompletion = rej;
    });

    const taskEntry = {
        id: taskId,
        title: title || task.substring(0, 30),
        task: task,
        status: 'running',
        startedAt: Date.now(),
        lastChunkTime: Date.now(),
        wps: 0,
        questions: [],
        completionPromise,
        _resolveCompletion,
        _rejectCompletion,
        progress: [] // Array of arrays containing logs for each turn
    };

    // Sliding-window word stats (mirrors the main agent's streamingWordStatsRef logic)
    const wordStats = { chunks: [], totalWords: 0 };

    // setInterval(() => {
    //     fs.writeFileSync(`SUBAGENT_DEBUG_ENTRY-{${taskEntry.id}}.json`, JSON.stringify(taskEntry, null, 4));
    // }, 1000);

    subagentProgress.push(taskEntry);
    if (context.onSubagentUpdate) {
        context.onSubagentUpdate();
    }

    // Run the subagent asynchronously
    let currentTurnLogs = [];
    const subagentContext = {
        ...context,
        taskId: taskId,
        onAskMain: async (questionText, optionsObj) => {
            const questionId = `q-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            let questionResolver = null;
            const qPromise = new Promise((resolve) => {
                questionResolver = resolve;
            });

            const qEntry = {
                id: questionId,
                question: questionText,
                options: optionsObj,
                answered: false,
                answer: null,
                askedAt: Date.now(),
                _resolve: questionResolver
            };

            taskEntry.questions.push(qEntry);
            taskEntry.status = 'waiting';
            if (context.onSubagentUpdate) {
                context.onSubagentUpdate();
            }

            // Nudge main agent with complete Answer tool call syntax (JIT injection saves turn tokens)
            addPendingNudge(`[SYSTEM] Background subagent "${taskEntry.title}" is WAITING FOR YOUR INPUT: "${questionText}"\nRespond using tool: [tool:functions.Answer(id="${taskId}", answer="...")]\n[/SYSTEM]`);

            const answer = await qPromise;
            return answer;
        },
        onVisualFeedback: (feedbackLabel) => {
            taskEntry.lastChunkTime = Date.now();
            const clean = feedbackLabel.replace(/\x1b\[[0-9;]*m/g, '');
            const match = clean.match(/[✔✘✗✖🔍📖→➕↻•]\s*([A-Za-z0-9\s-]+)/);
            if (match) {
                taskEntry.currentTool = match[1].trim();
            } else {
                taskEntry.currentTool = clean;
            }
            if (context.onSubagentUpdate) {
                context.onSubagentUpdate();
            }
        },
        onTokenChunk: (_chunkText, chunkWordCount) => {
            const now = Date.now();
            taskEntry.lastChunkTime = now;
            taskEntry.currentTool = 'Thinking';

            // Sliding-window TPS (same 400ms window as the main agent)
            if (typeof chunkWordCount === 'number' && chunkWordCount > 0) {
                wordStats.totalWords += chunkWordCount;
                wordStats.chunks.push({ time: now, words: chunkWordCount });
                const cutoff = now - 400;
                wordStats.chunks = wordStats.chunks.filter(c => c.time >= cutoff);
                if (wordStats.chunks.length > 0) {
                    const windowWords = wordStats.chunks.reduce((acc, c) => acc + c.words, 0);
                    const oldestTime = wordStats.chunks[0].time;
                    const timeSpanSec = Math.max(0.4, (now - oldestTime) / 1000);
                    taskEntry.wps = Math.round((windowWords / timeSpanSec) * 10) / 10;
                }
            }

            if (context.onSubagentUpdate) {
                context.onSubagentUpdate();
            }
        }
    };
    runSubagent(task, subagentContext, model, allowedTools, 50, (logMessage) => {
        if (taskEntry.status === 'cancelled') return;

        if (logMessage.startsWith('[Subagent Turn')) {
            if (currentTurnLogs.length > 0) {
                taskEntry.progress.push([...currentTurnLogs]);
                currentTurnLogs = [];
            }
        }

        if (logMessage.includes('[Executing Tool]')) {
            const m = logMessage.match(/\[Executing Tool\]\s*([a-zA-Z0-9_]+)/);
            if (m) {
                // If not already set by onVisualFeedback, fall back to parsed tool name
                if (!taskEntry.currentTool || taskEntry.currentTool === 'Thinking') {
                    taskEntry.currentTool = m[1];
                }
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
    }, true).then((finalAnswer) => {
        if (taskEntry.status === 'cancelled') {
            if (taskEntry._resolveCompletion) taskEntry._resolveCompletion(finalAnswer);
            return;
        }
        if (currentTurnLogs.length > 0) {
            taskEntry.progress.push([...currentTurnLogs]);
            currentTurnLogs = [];
        }
        taskEntry.status = 'completed';
        taskEntry.finalAnswer = finalAnswer;
        if (context.onSubagentUpdate) {
            context.onSubagentUpdate();
        }
        addPendingNudge(`[SYSTEM] Background subagent "${taskEntry.title}" (id: ${taskId}) has FINISHED. Call GetProgress(id="${taskId}") to see the final result. [/SYSTEM]`);
        if (taskEntry._resolveCompletion) taskEntry._resolveCompletion(finalAnswer);
    }).catch(async (err) => {
        const { isTerminationSignaled } = await import('../utils/ai.js');
        const isCancelled = err.message === 'Subagent task was cancelled.' || taskEntry.status === 'cancelled' || isTerminationSignaled();
        if (isCancelled) {
            taskEntry.status = 'cancelled';
            currentTurnLogs.push(`[SUBAGENT CANCELLED] Task was cancelled.`);
            taskEntry.progress.push([...currentTurnLogs]);
            if (context.onSubagentUpdate) {
                context.onSubagentUpdate();
            }
            if (taskEntry._resolveCompletion) taskEntry._resolveCompletion(null);
            return;
        }
        currentTurnLogs.push(`[SUBAGENT FAILURE] Error: ${err.message}`);
        taskEntry.progress.push([...currentTurnLogs]);
        taskEntry.status = 'failed';
        taskEntry.error = err.message;
        if (context.onSubagentUpdate) {
            context.onSubagentUpdate();
        }
        addPendingNudge(`[SYSTEM] Background subagent "${taskEntry.title}" (id: ${taskId}) FAILED with error: ${err.message}. [/SYSTEM]`);
        if (taskEntry._rejectCompletion) taskEntry._rejectCompletion(err);
    });

    return `SUCCESS: Background subagent started. Task ID: ${taskId}`;
};
