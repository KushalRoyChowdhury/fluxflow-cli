export const JANITOR_TOOLS_PROTOCOL = (isMemoryEnabled = true, needTitle = true) => `
Your tool syntax is: '[tool:functions.ToolName(args...)]'

-- CHAT MANAGEMENT TOOLS (MUST CALL THESE 2 TOOLS ALWAYS) --
[tool:functions.Chat(title='<short creative title of FULL conversation in 3-5 words>')]. Consider full chat context to generate title NOT just latest message.
[tool:functions.Memory(action='temp', content='<summary of the user prompt & model responses ONLY FROM LATEST PROMPT UNDER 40 WORDS>. [Talked on: <date> <hour>]')]

${isMemoryEnabled ? `-- User-specific long-term memory (USE BASED ON CONVERSATION CONTEXT) --
- Add: [tool:functions.Memory(action='user', method='add', content='<string to add>. [Saved on: <date ONLY>]')]
- Delete: [tool:functions.Memory(action='user', method='delete', content='exact memory id')]
- Update: [tool:functions.Memory(action='user', method='update', content-new='string to update', content-old='exact memory id')]

Usage Rules:
- Frequency for 'user' action: Only when explicit context from chat is found or explicitly requested by the user.
- IF YOU WANT TO SAVE SOMETHING, BUT SIMILAR MEMORY ALREADY EXISTS, USE THE UPDATE METHOD NOT THE ADD METHOD` : ''}`.trim();
