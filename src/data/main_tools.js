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
    return `
-- TOOL DEFINITIONS --
Tool calls: ONLY use [tool:functions.ToolName(args)]
**NO OTHER SYNTAX/MARKERS/BOUNDARY ALLOWED**

**TOOL USAGE POLICY:**
- MAX 3 TOOL CALLS/TURN${mode === 'Flux' ? ' (Todo: 3+, Run: max 1 or 2 consecutive)' : ''}
${mode === 'Flux' ? "- Same file, many edits? Prefer multi search-replace in Patch ← **HIGHLY RECOMMENDED**\n- Tool denied?Use Ask immediately for user guidance.NEVER proceed blindly/end turn ← ** MANDATORY **\n- FileMap → ReadFile for efficient file understanding\n- Need specific text ? SearchKeyword > Guessing/ReadFile\n- Huge files ? SearchKeyword > FileMap/Full Read\n- No tool spamming\n- **Update/complete Todos from realtime progress EVERY TURN**\n" : ""}
- COMMUNICATION TOOLS -
1. [tool:functions.Ask(question="...", optionA="option::description", ...MAX 4)]. Ambiguity: MUST ask for path divergence, security or risk. Ask, don't finish/guess. Suggest best options; no preferences. Keep options short

- WEB TOOLS -
1. [tool:functions.WebSearch(query="...", aiMode="true optional", limit=number)]. Limit 3-10 (aiMode ignores). Usage: unknown info/docs. aiMode: LLM search (default: false)
2. [tool:functions.WebScrape(url="...")]. Proactive use for specific webpage/docs/api

${mode === 'Flux' ? `- WORKSPACE TOOLS (path = relative; FIRST ARGUMENT, path separator: '/') -
1. [tool:functions.ReadFile(path="...", startLine=number, endLine=number)]. ${aiProvider !== 'Google' ? `${isMultiModal ? `Supports images/docs` : `No Multimodal support`}` : `Supports images/docs`}
2. [tool:functions.ReadFolder(path="...")]. Detailed DIR stats including File Sizes
3. [tool:functions.FileMap(path="path/file")]. Shows file structure, functions, class, import/export, variables
4. [tool:functions.PatchFile(path="...", allowMultiple="true optional", replaceContent1="...", newContent1="...", ...MAX 10)]. Surgical patch. allowMultiple: Replace all matches (default: false). Multiple patches same file? Use replaceContent2/newContent2... Unsure? ReadFile. MUST VERIFY DIFF
5. [tool:functions.WriteFile(path="...", content="...")]. Creates/Overwrites. File Exist? PatchFile > WriteFile. Verify Imports
6. [tool:functions.SearchKeyword(keyword="...", path="optional, target directory or filename", subString="true optional", regex="false for keyword, optional")]. Project-wide search. path limits scope to a file/dir. Find definitions/logic without full reads. Locate relevant code. Defaults: subString=false, regex=true
7. [tool:functions.Run(command="...")]. Runs ${osDetected === 'Windows' ? (isPsAvailable() ? `WINDOWS POWERSHELL` : `WINDOWS CMD ONLY`) : `BASH`} command. Destructive/Irreversible ops → Ask user
8. [tool:functions.Todo(method="create/append/get", tasks=[ARRAY OF STRINGS], markDone=[ARRAY OF TASK STRINGS])]. Task list, no Markdown in arrays. Analyze request: if multi-task, break it down & create Todos BEFORE starting. \`tasks\` & \`markDone\` optional with \`get\`. Use \`get + markDone\` to complete tasks, or \`create + markDone\` to create completed tasks. **UPDATE EVERY TURN**${enableSubAgents ? '\n9. [tool:functions.Await(time="seconds")]. For waiting without exiting agent loop, 15s - 180s' : ''}
${_cachedAdvanceRollback ? `
- EMERGENCY SAFETY TOOLS -
Info: \`initial\` = user prompt for current task. Revert \`id\` = turn BEFORE the disaster tool (e.g. disaster:\`turn_3\` → revert:\`turn_2\`). Reason explicitly if needed.
1. [tool:functions.EmergencyRollback(method="getCheckpoint/forceRevert", id="...")]. Rollback workspace to a checkpoint in THIS agent loop.
Use ONLY for catastrophic/codebase corruption. Before ending loop, verify no catastrophe. \`id\` not required with \`getCheckPoint\`.\n` : ''}${enableSubAgents ? `
- SUB AGENT TOOLS -
**PROACTIVE sub-agent use HIGHLY RECOMMENDED. Prefer for any task with even slight benefit, no user nudge needed**
Invocations:
- Invoke (async/background, ≤7 parallel). Parallelize long tasks. NEVER repeat while active
- InvokeSync (sync/blocking). Sequential, repetitive or delegated tasks. Saves tokens/cost
1. [agent:generalist.InvokeSync/Invoke(title="...", task="...")]. Task must be detailed: exact file paths, imports/exports, dependencies & folder structure
2. [agent:generalist.GetProgress(id="...")]. Check async task progress. If still running, continue your work. Wait exponentially longer between checks. NEVER spam GetProgress
3. [agent:generalist.Cancel(id="...")]. Cancel async task ONLY if stalled (2m+) or clearly incorrect` : ''}`.trim()
:










`- CREATIVE TOOLS (path = relative to CWD & WILL BE FIRST ARGUMENT, path separator: '/') -
1. [tool:functions.WritePDF(path="...", content="...", orientation="...")]. PROACTIVE A4 PAGE BREAKS MUST IN CSS. HTML/CSS for PREMIUM layout, stable margins & headers/footers, NO WATERMARKS
2. [tool:functions.WriteDoc(path="...", content="...")]. A4 Word document, NO WATERMARKS, stable margins & headers/footers
- WORKSPACE & SUB AGENT TOOLS ARE NOT AVAILABLE IN FLOW`.trim()}

- VERIFY TOOL RESULT CONTENTS. Fix errors. No hallucinations
- **Escape quotes: \\" for code strings**
- **Literal escapes: Double-escape sequences (e.g., \\\\n)**
- **File structure: Real newlines for code formatting**`.trim();
};
// [DEPRICATED] 7. [tool:functions.GenerateImage(path="... png", prompt="detailed", ratio="16:9, 9:16, 1:1")].. Mockups, PDF thumbnails, any visual content
