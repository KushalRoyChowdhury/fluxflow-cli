import { web_search } from '../tools/web_search.js';
import { web_scrape } from '../tools/web_scrape.js';
import { memory } from '../tools/memory.js';
import { chat } from '../tools/chat.js';
import { view_file } from '../tools/view_file.js';
import { write_file } from '../tools/write_file.js';
import { update_file } from '../tools/update_file.js';
import { exec_command } from '../tools/exec_command.js';
import { read_folder } from '../tools/read_folder.js';
import { ask_user } from '../tools/ask_user.js';
import { write_pdf } from '../tools/write_pdf.js';
import { write_docx } from '../tools/write_docx.js';
import { search_keyword } from '../tools/search_keyword.js';
import { generate_image } from '../tools/generate_image.js';
import { saveSummary } from '../tools/saveSummary.js';
import { addMemScore } from '../tools/addMemScore.js';
import { file_map } from '../tools/file_map.js';

const TOOL_MAP = {
    web_search,
    web_scrape,
    memory,
    chat,
    view_file,
    write_file,
    update_file,
    exec_command,
    read_folder,
    write_pdf,
    write_docx,
    search_keyword,
    generate_image,
    saveSummary,
    addMemScore,
    file_map,
    ask: ask_user,

    // PascalCase Normalizations for Token Efficiency
    Ask: ask_user,
    WebSearch: web_search,
    WebScrape: web_scrape,
    ReadFile: view_file,
    ReadFolder: read_folder,
    WriteFile: write_file,
    PatchFile: update_file,
    WritePDF: write_pdf,
    WriteDoc: write_docx,
    Run: exec_command,
    SearchKeyword: search_keyword,
    Memory: memory,
    Chat: chat,
    GenerateImage: generate_image,
    saveSumary: saveSummary,
    SaveSummary: saveSummary,
    SaveSumary: saveSummary,
    add_mem_score: addMemScore,
    AddMemScore: addMemScore,
    addMemoryScore: addMemScore,
    AddMemoryScore: addMemScore,
    FileMap: file_map
};

/**
 * Dispatches a tool call to the appropriate module.
 * @param {string} toolName - The name of the tool to call.
 * @param {string} args - The raw arguments string from the model.
 * @returns {Promise<string>} The result of the tool execution.
 */
export const dispatchTool = async (toolName, args, context = {}) => {
    if (context.mode && context.mode.toLowerCase() === 'flow') {
        const normalized = toolName.toLowerCase();
        const isWebOrAsk = normalized.startsWith('web') || normalized.startsWith('ask');
        if (!isWebOrAsk) {
            return `ERROR: Tool [${toolName}] is restricted in Flow mode.`;
        }
    }

    const tool = TOOL_MAP[toolName];

    if (!tool) {
        return `ERROR: Tool [${toolName}] not found in registry.`;
    }

    try {
        // Support both sync and async tools, passing external context
        return await tool(args, context);
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return `ERROR: Execution failed for [${toolName}]: ${errorMsg}`;
    }
};
