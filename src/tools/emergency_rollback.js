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

        const FRIENDLY_TOOL_NAMES = {
            'write_file': 'WriteFile',
            'update_file': 'PatchFile',
            'view_file': 'ReadFile',
            'read_folder': 'ReadFolder',
            'exec_command': 'Run',
            'web_search': 'WebSearch',
            'web_scrape': 'WebScrape',
            'search_keyword': 'SearchKeyword',
            'write_pdf': 'WritePDF',
            'write_docx': 'WriteDoc',
            'generate_image': 'GenerateImage',
            'file_map': 'FileMap',
            'todo': 'Todo',
            'await': 'Await',
            'ask': 'Ask',
            'ask_user': 'Ask',
            'invoke': 'Invoke',
            'invokesync': 'InvokeSync',
            'getprogress': 'GetProgress',
            'cancel': 'Cancel',
            'emergency_rollback': 'EmergencyRollback',
            'emergencyrollback': 'EmergencyRollback'
        };

        const getFriendlyName = (name) => {
            return FRIENDLY_TOOL_NAMES[name] || FRIENDLY_TOOL_NAMES[name.toLowerCase()] || name;
        };

        let output = "Available checkpoints for rollback:\n\n";
        for (const cp of checkpoints) {
            if (cp.id === 'initial') {
                output += `--- Initial State (id: initial) ---\nTools Used: User Prompted for task\n\n`;
            } else {
                const turnNum = cp.id.replace('turn_', '');
                const toolsStr = cp.toolsUsed && cp.toolsUsed.length > 0
                    ? cp.toolsUsed.map(getFriendlyName).join(', ')
                    : 'None';
                output += `--- Turn ${turnNum} (id: ${cp.id}) ---\nTools Used: ${toolsStr}\n\n`;
            }
        }
        return output.trim();
    } else if (method === 'forceRevert') {
        if (!id) {
            return "ERROR: Missing required parameter 'id' for forceRevert.";
        }
        try {
            const result = await AdvanceRevertManager.rollbackToCheckpoint(chatId, id);
            const { checkpointId, stats } = result;
            const totalFiles = stats.restored + stats.replaced + stats.failed.length;

            let output = `SUCCESS: Repository rolled back to checkpoint [${checkpointId}].\n\n`;
            output += `Stats:\n`;
            output += `  Restored : ${stats.restored} file${stats.restored !== 1 ? 's' : ''} (new to workspace)\n`;
            output += `  Replaced : ${stats.replaced} file${stats.replaced !== 1 ? 's' : ''} (overwritten)\n`;
            output += `  Failed   : ${stats.failed.length} file${stats.failed.length !== 1 ? 's' : ''}`;

            if (stats.failed.length > 0) {
                output += `\n    ${stats.failed.join('\n    ')}`;
            }

            output += `\n  ────────────────────────────-\n`;
            output += `  Total    : ${totalFiles} file${totalFiles !== 1 ? 's' : ''} processed`;

            return output;
        } catch (err) {
            return `ERROR: ${err.message}`;
        }
    } else {
        return `ERROR: Invalid method "${method}". Use "getCheckpoint" or "forceRevert".`;
    }
};
