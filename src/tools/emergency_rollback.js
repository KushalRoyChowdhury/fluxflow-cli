import { parseArgs } from '../utils/arg_parser.js';
import { AdvanceRevertManager } from '../utils/advanceRevert.js';

/**
 * Emergency Rollback Tool
 * Allows reverting the repository to a previous turn's state.
 */
export const emergency_rollback = async (args, context = {}) => {
    const parsed = parseArgs(args);
    const method = parsed.method;
    const id = parsed.id;
    const chatId = context.chatId;
    const systemSettings = context.systemSettings;

    if (!systemSettings?.advanceRollback) {
        return "ERROR: Advance Rollback feature is currently disabled in settings under Security. Tell user to enable it.";
    }

    if (!chatId) {
        return "ERROR: No active chat transaction found for rollback.";
    }

    if (method === 'getCheckpoint') {
        const checkpoints = await AdvanceRevertManager.getCheckpoints(chatId);
        if (checkpoints.length === 0) {
            return "No checkpoints available.";
        }
        let output = "Available checkpoints for rollback:\n\n";
        for (const cp of checkpoints) {
            if (cp.id === 'initial') {
                output += `--- Initial State (id: initial) ---\nTools Used: None\n\n`;
            } else {
                const turnNum = cp.id.replace('turn_', '');
                const toolsStr = cp.toolsUsed && cp.toolsUsed.length > 0 ? cp.toolsUsed.join(', ') : 'None';
                output += `--- Turn ${turnNum} (id: ${cp.id}) ---\nTools Used: ${toolsStr}\n\n`;
            }
        }
        return output.trim();
    } else if (method === 'forceRevert') {
        if (!id) {
            return "ERROR: Missing required parameter 'id' for forceRevert.";
        }
        try {
            await AdvanceRevertManager.rollbackToCheckpoint(chatId, id);
            return `SUCCESS: Repository rolled back to checkpoint [${id}].`;
        } catch (err) {
            return `ERROR: ${err.message}`;
        }
    } else {
        return `ERROR: Invalid method "${method}". Use "getCheckpoint" or "forceRevert".`;
    }
};
