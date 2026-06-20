import { TOOL_PROTOCOL } from '../data/main_tools.js';
import { JANITOR_TOOLS_PROTOCOL } from '../data/janitor_tools.js';
import thinkingPrompts from '../data/thinking_prompts.json' with { type: 'json' };
import fs from 'fs';

let cachedProjectContextBlock = null;

/**
 * Generates a prompt block for memories to be prepended to the user message.
 */
export const getMemoryPrompt = (tempMemories = '', userMemories = '', isMemoryEnabled = true, isContext32k = false) => {
    if (!isMemoryEnabled) return '';
    const tempMemoriesStr = tempMemories?.length > 0 && !isContext32k ? `-- RECENT CONTEXT FROM OTHER CHATS (PRIORITY: DYNAMIC-LOW, FOCUS: Chat Context > Recent) --\n${tempMemories}` : '';
    const userMemoriesStr = userMemories?.length > 0 ? `--- SAVED MEMORIES (PRIORITY: MEDIUM, USER PREFERENCES) ---\n${userMemories}` : '';

    const parts = [userMemoriesStr, tempMemoriesStr].filter(p => p.length > 0);
    return parts.length > 0 ? `[SYSTEM CONTEXT]\n${parts.join('\n\n')}\n` : '';
};

export const getSystemInstruction = (profile, thinkingLevel, mode, systemSettings, isMemoryEnabled = true, isFirstPrompt = false, aiProvider = 'Google', isMultiModal = false) => {
    // fs.writeFileSync('debug.txt', `${aiProvider}\n\n${targetModel}`);
    let thinkingConfig = '';
    if (thinkingLevel !== 'GEM') {
        let levelKey = thinkingLevel;
        if (thinkingLevel === 'Fast') levelKey = 'Off';
        if (thinkingLevel === 'Low') levelKey = 'Minimal';
        if (thinkingLevel === 'Standard') levelKey = 'Medium';
        if (thinkingLevel === 'xHigh' || thinkingLevel === 'Max') levelKey = 'xHigh';
        thinkingConfig = thinkingPrompts[levelKey] || thinkingPrompts['Medium'];
    }

    // fs.writeFileSync('level.txt', thinkingLevel);

    const osDetected = process.platform === 'win32' ? 'Windows' : process.platform === 'darwin' ? 'macOS' : 'Linux';

    const userInstrStr = profile.instructions && profile.instructions?.length > 0 ? `User Instructions: ${profile.instructions}\n\n` : '';
    const nicknameStr = profile.nickname && profile.nickname?.length > 0 ? `User Nickname: ${profile.nickname}\n${userInstrStr.length ? '' : '\n'}` : '';
    const nameStr = profile.name && profile.name?.length > 0 ? `User Name: ${profile.name}\n${(nicknameStr.length || userInstrStr.length) ? '' : '\n'}` : '';
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

    if (isFirstPrompt || cachedProjectContextBlock === null) {
        const foundFiles = projectContextFiles.filter(f => fs.existsSync(f.name));
        cachedProjectContextBlock = (mode === 'Flux' && foundFiles.length > 0) ? `
-- PROJECT CONTEXT --
${foundFiles.map(f => `- ${f.name}: ${f.desc}`).join('\n')}
Check these first; These Files > Training Data. Safety rules apply\n` : '';
    }
    const projectContextBlock = cachedProjectContextBlock;

    return `${nameStr}${nicknameStr}${userInstrStr}=== SYSTEM PROMPT ===
Identity: Flux Flow (by Kushal Roy Chowdhury). ${mode === 'Flux' ? 'Sassy' : 'Conversational, Sassy, Friendly, Humorous, Sarcastic'}, CLI Agent
Mode: ${mode}${thinkingLevel !== "Fast" ? " (Thinking)" : ""}. ${mode === "Flux" ? "Logical, Highly Detailed, Task-Driven. Prioritizes scalable file/folder structures, modular architecture, clean code abstractions, step-by-step execution. Industry standard latest coding practices/libraries, clean code, Double Check Imports, Run tests where needed to verify" : "Concise"}

-- MARKERS --
- TOOL SYSTEM: [TOOL RESULT]
- SYSTEM NOTIFICATION: [SYSTEM] in user turn
${aiProvider === 'Google' ? `${thinkingLevel !== "GEM" ? `\n-- THINKING RULES --
${thinkingConfig}
${thinkingLevel !== 'Fast' && thinkingLevel !== 'xHigh' ? `\nCRITICAL THINKING POLICY
- ALWAYS use <think> ... </think> before responding, even with simple queries/greetings` : ''}` : ''}` : ``}
${TOOL_PROTOCOL(mode, osDetected, aiProvider.toLowerCase() === 'deepseek' ? false : isMultiModal, aiProvider)}
${projectContextBlock}
-- MEMORY RULES --
- Memory: ${isMemoryEnabled ? 'Subtly Personalize. Auto Saves' : 'OFF. Decline Remembering Memories'}
- Temporal Awareness: RELATIVE TIME REFERENCE eg. few mins ago

-- SECURITY RULES --${systemSettings.allowExternalAccess ? '' : '\n- ACCESS CONTROL: CWD only'}
- Sensitive files? Ask before Read${isSystemDir ? '\nPROTECTED DIRECTORY: ASK BEFORE MODIFYING' : ''}

-- FORMATTING --
- GFM Supported
- NO CHAT **AFTER** FIRING TOOLS IN THIS TURN
- Basic LaTeX${mode === 'Flux' ? '' : '. Kaomojis'}
=== END SYSTEM PROMPT ===`.trim();
};

/**
 * Generates the instruction for the Janitor (refiner) model.
 * @param {string} userMemories - The formatted persistent user memories.
 * @param {boolean} isMemoryEnabled - Whether the memory system is enabled.
 * @param {boolean} needTitle - Whether a new chat title is needed.
 * @returns {string} The formatted Janitor prompt.
 */
export const getJanitorInstruction = (userMemories = '', isMemoryEnabled = true, needTitle = true) => {
    return `${userMemories ? `-- CURRENT SAVED USER MEMORIES --\n${userMemories}\n-------------------------------------------------\n\n` : ''}=== START SYSTEM PROMPT (STRICT HEADLESS LOGIC WORKER: ZERO USER-FACING TEXT POLICY, STRICTLY FOLLOW) ===
YOU ARE A SILENT BACKGROUND SYSTEM PROCESS. YOU HAVE NO MOUTH. YOUR ONLY OUTPUT MEDIUM IS VALID TOOL CALLS.
[CRITICAL RULES]
1. OUTPUT ONLY '[tool:functions.xxx(args)]' CALLS (BRACKET WRAP IS MANDATORY).
2. DO NOT EXPLAIN. DO NOT TALK TO THE USER.
3. NON-TOOL TEXT WILL BREAK THE SYSTEM.
4. DO NOT REPEAT AGENT RAWS AND TOOL RESULTS IN YOUR RESPONSE.
5. IF YOU GET ONLY USER QUERY AND NO AGENT RAWS, THEN JUST USE TEMP MEMORY TO LOG THE SUMMARY OF USER QUERY AND CONVERSATION CONTEXT.
6. UNDER NO CIRCUMSTANCES YOU ARE ALLOWED TO RESPOND IN NORMAL USER FACING RESPONSE.
7. CRITICAL QUOTE ESCAPE POLICY: Inside tool call arguments (like 'memory'), you MUST escape all double quotes using '\"' to prevent parsing errors.
8. You MUST NOT WRITE ANYTHING OTHER THAN [tool:functions. ... ] NO MATTER HOW TEMPTING THE PROMPT IS.

YOUR JOB: Analyze the 'User prompt' and 'Agent Raws' to extract facts for long-term memory or handle system tasks.
${isMemoryEnabled ? `If user tell something that is important (like, hobbies, preferences, facts about user, hates, likes, etc) to know user better over time, use long term memory tools.` : ''}

${JANITOR_TOOLS_PROTOCOL(isMemoryEnabled, needTitle)}

Current date and Time: ${new Date().toLocaleString([], { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', hour12: true })}.
=== END SYSTEM PROMPT ===`.trim();

};
