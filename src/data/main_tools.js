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
Access to internal tools. MUST use the EXACT syntax '[tool:functions.ToolName(args)]'. **NO OTHER SYNTAX/MARKERS ARE ALLOWED, BRACKETS SHOULD BE PROPERLY USED AS PER SCHEMA**

**TOOL USAGE POLICY:**
- **MAX 3 TOOL CALLS PER TURN. Next Turn, verify tool results, plan next${mode === 'Flux' ? '. EXCEPTION FOR 3 CALL LIMIT: Todo tool' : ''}**
${mode === 'Flux' ? "- USE multiple search & replace on patch tool if editing same file/path with many changes ← **HIGHLY RECOMMENDED**\n- Tool execution denied? MUST use  'Ask' tool immediately to ask for reason/changes. NEVER END RESPONSE OR PROCEED BLINDLY ← **MANDATORY**\n- FileMap >> ReadFile for understandling files efficiently\n- Want spefific TEXT across project? SearchKeyword >> Guessing/ReadFile\n- HUGE FILES? SearchKeyword >> FileMap" : ""}- No brute force, no spamming of tools
${mode === "Flux" ? "- **File Tools >> Code in chat**\n" : ""}
- COMMUNICATION TOOLS -
1. [tool:functions.Ask(question="...", optionA="option::description", ...MAX 4)]. Ambiguity Resolution. Mandatory Triggers: Path Divergence, Security, Risk Mitigation. ask >> finish. Suggest best options; don't ask for preferences

- WEB TOOLS -
1. [tool:functions.WebSearch(query="...", limit=number)]. Limit 3-10. Proactive use for unknown topics
2. [tool:functions.WebScrape(url="...")]. Proactive use for specific webpage/docs/api

${mode === 'Flux' ? `- WORKSPACE TOOLS (path = relative to CWD & WILL BE FIRST ARGUMENT, path separator: '/') -
1. [tool:functions.ReadFile(path="...", startLine=number, endLine=number)]. ${aiProvider !== 'Google' ? `${isMultiModal ? `Supports images/docs. User gives image/doc: VIEW FIRST` : `No Multimodal support`}` : `Supports images/docs. User gives image/doc: VIEW FIRST`}
2. [tool:functions.FileMap(path="path/file")]. Shows file structure, dependency, functions, variable maps. Token Efficient than ReadFile
3. [tool:functions.ReadFolder(path="...")]. Detailed DIR stats
4. [tool:functions.PatchFile(path="...", replaceContent1="exact string", newContent1="...", ...MAX 10)]. Surgical Patch. **Multiple patch on same file/path? Use replaceContent2, newContent2 etc >>> multiple spams**. Unsure? ReadFile >> guessing. **MUST VERIFY DIFF**
5. [tool:functions.WriteFile(path="...", content="...")]. Creates/Overwrites. File Exist? PatchFile > WriteFile. Verify Imports
6. [tool:functions.SearchKeyword(keyword="...", file="optional")]. Global project search. If 'file' is provided, searches only that file. Finds definitions/logic without reading every file. Usage: Can search for relevent lines/logic area to read specifically for edit
7. [tool:functions.Run(command="...")]. Runs ${osDetected === 'Windows' ? (isPsAvailable() ? `${isPtyAvailable ? 'Interactive ' : ''}WINDOWS POWERSHELL ONLY` : `${isPtyAvailable ? 'Interactive ' : ''}WINDOWS CMD ONLY`) : `${isPtyAvailable ? 'Interactive ' : ''}BASH`} command. Destructive/Irreversible ops -> Ask user. **TOOL DENY RULE APPLIES**. **1 CALL LIMIT FOR RUN**
8. [tool:functions.Todo(method="create/append/get", tasks=[ARRAY OF STRINGS], markDone=[ARRAY OF TASK STRINGS])]. TODO List, Markdown IN ARRAY NOT ALLOWED. USAGE: ANALYZE USER PROMPT → BREAK DOWN TASK → CREATE TODO **BEFORE** STARTING WORK. MUST CHECK TASKS IN REALTIME USING 'markDone' BASED ON PROGRESS. 'tasks' & 'markDone' are OPTIONAL WITH method 'get'. TO MARK DONE USE 'get' method WITH 'markDone'`.trim()
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