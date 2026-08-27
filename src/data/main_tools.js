import { execSync } from 'child_process';
import { isPtyAvailable } from '../tools/exec_command';

let _isPwshAvailable = null;
export const isPwshAvailable = () => {
    if (process.platform !== 'win32') return false;
    if (_isPwshAvailable !== null) return _isPwshAvailable;
    try {
        execSync('where.exe pwsh.exe', { stdio: 'ignore', windowsHide: true });
        _isPwshAvailable = true;
    } catch (e) {
        _isPwshAvailable = false;
    }
    return _isPwshAvailable;
};

let _isPsAvailable = null;
export const isPsAvailable = () => {
    if (process.platform !== 'win32') return false;
    if (_isPsAvailable !== null) return _isPsAvailable;
    try {
        execSync('where.exe powershell.exe', { stdio: 'ignore', windowsHide: true });
        _isPsAvailable = true;
    } catch (e) {
        _isPsAvailable = false;
    }
    return _isPsAvailable;
};

export const getPreferredWindowsShell = () => {
    if (isPwshAvailable()) return 'pwsh';
    if (isPsAvailable()) return 'powershell';
    return 'cmd';
};

let _cachedAdvanceRollback = null;


export const TOOL_PROTOCOL = (mode, osDetected, isMultiModal, aiProvider, advanceRollback = false, enableSubAgents = true) => {
    if (_cachedAdvanceRollback === null) {
        _cachedAdvanceRollback = advanceRollback;
    }

    const fluxInstructions = `- JSON escape literal sequences inside tool arguments (backslash: \\\\, newLine: \\n, quote: \\\") ← Mandatory
- Same file, multiple edits? One PatchFile (≤15 blocks)
- Tool denied? Ask for guidance
- Need text or huge file? CodeSearch > Full Read
- Avoid unnecessary large file chunk reads
- Dont hallucinate tool results, verify, fix errors
- Stuck on syntax error? Tell user > waste time
`;

    // =====================================================================================================

    const fluxTools = `**Workspace Tools (path = relative; first argument, path separator: '/')**
- ReadFile(path=string, startLine?=int, endLine?=int)${aiProvider !== 'Google' ? `${isMultiModal ? `. Supports images/docs` : ''}` : `. Supports images/docs`}
- ReadFolder(path=string, recurse?=int[1..3]). Minimize recursion
- PatchFile(path=string, allowMultiple?=bool, searchContent1="string match OR ^LINE:start..end$", newContent1=string, ...MAX15). Use small searchStringMatch. Line Ranges must for large searchBlock and escape sequences. ^...$ must for line ranges. JSON Escape applies
- WriteFile(path=string, content=string). Creates/Overwrites. File Exist? PatchFile > WriteFile. JSON Escape applies
- CodeSearch(keyword=string, path?="dir/file/glob/regex, inclusion/exclusion ;-separated", fuzzy?=bool, regex?=bool:auto). Find definitions, logic, relevant code, standard junk auto-excluded
- Run(command=string). Runs ${osDetected === 'Windows' ? (isPsAvailable() ? `powershell` : `windows CMD`) : `bash`} command. Destructive/Irreversible ops → Ask user
- Goal(method="create/append/get", tasks=string[], markDone=string[]). If long multi-task: create Goals before starting. \`get + markDone\` to mark complete. Update every turn when created
${_cachedAdvanceRollback ? `
**Emergency Tools**
Info: \`initial\` = current task prompt. Revert \`id\` = turn before disaster (eg. disaster: \`turn_3\` → revert: \`turn_2\`). Reason explicitly
- EmergencyRollback(method="getCheckpoint/forceRevert", id=string). Rollback workspace in this agent loop. ONLY for catastrophic corruption. Before ending, verify no catastrophe. \`getCheckpoint\`: \`id\` excluded\n` : ''}${enableSubAgents ? `
**Sub Agent Tools**
Default to using subagents whenever helpful, no user nudge needed
Invocations:
• Invoke (async/background, ≤7 parallel). Parallelize long tasks. May take time
• InvokeSync (sync/blocking). Sequential, repetitive or delegated tasks. Saves tokens/cost
- InvokeSync/Invoke(title=string, task=string). Task must be detailed: exact file paths, imports/exports, dependencies
- Await(id=string, timeout=int[..=180]). Event-driven wait
- GetProgress(id=string). Poll sparingly; NO initial poll. Work or await. Never end while subagent runs
- Steer(id=string, message=string). Inject additional instruction or redirection into active async subagent
- Cancel(id=string). Cancel async task ONLY if stalled (2m+) or incorrect` : ''}`;

    // =====================================================================================================

    const flowTools = `**Creative Tools (path = relative; first argument, path separator: '/')**
- WritePDF(path=string, content=string, orientation="landscape/portrait"). Proactive A4 page breaks must in css. HTML/CSS for premium layout, stable margins & headers/footers, no watermarks
- WriteDoc(path=string, content=string). A4 Word document, no watermarks, stable margins & headers/footers`;

    // =====================================================================================================

    const computerTools = `**Computer Use Tools (GUI Desktop Automation)**
- Click(gridId=int, type="single/double", button="left/middle/right", intendedClickText=string). Click target grid number, intendedClickText: literal text/symbol on screen (OCR scannable, upto 3 words). Double click desktop icons
- Drag(fromGridId=int, toGridId=int). Drag mouse from start grid number to target grid number
- Scroll(direction="up/down", gridId=int). Scroll viewport vertically
- KeyboardTyping(text=string, autoPressEnter?=bool). Type text string into currently active input. JSON escape literal escape sequences
- KeyPress(key="key or ;-separated combination, eg: enter, back, backspace, clearInput, ctrl;c, alt;tab, f5, f11, alt;f4"). Press key, shortcut, function key (f1-f12), or clear active input field
- RecaptureScreen(). Request fresh gridded screenshot`;

    // =====================================================================================================

    return `
-- TOOLS --
You cant execute tools. To use tools, must output exactly [tool:functions.ToolName(arg1="value1")] structured string in chat output & wait for system response ← no exception, tool:functions must
Tool Rules:
- Max 5 tool calls/turn${mode === 'Flux' || mode.toLowerCase() === 'fluxcu' ? ' (Todo: 5+)' : ''}
- NO chat text with tool calls
${mode === 'Flux' || mode.toLowerCase() === 'fluxcu' ? `${fluxInstructions}` : ""}
**User Communication**
- AskUser(question=string, optionA="title::description", ...MAX4). Ambiguity, path divergence, security risk. Ask, dont finish/guess. Keep titles short

**Web Tools**
- WebSearch(query=string, aiMode?=bool, limit?=int[3..10]). Proactive use for unknown info/docs. aiMode (LLM search): exclude limit
- WebScrape(url=string). Proactive use for specific webpage/docs/api. Supports JS

${mode === 'ICU' ? `${computerTools}` : mode === 'FluxCU' ? `${fluxTools}\n${computerTools}` : mode === 'Flux' ? `${fluxTools}` : `${flowTools}`}`.trim();
};
// [DEPRICATED] - GenerateImage(path="... png", prompt="detailed", ratio="16:9, 9:16, 1:1").. Mockups, PDF thumbnails, any visual content
// [DEPRICATED] - FileMap(path="..."). Shows file's code structure

// \n${flowTools.replace('**Creative Tools (path = relative; first argument, path separator: ' / ')**', '**Creative Tools**')}
