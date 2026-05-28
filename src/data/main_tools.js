export const TOOL_PROTOCOL = (mode, osDetected) => `
-- TOOL DEFINITIONS --
Access to internal tools. To call a tool, MUST use the exact syntax on a new line: [tool:functions.ToolName(args)]
- **STRICT POLICY: MAX 3 TOOL CALLS PER TURN. Next Turn, verify results, plan next**

- COMMUNICATION TOOLS -
1. [tool:functions.Ask(question="...", optionA="option::description", ...MAX 4)]. Ambiguity Resolution. Mandatory Triggers: Path Divergence, Security, Risk Mitigation. ask >> finish
Suggest best options; don't ask for preferences

- WEB TOOLS -
1. [tool:functions.WebSearch(query="...", limit=number)]. Limit 3-10. Proactive use for unknown topics${mode === 'Flux' ? ' or docs' : ''}
2. [tool:functions.WebScrape(url="...")]. Visit URL

${mode === 'Flux' ? `- PROJECT TOOLS (path = relative to CWD) -
1. [tool:functions.ReadFile(path="...", startLine=number, endLine=number)]. Supports images/docs. User gives image/doc: VIEW FIRST
2. [tool:functions.ReadFolder(path="...")]. Detailed DIR stats
3. [tool:functions.WriteFile(path="...", content="...")]. Creates/Overwrites. File Exist? PatchFile > WriteFile. Verify Imports
4. [tool:functions.PatchFile(path="...", replaceContent="exact old content", newContent="new content")]. Surgical patching. Unsure replaceContent? ReadFile > guessing
5. [tool:functions.SearchKeyword(keyword="...")]. Global project search. Finds definitions/logic without reading every file
6. [tool:functions.Run(command="...")]. Runs a ${osDetected === 'Windows' ? 'Windows CMD' : 'Bash'} command. Destructive/Irreversible ops -> Ask user
7. [tool:functions.GenerateImage(path="... png", prompt="detailed", ratio="16:9, 9:16, 1:1")]. Usage: Mockups, PDF thumbnails, any visual content
8. [tool:functions.WritePDF(path="...", content="...", orientation="...")]. PROACTIVE A4 PAGE BREAKS MUST IN CSS. HTML/CSS for PREMIUM layout (100vh/vw)
9. [tool:functions.WriteDoc(path="...", content="...")]. A4 Word document

- VERIFY TOOL RESULT CONTENTS. Fix errors. No hallucinations
- File tools > Long chat

- Escape quotes: \\" for code strings
- Literal escapes: Double-escape sequences (e.g., \\\\n, \\\\t)
- File structure: Real newlines for code formatting`.trim() : `
- FILE TOOLS ARE NOT AVAILABLE IN FLOW`.trim()}

- Results: Passed as [TOOL RESULT] (system priority)
- MAX Tool call stack: STRICTLY 3 per turn`.trim();
