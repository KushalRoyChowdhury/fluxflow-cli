import { subagentProgress } from '../utils/subagent_state.js';
import { parseArgs } from '../utils/arg_parser.js';

export const getProgress = async (args, context = {}) => {
    const parsed = parseArgs(args);
    const id = parsed.id;

    if (!id) {
        return 'ERROR: Missing "id" argument for getProgress.';
    }

    const task = subagentProgress.find(t => t.id === id);
    if (!task) {
        return `ERROR: Subagent task with ID [${id}] not found.`;
    }

    let output = `Subagent Task Status: ${task.status.toUpperCase()}\n`;
    output += `Title: ${task.title}\n`;
    output += `Task: ${task.task}\n\n`;
    output += `Progress Log:\n`;

    task.progress.forEach((turnLogs, index) => {
        output += `--- Turn ${index + 1} ---\n`;
        output += turnLogs.join('\n') + '\n\n';
    });

    if (task.status === 'completed' && task.finalAnswer) {
        output += `Final Answer:\n${task.finalAnswer}\n`;
    } else if (task.status === 'failed' && task.error) {
        output += `Failure Error: ${task.error}\n`;
    }

    return output.trim();
};
