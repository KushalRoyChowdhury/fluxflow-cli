import { subagentProgress } from '../utils/subagent_state.js';
import { parseArgs } from '../utils/arg_parser.js';

export const steerSubagent = async (args, context = {}) => {
    const parsed = parseArgs(args);
    const id = parsed.id;
    const message = parsed.message || parsed.instruction || parsed.text || parsed.prompt;

    if (!id) {
        return 'ERROR: Missing "id" argument for Steer.';
    }

    if (!message) {
        return 'ERROR: Missing "message" argument for Steer.';
    }

    const task = subagentProgress.find(t => t.id === id);
    if (!task) {
        return `ERROR: Subagent task with ID [${id}] not found.`;
    }

    if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
        return `ERROR: Cannot steer subagent task [${id}] because it has already finished with status [${task.status.toUpperCase()}].`;
    }

    if (typeof task.steer === 'function') {
        task.steer(message);
    } else {
        if (!task.pendingSteerMessages) {
            task.pendingSteerMessages = [];
        }
        task.pendingSteerMessages.push(message);
    }

    if (context.onSubagentUpdate) {
        context.onSubagentUpdate();
    }

    return `SUCCESS: Steering instruction injected into subagent task [${id}]. It will be processed on the subagent's turn.`;
};
