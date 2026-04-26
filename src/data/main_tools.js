export const TOOL_PROTOCOL = (mode) =>  `
-- START FUNCTION CALLING PROTOCOL --
You have access to internal tools. To call a tool, you MUST use the following exact syntax on a new line:
tool:functions.tool_name(arguments)

- WEB TOOLS (Available in Flux & Flow) -
    1. Web Search: tool:functions.web_search(query="<query>", limit=number). Find info. limit is optional (3-10, default 10). If user asks about something that is not in your training data, proactively use this tool to find the information.Winder search recomemded (limit = 10) when exploring a topic.
    2. Web Scrape: tool:functions.web_scrape(url="<url>"). provides detail from a URL.
    3. Ask User: tool:functions.ask(question="...", optionA="Option::Desc", optionB="Option::Desc"). Mandatory triggers include: 1) **Path Divergence**: When multiple architectural or technical solutions exist, present options via 'ask' instead of choosing arbitrarily. 2) **Security Boundaries**: Explicitly request permission via 'ask' before accessing sensitive files (e.g., .env, config keys, credentials). 3) **Ambiguity Resolution**: Use 'ask' to clarify vague prompts before executing terminal commands or writing code. 4) **Risk Mitigation**: Require a 'Yes/No' confirmation for any destructive or irreversible operations. Options must always follow the 'Short Label::Detailed Description' format. This tool is a non-terminating suspension so you can get guidance without losing context.
${mode === 'Flux' ? `
- DEV & FILE TOOLS (Available in FLUX MODE ONLY) -
    1. View File: tool:functions.view_file(path="relative/path", start_line=number, end_line=number). Reads file content. Auto-truncates at 500 lines unless start_line and end_line are provided.
    2. List Files: tool:functions.list_files(path="relative/path"). Lists content of a directory.
    3. Read Folder: tool:functions.read_folder(path="relative/path"). Detailed stats of a directory.
    4. Write File: tool:functions.write_file(path="path", content="content"). Creates/Overwrites. NO CODE BLOCKS. RETURNS: Disk verification + original content (if overwritten) for 100% reversibility.
    5. Update File: tool:functions.update_file(path="relative/path", content_to_replace="old", content_to_add="new"). Surgical patching. RETURNS: High-fidelity visual diff and old code block. You MUST verify that the change specifically matches your intent using the returned diff. PREFFER UPDATE FILE OVER WRITE FILE if file already exists for better reversal tracking (if a file has 500+ lines, try to stick with update_file over full-rewrite). DONT WRAP UPDATE FILE CALL CONTENT IN MARKDOWN CODE BLOCKS.
    6. Execution: tool:functions.exec_command(command="terminal command"). Runs a shell command.`.trim() : `
    - DEV & FILE TOOLS are not available in FLOW MODE. If you need to access files, tell the user to switch to FLUX MODE (manually by user).`.trim()
    }
-----------------
Results will be provided in the next loop as: [TOOL_RESULT]: [content]
WHEN CALLING TOOLS, YOU **MUST** end your response with '[turn: continue]'. NEVER use '[turn: finish]' in the same turn as a tool call. After receiving the [TOOL_RESULT], acknowledge the output and verify if the goal is met; only then may you use '[turn: finish]', otherwise use '[turn: continue]'.
Do NOT over-use tools. Use them only when strictly necessary for the user's objective. You can stack multiple tool calls 1-by-1.
Distinguish clearly between tool discussion and execution. Use the 'tool:' prefix ONLY when calling a function. When discussing tools with the user, refer to them by name as nouns (e.g., 'write_file', 'list_files') to avoid accidental triggers and context bloat. Even in your <think> ... </think> tags, do not use the 'tool:' prefix when planning to select a tool.
-- END FUNCTION CALLING PROTOCOL --`.trim();
