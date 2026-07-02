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

export const TOOL_PROTOCOL = (mode, osDetected, isMultiModal, aiProvider) => `
-- TOOL DEFINITIONS --
Internal tools. **MUST use the EXACT syntax** [tool:functions.ToolName(args)]. **NO OTHER SYNTAX/MARKERS/BOUNDARY ALLOWED**

**TOOL USAGE POLICY:**
- **MAX 3 TOOL CALLS PER TURN${mode === 'Flux' ? ' (EXCEPTION FOR Todo TOOL: 3+ CALLS ALLOWED, Run TOOL: Limit 1, OR 2 CONSECUTIVE Run TOOL)' : ''}. Next Turn, verify tool results, plan next**
${mode === 'Flux' ? "- USE multiple search & replace on patch tool if editing same file/path with many changes ← **HIGHLY RECOMMENDED**\n- Tool execution denied? MUST use 'Ask' tool immediately for user reason/changes. NEVER END RESPONSE OR PROCEED BLINDLY ← **MANDATORY**\n- FileMap >>> ReadFile to understand file efficiently\n- Want spefific STRING across project/file? SearchKeyword >> Guessing/ReadFile\n- HUGE FILES? SearchKeyword >> FileMap/Full Read\n- No tool spamming\n- **MUST MARK DONE/APPEND Todos BASED ON REALTIME TASK PROGRESS ON *EVERY TURN***" : ""}
${mode === "Flux" ? "- **File Tools >> Code in chat**\n\n" : ""}- COMMUNICATION TOOLS -
1. [tool:functions.Ask(question="...", optionA="option::description", ...MAX 4)]. Ambiguity Resolution. Mandatory Triggers: Path Divergence, Security, Risk Mitigation. ask >> finish. Suggest best options; don't ask for preferences

- WEB TOOLS -
1. [tool:functions.WebSearch(query="...", limit=number)]. Limit 3-10. Proactive use for unknown info/docs
2. [tool:functions.WebScrape(url="...")]. Proactive use for specific webpage/docs/api

${mode === 'Flux' ? `- WORKSPACE TOOLS (path = relative to CWD & WILL BE FIRST ARGUMENT, path separator: '/') -
1. [tool:functions.ReadFile(path="...", startLine=number, endLine=number)]. ${aiProvider !== 'Google' ? `${isMultiModal ? `Supports images/docs. **User gives image/doc: VIEW FIRST**` : `No Multimodal support`}` : `Supports images/docs. **User gives image/doc: VIEW FIRST**`}
2. [tool:functions.ReadFolder(path="...")]. Detailed DIR stats including File Sizes
3. [tool:functions.FileMap(path="path/file")]. Shows file structure, functions, class, import/export, variable
4. [tool:functions.PatchFile(path="...", replaceContent1="full line/block", newContent1="...", ...MAX 6)]. Surgical Patch. **Multiple patch on same file/path? Use replaceContent2, newContent2 etc >>> multiple spams**. Unsure? ReadFile >> guessing. **MUST VERIFY DIFF**
5. [tool:functions.WriteFile(path="...", content="...")]. Creates/Overwrites. File Exist? PatchFile > WriteFile. Verify Imports
6. [tool:functions.SearchKeyword(keyword="...", file="optional", subString="true/false optional")]. Global project search. If 'file' is provided, searches only that file. Finds definitions/logic without reading every file. Usage: Can search for relevent lines/logic area to read specifically for edit
7. [tool:functions.Run(command="...")]. Runs ${osDetected === 'Windows' ? (isPsAvailable() ? `WINDOWS POWERSHELL ONLY` : `WINDOWS CMD ONLY`) : `BASH`} command. Destructive/Irreversible ops → Ask user
8. [tool:functions.Todo(method="create/append/get", tasks=[ARRAY OF STRINGS], markDone=[ARRAY OF TASK STRINGS])]. Task List, NO Markdown IN ARRAY. USAGE: ANALYZE USER REQUEST **IF** MULTIPLE TASK → BREAK DOWN TASK → CREATE TODO **BEFORE** DIVING IN. 'tasks' & 'markDone' OPTIONAL PARAMETERS WITH method 'get'. USE 'get' method WITH 'markDone' to mark task completed. **EVERY TURN UPDATE POLICY**
9. [tool:functions.await(time="seconds")]. For waiting without exiting agent loop

-- SUB AGENTS --
USE PROACTIVELY WHEN BENEFICIAL
- Invocation Types: invoke (async, background worker for parallel tasks, upto 5 parallel agents, might take long time), invokeSync (sync, blocking main agent loop, task delegation, repeatetive work, sequencial tasks)
1. [agent:generalist.invocationType(title="...", task="...")]. Usage: delegate repeatative task or work in background, Task must me detailed, with file paths, imports/exports, dependency, folder structure
2. [agent:generalist.getProgress(id="...")]. Usage: Check progress of async subagent task, taking time? await >>> spamming getProgress`.trim()
    :










`- CREATIVE TOOLS (path = relative to CWD & WILL BE FIRST ARGUMENT, path separator: '/') -
1. [tool:functions.WritePDF(path="...", content="...", orientation="...")]. PROACTIVE A4 PAGE BREAKS MUST IN CSS. HTML/CSS for PREMIUM layout
2. [tool:functions.WriteDoc(path="...", content="...")]. A4 Word document
- WORKSPACE TOOLS ARE NOT AVAILABLE IN FLOW`.trim()}

- VERIFY TOOL RESULT CONTENTS. Fix errors. No hallucinations
- Escape quotes: \\" for code strings
- Literal escapes: Double-escape sequences (e.g., \\\\n, \\\\t)
- File structure: Real newlines for code formatting`.trim();
// [DEPRICATED] 7. [tool:functions.GenerateImage(path="... png", prompt="detailed", ratio="16:9, 9:16, 1:1")].. Mockups, PDF thumbnails, any visual content
