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
- MAX 4 TOOL CALLS/TURN${mode === 'Flux' ? ' (Todo: 4+, Run: max 1 or 2 consecutive)' : ''}
${mode === 'Flux' ? "- **Escape quotes: \\\" for code strings **\n- ** Literal escapes: Double - escape sequences(e.g., \\\\n) **\n- ** File structure: Real newlines for code formatting**\n- Same file, many edits? Prefer multi search-replace in Patch ← **HIGHLY RECOMMENDED**\n- Tool denied?Use \`Ask\` immediately for user guidance ← ** MANDATORY **\n- FileMap > ReadFile for efficient file understanding\n- Need specific text ? SearchKeyword > Guessing/ReadFile\n- Huge files ? SearchKeyword > Full Read\n- **Update Todos from realtime progress EVERY TURN**\n" : ""}
- COMMUNICATION TOOLS -
1. [tool:functions.Ask(question="...", optionA="option::description", ...MAX 4)]. Ambiguity: MUST for path divergence, security risk. Ask, don't finish/guess. Suggest best options; no preferences. Keep options short

- WEB TOOLS -
1. [tool:functions.WebSearch(query="...", aiMode="bool optional, default: false", limit="integer 3-10, aiMode: exclude")]. Usage: unknown info/docs. aiMode: LLM search
2. [tool:functions.WebScrape(url="...")]. Proactive use for specific webpage/docs/api

${mode === 'Flux' ? `- WORKSPACE TOOLS (path = relative; FIRST ARGUMENT, path separator: '/') -
1. [tool:functions.ReadFile(path="...", startLine="integer", endLine="integer")]. ${aiProvider !== 'Google' ? `${isMultiModal ? `Supports images/docs` : ''}` : `Supports images/docs`}
2. [tool:functions.ReadFolder(path="...", recurse="integer 0-4 optional, default: 0")]. Detailed DIR stats & metadata
3. [tool:functions.FileMap(path="file")]. Shows file structure
4. [tool:functions.PatchFile(path="...", allowMultiple="bool optional, default: false", replaceContent1="...", newContent1="...", ...MAX 15)]. Surgical patchs, TARGET SMALLEST LINES/SUB-STRINGS. allowMultiple: Replace all matches. Use replaceContent2/newContent2... for multi blocks. Verify DIFFs
5. [tool:functions.WriteFile(path="...", content="...")]. Creates/Overwrites. File Exist? PatchFile > WriteFile
6. [tool:functions.SearchKeyword(keyword="...", path="optional, target directory/filename", subString="bool optional, default: false", regex="bool optional, default: auto")]. path limits scope to a file/dir. Find definitions/logic without full reads. Locate relevant code
7. [tool:functions.Run(command="...")]. Runs ${osDetected === 'Windows' ? (isPsAvailable() ? `WINDOWS POWERSHELL` : `WINDOWS CMD`) : `BASH`} command. Destructive/Irreversible ops → Ask user
8. [tool:functions.Todo(method="create/append/get", tasks=[ARRAY OF STRINGS], markDone=[ARRAY OF TASKS])]. Task list, no Markdown in arrays. Analyze request: if long multi-task, break it down & create Todos BEFORE starting. \`tasks\` & \`markDone\` optional with \`get\`. Use \`get + markDone\` to complete tasks, or \`create + markDone\` to create completed tasks. **UPDATE EVERY TURN**${enableSubAgents ? '\n9. [tool:functions.Await(time="seconds")]. For waiting without exiting agent loop, 15s - 180s' : ''}
${_cachedAdvanceRollback ? `
- EMERGENCY SAFETY TOOLS -
Info: \`initial\` = user prompt for current task. Revert \`id\` = turn BEFORE the disaster tool (e.g. disaster:\`turn_3\` → revert:\`turn_2\`). Reason explicitly
1. [tool:functions.EmergencyRollback(method="getCheckpoint/forceRevert", id="...")]. Rollback workspace to a checkpoint in THIS agent loop.
Use ONLY for catastrophic/codebase corruption. Before ending loop, verify no catastrophe. \`id\` not required with \`getCheckPoint\`.\n` : ''}${enableSubAgents ? `
- SUB AGENT TOOLS -
**PROACTIVE sub-agent use HIGHLY RECOMMENDED. Prefer for any task with even slight benefit, no user nudge needed**
Invocations:
- Invoke (async/background, ≤7 parallel). Parallelize long tasks. NEVER repeat while active
- InvokeSync (sync/blocking). Sequential, repetitive or delegated tasks. Saves tokens/cost
1. [agent:generalist.InvokeSync/Invoke(title="...", task="...")]. Task must be detailed: exact file paths, imports/exports, dependencies & folder structure
2. [agent:generalist.GetProgress(id="...")]. Check async task progress. If still running, continue your work. Wait exponentially longer between checks
3. [agent:generalist.Cancel(id="...")]. Cancel async task ONLY if stalled (2m+) or clearly incorrect` : ''}`.trim()
:










`- CREATIVE TOOLS (path = relative to CWD & WILL BE FIRST ARGUMENT, path separator: '/') -
1. [tool:functions.WritePDF(path="...", content="...", orientation="...")]. PROACTIVE A4 PAGE BREAKS MUST IN CSS. HTML/CSS for PREMIUM layout, stable margins & headers/footers, NO WATERMARKS
2. [tool:functions.WriteDoc(path="...", content="...")]. A4 Word document, NO WATERMARKS, stable margins & headers/footers
- WORKSPACE & SUB AGENT TOOLS ARE NOT AVAILABLE IN FLOW`.trim()}`.trim();
};
// [DEPRICATED] 7. [tool:functions.GenerateImage(path="... png", prompt="detailed", ratio="16:9, 9:16, 1:1")].. Mockups, PDF thumbnails, any visual content
