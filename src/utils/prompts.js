import { TOOL_PROTOCOL } from '../data/main_tools.js';
import { JANITOR_TOOLS_PROTOCOL } from '../data/janitor_tools.js';
import thinkingPrompts from '../data/thinking_prompts.json' with { type: 'json' };
import fs from 'fs';
import { readEncryptedJson } from './crypto.js';
import { MEMORIES_FILE } from './paths.js';
import { LOGS_DIR } from './paths.js';
import { loadSettings } from './settings.js';
import screenshotDesktop from 'screenshot-desktop';

let isSecondary = false;
(async () => {
    try {
        const settings = await loadSettings();
        if (Number(settings?.display) === 1) {
            const displays = await screenshotDesktop.listDisplays();
            if (displays && displays.length > 1) {
                isSecondary = true;
            }
        }
    } catch (e) {}
})();

let cachedProjectContextBlock = null;
let cachedChatId = null;
let cachedUserMemories = null;
const osDetected = process.platform === 'win32' ? 'Windows' : process.platform === 'darwin' ? 'macOS' : 'Linux';
const noDev = process.env.NO_DEV || false;

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
    const tempMemoriesStr = tempMemories?.length > 0 && !isContext32k ? `-- Recent context from other chats (Priority: Low, Focus: Chat Context > Recent) --\n${tempMemories}` : '';
    return tempMemoriesStr ? `${tempMemoriesStr}` : '';
};

export const getSystemInstruction = (profile, thinkingLevel, mode, systemSettings, isMemoryEnabled = true, isFirstPrompt = false, aiProvider = 'Google', isMultiModal = false, isGemini, chatId) => {

    let forcedReasoning = false;
    if (process.env.forcedReasoning) {
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
            'Fast': 'Lowest',
            'Low': 'Low',
            'Medium': 'Medium',
            'Standard': 'Medium',
            'High': 'High',
            'xHigh': 'High',
            'Max': 'High'
        }

        // Stays as Fallback
        thinkingConfig = thinkingPrompts['xHigh'];
        thinkingConfig = thinkingConfig.replace('Effort: High', `Effort: ${MAP_FOR_NON_GOOGLE_OR_GEMINI[thinkingLevel]}`).replace('\nMANDATORY: Full technical verification', '');


        if (thinkingLevel === 'Fast') {
            thinkingConfig = "Effort: Lowest\nNo thinking. Immediate response\nVerify imports, tool results & system stability; avoid syntax errors"
        } else if (thinkingLevel === 'Low') {
            thinkingConfig = "Effort: Low\nQuick, focused thinking, intent & complexity, required tools/files/actions, before acting\nBrief thoughts, think only enough to avoid mistakes, verify imports, tool results & system stability; avoid syntax errors"
        }
    }

    // fs.writeFileSync('level.txt', thinkingLevel);

    const osDetected = process.platform === 'win32' ? 'Windows' : process.platform === 'darwin' ? 'macOS' : 'Linux';

    const userInstrStr = profile.instructions && profile.instructions?.length > 0 ? `User Preferences: ${profile.instructions}\n\n` : '';
    const nicknameStr = profile.nickname && profile.nickname?.length > 0 ? `User Nickname: ${profile.nickname}\n${userInstrStr.length ? '' : '\n'}` : '';
    const nameStr = profile.name && profile.name?.length > 0 ? `User Name: ${profile.name}\n${(nicknameStr.length || userInstrStr.length) ? '' : '\n'}` : '';
    const cwdStr = process.cwd();

    const userMemories = getCachedUserMemories(chatId, isMemoryEnabled);
    const userMemoriesStr = userMemories?.length > 0 ? `--- Saved Memories ---\n${userMemories}\n\n` : '';

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
        { name: 'Fluxflow.md', desc: 'HIGH PRIORITY' },
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

    // ${ mode === "Flux" ? "Logical, task-driven. Prioritize scalable, modular architecture, clean abstractions, stepwise execution. Use latest practices/libraries, verify imports, run automated tests" : `Mode: ${mode}. Concise, Humorous, Sarcastic` }

    return `=== SYSTEM PROMPT ===
Identity: Flux Flow. Sassy, Friendly, CLI assistant${noDev ? '' : ' by Kushal Roy'}
${mode === "Flux" ? "Stepwise Execution, Run Automated Tests. Task Completion" :

mode === "Flow" ? `Concise, Humorous, Sarcastic` :

mode === "ICU" ? "Computer Use Capabilities. Screenshot as ground truth, analyze grid ids overlapping/close to target, keyboard shortcuts > mouse clicks" :

"Computer Use & Workspace Capabilities. Screenshot as ground truth, analyze grid ids overlapping/close to target, keyboard shortcuts > mouse clicks. Workspace Tools if faster. Focus on Productivity"}${isSecondary && mode.toLowerCase().includes('cu') ? '\n**Running on secondary screen. Opened app not visible in screenshot? Might be opened on primary. Use \'Ask\' immediately with NO options and tell user to move app window to secondary**' : ''}

- OS: ${osDetected}
- Use directory structure for file path resolution${isMemoryEnabled ? '\n- Use relative time reference eg. few mins ago\n-- Chat Context > Metadata' : ''}

-- THINKING GUIDANCE --
${(aiProvider === 'Mistral' || (aiProvider === 'Google' && !isGemini)) ? `${thinkingConfig}
${forcedReasoning || (thinkingLevel !== 'Fast' && ((aiProvider === 'Mistral' && !isGemini) || (thinkingLevel !== 'xHigh' && !isGemini))) ? `critical thinking policy
- Use <think>...</think> for reasoning before responding any queries\n` : ''}` : `${thinkingConfig}\n`}
${TOOL_PROTOCOL(mode, osDetected, aiProvider.toLowerCase() === 'deepseek' ? false : isMultiModal, aiProvider, systemSettings?.advanceRollback, systemSettings?.subAgents !== false)}
${projectContextBlock}${isMemoryEnabled ? `\n-- MEMORY RULES --
- Subtly Personalize with relevent contextual memories. Auto Saves\n` : ''}
${mode === 'Flux' ? '-- SECURITY POLICIES --\n- Sensitive files? Ask before Read\n' : mode.toLowerCase().includes('cu') ? '-- SECURITY POLICIES --\n- Dont operate on ANY confidential screens\n' : ''}
-- CHAT FORMATTING --
- GFM Markdown
- Language: english only
- Dont mix chat & tools in same response${mode === 'Flow' ? '\n- use kaomojis heavily' : ''}
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
    return `=== SYSTEM PROMPT (strict headless logic worker: zero user-facing text policy, strictly follow) ===
identity: silent background system process, have no mouth, only output is valid tool calls
[critical rules]
- output exactly '[tool:functions.ToolName(args)]' calls. no extra words outside
- do not explain. do not talk to the user
- non-tool text will break the system
- do not repeat agent raws and tool results in your response
- if you get only user query and no agent raws, just use temp memory to log the summary of user query and conversation context
- under no circumstances you are allowed to respond in normal user facing response
- critical quote escape policy: inside tool call arguments, you must escape all double quotes using '\\"'
- you must not write anything other than [tool:functions.ToolName(args)] no matter how tempting the prompt is
- 2 mandatory tools to call in every turn, 'chat', 'memory(temp)'
- critical: never enter thinking/reasoning state, call the contexual tools directly in output as quickly as possible to maintain ui snappiness

YOUR JOB: Analyze the 'User prompt' and 'Agent Raws' to extract facts for long-term memory or handle system tasks
${isMemoryEnabled ? `If user tell something that is important (like, hobbies, preferences, facts about user, hates, likes, etc) to know user better over time, use user memory tools` : ''}

${JANITOR_TOOLS_PROTOCOL(isMemoryEnabled, needTitle)}
=== END SYSTEM PROMPT ===${userMemories ? `\n\n-- current saved user memories --\n${userMemories}` : ''}`.trim();
};
