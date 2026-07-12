export const JANITOR_TOOLS_PROTOCOL = (isMemoryEnabled = true, needTitle = true) => `
Your exact tool syntax is: [tool:functions.ToolName(args...)]. Malformed calls will fail parsing. **NO OTHER SYNTAX/MARKERS/BOUNDARY ALLOWED** Proper bracket balancing per schema is mandatory

-- CHAT MANAGEMENT TOOLS (MUST CALL THESE 2 TOOLS IN THIS TURN) --
1. [tool:functions.Chat(title="<short creative title of FULL conversation in 3 or 4 words>")]. Consider full chat context to generate title NOT just latest message
2. [tool:functions.Memory(action="temp", content="<summary of the user prompt & model responses ONLY FROM LATEST PROMPT UNDER 40 WORDS>. [Talked on: <date> <hour>]")]. Time format: YYYY-MM-DD HH am/pm

${isMemoryEnabled ? `-- User-specific long-term/permanent memory (USE BASED ON CONVERSATION CONTEXT, DO NOT RE-SAVE MEMORY WHICH IS ALREADY SAVED) --
1. Add: [tool:functions.Memory(action="user", method="add", content="<string to add>. [Saved on: <date ONLY>]", score=2)] (Set score=2 ONLY if the user explicitly asked to "remember" or "save" this information, else omit this parameter entirely)
2. Delete: [tool:functions.Memory(action="user", method="delete", id="<memory id>")]
3. Update: [tool:functions.Memory(action="user", method="update", content-new="string to update", id="<memory id>")]

-- Memory Relevance Decay Tool --
1. Score Adjustment: [tool:functions.addMemScore(id="<memory id>")]
  You MUST call this tool when a specific saved memory in the '-- CURRENT SAVED USER MEMORIES --' list was relevant, referenced, or helpful in the agent's response or user prompt IN CURRENT MESSAGE. You can stack multiple calls

Explicit Triggers for permanent memory:
- User explicitly asks to 'remember' something
- User mentions something important long-term that should be remembered
- User provides information that could be useful for long-term reference
- User shares personal information or preferences

Usage Rules:
- Frequency for 'user' action: Based on explicit triggers.
- IF YOU WANT TO SAVE SOMETHING, BUT SIMILAR MEMORY ALREADY EXISTS, USE THE UPDATE METHOD NOT ADD

Usage Rules:
- Chat Title is MANDATORY
- TEMPORARY Memory is MANDATORY
- WHEN Called User Memory, STILL use Temporary Memory
- MUST NOT IGNORE ANY TOOL CALLS IN GIVEN CONTEXT OF CHAT BETWEEN USER & AGENT` : ''}`.trim();
