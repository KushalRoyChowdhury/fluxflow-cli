import { TOOL_PROTOCOL } from '../data/main_tools.js';
import { JANITOR_TOOLS_PROTOCOL } from '../data/janitor_tools.js';
import thinkingPrompts from '../data/thinking_prompts.json' with { type: 'json' };
import fs from 'fs';
import path from 'path';
import os from 'os';
import { readEncryptedJson } from './crypto.js';
import { MEMORIES_FILE, LOGS_DIR, FLUXFLOW_DIR } from './paths.js';
import { loadSettings } from './settings.js';
import { createAboutSkill } from './about_skill.js';

export const getCaseInsensitiveFilePath = (dir, fileNames) => {
    try {
        if (!fs.existsSync(dir)) return null;
        const names = Array.isArray(fileNames) ? fileNames.map(f => f.toLowerCase()) : [fileNames.toLowerCase()];
        const files = fs.readdirSync(dir);
        for (const name of names) {
            const match = files.find(f => f.toLowerCase() === name);
            if (match) {
                const filePath = path.join(dir, match);
                const stat = fs.statSync(filePath);
                if (stat.isFile()) {
                    return filePath;
                }
            }
        }
    } catch (e) {}
    return null;
};

const readCaseInsensitiveFile = (dir, fileNames) => {
    const filePath = getCaseInsensitiveFilePath(dir, fileNames);
    if (filePath) {
        try {
            return fs.readFileSync(filePath, 'utf8');
        } catch (e) {}
    }
    return '';
};

export const getGlobalFluxflowPath = () => getCaseInsensitiveFilePath(FLUXFLOW_DIR, ['fluxflow.md', 'agent.md', 'agents.md']);
export const getLocalFluxflowPath = () => getCaseInsensitiveFilePath(process.cwd(), ['fluxflow.md', 'agent.md', 'agents.md']);

export let globalFluxflowPath = getGlobalFluxflowPath();
export let localFluxflowPath = getLocalFluxflowPath();

let cachedTargetKey = null;

export let ADD_ID = '';
export let ADD_NO_INS = false;

const parseGlobalEasterEgg = (rawContent) => {
    if (!rawContent || !/^<<<[\s\S]*?Identity:/m.test(rawContent)) {
        return rawContent;
    }

    const match = rawContent.match(/^<<<\s*\r?\n([\s\S]*?)\r?\n>>>\s*(?:\r?\n)?([\s\S]*)$/);
    if (!match) {
        return rawContent;
    }

    const block = match[1];
    const rest = match[2];

    const idMatch = block.match(/^Identity:\s*([\s\S]*?)(?=\r?\n\s*(?:<><|>>>)|$)/m);
    if (idMatch) {
        ADD_ID = idMatch[1].trim();
        process.env.NO_INS = true;
    }

    if (/<><\s*NO_INS/.test(block)) {
        ADD_NO_INS = true;
    }

    return rest.trim();
};

export const readGlobalInstruction = (force = false) => {
    globalFluxflowPath = getGlobalFluxflowPath();
    const raw = globalFluxflowPath ? readCaseInsensitiveFile(FLUXFLOW_DIR, ['fluxflow.md', 'agent.md', 'agents.md']).trim() : '';
    return parseGlobalEasterEgg(raw);
};

export const readLocalInstruction = (force = false) => {
    localFluxflowPath = getLocalFluxflowPath();
    return localFluxflowPath ? readCaseInsensitiveFile(process.cwd(), ['fluxflow.md', 'agent.md', 'agents.md']).trim() : '';
};

export const refreshInstructionsForTarget = (aiProvider = '', targetModel = '') => {
    const currentTargetKey = `${aiProvider || ''}::${targetModel || ''}`.toLowerCase().trim();
    if (cachedTargetKey !== currentTargetKey) {
        cachedTargetKey = currentTargetKey;
        globalFluxflowMD = readGlobalInstruction();
        localFluxflowMD = readLocalInstruction();
    }
};

export let globalFluxflowMD = readGlobalInstruction();

export const filterModelConditionalTags = (content, targetModel = '', aiProvider = '') => {
    if (!content) return '';
    let result = content;

    const currentProvider = aiProvider ? aiProvider.toLowerCase().trim() : '';
    const currentUniqueTarget = (aiProvider && targetModel) ? `${aiProvider}::${targetModel}`.toLowerCase().trim() : '';
    const currentModelId = targetModel ? targetModel.toLowerCase().trim() : '';

    // 0. Pre-resolve <start_provider_providerName>...<end_provider_providerName>
    // Converts nested <start_model_modelId> into <start_model_providerName::modelId> so Handle 1 handles it
    result = result.replace(/<start_provider_([^>\r\n]+)>([\s\S]*?)<end_provider_([^>\r\n]+)>/gi, (match, startProv, innerContent, endProv) => {
        if (startProv.trim().toLowerCase() === endProv.trim().toLowerCase()) {
            const providerName = startProv.trim().toLowerCase();
            if (/<start_model_/i.test(innerContent)) {
                return innerContent
                    .replace(/<start_model_([^>\r\n]+)>/gi, `<start_model_${providerName}::$1>`)
                    .replace(/<end_model_([^>\r\n]+)>/gi, `<end_model_${providerName}::$1>`);
            }
            // If it's a general provider-level block without model tags
            if (currentProvider && providerName === currentProvider) {
                return innerContent;
            }
            return '';
        }
        return match;
    });

    // 1. Handle <start_model_unique_target>...<end_model_unique_target>
    // e.g. <start_model_google::gemini-2.5-flash>...<end_model_google::gemini-2.5-flash>
    result = result.replace(/<start_model_([^>\r\n]+::[^>\r\n]+)>([\s\S]*?)<end_model_([^>\r\n]+::[^>\r\n]+)>/gi, (match, startTag, innerContent, endTag) => {
        if (startTag.trim().toLowerCase() === endTag.trim().toLowerCase()) {
            if (currentUniqueTarget && startTag.trim().toLowerCase() === currentUniqueTarget) {
                return innerContent;
            }
            return '';
        }
        return match;
    });

    // 2. Handle <start_model_model-id>...<end_model_model-id>
    // e.g. <start_model_gemini-2.5-flash>...<end_model_gemini-2.5-flash>
    result = result.replace(/<start_model_([^>\r\n]+)>([\s\S]*?)<end_model_([^>\r\n]+)>/gi, (match, startTag, innerContent, endTag) => {
        if (startTag.trim().toLowerCase() === endTag.trim().toLowerCase()) {
            if (currentModelId && startTag.trim().toLowerCase() === currentModelId) {
                return innerContent;
            }
            return '';
        }
        return match;
    });

    return result;
};

// Ensure standard about skill is created before reading instructions/skills
createAboutSkill();
export let localFluxflowMD = readLocalInstruction();

const parseSkillFrontmatter = (content) => {
    if (!content) return null;
    const match = content.match(/^\s*---\r?\n([\s\S]*?)\r?\n---(?:\r?\n)?([\s\S]*)$/);
    if (!match) return null;
    const frontmatter = match[1];
    const body = (match[2] || '').trim();
    if (body.length === 0) return null;

    let name = '';
    let description = '';

    const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
    const descMatch = frontmatter.match(/^description:\s*(.+)$/m);

    if (nameMatch) {
        name = nameMatch[1].trim().replace(/^["']|["']$/g, '');
    }
    if (descMatch) {
        description = descMatch[1].trim().replace(/^["']|["']$/g, '');
    }

    if (name && description) {
        return { name, description };
    }
    return null;
};

const findSkillFiles = (baseDir) => {
    const results = [];
    if (!baseDir || !fs.existsSync(baseDir)) return results;

    const traverse = (dir, depth = 0) => {
        if (depth > 5) return;
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                const lowerName = entry.name.toLowerCase();
                if (entry.isFile()) {
                    if (lowerName === 'skill.md') {
                        results.push(fullPath);
                    }
                } else if (entry.isDirectory()) {
                    if (depth === 0) {
                        if (lowerName === 'skills' || lowerName === '.skills' || lowerName === 'skill' || lowerName === '.skill') {
                            traverse(fullPath, depth + 1);
                        }
                    } else {
                        traverse(fullPath, depth + 1);
                    }
                }
            }
        } catch (e) {}
    };

    traverse(baseDir, 0);
    return results;
};

const loadSkillsFromDir = (dir) => {
    const files = findSkillFiles(dir);
    const skills = [];
    for (const filePath of files) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const meta = parseSkillFrontmatter(content);
            if (meta) {
                skills.push({ ...meta, filePath });
            }
        } catch (e) {}
    }
    return skills;
};

const formatSkillsPrompt = (skills) => {
    if (!skills || skills.length === 0) return '';
    return skills.map(s => `- ${s.name}: ${s.description}`).join('\n');
};

export const globalSkills = loadSkillsFromDir(FLUXFLOW_DIR);
export const localSkills = loadSkillsFromDir(process.cwd());

export const globalSkillsPrompt = formatSkillsPrompt(globalSkills);
export const localSkillsPrompt = formatSkillsPrompt(localSkills);

// Filter helper: exclude system-generated docs skill from UI count and summary
const isSystemDocsSkill = (s) => {
    if (!s) return false;
    const norm = (s.filePath || '').replace(/\\/g, '/').toLowerCase();
    return norm.includes('/skills/fluxflow/skill.md') || norm.includes('/skills/about-fluxflow/skill.md') || s.name?.toLowerCase() === 'fluxflow';
};

const getUIGlobalSkills = () => (globalSkills || []).filter(s => !isSystemDocsSkill(s));
const getUILocalSkills = () => (localSkills || []).filter(s => !isSystemDocsSkill(s));

export const loadedFilesCount = (globalFluxflowMD ? 1 : 0) + (localFluxflowMD ? 1 : 0) + getUIGlobalSkills().length + getUILocalSkills().length;

const formatPathForUI = (filePath, scope = 'Project') => {
    if (!filePath) return '';
    const normalized = filePath.replace(/\\/g, '/');
    if (scope === 'Global') {
        const home = os.homedir().replace(/\\/g, '/');
        if (normalized.toLowerCase().startsWith(home.toLowerCase())) {
            return '~' + normalized.slice(home.length);
        }
        return normalized;
    }
    const rel = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
    return rel.startsWith('.') ? rel : `./${rel}`;
};

export const getLoadedFilesSummary = () => {
    globalFluxflowMD = readGlobalInstruction();
    localFluxflowMD = readLocalInstruction();
    const instructions = [];
    if (globalFluxflowPath && globalFluxflowMD.length > 0) {
        instructions.push({ scope: 'Global', path: globalFluxflowPath });
    }
    if (localFluxflowPath && localFluxflowMD.length > 0) {
        instructions.push({ scope: 'Project', path: localFluxflowPath });
    }

    const currentGlobalSkills = getUIGlobalSkills();
    const currentLocalSkills = getUILocalSkills();

    const totalCount = instructions.length + currentGlobalSkills.length + currentLocalSkills.length;

    if (totalCount === 0) {
        return `✦ Loaded Files & Instructions\n⠀⠀\x1b[2m└─\x1b[22m No instruction or skill files are currently loaded.\n⠀`;
    }

    const lines = [];
    lines.push(`✦ Loaded Files & Instructions (${totalCount} ${totalCount === 1 ? 'file' : 'files'} active)`);

    if (instructions.length > 0) {
        lines.push(`\n  \x1b[1mInstructions:\x1b[22m`);
        instructions.forEach(inst => {
            lines.push(`  • [${inst.scope}] ${formatPathForUI(inst.path, inst.scope)}`);
        });
    }

    if (currentGlobalSkills?.length > 0 || currentLocalSkills?.length > 0) {
        lines.push(`\n  \x1b[1mSkills:\x1b[22m`);
        if (currentGlobalSkills?.length > 0) {
            currentGlobalSkills.forEach(s => {
                lines.push(`  • [Global] \x1b[36m${s.name}\x1b[39m`);
                lines.push(`    \x1b[2m└─ ${formatPathForUI(s.filePath, 'Global')}\x1b[22m`);
            });
        }
        if (currentLocalSkills?.length > 0) {
            currentLocalSkills.forEach(s => {
                lines.push(`  • [Project] \x1b[36m${s.name}\x1b[39m`);
                lines.push(`    \x1b[2m└─ ${formatPathForUI(s.filePath, 'Project')}\x1b[22m`);
            });
        }
    }

    lines.push('⠀');
    return lines.join('\n');
};

let isSecondary = false;
(async () => {
    try {
        const settings = await loadSettings();
        if (Number(settings?.display) === 1) {
            const { default: screenshotDesktop } = await import('screenshot-desktop');
            const displays = await screenshotDesktop.listDisplays();
            if (displays && displays.length > 1) {
                isSecondary = true;
            }
        }
    } catch (e) {}
})();

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

export const getSystemInstruction = (profile, thinkingLevel, mode, systemSettings, isMemoryEnabled = true, isFirstPrompt = false, aiProvider = 'Google', isMultiModal = false, isGemini, chatId, keepReasoningContext = false, targetModel = '') => {
    // console.log(systemSettings)

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
        thinkingConfig = thinkingConfig.replace('Effort: High', `Effort: ${MAP_FOR_NON_GOOGLE_OR_GEMINI[thinkingLevel]}`);


        if (thinkingLevel === 'Fast') {
            thinkingConfig = "Effort: Lowest\nNo thinking. Immediate response\nVerify imports, tool results & system stability; avoid syntax errors"
        } else if (thinkingLevel === 'Low') {
            thinkingConfig = "Effort: Low\nQuick, focused thinking, intent & complexity, required tools/files/actions, before acting\nDont waste tokens, be efficient, use least thinking tokens, focus on result\nGather useful context\nBrief thoughts, think only enough to avoid mistakes, verify imports, tool results & system stability; avoid syntax errors"
        }
    }

    // fs.writeFileSync('level.txt', thinkingLevel);

    const userInstrStr = profile.instructions && profile.instructions?.length > 0 ? `User Preferences: ${profile.instructions}\n\n` : '';
    const nicknameStr = profile.nickname && profile.nickname?.length > 0 ? `User Nickname: ${profile.nickname}\n${userInstrStr.length ? '' : '\n'}` : '';
    const nameStr = profile.name && profile.name?.length > 0 ? `User Name: ${profile.name}\n${(nicknameStr.length || userInstrStr.length) ? '' : '\n'}` : '';
    const cwdStr = process.cwd();

    const userMemories = getCachedUserMemories(chatId, isMemoryEnabled);
    const userMemoriesStr = userMemories?.length > 0 ? `--- Saved Memories ---\n${userMemories}\n\n` : '';

    refreshInstructionsForTarget(aiProvider, targetModel);

    const filteredGlobalMD = filterModelConditionalTags(globalFluxflowMD, targetModel, aiProvider).trim();
    const filteredLocalMD = filterModelConditionalTags(localFluxflowMD, targetModel, aiProvider).trim();

    // const additionalInstructions = [globalFluxflowMD, localFluxflowMD].filter(Boolean).join('\n\n');
    const additionalInstrStr = filteredGlobalMD.length > 0 || filteredLocalMD.length > 0 ? `--- Additional Instructions ---\n${filteredGlobalMD.length > 0 ? `-- Global --\n${filteredGlobalMD}` : ''}${filteredLocalMD.length > 0 ? `${filteredGlobalMD.length > 0 ? '\n\n' : ''}-- Project --\n${filteredLocalMD}` : ''}\n\n` : '';

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

    // --MARKERS --
    // - TOOL SYSTEM: [TOOL RESULT]
    // - SYSTEM NOTIFICATION: [SYSTEM] in user turn

    // ${ mode === "Flux" ? "Logical, task-driven. Prioritize scalable, modular architecture, clean abstractions, stepwise execution. Use latest practices/libraries, verify imports, run automated tests" : `Mode: ${mode}. Concise, Humorous, Sarcastic` }

    function normaliseThinkingLevel(thinkingLevel) {
        const map = {
            Low: 'Low',
            Standard: 'Medium',
            Medium: 'Medium',
            High: 'High',
            xHigh: 'Extended',
            Max: 'Max'
        };

        return map[thinkingLevel] ?? '';
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const day = String(now.getDate()).padStart(2, '0');
    const dateTimeStr = `${year}-${month}-${day}`;
    const isMetadataOff = !!systemSettings?.autoExcludeMetadata;

    const userHasWayyTooMuchMoney = process.env.I_HAVE_TOO_MUCH_MONEY === "true" || process.env.I_HAVE_TOO_MUCH_MONEY === true || false;

    const isNoDev = process.env.NO_DEV === 'true' || process.env.NO_DEV === '1' || process.env.NO_DEV === true || false;

    return `${userHasWayyTooMuchMoney ? `${(() => {
        return ' '.repeat(Math.floor(Math.random() * 4) + 1);
    })()}` : ''}=== SYSTEM PROMPT ===
Identity: ${ADD_ID.length > 1 ? ADD_ID : 'Flux Flow. Sassy, Friendly, CLI Assistant'}
${ADD_NO_INS ? '' : `${mode === "Flux" ? "Stepwise Execution, Run Automated Tests. Task Completion" :
mode === "Flow" ? `Concise, Humorous, Sarcastic` :
mode === "ICU" ? "Computer Use Capabilities. Screenshot as ground truth, analyze grid ids overlapping/close to target, keyboard shortcuts > mouse clicks" :
"Computer Use & Workspace Capabilities. Screenshot as ground truth, analyze grid ids overlapping/close to target, keyboard shortcuts > mouse clicks. Workspace Tools if faster. Focus on Productivity"}`}${isSecondary && mode.toLowerCase().includes('cu') ? '\n- Running on secondary screen. Opened app not visible in screenshot? Might be opened on primary. Use \'AskUser\' with NO options and tell user to move app window to secondary' : ''}

- OS: ${osDetected}${!isNoDev && targetModel.length > 1 ? `\n- Model: ${path.basename(targetModel.trim())} ${normaliseThinkingLevel(thinkingLevel)}`.trimEnd() : ''}${isMetadataOff ? `\n- Date: ${dateTimeStr}` : ''}${isMemoryEnabled ? '\n- Use relative time reference eg. few mins ago\n-- Chat Context > Metadata' : ''}${additionalInstrStr.length > 0 ? '\n- Additional Instructions ≈ System Prompt' : ''}${(globalSkillsPrompt.length > 0 || localSkillsPrompt.length > 0) && mode.toLowerCase().includes('flux') ? '\n- Read available relevant skills for tasks before proceeding: Use ReadFile, with virtual path=\"#skills/{global|project}/skillName\". For references: path=\"#skills/{global|project}/skillName/references/<file-name>.md\"' : ''}

-- THINKING GUIDANCE --
${(aiProvider === 'Mistral' || (aiProvider === 'Google' && !isGemini)) ? `${thinkingConfig}
${forcedReasoning || (thinkingLevel !== 'Fast' && ((aiProvider === 'Mistral' && !isGemini) || (thinkingLevel !== 'xHigh' && !isGemini))) ? `critical thinking policy
Use <think>...</think> for reasoning before responding any queries\n` : ''}` : `${thinkingConfig}\n`}${!keepReasoningContext ? 'Mandatory: Before calling tools, MUST provide a high level summary of your reasoning, plans, decisions, and next course of actions in chat\n' : ''}No text after tool call in same turn\n
${TOOL_PROTOCOL(mode, osDetected, isMultiModal, aiProvider, systemSettings?.advanceRollback, systemSettings?.subAgents !== false, !!systemSettings?.autoExec)}${isMemoryEnabled ? `\n\n-- MEMORY RULES --
- Subtly Personalize with relevent contextual memories. Auto Saves\n` : ''}${mode === 'Flux' ? '' : mode.toLowerCase().includes('cu') ? '\n\n-- SECURITY POLICIES --\n- Dont operate on ANY confidential screens\n' : ''}${mode === 'Flow' ? '\n\n-- CHAT FORMATTING --\n- use kaomojis heavily' : ''}
=== END SYSTEM PROMPT ===

${nameStr}${nicknameStr}${userInstrStr}${additionalInstrStr}${globalSkillsPrompt.length > 0 && mode.toLowerCase().includes('flux') ? `-- Global Skills --\n${globalSkillsPrompt}\n\n` : ''}${localSkillsPrompt.length > 0 && mode.toLowerCase().includes('flux') ? `-- Project Skills --\n${localSkillsPrompt}\n\n` : ''}${userMemoriesStr}`.trim();
};

// -- SECURITY RULES --${systemSettings.allowExternalAccess ? '' : '\n- ACCESS CONTROL: CWD only'}
// -- SECURITY POLICIES --\n- Sensitive files? Ask before Read\n

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
