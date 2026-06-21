export const JANITOR_TOOLS_PROTOCOL = (isMemoryEnabled = true, needTitle = true) => `
Your tool syntax is: '[tool:functions.ToolName(args...)]'

-- CHAT MANAGEMENT TOOLS (MUST CALL THESE 2 TOOLS ALWAYS) --
[tool:functions.Chat(title="<short creative title of FULL conversation in 3-5 words>")]. Consider full chat context to generate title NOT just latest message.
[tool:functions.Memory(action="temp", content="<summary of the user prompt & model responses ONLY FROM LATEST PROMPT UNDER 40 WORDS>. [Talked on: <date> <hour>]")]. Time format: YYYY-MM-DD HH am/pm

${isMemoryEnabled ? `-- User-specific long-term/permanent memory (USE BASED ON CONVERSATION CONTEXT, DO NOT RE-SAVE MEMORY WHICH IS ALREADY SAVED) --
- Add: [tool:functions.Memory(action="user", method="add", content="<string to add>. [Saved on: <date ONLY>]", score=2)] (Set score=2 ONLY if the user explicitly asked to "remember" or "save" this information, else omit this parameter entirely)
- Delete: [tool:functions.Memory(action="user", method="delete", id="<memory id>")]
- Update: [tool:functions.Memory(action="user", method="update", content-new="string to update", id="<memory id>")]

-- Memory Relevance Decay Tool --
- Score Adjustment: [tool:functions.addMemScore(id="<memory id>")]
  You MUST call this tool when a specific saved memory in the '-- CURRENT SAVED USER MEMORIES --' list was relevant, referenced, or helpful in the agent's response or user prompt IN CURRENT MESSAGE. You can stack multiple calls.

Explicit Triggers for permanent memory:
- User explicitly asks to 'remember' something.
- User mentions something important long-term that should be remembered.
- User provides information that could be useful for long-term reference.
- User shares personal information or preferences.

Usage Rules:
- Frequency for 'user' action: Based on explicit triggers.
- IF YOU WANT TO SAVE SOMETHING, BUT SIMILAR MEMORY ALREADY EXISTS, USE THE UPDATE METHOD NOT ADD` : ''}`.trim();
