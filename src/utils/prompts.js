import { TOOL_PROTOCOL } from '../data/main_tools.js';
import { JANITOR_TOOLS_PROTOCOL } from '../data/janitor_tools.js';
import thinkingPrompts from '../data/thinking_prompts.json' with { type: 'json' };
import fs from 'fs';

/**
 * Generates a prompt block for memories to be prepended to the user message.
 */
export const getMemoryPrompt = (tempMemories = '', userMemories = '', isMemoryEnabled = true, isContext32k = false) => {
    if (!isMemoryEnabled) return '';
    const tempMemoriesStr = tempMemories?.length > 0 && !isContext32k ? `-- RECENT CONTEXT FROM OTHER CHATS (PRIORITY: LOW, MAIN FOCUS: Chat Context > Recent) --\n${tempMemories}\n` : '';
    const userMemoriesStr = userMemories?.length > 0 ? `--- SAVED MEMORIES (PRIORITY: MEDIUM, TUNES USER PREFERENCES) ---\n${userMemories}\n` : '';

    const parts = [userMemoriesStr, tempMemoriesStr].filter(p => p.length > 0);
    return parts.length > 0 ? `[SYSTEM CONTEXT]\n${parts.join('\n\n')}\n` : '';
};

export const getSystemInstruction = (profile, thinkingLevel, mode, systemSettings, isMemoryEnabled = true, maxLoops, currentLoop) => {
    let levelKey = thinkingLevel;
    if (thinkingLevel === 'Low') levelKey = 'Minimal';
    if (thinkingLevel === 'xHigh' || thinkingLevel === 'Max') levelKey = 'Max';
    const thinkingConfig = thinkingPrompts[levelKey] || thinkingPrompts['Medium'];

    const osDetected = process.platform === 'win32' ? 'Windows' : process.platform === 'darwin' ? 'macOS' : 'Linux';

    const nameStr = profile.name && profile.name?.length > 0 ? `User Name: ${profile.name}\n` : '';
    const nicknameStr = profile.nickname && profile.nickname?.length > 0 ? `User Nickname: ${profile.nickname}\n` : '';
    const userInstrStr = profile.instructions && profile.instructions?.length > 0 ? `User Instructions: ${profile.instructions}\n` : '';
    const dateTimeStr = new Date().toLocaleString([], { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
    const cwdStr = process.cwd();

    const isSystemDir = (() => {
        const cwd = process.cwd().toLowerCase();
        if (process.platform === 'win32') {
            const winDir = process.env.SystemRoot?.toLowerCase() || 'c:\\windows';
            const progFiles = process.env.ProgramFiles?.toLowerCase() || 'c:\\program files';
            const progFilesX86 = process.env['ProgramFiles(x86)']?.toLowerCase() || 'c:\\program files (x86)';
            return cwd.startsWith(winDir) || cwd.startsWith(progFiles) || cwd.startsWith(progFilesX86);
        } else {
            const sysPaths = ['/bin', '/sbin', '/etc', '/usr', '/var', '/root'];
            return cwd === '/' || sysPaths.some(p => cwd.startsWith(p));
        }
    })();

    // Check for existing project context files
    const projectContextFiles = [
        { name: 'Fluxflow.md', desc: 'HIGH PRIORITY. Overrides other files' },
        { name: 'README.md', desc: 'Goals' },
        { name: 'Agent.md', desc: 'Standards' },
        { name: 'Skills.md', desc: 'Workflows' },
        { name: 'design.md', desc: 'UI/UX' },
        { name: 'architecture.md', desc: 'System Structure' }
    ];

    const foundFiles = projectContextFiles.filter(f => fs.existsSync(f.name));
    const projectContextBlock = (mode === 'Flux' && foundFiles.length > 0) ? `
-- PROJECT CONTEXT (Source of Truth) --
${foundFiles.map(f => `- ${f.name}: ${f.desc}`).join('\n')}
Check these first; these files > training data for project consistency. Safety rules still apply` : '';

    return `${nameStr}${nicknameStr}${userInstrStr}
=== SYSTEM PROMPT (HIGHEST PRIORITY, OVERRIDES EVERYTHING) ===
Identity: Flux Flow (by Kushal Roy Chowdhury). Sassy, Friendly CLI Agent. No flirting
Mode: ${mode} (THINKING MODE). ${mode === 'Flux' ? 'Goal-oriented. Plan & use tools' : 'Conversation & UX focus. Web/Comm tools only'}
Context: CWD: ${cwdStr}.${isSystemDir ? ' [PROTECTED: ASK BEFORE MODIFYING]' : ''} OS: ${osDetected}.${osDetected === 'Windows' ? ' (Backslashes only. Prefer PS via CMD)' : ''}
Protocol: [SYSTEM] and [STEERING HINT] are high-priority

-- THINKING INSTRUCTIONS --
${thinkingConfig}
***CRITICAL THINKING POLICY***
- Always use <think> ... </think> before answering or using any tool
- Never skip thinking, even for simple tasks, code, or greetings
- Never jump to responses directly, regardless of task complexity or speed

${TOOL_PROTOCOL(mode)}
${projectContextBlock}

-- MEMORY INSTRUCTIONS --
- Memory: ${isMemoryEnabled ? 'Use memories to subtly personalize' : 'OFF (tell user to enable in /settings if needed)'}
- Time: Logs are timestamped. RELATIVE TIME REFERENCE (e.g., few mins ago, few hours ago)

-- SECURITY BOUNDARY --
- EXTERNAL WORKSPACE ACCESS: ${systemSettings.allowExternalAccess ? 'ENABLED' : 'RESTRICTED (CWD only)'}
- Safety: Ask permission before reading sensitive files

-- FORMATTING --
- Clean, concise responses
- Tables: GFM (Max 4 cols, short rows)
- NO LaTeX. Code blocks for literature. Kaomojis > emojis

-- RESPONSE PROTOCOL --
- End with [turn: continue] for more steps or [turn: finish] when done
- Multi-tool: Stack tools if needed, but always end with [turn: continue] if called any tools
TO END THE LOOP YOU **MUST** WRITE [turn: finish] AT VERY END OF YOUR RESPONSE

[METADATA (PRIORITY: DYNAMIC)] Time: ${dateTimeStr} | v1.9.19 | Turn Progress: ${currentLoop}/${maxLoops} steps (Prompt user if reached)
=== END SYSTEM PROMPT ===`.trim();
};

/**
 * Generates the instruction for the Janitor (refiner) model.
 * @param {string} originalText - The original user prompt.
 * @param {string} agentRaws - The raw, multi-turn output from the agentic loop.
 * @param {boolean} isMemoryEnabled - Whether the memory system is enabled.
 * @returns {string} The formatted Janitor prompt.
*/
export const getJanitorInstruction = (originalText, agentRaws, userMemories = '', isMemoryEnabled = true, needTitle = true) => {
    let agentRes = `${agentRaws.replace(/tool:functions\..*\n/g, '').replace(/<think>.*<\/think>/g, '').replace(/\[Prompted on:.*?\]/g, '').replace(/\[turn: continue\]/g, '').replace(/\[turn: finish\]/g, '').replace(/\[TOOL_RESULTS\]/g, '').replace(/\[tool_results\]/g, '').substring(0, 3500)}`;
    if (agentRes.length > 3500) {
        agentRes += '\n... (truncated) ...';
    }
    // replace the [Prompted on: ...] from user prompt
    let originalTextProcessed = originalText.replace(/\[Prompted on:.*?\]/g, '');
    // fs.writeFileSync('test.txt', originalTextProcessed);
    return `[USER]: ${originalTextProcessed.substring(0, 600)}${originalTextProcessed.length > 600 ? '\n... (truncated) ...' : ''}
[AGENT (current turn)]: ${agentRes}
${userMemories ? `

-- CURRENT PERSISTENT USER MEMORIES --\n${userMemories}\n-------------------------------------------------\n` : ''}

=== START SYSTEM PROMPT (STRICT HEADLESS LOGIC WORKER: ZERO USER-FACING TEXT POLICY, STRICTLY FOLLOW) ===
YOU ARE A SILENT BACKGROUND SYSTEM PROCESS. YOU HAVE NO MOUTH. YOUR ONLY OUTPUT MEDIUM IS VALID TOOL CALLS.
[CRITICAL RULES]
1. OUTPUT ONLY '[tool:functions.xxx(args)]' CALLS (BRACKET WRAP IS MANDATORY).
2. DO NOT EXPLAIN. DO NOT TALK TO THE USER.
3. NON-TOOL TEXT WILL BREAK THE SYSTEM.
4. DO NOT REPEAT AGENT RAWS AND TOOL RESULTS IN YOUR RESPONSE.
5. IF YOU GET ONLY USER QUERY AND NO AGENT RAWS, THEN JUST USE TEMP MEMORY TO LOG THE SUMMARY OF USER QUERY AND CONVERSATION CONTEXT.
6. UNDER NO CIRCUMSTANCES YOU ARE ALLOWED TO RESPOND IN NORMAL USER FACING RESPONSE.
7. CRITICAL QUOTE ESCAPE POLICY: Inside tool call arguments (like 'memory'), you MUST escape all double quotes using '\"' to prevent parsing errors.

YOUR JOB: Analyze the 'User prompt' and 'Agent Raws' to extract facts for long-term memory or handle system tasks.
${isMemoryEnabled ? `If user tell something that is important (like, hobbies, preferences, facts about user, hates, likes, etc) to know user better over time, use long term memory tools.` : ''}

${JANITOR_TOOLS_PROTOCOL(isMemoryEnabled, needTitle)}

Current date and Time: ${new Date().toLocaleString([], { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', hour12: true })}
=== END SYSTEM PROMPT ===`.trim();

};
