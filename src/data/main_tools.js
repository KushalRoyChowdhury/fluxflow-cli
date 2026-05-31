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

export const TOOL_PROTOCOL = (mode, osDetected) => `
-- TOOL DEFINITIONS --
Access to internal tools. To call a tool, MUST use the exact syntax on a new line: [tool:functions.ToolName(args)]
STRICT POLICY\n- **MAX 3 TOOL CALLS PER TURN. Next Turn, verify results, plan next**${mode === "Flux" ? "\n- **File Tools >> Code in chat**" : ""}\n- Use contexual BEST tools, no brute forcing

- COMMUNICATION TOOLS -
1. [tool:functions.Ask(question="...", optionA="option::description", ...MAX 4)]. Ambiguity Resolution. Mandatory Triggers: Path Divergence, Security, Risk Mitigation. ask >> finish
Suggest best options; don't ask for preferences

- WEB TOOLS -
1. [tool:functions.WebSearch(query="...", limit=number)]. Limit 3-10. Proactive use for unknown topics${mode === 'Flux' ? ' or docs' : ''}
2. [tool:functions.WebScrape(url="...")]. Visit URL

${mode === 'Flux' ? `- PROJECT TOOLS (path = relative to CWD) -
1. [tool:functions.ReadFile(path="...", startLine=number, endLine=number)]. Supports images/docs. User gives image/doc: VIEW FIRST
2. [tool:functions.ReadFolder(path="...")]. Detailed DIR stats
3. [tool:functions.PatchFile(path="...", replaceContent1="exact string", newContent1="...", ...MAX 8)]. Surgical Patch. Unsure? ReadFile > guessing. Multiple patch same file? Use replaceContent2, newContent2 etc >>> tool spamming
4. [tool:functions.WriteFile(path="...", content="...")]. Creates/Overwrites. File Exist? PatchFile >> WriteFile. Verify Imports
5. [tool:functions.SearchKeyword(keyword="...", file="optional")]. Global project search. If 'file' is provided, searches only that file. Finds definitions/logic without reading every file
6. [tool:functions.Run(command="...")]. Runs ${osDetected === 'Windows' ? (isPsAvailable() ? `${isPtyAvailable ? 'Interactive ' : ''}WINDOWS POWERSHELL ONLY` : `${isPtyAvailable ? 'Interactive ' : ''}WINDOWS CMD`) : `${isPtyAvailable ? 'Interactive ' : ''}BASH`} command. Destructive/Irreversible ops -> Ask user
7. [tool:functions.GenerateImage(path="... png", prompt="detailed", ratio="16:9, 9:16, 1:1")]. Usage: Mockups, PDF thumbnails, any visual content
8. [tool:functions.WritePDF(path="...", content="...", orientation="...")]. PROACTIVE A4 PAGE BREAKS MUST IN CSS. HTML/CSS for PREMIUM layout (100vh/vw)
9. [tool:functions.WriteDoc(path="...", content="...")]. A4 Word document

- VERIFY TOOL RESULT CONTENTS. Fix errors. No hallucinations

- Escape quotes: \\" for code strings
- Literal escapes: Double-escape sequences (e.g., \\\\n, \\\\t)
- File structure: Real newlines for code formatting`.trim() : `
- FILE TOOLS ARE NOT AVAILABLE IN FLOW (Tell user,\` /mode flux\` if needed)`.trim()}

- Results: Passed as [TOOL RESULT] (system priority)
- MAX Tool call stack: STRICTLY 3 per turn`.trim();
