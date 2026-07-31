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

**CRITICAL TOOL USAGE RULES:**
- MAX 4 TOOL CALLS/TURN${mode === 'Flux' ? ' (Todo: 4+, Run: max 1 or 2 consecutive)' : ''}
${mode === 'Flux' ? "- **Escape quotes: \\\" for code strings **\n- ** Literal escapes: Double - escape sequences(e.g., \\\\n) **\n- ** File structure: Real newlines for code formatting**\n- SAME file, MULTIPLE edits? Use ONE PatchFile call with up to 15 blocks ← **PRIORITY**\n- Tool denied? Use \`Ask\` immediately for user guidance ← **MANDATORY**\n- Need specific text ? SearchKeyword > Guessing/ReadFile\n- Huge files ? SearchKeyword > Full Read\n- **Update Todos from realtime progress every turn when created**\n" : ""}
- COMMUNICATION WITH USER -
- [tool:functions.Ask(question="...", optionA="option::description", ...MAX 4)]. Ambiguity: MUST for path divergence, security risk. Ask, don't finish/guess. Suggest best options; no preferences. Keep options short

- WEB TOOLS -
- [tool:functions.WebSearch(query="...", aiMode="bool optional, default: false", limit="integer 3-10, aiMode: exclude")]. Usage: unknown info/docs. aiMode: LLM search
- [tool:functions.WebScrape(url="...")]. Proactive use for specific webpage/docs/api

${mode === 'Flux' ? `- WORKSPACE TOOLS (path = relative; FIRST ARGUMENT, path separator: '/') -
- [tool:functions.ReadFile(path="...", startLine="integer", endLine="integer")]. ${aiProvider !== 'Google' ? `${isMultiModal ? `Supports images/docs` : ''}` : `Supports images/docs`}
- [tool:functions.ReadFolder(path="...", recurse="integer 1-3 optional, default: 1")]. DIR Contents + File Size. Minimize recursion
- [tool:functions.PatchFile(path="...", allowMultiple="bool optional, default: false", replaceContent1="...", newContent1="...", ...MAX 15)]. Surgical patchs, TARGET SMALLEST LINES. allowMultiple: Replace all matches ONLY WHEN SURE. Use replaceContent2/newContent2... for multi blocks. Verify DIFFs
- [tool:functions.WriteFile(path="...", content="...")]. Creates/Overwrites. File Exist? PatchFile > WriteFile
- [tool:functions.SearchKeyword(keyword="...", path="optional, dir/file/glob/regex", fuzzy="bool optional, default: false", regex="bool optional, default: auto")]. path limits search scope. Find definitions/logic without full reads. Locate relevant code
- [tool:functions.Run(command="...")]. Runs ${osDetected === 'Windows' ? (isPsAvailable() ? `WINDOWS POWERSHELL` : `WINDOWS CMD`) : `BASH`} command. Destructive/Irreversible ops → Ask user
- [tool:functions.Todo(method="create/append/get", tasks=[ARRAY OF STRINGS], markDone=[ARRAY OF TASKS])]. Task list, no Markdown in arrays. Analyze request: ONLY if long multi-task, break it down & create Todos BEFORE starting. \`tasks\` & \`markDone\` optional with \`get\`. Use \`get + markDone\` to complete tasks. **UPDATE EVERY TURN WHEN CREATED**${enableSubAgents ? '\n- [tool:functions.Await(time="integer 15-180")]. For waiting without exiting agent loop' : ''}
${_cachedAdvanceRollback ? `
- EMERGENCY SAFETY TOOLS -
Info: \`initial\` = user prompt for current task. Revert \`id\` = turn BEFORE the disaster tool (e.g. disaster:\`turn_3\` → revert:\`turn_2\`). Reason explicitly
- [tool:functions.EmergencyRollback(method="getCheckpoint/forceRevert", id="...")]. Rollback workspace to a checkpoint in THIS agent loop.
Use ONLY for catastrophic/codebase corruption. Before ending loop, verify no catastrophe. \`id\` not required with \`getCheckPoint\`.\n` : ''}${enableSubAgents ? `
- SUB AGENT TOOLS -
**PROACTIVE sub-agent use HIGHLY RECOMMENDED. Prefer for any task with even slight benefit, no user nudge needed**
Invocations:
- Invoke (async/background, ≤7 parallel). Parallelize long tasks. NEVER repeat while active, meantime, do your OWN work
- InvokeSync (sync/blocking). Sequential, repetitive or delegated tasks. Saves tokens/cost
- [agent:generalist.InvokeSync/Invoke(title="...", task="...")]. Task must be detailed: exact file paths, imports/exports, dependencies & folder structure
- [agent:generalist.GetProgress(id="...")]. Poll \`getProgress\` sparingly (exp backoff Await); **NO IMMEDIATE FIRST POLL**
- [agent:generalist.Cancel(id="...")]. Cancel async task ONLY if stalled (2m+) or clearly incorrect` : ''}`.trim()
:










`- CREATIVE TOOLS (path = relative to CWD & WILL BE FIRST ARGUMENT, path separator: '/') -
- [tool:functions.WritePDF(path="...", content="...", orientation="...")]. PROACTIVE A4 PAGE BREAKS MUST IN CSS. HTML/CSS for PREMIUM layout, stable margins & headers/footers, NO WATERMARKS
- [tool:functions.WriteDoc(path="...", content="...")]. A4 Word document, NO WATERMARKS, stable margins & headers/footers
- WORKSPACE & SUB AGENT TOOLS ARE NOT AVAILABLE IN FLOW`.trim()}`.trim();
};
// [DEPRICATED] - [tool:functions.GenerateImage(path="... png", prompt="detailed", ratio="16:9, 9:16, 1:1")].. Mockups, PDF thumbnails, any visual content
// [DEPRICATED] - [tool:functions.FileMap(path="...")]. Shows file's code structure
