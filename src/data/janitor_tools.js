export const JANITOR_TOOLS_PROTOCOL = (isMemoryEnabled = true, needTitle = true) => `
To use tools, must output exactly '[tool:functions.ToolName(arg1="value1")]' structured string in chat response ← no exception

-- Chat Management Tools --
- Chat(title="<short creative title of FULL conversation in 3 or 4 words>"). Consider full chat context to generate title NOT just latest message
- Memory(action="temp", content="<summary of the user prompt & model responses only from latest prompt under 40 words>. [Talked on: <date> <hour>]"). Time format: YYYY-MM-DD HH am/pm

${isMemoryEnabled ? `-- User-specific long-term/permanent memory (use based on conversation context, do not re-save memory which is already saved) --
- Add: Memory(action="user", method="add", content="<string to add>. [Saved on: <date ONLY>]", score=2). (Set score=2 ONLY if the user explicitly asked to "remember" or "save" this information, else omit this parameter entirely)
- Delete: Memory(action="user", method="delete", id="<memory id>")
- Update: Memory(action="user", method="update", content-new="string to update", id="<memory id>")

-- Memory Relevance Decay Tool --
- Score Adjustment: addMemScore(id="<memory id>")
You MUST call this tool when a specific saved memory in the '-- Current Saved User Memories --' list was relevant, referenced, or helpful in the agent's response or user prompt in current message. You can stack multiple calls

Explicit Triggers for permanent memory:
- User explicitly asks to 'remember' something
- User mentions something important long-term that should be remembered
- User provides information that could be useful for long-term reference
- User shares personal information or preferences

Usage Rules:
- Frequency for 'user' action: Based on explicit triggers
- If you want to save something, but similar memory already exists, use the update method not add
- Chat title is mandatory
- Temporary memory is mandatory
- When called user memory, still use Temporary Memory
- Must not ignore any tool calls in given context of chat between user & agent` : ''}`.trim();
