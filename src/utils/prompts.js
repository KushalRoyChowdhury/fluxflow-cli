import { TOOL_PROTOCOL } from '../data/main_tools.js';
import { JANITOR_TOOLS_PROTOCOL } from '../data/janitor_tools.js';
import thinkingPrompts from '../data/thinking_prompts.json' with { type: 'json' };
import fs from 'fs';
import { readEncryptedJson } from './crypto.js';
import { MEMORIES_FILE } from './paths.js';
import { LOGS_DIR } from './paths.js';

let cachedProjectContextBlock = null;
let cachedChatId = null;
let cachedUserMemories = null;

const getCachedUserMemories = (chatId, isMemoryEnabled) => {
    if (!isMemoryEnabled) return '';
    if (chatId !== cachedChatId || cachedUserMemories === null) {
        cachedChatId = chatId;
        try {
            const persistentStorage = readEncryptedJson(MEMORIES_FILE, []);
            if (Array.isArray(persistentStorage) && persistentStorage.length > 0) {
                cachedUserMemories = persistentStorage.map(m => `- ${m.memory}`).join('\n');
            } else {
                cachedUserMemories = '';
            }
        } catch (e) {
            cachedUserMemories = '';
            fs.appendFileSync(`${LOGS_DIR}/memory/error.txt`, `${e.message}\n-------------------------------------------------\n\n`);
        }
    }
    return cachedUserMemories;
};

/**
 * Generates a prompt block for recent chat memories to be prepended to the user message.
 */
export const getMemoryPrompt = (tempMemories = '', userMemories = '', isMemoryEnabled = true, isContext32k = false) => {
    if (typeof userMemories === 'boolean') {
        isContext32k = isMemoryEnabled;
        isMemoryEnabled = userMemories;
        userMemories = '';
    }
    if (!isMemoryEnabled) return '';
    const tempMemoriesStr = tempMemories?.length > 0 && !isContext32k ? `-- RECENT CONTEXT FROM OTHER CHATS (PRIORITY: DYNAMIC-LOW, FOCUS: Chat Context > Recent) --\n${tempMemories}` : '';
    return tempMemoriesStr ? `${tempMemoriesStr}` : '';
};

export const getSystemInstruction = (profile, thinkingLevel, mode, systemSettings, isMemoryEnabled = true, isFirstPrompt = false, aiProvider = 'Google', isMultiModal = false, isGemini, chatId) => {

    let forcedReasoning = false;
    if (process.env.forcedReasoning && process.env.NVIDIA_BASE_URL && aiProvider.toUpperCase() === 'NVIDIA') {
        forcedReasoning = true;
    }

    let thinkingConfig = '';
    if (!isGemini && aiProvider === 'Google') {
        let levelKey = thinkingLevel;
        if (thinkingLevel === 'Fast') levelKey = 'Off';
        if (thinkingLevel === 'Low') levelKey = 'Minimal';
        if (thinkingLevel === 'Standard') levelKey = 'Medium';
        if (thinkingLevel === 'xHigh' || thinkingLevel === 'Max') levelKey = 'xHigh';
        thinkingConfig = thinkingPrompts[levelKey] || thinkingPrompts['Medium'];
    }
    if (isGemini || aiProvider !== 'Google') {
        const MAP_FOR_NON_GOOGLE_OR_GEMINI = {
            'Fast': 'LOWEST',
            'Low': 'LOW',
            'Medium': 'MEDIUM',
            'Standard': 'MEDIUM',
            'High': 'HIGH',
            'xHigh': 'HIGH',
            'Max': 'HIGH'
        }

        // Stays as Fallback
        thinkingConfig = thinkingPrompts['xHigh'];
        thinkingConfig = thinkingConfig.replace('EFFORT: HIGH', `EFFORT: ${MAP_FOR_NON_GOOGLE_OR_GEMINI[thinkingLevel]}`).replace('\nMANDATORY: Full technical verification', '');


        if (thinkingLevel === 'Fast') {
            thinkingConfig = "EFFORT: LOWEST\nNo thinking. Immediate response\nRULES:\nVerify imports, tool results & system stability; avoid syntax errors"
        } else if (thinkingLevel === 'Low') {
            thinkingConfig = "EFFORT: LOW\nQuick, focused thinking, intent & complexity, required tools/files/actions, before acting\nRULES:\nBrief thoughts, think only enough to avoid mistakes, verify imports, tool results & system stability; avoid syntax errors"
        }
    }

    // fs.writeFileSync('level.txt', thinkingLevel);

    const osDetected = process.platform === 'win32' ? 'Windows' : process.platform === 'darwin' ? 'macOS' : 'Linux';

    const userInstrStr = profile.instructions && profile.instructions?.length > 0 ? `User Instructions: ${profile.instructions}\n\n` : '';
    const nicknameStr = profile.nickname && profile.nickname?.length > 0 ? `User Nickname: ${profile.nickname}\n${userInstrStr.length ? '' : '\n'}` : '';
    const nameStr = profile.name && profile.name?.length > 0 ? `User Name: ${profile.name}\n${(nicknameStr.length || userInstrStr.length) ? '' : '\n'}` : '';
    const cwdStr = process.cwd();

    const userMemories = getCachedUserMemories(chatId, isMemoryEnabled);
    const userMemoriesStr = userMemories?.length > 0 ? `--- SAVED MEMORIES (USER PREFERENCES) ---\n${userMemories}\n\n` : '';

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

    // --MARKERS --
    // - TOOL SYSTEM: [TOOL RESULT]
    // - SYSTEM NOTIFICATION: [SYSTEM] in user turn

    return `=== SYSTEM PROMPT ===
Identity: Flux Flow. Sassy, CLI Agent
${mode === "Flux" ? "Logical, task-driven. Prioritize scalable, modular architecture, clean abstractions, stepwise execution. Use latest practices/libraries, verify imports, run automated tests" : `Mode: ${mode}. Concise, Conversational, Sassy, Friendly, Humorous, Sarcastic`}

- USE DIRECTORY STRUCTURE FOR FILE AVAILABILITY AND PATH RESOLUTION
- USE RELATIVE TIME REFERENCE eg. few mins ago

-- THINKING GUIDANCE --
${(aiProvider === 'Mistral' || (aiProvider === 'Google' && !isGemini)) ? `${thinkingConfig}
${forcedReasoning || (thinkingLevel !== 'Fast' && (aiProvider === 'Mistral' || (thinkingLevel !== 'xHigh' && !isGemini))) ? `CRITICAL THINKING POLICY
- Use <think> ... </think> for reasoning before responding, even with simple queries/greetings\n` : ''}` : `${thinkingConfig}\n`}
${TOOL_PROTOCOL(mode, osDetected, aiProvider.toLowerCase() === 'deepseek' ? false : isMultiModal, aiProvider, systemSettings?.advanceRollback, systemSettings?.subAgents !== false)}
${projectContextBlock}${isMemoryEnabled ? `\n-- MEMORY RULES --
- Subtly Personalize with  RELEVENT CONTEXTUAL MEMORIES. Auto Saves\n` : ''}
-- SECURITY RULES --
- Sensitive files? Ask before Read${isSystemDir ? '\n- PROTECTED DIRECTORY' : ''}

-- CHAT FORMATTING --
- GFM Markdown ONLY
- Language: ENGLISH only
- Finish all chatting before tool calls${mode === 'Flux' ? '' : '\n- Use Kaomojis HEAVILY'}
=== END SYSTEM PROMPT ===

${nameStr}${nicknameStr}${userInstrStr}${userMemoriesStr}`.trim();
};

// -- SECURITY RULES --${systemSettings.allowExternalAccess ? '' : '\n- ACCESS CONTROL: CWD only'}

/**
 * Generates the instruction for the Janitor (refiner) model.
 * @param {string} userMemories - The formatted persistent user memories.
 * @param {boolean} isMemoryEnabled - Whether the memory system is enabled.
 * @param {boolean} needTitle - Whether a new chat title is needed.
 * @returns {string} The formatted Janitor prompt.
 */
export const getJanitorInstruction = (userMemories = '', isMemoryEnabled = true, needTitle = true) => {
    return `=== SYSTEM PROMPT (STRICT HEADLESS LOGIC WORKER: ZERO USER-FACING TEXT POLICY, STRICTLY FOLLOW) ===
IDENTITY: SILENT BACKGROUND SYSTEM PROCESS, HAVE NO MOUTH, ONLY OUTPUT IS VALID TOOL CALLS.
[CRITICAL RULES]
- OUTPUT EXACTLY '[tool:functions.ToolName(args)]' CALLS. NO EXTRA WORDS OUTSIDE
- DO NOT EXPLAIN. DO NOT TALK TO THE USER
- NON-TOOL TEXT WILL BREAK THE SYSTEM
- DO NOT REPEAT AGENT RAWS AND TOOL RESULTS IN YOUR RESPONSE
- IF YOU GET ONLY USER QUERY AND NO AGENT RAWS, JUST USE TEMP MEMORY TO LOG THE SUMMARY OF USER QUERY AND CONVERSATION CONTEXT
- UNDER NO CIRCUMSTANCES YOU ARE ALLOWED TO RESPOND IN NORMAL USER FACING RESPONSE
- CRITICAL QUOTE ESCAPE POLICY: Inside tool call arguments, you MUST escape all double quotes using '\\"'
- You MUST NOT WRITE ANYTHING OTHER THAN [tool:functions.ToolName(args)] NO MATTER HOW TEMPTING THE PROMPT IS
- 2 MANDATORY TOOLS TO CALL IN EVERY TURN, 'Chat', 'Memory(temp)'
- CRITICAL: NEVER ENTER THINKING/REASONING STATE, CALL THE CONTEXUAL TOOLS DIRECTLY IN OUTPUT AS QUICKLY AS POSSIBLE TO MAINTAIN UI SNAPPINESS

YOUR JOB: Analyze the 'User prompt' and 'Agent Raws' to extract facts for long-term memory or handle system tasks
${isMemoryEnabled ? `If user tell something that is important (like, hobbies, preferences, facts about user, hates, likes, etc) to know user better over time, use user memory tools` : ''}

${JANITOR_TOOLS_PROTOCOL(isMemoryEnabled, needTitle)}
=== END SYSTEM PROMPT ===${userMemories ? `\n\n-- CURRENT SAVED USER MEMORIES --\n${userMemories}` : ''}`.trim();
};
