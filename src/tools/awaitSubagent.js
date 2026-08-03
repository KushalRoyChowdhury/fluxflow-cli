import { subagentProgress } from '../utils/subagent_state.js';
import { parseArgs } from '../utils/arg_parser.js';

export const awaitSubagent = async (args, context = {}) => {
    const parsed = parseArgs(args);
    const id = parsed.id;
    let timeoutSec = parseInt(parsed.timeout || parsed.time || '120', 10);
    if (isNaN(timeoutSec) || timeoutSec <= 0) timeoutSec = 120;
    if (timeoutSec > 300) timeoutSec = 300;

    if (!id) {
        if (parsed.time) {
            // Fallback for simple time delay if no subagent id provided
            await new Promise(resolve => setTimeout(resolve, timeoutSec * 1000));
            return `SUCCESS: Waited for ${timeoutSec}s.`;
        }
        return 'ERROR: Missing "id" argument for Await.';
    }

    const task = subagentProgress.find(t => t.id === id);
    if (!task) {
        return `ERROR: Subagent task with ID [${id}] not found.`;
    }

    // Immediate check if task already finished or waiting for answer
    if (task.status === 'completed') {
        return `SUCCESS: Subagent task [${id}] completed.\nFinal Answer:\n${task.finalAnswer || '(No output)'}`;
    }
    if (task.status === 'failed') {
        return `ERROR: Subagent task [${id}] failed.\nError: ${task.error || 'Unknown error'}`;
    }
    if (task.status === 'cancelled') {
        return `INFO: Subagent task [${id}] was cancelled.`;
    }

    let timeoutId;
    const timeoutPromise = new Promise((resolve) => {
        timeoutId = setTimeout(() => {
            resolve({ type: 'timeout' });
        }, timeoutSec * 1000);
    });

    try {
        const result = await Promise.race([
            task.completionPromise.then(() => ({ type: 'completion' })),
            timeoutPromise
        ]);

        clearTimeout(timeoutId);

        if (result.type === 'timeout') {
            return `TIMEOUT: Subagent task [${id}] is still running (status: ${task.status.toUpperCase()}) after ${timeoutSec}s. You can continue other work or call Await again.`;
        }

        if (task.status === 'completed') {
            return `SUCCESS: Subagent task [${id}] completed.\nFinal Answer:\n${task.finalAnswer || '(No output)'}`;
        } else if (task.status === 'failed') {
            return `ERROR: Subagent task [${id}] failed.\nError: ${task.error || 'Unknown error'}`;
        } else if (task.status === 'cancelled') {
            return `INFO: Subagent task [${id}] was cancelled.`;
        } else {
            return `INFO: Subagent task [${id}] status changed to ${task.status.toUpperCase()}.`;
        }
    } catch (err) {
        clearTimeout(timeoutId);
        return `ERROR: Exception while awaiting subagent [${id}]: ${err.message}`;
    }
};

