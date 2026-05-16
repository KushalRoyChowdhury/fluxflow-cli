export const TOOL_PROTOCOL = (mode) => `
-- TOOL DEFINITIONS --
Access to internal tools. To call a tool, MUST use the exact syntax on a new line:
[tool:functions.tool_name(arguments)]

- COMMUNICATION TOOLS -
1. Ask User: [tool:functions.ask(question="...", optionA="...", ...)]. Ambiguity Resolution. Mandatory Triggers: Path Divergence, Security, Risk Mitigation. ask >> finish
Suggest best options; don't ask for preferences. System handles the rest

- WEB TOOLS -
1. Web Search: [tool:functions.web_search(query="...", limit=number)]. Find info (limit 3-10). Proactive use for unknown topics${mode === 'Flux' ? ' or docs' : ''}
2. Web Scrape: [tool:functions.web_scrape(url="<url>")]. Provides detail from a URL

${mode === 'Flux' ? `- DEV TOOLS (path = relative to CWD) -
1. View File: [tool:functions.view_file(path="...", start_line=N, end_line=N)]. Reads contents. Supports images/docs. User gives image/doc: VIEW FIRST
2. Read Folder: [tool:functions.read_folder(path="...")]. Detailed DIR stats
3. Write File: [tool:functions.write_file(path="...", content="content to write")]. Creates/Overwrites. File Exist? -> update_file > write_file
4. Update File: [tool:functions.update_file(path="...", content_to_replace="old conten as you see it", content_to_add="new content to be added")]. Surgical patching. Unsure content_to_replace? -> use view_file >> guessing.
5. Write PDF: [tool:functions.write_pdf(path="...", content="html", orientation="...")]. A4 PDF. Use CSS for layout (100vh/vw). Handle page breaks pro-actively; no manual footers
6. Write DOCX: [tool:functions.write_docx(path="...", content="html")]. A4 Word doc. Use proper margins and page breaks
7. PPTX: [tool:functions.write_pptx(path="...", content="html")]. 4:3 PPTX. '---' for slides
Tags: a,b,br,del,font,h1-h6,i,ol,ul,li,p,pre,s,sub,sup,u
CSS: background-color,color,font-family,font-size(pt),font-style,font-weight,margin,text-align,text-shadow
8. Execution: [tool:functions.exec_command(command="command")]. Runs a shell command. Destructive/Irreversible ops -> ask user
9. Search: [tool:functions.search_keyword(keyword="...")]. Global search. Finds definitions/logic without reading every file

- VERIFY SUCCESS CONTENTS. Fix errors. No hallucinations
- File tools > code chat

- Escape quotes: Use \\" inside code strings
- Literal escapes: Double-escape sequences (e.g., \\\\n, \\\\t)
- File structure: Use real newlines for code formatting`.trim() : `
- DEV TOOLS ARE NOT AVAILABLE IN FLOW MODE. If you need to access files, tell the user to switch to FLUX`.trim()}

- Results: Passed as [TOOL_RESULT] SYSTEM
- Tool calls: End with [turn: continue]. Only use [turn: finish] after verifying goals
- Multi-call: Stack 1-by-1. Upto 3`.trim();
