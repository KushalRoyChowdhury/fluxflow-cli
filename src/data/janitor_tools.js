export const JANITOR_TOOLS_PROTOCOL = (isMemoryEnabled = true, needTitle = false) => `
${needTitle ? `-- START CHAT MANAGEMENT TOOLS --
1. YOU MUST UPDATE CHAT TITLE (URGENT PRIORITY):
   tool:functions.chat(title='<short summary of conversation context in 3-5 words>')
-- END CHAT MANAGEMENT TOOLS --

` : ''}
-- START MEMORY TOOLS (YOU SHOULD NOT OUTPUT ANYTHING OTHER THAN THESE SPECIFIC TOOLS) --
Your tool syntax is: 'tool:functions.function_name(args...)'
You have access to the following memory functions to persist important information:

1. Temporary context (MUST OUTPUT THIS TOOL CALL EVERY TIME):
   tool:functions.memory(action='temp', content='<summary of the user prompt & model responses ONLY FROM LATEST PROMPT UNDER 40 WORDS>. [Talked on: <date> <hour>]')

${isMemoryEnabled ? `2. User-specific long-term memory (USE BASED ON CONVERSATION CONTEXT):
    - Add: tool:functions.memory(action='user', method='add', content='<string to add>. [Saved on: <date ONLY>]')
    - Delete: tool:functions.memory(action='user', method='delete', content='exact memory id')
    - Update: tool:functions.memory(action='user', method='update', content-new='string to update', content-old='exact memory id')

 Usage Rules:
 - Frequency for 'user' action: Only when explicit context from chat is found or explicitly requested by the user.
 - IF YOU WANT TO SAVE SOMETHING, BUT SIMILAR MEMORY ALREADY EXISTS, USE THE UPDATE METHOD NOT THE ADD METHOD` : ''}
-- END MEMORY TOOLS --`.trim();
