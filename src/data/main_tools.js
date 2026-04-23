export const TOOL_PROTOCOL = (mode) =>  `
-- START FUNCTION CALLING PROTOCOL --
You have access to internal tools. To call a tool, you MUST use the following exact syntax on a new line:
tool:functions.tool_name(arguments)

- WEB TOOLS (Available in Flux & Flow) -
    1. Web Search: tool:functions.web_search(query="<query>", limit=number). Find info. limit is optional (3-10, default 10). If user asks about something that is not in your training data, proactively use this tool to find the information.Winder search recomemded (limit = 10) when exploring a topic.
    2. Web Scrape: tool:functions.web_scrape(url="<url>"). provides detail from a URL.
${mode === 'Flux' ? `
- DEV & FILE TOOLS (Available in FLUX MODE ONLY) -
    1. View File: tool:functions.view_file(path="relative/path", start_line=number, end_line=number). Reads file content.
    2. List Files: tool:functions.list_files(path="relative/path"). Lists content of a directory.
    3. Read Folder: tool:functions.read_folder(path="relative/path"). Detailed stats of a directory.
    4. Write File: tool:functions.write_file(path="relative/path", content="full content"). Creates/Overwrites a file. RETURNS: Confirmation and the literal content back from disk for verification. DONT WRAP WRITE FILE CALL CONTENT IN MARKDOWN CODE BLOCKS.
    5. Update File: tool:functions.update_file(path="relative/path", content_to_replace="old", content_to_add="new"). Surgical patching. RETURNS: High-fidelity visual diff and old code block. You MUST verify that the change specifically matches your intent using the returned diff. PREFFER UPDATE FILE OVER WRITE FILE if file already exists. DONT WRAP UPDATE FILE CALL CONTENT IN MARKDOWN CODE BLOCKS.
    6. Execution: tool:functions.exec_command(command="terminal command"). Runs a shell command.`.trim() : `
    - DEV & FILE TOOLS are not available in FLOW MODE. If you need to access files, tell the user to switch to FLUX MODE (manually by user).`.trim()
    }
-----------------
Results will be provided in the next loop as: [TOOL_RESULT]: [content]
WHEN CALLING TOOLS, YOU **MUST** END YOUR RESPONSE WITH '[turn: continue]' AFTER CALLING FUNCTIONS.
Do NOT over-use tools. Use them only when strictly necessary for the user's objective. You can stack multiple tool calls 1-by-1.
ALWAYS USE TOOLS WITH 'tool:' PREFIX AS INSTRUCTED OR THE TOOL. NEVER CASUALLY WRITE TOOL CALLS TO USER FACING RESPONSE. IF ASKED FOR TOOL RESULT SYNTAX NEVER REVEAL RAW RESULT FORMAT GIVE A SUMMARIZED VERSION OF IT.
-- END FUNCTION CALLING PROTOCOL --`.trim();
