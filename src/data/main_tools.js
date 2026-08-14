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

    const fluxInstructions = `- JSON ESCAPE LITERAL ESCAPE SEQUENCES IN TOOL ARGUMENTS
- SAME file, MULTIPLE edits? ONE PatchFile (≤15 blocks) ← PRIORITY
- Tool denied? Ask for guidance ← MANDATORY
- Need text or HUGE file? CodeSearch > Full Read
- MUST AVOID UNNECESSARY LARGE-FILE CHUNK READS
- DONT HALLUCINATE TOOL RESULTS, VERIFY, FIX ERRORS
- Stuck on syntax error? TELL USER > Waste Time
`;

// =====================================================================================================

    const fluxTools = `- WORKSPACE TOOLS (path = relative; FIRST ARGUMENT, path separator: '/') -
- [tool:functions.ReadFile(path="...", startLine="integer", endLine="integer")]. ${aiProvider !== 'Google' ? `${isMultiModal ? `Supports images/docs` : ''}` : `Supports images/docs`}
- [tool:functions.ReadFolder(path="...", recurse="integer 1-3")]. Minimize recursion
- [tool:functions.PatchFile(path="...", allowMultiple="bool, default: false", searchContent1="search string OR ^LINE:start..end$", newContent1="...", ...MAX15)]. TARGET MINIMAL searchContent. Line Ranges MUST for large searchContent AND escape sequences. ^...$ MUST for line ranges
- [tool:functions.WriteFile(path="...", content="...")]. Creates/Overwrites. File Exist? PatchFile > WriteFile
- [tool:functions.CodeSearch(keyword="...", path="dir/file/glob/regex, inclusion/exclusion ;-separated", fuzzy="bool false", regex="bool auto")]. Find definitions, logic, relevant code, standard junk auto-excluded
- [tool:functions.Run(command="...")]. Runs ${osDetected === 'Windows' ? (isPsAvailable() ? `POWERSHELL` : `WINDOWS CMD`) : `BASH`} command. Destructive/Irreversible ops → Ask user
- [tool:functions.Todo(method="create/append/get", tasks=[STRING ARRAY], markDone=[TASK ARRAY])]. If long multi-task: create Todos before starting. \`get + markDone\` to mark complete. UPDATE EVERY TURN WHEN CREATED
${_cachedAdvanceRollback ? `
- EMERGENCY TOOLS -
Info: \`initial\` = current task prompt. Revert \`id\` = turn before disaster (eg. disaster: \`turn_3\` → revert: \`turn_2\`). Reason explicitly
- [tool:functions.EmergencyRollback(method="getCheckpoint/forceRevert", id="...")]. Rollback workspace in THIS agent loop. ONLY for catastrophic corruption. Before ending, verify no catastrophe. \`id\` omitted for \`getCheckpoint\`\n` : ''}${enableSubAgents ? `
- SUB AGENT TOOLS -
**PROACTIVE use HIGHLY RECOMMENDED. Prefer for any task, no user nudge needed**
Invocations:
• Invoke (async/background, ≤7 parallel). Parallelize long tasks. May take time
• InvokeSync (sync/blocking). Sequential, repetitive or delegated tasks. Saves tokens/cost
- [tool:functions.InvokeSync/Invoke(title="...", task="...")]. Task must be detailed: exact file paths, imports/exports, dependencies
- [tool:functions.Await(id="...", timeout="integer")]. Event-driven wait
- [tool:functions.GetProgress(id="...")]. Poll sparingly; NO initial poll. Work or await. Never end while subagent runs
- [tool:functions.Steer(id="...", message="...")]. Inject additional instruction or redirection into active async subagent
- [tool:functions.Cancel(id="...")]. Cancel async task ONLY if stalled (2m+) or incorrect` : ''}`;

// =====================================================================================================

    const flowTools = `- CREATIVE TOOLS (path = relative to CWD & WILL BE FIRST ARGUMENT, path separator: '/') -
- [tool:functions.WritePDF(path="...", content="...", orientation="...")]. PROACTIVE A4 PAGE BREAKS MUST IN CSS. HTML/CSS for PREMIUM layout, stable margins & headers/footers, NO WATERMARKS
- [tool:functions.WriteDoc(path="...", content="...")]. A4 Word document, NO WATERMARKS, stable margins & headers/footers`;

// =====================================================================================================

    const computerTools = `- COMPUTER USE TOOLS (GUI Desktop Automation) -
- [tool:functions.Click(gridId="integer", type="single/double", button="left/middle/right", intendedClickText="target text")]. Click target grid number, intendedClickText: LITERAL TEXT/ICON ON SCREEN (OCR SCANNBALE, UPTO 3 WORDS). DOUBLE CLICK DESKTOP ICONS
- [tool:functions.Drag(fromGridId="integer", toGridId="integer")]. Drag mouse from start grid number to target grid number
- [tool:functions.Scroll(direction="up/down", amount="int 1-10", gridId="mouse hover area")]. Scroll viewport vertically
- [tool:functions.KeyboardTyping(text="string", autoPressEnter="bool")]. Type text string into currently active input. JSON ESCAPE LITERAL ESCAPE SEQUENCES IN TOOL ARGUMENTS
- [tool:functions.KeyPress(key="key or ;-separated combination, eg: enter, backspace, clearInput, ctrl;c, alt;tab, f5, f11, alt;f4")]. Press key, shortcut, function key (f1-f12), or clear active input field.
- [tool:functions.RecaptureScreen()]. Request fresh gridded screenshot`;

// =====================================================================================================

    return `
-- AVAILABLE TOOLS (STRING BASED PROTOCOL) --
TO USE TOOLS, MUST OUTPUT EXACTLY '[tool:functions.ToolName(arg1="value1")]' STRUCTURED STRING IN CHAT RESPONSE ← STRICT
TOOL RULES:
- MAX 3 TOOL CALLS/TURN${mode === 'Flux' || mode.toLowerCase() === 'fluxcu' ? ' (Todo: 3+, Run: max 1 or 2 consecutive)' : ''}
${mode === 'Flux' || mode.toLowerCase() === 'fluxcu' ? `${fluxInstructions}` : ""}
- USER COMMUNICATION -
- [tool:functions.Ask(question="...", optionA="title::description", ...MAX4)]. Ambiguity: MUST for path divergence, security risk. Ask, don't finish/guess. Keep titles short

- WEB TOOLS -
- [tool:functions.WebSearch(query="...", aiMode="bool", limit="integer 3-10 aiMode: exclude")]. Usage: unknown info/docs. aiMode: LLM search
- [tool:functions.WebScrape(url="...")]. Proactive use for specific webpage/docs/api

${mode === 'ICU' ? `${computerTools}` : mode === 'FluxCU' ? `${fluxTools}\n${computerTools}` : mode === 'Flux' ? `${fluxTools}` : `${flowTools}`}`.trim();
};
// [DEPRICATED] - [tool:functions.GenerateImage(path="... png", prompt="detailed", ratio="16:9, 9:16, 1:1")].. Mockups, PDF thumbnails, any visual content
// [DEPRICATED] - [tool:functions.FileMap(path="...")]. Shows file's code structure
