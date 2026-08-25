import { execSync } from 'child_process';
import { isPtyAvailable } from '../tools/exec_command';

let _isPsAvailable = null;
export const isPsAvailable = () => {
    if (process.platform !== 'win32') return false;
    if (_isPsAvailable !== null) return _isPsAvailable;
    try {
        // Silent check for powershell availability
        execSync('powershell.exe -NoProfile -Command "exit"', { stdio: 'ignore' });
        _isPsAvailable = true;
    } catch (e) {
        _isPsAvailable = false;
    }
    return _isPsAvailable;
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
- ReadFile(path="...", startLine="int", endLine="int")${aiProvider !== 'Google' ? `${isMultiModal ? `. Supports images/docs` : ''}` : `. Supports images/docs`}
- ReadFolder(path="...", recurse="int 1-3"). Minimize recursion
- PatchFile(path="...", allowMultiple="bool, false", searchContent1="search string OR ^LINE:start..end$", newContent1="...", ...MAX15). Use small searchContent. Line Ranges must for large searchContent and escape sequences. ^...$ must for line ranges
- WriteFile(path="...", content="..."). Creates/Overwrites. File Exist? PatchFile > WriteFile
- CodeSearch(keyword="...", path="dir/file/glob/regex, inclusion/exclusion ;-separated", fuzzy="bool, false", regex="bool, auto"). Find definitions, logic, relevant code, standard junk auto-excluded
- Run(command="..."). Runs ${osDetected === 'Windows' ? (isPsAvailable() ? `powershell` : `windows CMD`) : `bash`} command. Destructive/Irreversible ops → Ask user
- Goal(method="create/append/get", tasks=[string array], markDone=[task array]). If long multi-task: create Goals before starting. \`get + markDone\` to mark complete. Update every turn when created
${_cachedAdvanceRollback ? `
**Emergency Tools**
Info: \`initial\` = current task prompt. Revert \`id\` = turn before disaster (eg. disaster: \`turn_3\` → revert: \`turn_2\`). Reason explicitly
- EmergencyRollback(method="getCheckpoint/forceRevert", id="..."). Rollback workspace in this agent loop. ONLY for catastrophic corruption. Before ending, verify no catastrophe. \`id\` omitted for \`getCheckpoint\`\n` : ''}${enableSubAgents ? `
**Sub Agent Tools**
proactive use highly recommended. Prefer for any task, no user nudge needed
Invocations:
• Invoke (async/background, ≤7 parallel). Parallelize long tasks. May take time
• InvokeSync (sync/blocking). Sequential, repetitive or delegated tasks. Saves tokens/cost
- InvokeSync/Invoke(title="...", task="..."). Task must be detailed: exact file paths, imports/exports, dependencies
- Await(id="...", timeout="integer"). Event-driven wait
- GetProgress(id="..."). Poll sparingly; NO initial poll. Work or await. Never end while subagent runs
- Steer(id="...", message="..."). Inject additional instruction or redirection into active async subagent
- Cancel(id="..."). Cancel async task ONLY if stalled (2m+) or incorrect` : ''}`;

    // =====================================================================================================

    const flowTools = `**Creative Tools (path = relative; first argument, path separator: '/')**
- WritePDF(path="...", content="...", orientation="..."). Proactive A4 page breaks must in css. HTML/CSS for premium layout, stable margins & headers/footers, no watermarks
- WriteDoc(path="...", content="..."). A4 Word document, no watermarks, stable margins & headers/footers`;

    // =====================================================================================================

    const computerTools = `**Computer Use Tools (GUI Desktop Automation)**
- Click(gridId="integer", type="single/double", button="left/middle/right", intendedClickText="target text"). Click target grid number, intendedClickText: literal text/icon on screen (OCR scannable, upto 3 words). Double click desktop icons
- Drag(fromGridId="integer", toGridId="integer"). Drag mouse from start grid number to target grid number
- Scroll(direction="up/down", gridId="mouse hover area"). Scroll viewport vertically
- KeyboardTyping(text="string", autoPressEnter="bool"). Type text string into currently active input. JSON escape literal escape sequences
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
- AskUser(question="...", optionA="title::description", ...MAX4). Ambiguity, path divergence, security risk. Ask, dont finish/guess. Keep titles short

**Web Tools**
- WebSearch(query="...", aiMode="bool, optional", limit="integer 3-10 aiMode: exclude"). Proactive use for unknown info/docs. aiMode: LLM search
- WebScrape(url="..."). Proactive use for specific webpage/docs/api

${mode === 'ICU' ? `${computerTools}` : mode === 'FluxCU' ? `${fluxTools}\n${computerTools}` : mode === 'Flux' ? `${fluxTools}` : `${flowTools}`}`.trim();
};
// [DEPRICATED] - GenerateImage(path="... png", prompt="detailed", ratio="16:9, 9:16, 1:1").. Mockups, PDF thumbnails, any visual content
// [DEPRICATED] - FileMap(path="..."). Shows file's code structure

// \n${flowTools.replace('**Creative Tools (path = relative; first argument, path separator: ' / ')**', '**Creative Tools**')}
