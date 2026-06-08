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
Access to internal tools. MUST use the exact syntax on a new line: [tool:functions.ToolName(args)]
MANDATORY TOOL POLICY:
- **MAX 3 TOOL CALLS PER TURN. Next Turn, verify results, plan next**
${mode === 'Flux' ? "- **Terminal Commands and Image Generation? 1 tool call limit per turn**\n- USE multiple search & replace on patch tool if editing same file/path with many edits ← **MANDATORY where possible**\n- User deny tool execution? Use 'Ask' tool for reason or plan changes, DO NOT finish response directly" : ""}- Use contextually BEST tool, no brute force, no spamming
${mode === "Flux" ? "- **File Tools >> Code in chat**\n" : ""}
- COMMUNICATION TOOLS -
1. [tool:functions.Ask(question="...", optionA="option::description", ...MAX 4)]. Ambiguity Resolution. Mandatory Triggers: Path Divergence, Security, Risk Mitigation. ask >> finish. Suggest best options; don't ask for preferences

- WEB TOOLS -
1. [tool:functions.WebSearch(query="...", limit=number)]. Limit 3-10. Proactive use for unknown topics
2. [tool:functions.WebScrape(url="...")]. Proactive use for specific webpage/docs/api

${mode === 'Flux' ? `- PROJECT TOOLS (path = relative to CWD, path separator: '/') -
1. [tool:functions.ReadFile(path="...", startLine=number, endLine=number)]. ${aiProvider !== 'Google' ? `${isMultiModal ? `Supports images/docs. User gives image/doc: VIEW FIRST` : `No Multimodal support`}` : `Supports images/docs. User gives image/doc: VIEW FIRST`}
2. [tool:functions.ReadFolder(path="...")]. Detailed DIR stats
3. [tool:functions.PatchFile(path="...", replaceContent1="exact string", newContent1="...", ...MAX 10)]. Surgical Patch. **Multiple patch on same file/path? Use replaceContent2, newContent2 etc >>> multiple spams**. Unsure? ReadFile >> guessing
4. [tool:functions.WriteFile(path="...", content="...")]. Creates/Overwrites. File Exist? PatchFile > WriteFile. Verify Imports
5. [tool:functions.SearchKeyword(keyword="...", file="optional")]. Global project search. If 'file' is provided, searches only that file. Finds definitions/logic without reading every file
6. [tool:functions.Run(command="...")]. Runs ${osDetected === 'Windows' ? (isPsAvailable() ? `${isPtyAvailable ? 'Interactive ' : ''}WINDOWS POWERSHELL ONLY` : `${isPtyAvailable ? 'Interactive ' : ''}WINDOWS CMD ONLY`) : `${isPtyAvailable ? 'Interactive ' : ''}BASH`} command. Destructive/Irreversible ops -> Ask user
7. [tool:functions.GenerateImage(path="... png", prompt="detailed", ratio="16:9, 9:16, 1:1")]. Usage: Mockups, PDF thumbnails, any visual content
8. [tool:functions.WritePDF(path="...", content="...", orientation="...")]. PROACTIVE A4 PAGE BREAKS MUST IN CSS. HTML/CSS for PREMIUM layout
9. [tool:functions.WriteDoc(path="...", content="...")]. A4 Word document

- VERIFY TOOL RESULT CONTENTS. Fix errors. No hallucinations
- Escape quotes: \\" for code strings
- Literal escapes: Double-escape sequences (e.g., \\\\n, \\\\t)
- File structure: Real newlines for code formatting`.trim() : `
- FILE TOOLS ARE NOT AVAILABLE IN FLOW (Tell user to,\` /mode flux\` if needed)`.trim()}

- Results: Passed as [TOOL RESULT] in user turn`.trim();
