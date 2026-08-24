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
import { todo } from '../tools/todo.js';
import { invokeSync } from '../tools/invokeSync.js';
import { invoke } from '../tools/invoke.js';
import { getProgress } from '../tools/getProgress.js';
import { cancel } from '../tools/cancel.js';
import { awaitTool } from '../tools/await.js';
import { emergency_rollback } from '../tools/emergency_rollback.js';
import { awaitSubagent } from '../tools/awaitSubagent.js';
import { answerSubagent } from '../tools/answerSubagent.js';
import { steerSubagent } from '../tools/steerSubagent.js';
import { computer_action } from '../tools/computer_action.js';
import { click } from '../tools/click.js';
import { drag } from '../tools/drag.js';
import { scroll } from '../tools/scroll.js';
import { keyboard_typing } from '../tools/keyboard_typing.js';
import { key_press } from '../tools/key_press.js';
import { recapture_screen } from '../tools/recapture_screen.js';


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
    todo,
    Todo: todo,
    goal: todo,
    Goal: todo,
    invokeSync,
    invoke,
    getProgress,
    cancel,
    awaitSubagent,
    answerSubagent,
    steerSubagent,
    computer_action,
    computer_use: computer_action,
    ComputerAction: computer_action,
    ComputerUse: computer_action,

    // New Dedicated Computer Use Tools
    click,
    Click: click,
    drag,
    Drag: drag,
    scroll,
    Scroll: scroll,
    keyboard_typing,
    KeyboardTyping: keyboard_typing,
    keyboardtyping: keyboard_typing,
    key_press,
    KeyPress: key_press,
    keypress: key_press,
    recapture_screen,
    RecaptureScreen: recapture_screen,
    recapturescreen: recapture_screen,

    invoke_sync: invokeSync,
    get_progress: getProgress,
    await_subagent: awaitSubagent,
    answer_subagent: answerSubagent,
    steer_subagent: steerSubagent,
    steer: steerSubagent,
    Steer: steerSubagent,
    ask: ask_user,

    // PascalCase Normalizations for Token Efficiency
    Ask: ask_user,
    AskUser: ask_user,
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
    CodeSearch: search_keyword,
    code_search: search_keyword,
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
    FileMap: file_map,
    answer: answerSubagent,
    Answer: answerSubagent,
    AnswerSubagent: answerSubagent,
    await: awaitSubagent,
    Await: awaitSubagent,
    AwaitSubagent: awaitSubagent,
    EmergencyRollback: emergency_rollback,
    emergency_rollback: emergency_rollback
};

/**
 * Dispatches a tool call to the appropriate module.
 * @param {string} toolName - The name of the tool to call.
 * @param {string} args - The raw arguments string from the model.
 * @returns {Promise<string>} The result of the tool execution.
 */
export const dispatchTool = async (toolName, args, context = {}) => {
    const mode = context.mode ? context.mode.toLowerCase() : 'flux';
    const normalized = toolName.toLowerCase();

    // 1. SYSTEM & COMMON TOOLS (Always Allowed)
    const systemTools = ['memory', 'chat', 'savesummary', 'addmemscore', 'add_mem_score', 'ask', 'web_search', 'web_scrape', 'await'];
    const isSystem = systemTools.some(t => normalized.includes(t)) || normalized === 'ask';

    const cuTools = ['click', 'drag', 'scroll', 'keyboardtyping', 'keyboard_typing', 'keypress', 'key_press', 'recapturescreen', 'recapture_screen', 'computer'];
    const isCUTool = cuTools.some(t => normalized.includes(t));

    if (!isSystem) {
        // 2. MODE-SPECIFIC RESTRICTIONS
        if (mode === 'flow') {
            // Flow Mode: Only Creative tools allowed beyond common tools
            const isCreative = normalized.includes('write_pdf') || normalized.includes('write_docx') || normalized.includes('generate_image');
            if (!isCreative) {
                return `ERROR: Tool [${toolName}] is a Workspace Tool and NOT available in Flow mode. Tell user to switch (\`/mode flux\`) to use this tool.`;
            }
        } else if (mode === 'icu') {
            // ICU Mode: Only Computer Use tools allowed
            if (!isCUTool) {
                return `ERROR: Tool [${toolName}] is not available in Computer Use mode. ICU mode only supports Computer Use tools (Click, Drag, Scroll, KeyboardTyping, KeyPress, RecaptureScreen).`;
            }
        } else {
            // Flux & FluxCU Mode: Workspace tools allowed, Creative tools restricted
            const isCreative = normalized.includes('write_pdf') || normalized.includes('write_docx') || normalized.includes('generate_image');
            if (isCreative) {
                return `ERROR: Tool [${toolName}] is not available in ${context.mode || 'Flux'} mode. Tell user to switch (\`/mode flow\`) for document generation.`;
            }
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
