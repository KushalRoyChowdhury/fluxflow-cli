import { subagentProgress } from '../utils/subagent_state.js';
import { parseArgs } from '../utils/arg_parser.js';

export const cancel = async (args, context = {}) => {
    const parsed = parseArgs(args);
    const id = parsed.id;

    if (!id) {
        return 'ERROR: Missing "id" argument for cancel.';
    }

    const task = subagentProgress.find(t => t.id === id);
    if (!task) {
        return `ERROR: Subagent task with ID [${id}] not found.`;
    }

    if (task.status === 'completed' || task.status === 'failed') {
        return `INFO: Subagent task with ID [${id}] has already finished with status [${task.status.toUpperCase()}].`;
    }

    if (task.status === 'cancelled') {
        return `INFO: Subagent task with ID [${id}] is already cancelled.`;
    }

    task.status = 'cancelled';
    if (context.onSubagentUpdate) {
        context.onSubagentUpdate();
    }

    return `SUCCESS: Subagent task with ID [${id}] has been cancelled.`;
};
