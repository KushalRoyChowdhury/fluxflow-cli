// ─── Lazy Tool Loaders ───────────────────────────────────────────────────────
// Tool modules are imported on first use so heavy native dependencies
// (puppeteer, @nut-tree-fork/nut-js, sharp, pdf-lib, html-to-docx, tesseract.js,
// screenshot-desktop, ...) stay OUT of the boot graph.
const loadWebSearch = () => import('../tools/web_search.js').then(m => m.web_search);
const loadWebScrape = () => import('../tools/web_scrape.js').then(m => m.web_scrape);
const loadMemory = () => import('../tools/memory.js').then(m => m.memory);
const loadChat = () => import('../tools/chat.js').then(m => m.chat);
const loadViewFile = () => import('../tools/view_file.js').then(m => m.view_file);
const loadWriteFile = () => import('../tools/write_file.js').then(m => m.write_file);
const loadUpdateFile = () => import('../tools/update_file.js').then(m => m.update_file);
const loadExecCommand = () => import('../tools/exec_command.js').then(m => m.exec_command);
const loadReadFolder = () => import('../tools/read_folder.js').then(m => m.read_folder);
const loadAskUser = () => import('../tools/ask_user.js').then(m => m.ask_user);
const loadWritePdf = () => import('../tools/write_pdf.js').then(m => m.write_pdf);
const loadWriteDocx = () => import('../tools/write_docx.js').then(m => m.write_docx);
const loadSearchKeyword = () => import('../tools/search_keyword.js').then(m => m.search_keyword);
const loadGenerateImage = () => import('../tools/generate_image.js').then(m => m.generate_image);
const loadSaveSummary = () => import('../tools/saveSummary.js').then(m => m.saveSummary);
const loadAddMemScore = () => import('../tools/addMemScore.js').then(m => m.addMemScore);
const loadFileMap = () => import('../tools/file_map.js').then(m => m.file_map);
const loadTodo = () => import('../tools/todo.js').then(m => m.todo);
const loadInvokeSync = () => import('../tools/invokeSync.js').then(m => m.invokeSync);
const loadInvoke = () => import('../tools/invoke.js').then(m => m.invoke);
const loadGetProgress = () => import('../tools/getProgress.js').then(m => m.getProgress);
const loadCancel = () => import('../tools/cancel.js').then(m => m.cancel);
const loadEmergencyRollback = () => import('../tools/emergency_rollback.js').then(m => m.emergency_rollback);
const loadAwaitSubagent = () => import('../tools/awaitSubagent.js').then(m => m.awaitSubagent);
const loadAnswerSubagent = () => import('../tools/answerSubagent.js').then(m => m.answerSubagent);
const loadSteerSubagent = () => import('../tools/steerSubagent.js').then(m => m.steerSubagent);
const loadComputerAction = () => import('../tools/computer_action.js').then(m => m.computer_action);
const loadClick = () => import('../tools/click.js').then(m => m.click);
const loadDrag = () => import('../tools/drag.js').then(m => m.drag);
const loadScroll = () => import('../tools/scroll.js').then(m => m.scroll);
const loadKeyboardTyping = () => import('../tools/keyboard_typing.js').then(m => m.keyboard_typing);
const loadKeyPress = () => import('../tools/key_press.js').then(m => m.key_press);
const loadRecaptureScreen = () => import('../tools/recapture_screen.js').then(m => m.recapture_screen);

// Alias table → lazy loader (module resolved only when the tool is invoked).
const TOOL_MAP = {
    web_search: loadWebSearch,
    web_scrape: loadWebScrape,
    memory: loadMemory,
    chat: loadChat,
    view_file: loadViewFile,
    write_file: loadWriteFile,
    update_file: loadUpdateFile,
    exec_command: loadExecCommand,
    read_folder: loadReadFolder,
    write_pdf: loadWritePdf,
    write_docx: loadWriteDocx,
    search_keyword: loadSearchKeyword,
    generate_image: loadGenerateImage,
    saveSummary: loadSaveSummary,
    addMemScore: loadAddMemScore,
    file_map: loadFileMap,
    todo: loadTodo,
    Todo: loadTodo,
    goal: loadTodo,
    Goal: loadTodo,
    invokeSync: loadInvokeSync,
    invoke: loadInvoke,
    getProgress: loadGetProgress,
    cancel: loadCancel,
    awaitSubagent: loadAwaitSubagent,
    answerSubagent: loadAnswerSubagent,
    steerSubagent: loadSteerSubagent,
    computer_action: loadComputerAction,
    computer_use: loadComputerAction,
    ComputerAction: loadComputerAction,
    ComputerUse: loadComputerAction,

    // New Dedicated Computer Use Tools
    click: loadClick,
    Click: loadClick,
    drag: loadDrag,
    Drag: loadDrag,
    scroll: loadScroll,
    Scroll: loadScroll,
    keyboard_typing: loadKeyboardTyping,
    KeyboardTyping: loadKeyboardTyping,
    keyboardtyping: loadKeyboardTyping,
    key_press: loadKeyPress,
    KeyPress: loadKeyPress,
    keypress: loadKeyPress,
    recapture_screen: loadRecaptureScreen,
    RecaptureScreen: loadRecaptureScreen,
    recapturescreen: loadRecaptureScreen,

    invoke_sync: loadInvokeSync,
    get_progress: loadGetProgress,
    await_subagent: loadAwaitSubagent,
    answer_subagent: loadAnswerSubagent,
    steer_subagent: loadSteerSubagent,
    steer: loadSteerSubagent,
    Steer: loadSteerSubagent,
    ask: loadAskUser,

    // PascalCase Normalizations for Token Efficiency
    Ask: loadAskUser,
    AskUser: loadAskUser,
    WebSearch: loadWebSearch,
    WebScrape: loadWebScrape,
    ReadFile: loadViewFile,
    ReadFolder: loadReadFolder,
    WriteFile: loadWriteFile,
    PatchFile: loadUpdateFile,
    WritePDF: loadWritePdf,
    WriteDoc: loadWriteDocx,
    Run: loadExecCommand,
    SearchKeyword: loadSearchKeyword,
    CodeSearch: loadSearchKeyword,
    code_search: loadSearchKeyword,
    Memory: loadMemory,
    Chat: loadChat,
    GenerateImage: loadGenerateImage,
    saveSumary: loadSaveSummary,
    SaveSummary: loadSaveSummary,
    SaveSumary: loadSaveSummary,
    add_mem_score: loadAddMemScore,
    AddMemScore: loadAddMemScore,
    addMemoryScore: loadAddMemScore,
    AddMemoryScore: loadAddMemScore,
    FileMap: loadFileMap,
    answer: loadAnswerSubagent,
    Answer: loadAnswerSubagent,
    AnswerSubagent: loadAnswerSubagent,
    await: loadAwaitSubagent,
    Await: loadAwaitSubagent,
    AwaitSubagent: loadAwaitSubagent,
    EmergencyRollback: loadEmergencyRollback,
    emergency_rollback: loadEmergencyRollback
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

    const loader = TOOL_MAP[toolName];

    if (!loader) {
        // Canonical PascalCase names as exposed to the model in the system prompt
        const CANONICAL_TOOLS = [
            'ReadFile', 'ReadFolder', 'PatchFile', 'WriteFile', 'CodeSearch', 'Run', 'Goal',
            'AskUser', 'WebSearch', 'WebScrape', 'WritePDF', 'WriteDoc',
            'Click', 'Drag', 'Scroll', 'KeyboardTyping', 'KeyPress', 'RecaptureScreen',
            'Invoke', 'InvokeSync', 'Await', 'GetProgress', 'Steer', 'Cancel', 'EmergencyRollback', 'Chat', 'Memory'
        ];

        // Semantic / common shorthand mappings for smarter suggestions
        const ALIAS_MAP = {
            'read': 'ReadFile',
            'view': 'ReadFile',
            'viewfile': 'ReadFile',
            'write': 'WriteFile',
            'edit': 'PatchFile',
            'patch': 'PatchFile',
            'update': 'PatchFile',
            'updatefile': 'PatchFile',
            'exec': 'Run',
            'command': 'Run',
            'bash': 'Run',
            'shell': 'Run',
            'powershell': 'Run',
            'search': 'CodeSearch',
            'grep': 'CodeSearch',
            'find': 'CodeSearch',
            'searchkeyword': 'CodeSearch',
            'folder': 'ReadFolder',
            'ls': 'ReadFolder',
            'dir': 'ReadFolder',
            'list': 'ReadFolder',
            'ask': 'AskUser',
            'question': 'AskUser',
            'pdf': 'WritePDF',
            'docx': 'WriteDoc',
            'doc': 'WriteDoc',
            'word': 'WriteDoc',
            'screenshot': 'RecaptureScreen',
            'screen': 'RecaptureScreen',
            'recapture': 'RecaptureScreen',
            'type': 'KeyboardTyping',
            'typing': 'KeyboardTyping',
            'keyboard': 'KeyboardTyping',
            'press': 'KeyPress',
            'key': 'KeyPress',
            'todo': 'Goal',
            'task': 'Goal',
            'subagent': 'Invoke',
            'agent': 'Invoke'
        };

        const cleanInput = normalized.replace(/[^a-z0-9]/g, '');
        let bestMatch = ALIAS_MAP[cleanInput] || null;

        if (!bestMatch) {
            let highestScore = 0;
            const getBigrams = (str) => {
                const s = new Set();
                for (let i = 0; i < str.length - 1; i++) s.add(str.slice(i, i + 2));
                return s;
            };

            const bg1 = getBigrams(cleanInput);

            for (const candidate of CANONICAL_TOOLS) {
                const cleanCandidate = candidate.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (cleanInput === cleanCandidate) {
                    bestMatch = candidate;
                    break;
                }

                let score = 0;
                if (cleanCandidate.includes(cleanInput) || cleanInput.includes(cleanCandidate)) {
                    score += 0.6;
                }

                const bg2 = getBigrams(cleanCandidate);
                let intersection = 0;
                for (const bg of bg1) {
                    if (bg2.has(bg)) intersection++;
                }

                const dice = (2 * intersection) / ((bg1.size + bg2.size) || 1);
                score = Math.max(score, dice);

                if (score > highestScore && score >= 0.35) {
                    highestScore = score;
                    bestMatch = candidate;
                }
            }
        }

        const suggestion = bestMatch ? ` Do you mean '${bestMatch}'?` : '';
        return `ERROR: Tool [${toolName}] not found in registry.${suggestion}`;
    }

    try {
        // Resolve the lazy module first, then execute with external context.
        const tool = await loader();
        // Support both sync and async tools, passing external context
        return await tool(args, context);
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return `ERROR: Execution failed for [${toolName}]: ${errorMsg}`;
    }
};
