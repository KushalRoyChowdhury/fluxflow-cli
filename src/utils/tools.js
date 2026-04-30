import { web_search } from '../tools/web_search.js';
import { web_scrape } from '../tools/web_scrape.js';
import { memory } from '../tools/memory.js';
import { chat } from '../tools/chat.js';
import { list_files } from '../tools/list_files.js';
import { view_file } from '../tools/view_file.js';
import { write_file } from '../tools/write_file.js';
import { update_file } from '../tools/update_file.js';
import { exec_command } from '../tools/exec_command.js';
import { read_folder } from '../tools/read_folder.js';
import { ask_user } from '../tools/ask_user.js';
import { write_pdf } from '../tools/write_pdf.js';

const TOOL_MAP = {
    web_search,
    web_scrape,
    memory,
    chat,
    list_files,
    view_file,
    write_file,
    update_file,
    exec_command,
    read_folder,
    write_pdf,
    ask: ask_user
};

/**
 * Dispatches a tool call to the appropriate module.
 * @param {string} toolName - The name of the tool to call.
 * @param {string} args - The raw arguments string from the model.
 * @returns {Promise<string>} The result of the tool execution.
 */
export const dispatchTool = async (toolName, args, context = {}) => {
    const tool = TOOL_MAP[toolName];

    if (!tool) {
        return `ERROR: Tool [${toolName}] not found in registry.`;
    }

    try {
        // Support both sync and async tools, passing external context
        return await tool(args, context);
    } catch (err) {
        return `ERROR: Execution failed for [${toolName}]: ${err.message}`;
    }
};
