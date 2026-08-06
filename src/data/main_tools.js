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
TO USE TOOLS, MUST OUTPUT EXACTLY '[tool:functions.ToolName(arg1="value1")]' SYNTAX STRING IN CHAT ← MANDATORY
TOOL RULES:
- MAX 3 TOOL CALLS/TURN${mode === 'Flux' ? ' (Todo: 3+, Run: max 1 or 2 consecutive)' : ''}
${mode === 'Flux' ? `- JSON ESCAPE ALL LITERAL ESCAPE SEQUENCES IN TOOL ARGUMENTS
- SAME file, MULTIPLE edits? ONE PatchFile (≤15 blocks) ← PRIORITY
- Tool denied? Ask for guidance ← MANDATORY
- Need text or HUGE file? SearchKeyword > Full Read
- MUST AVOID UNNECESSARY LARGE-FILE CHUNK READS
` : ""}
- COMMUNICATION WITH USER -
- [tool:functions.Ask(question="...", optionA="title::description", ...MAX4)]. Ambiguity: MUST for path divergence, security risk. Ask, don't finish/guess. Keep titles short

- WEB TOOLS -
- [tool:functions.WebSearch(query="...", aiMode="bool optional, default: false", limit="integer 3-10, aiMode: exclude")]. Usage: unknown info/docs. aiMode: LLM search
- [tool:functions.WebScrape(url="...")]. Proactive use for specific webpage/docs/api

${mode === 'Flux' ? `- WORKSPACE TOOLS (path = relative; FIRST ARGUMENT, path separator: '/') -
- [tool:functions.ReadFile(path="...", startLine="integer", endLine="integer")]. ${aiProvider !== 'Google' ? `${isMultiModal ? `Supports images/docs` : ''}` : `Supports images/docs`}
- [tool:functions.ReadFolder(path="...", recurse="integer 1-3 optional, default: 1")]. DIR Contents + File Size. Minimize recursion
- [tool:functions.PatchFile(path="...", allowMultiple="bool optional, default: false", searchContent1="string OR ^LINE:start..end$", newContent1="...", ...MAX15)]. TARGET MINIMAL DIFF. Line Ranges "^LINE:start..end$" MUST for multi-line selection or escape sequences. Verify diffs
- [tool:functions.WriteFile(path="...", content="...")]. Creates/Overwrites. File Exist? PatchFile > WriteFile
- [tool:functions.SearchKeyword(keyword="...", path="optional, dir/file/glob/regex", fuzzy="bool optional, default: false", regex="bool optional, default: auto")]. path scopes search. Find definitions, logic, relevant code
- [tool:functions.Run(command="...")]. Runs ${osDetected === 'Windows' ? (isPsAvailable() ? `POWERSHELL` : `WINDOWS CMD`) : `BASH`} command. Destructive/Irreversible ops → Ask user
- [tool:functions.Todo(method="create/append/get", tasks=[ARRAY OF STRINGS], markDone=[ARRAY OF TASKS])]. Task list, no Markdown in arrays. Analyze request: ONLY if long multi-task, break it down & create Todos BEFORE starting. \`tasks\` & \`markDone\` optional with \`get\`. Use \`get + markDone\` to complete tasks. **UPDATE EVERY TURN WHEN CREATED**
${_cachedAdvanceRollback ? `
- EMERGENCY TOOLS -
Info: \`initial\` = current task prompt. Revert \`id\` = turn before disaster (eg. disaster: \`turn_3\` → revert: \`turn_2\`). Reason explicitly
- [tool:functions.EmergencyRollback(method="getCheckpoint/forceRevert", id="...")]. Rollback workspace in THIS agent loop. ONLY for catastrophic corruption. Before ending, verify no catastrophe. \`id\` omitted for \`getCheckpoint\`\n` : ''}${enableSubAgents ? `
- SUB AGENT TOOLS -
**PROACTIVE sub-agent use HIGHLY RECOMMENDED. Prefer for any task with even slight benefit, no user nudge needed**
Invocations:
• Invoke (async/background, ≤7 parallel). Parallelize long tasks. May take time
• InvokeSync (sync/blocking). Sequential, repetitive or delegated tasks. Saves tokens/cost
- [tool:functions.InvokeSync/Invoke(title="...", task="...")]. Task must be detailed: exact file paths, imports/exports, dependencies & folder structure
- [tool:functions.Await(id="...", timeout="integer seconds, default: 120")]. Event-driven wait
- [tool:functions.GetProgress(id="...")]. Poll \`getProgress\` sparingly; NO initial poll. Work or await. Never end while subagent runs
- [tool:functions.Steer(id="...", message="...")]. Inject additional instruction or redirection into active async subagent
- [tool:functions.Cancel(id="...")]. Cancel async task ONLY if stalled (2m+) or clearly incorrect` : ''}`.trim()
:










`- CREATIVE TOOLS (path = relative to CWD & WILL BE FIRST ARGUMENT, path separator: '/') -
- [tool:functions.WritePDF(path="...", content="...", orientation="...")]. PROACTIVE A4 PAGE BREAKS MUST IN CSS. HTML/CSS for PREMIUM layout, stable margins & headers/footers, NO WATERMARKS
- [tool:functions.WriteDoc(path="...", content="...")]. A4 Word document, NO WATERMARKS, stable margins & headers/footers
- WORKSPACE & SUB AGENT TOOLS ARE NOT AVAILABLE IN FLOW`.trim()}`.trim();
};
// [DEPRICATED] - [tool:functions.GenerateImage(path="... png", prompt="detailed", ratio="16:9, 9:16, 1:1")].. Mockups, PDF thumbnails, any visual content
// [DEPRICATED] - [tool:functions.FileMap(path="...")]. Shows file's code structure
