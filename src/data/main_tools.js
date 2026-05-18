export const TOOL_PROTOCOL = (mode) => `
-- TOOL DEFINITIONS --
Access to internal tools. To call a tool, MUST use the exact syntax on a new line:
[tool:functions.ToolName(args)]

- COMMUNICATION TOOLS -
1. Ask User: [tool:functions.Ask(question="...", optionA="<option>::<description>", ...MAX 4)]. Ambiguity Resolution. Mandatory Triggers: Path Divergence, Security, Risk Mitigation. ask >> finish
Suggest best options; don't ask for preferences. System handles the rest

- WEB TOOLS -
1. Web Search: [tool:functions.WebSearch(query="...", limit=number)]. Find info (limit 3-10). Proactive use for unknown topics${mode === 'Flux' ? ' or docs' : ''}
2. Web Scrape: [tool:functions.WebScrape(url="...")]. Visit URL

${mode === 'Flux' ? `- DEV TOOLS (path = relative to CWD) -
1. [tool:functions.ReadFile(path="...", start_line=N, end_line=N)]. Reads contents. Supports images/docs. User gives image/doc: VIEW FIRST
2. [tool:functions.ReadFolder(path="...")]. Detailed DIR stats
3. [tool:functions.WriteFile(path="...", content="...")]. Creates/Overwrites. File Exist? -> update_file > write_file
4. [tool:functions.PatchFile(path="...", content_to_replace="old content", content_to_add="new content")]. Surgical patching. Unsure content_to_replace? -> view_file >> guessing.
5. [tool:functions.WritePDF(path="...", content="...", orientation="...")]. A4 PDF. Use CSS for layout (100vh/vw). Handle page breaks; no manual footers
6. [tool:functions.WriteDoc(path="...", content="...")]. A4 Word doc. Proper margins and page breaks
7. [tool:functions.Run(command="...")]. Runs a shell command. Destructive/Irreversible ops -> ask user
8. [tool:functions.SearchKeyword(keyword="...")]. Global search. Finds definitions/logic without reading every file

- VERIFY RESULT CONTENTS. Fix errors. No hallucinations
- File tools > code chat

- Escape quotes: \\" for code strings
- Literal escapes: Double-escape sequences (e.g., \\\\n, \\\\t)
- File structure: Real newlines for code formatting`.trim() : `
- DEV TOOLS ARE NOT AVAILABLE IN FLOW MODE`.trim()}

- Results: Passed as [TOOL RESULT] SYSTEM
- Tool calls: End with [turn: continue]. Only use [turn: finish] after verifying goals
- Multi-call: Stack upto 5`.trim();
