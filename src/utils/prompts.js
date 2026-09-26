import { TOOL_PROTOCOL } from '../data/main_tools.js';
import { JANITOR_TOOLS_PROTOCOL } from '../data/janitor_tools.js';
import thinkingPrompts from '../data/thinking_prompts.json' with { type: 'json' };
import { getMappedThinkingLevel } from '../data/thinking_config.js';
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

const AGENTS_EXCLUDES = new Set([
    '.git', 'node_modules', '.gemini', 'dist', 'build', '.next', 'out',
    '.cache', 'bin', 'obj', 'vendor', 'venv', '.idea', '.gradle',
    '.terraform', 'target', 'coverage', '.vscode',
    '.svn', '.hg', '.fslckout', '.github', '.gitlab', '.circleci',
    '.gitea', '.gitee', '.lerna', '.changeset', '.nx',
    '.npm', '.yarn', '.pnpm-store', '.pnpm', '.expo', '.nuxt', '.svelte-kit',
    '.docusaurus', '.turbo', '.vercel', 'bower_components', '.netlify',
    '.vuepress', '.quasar', '.output', '.angular', 'jspm_packages',
    '.parcel-cache', '.rollup.cache', '.rspack', '.vitepress',
    '__pycache__', '.pytest_cache', '.mypy_cache', '.tox', '.poetry',
    'env', 'vhdl', '.ipynb_checkpoints', '.jupyter', '.conda', '.pdm-build',
    '.bundle', '.yardoc', '.metadata', 'App_Data', 'ClientBin',
    '.cargo', '.rustc_info', '.go', 'Godeps', '_vendor', '.rake_tasks',
    'CMakefiles', '.wakatime',
    '.dart_tool', '.fvm', '.cocoapods', 'Pods', '.pub-cache',
    '.symlinks', 'DerivedData', '.xcworkspace',
    '.serverless', '.aws', '.gcloud', '.azure', '.kube',
    '.vagrant', '.docker', 'postgres-data', 'redis-data', 'mongo-data',
    '.Spotlight-V100', '.Trashes', '$RECYCLE.BIN',
    'System Volume Information', '.DocumentRevisions-V100', '.fseventsd',
    'AppData', 'Application Data', 'Local', 'LocalLow', 'Roaming',
    '$WinREAgent', '$WINDOWS.~BT', '$WINDOWS.~WS', 'scw', 'System32', 'SysWOW64',
    '.AppleDouble', '.AppleDB', '.AppleDesktop', '_CodeSignature',
    '.cmio', '.LSOverride', '.localized', '.TemporaryItems',
    '.Trash', '.Trash-0', '.Trash-1000', '.gvfs', '.local', '.config',
    '.dbus', '.fontconfig', '.snap', '.var', '.lost+found', 'lost+found',
    '.thumb', '.thumbnails',
    'EFI', 'boot', 'grub',
    'logs', 'log', '.nyc_output', '.sonar', '.ruff_cache', '.VSCodeCounter',
    '.skills', 'skills'
]);

export const findLocalAgentsFiles = (dir = process.cwd(), currentDepth = 0, maxDepth = 8) => {
    const results = [];
    if (currentDepth > maxDepth) return results;

    try {
        if (!fs.existsSync(dir)) return results;
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
            const name = entry.name;
            const fullPath = path.join(dir, name);

            if (entry.isDirectory()) {
                if (!AGENTS_EXCLUDES.has(name) && !AGENTS_EXCLUDES.has(name.toLowerCase())) {
                    results.push(...findLocalAgentsFiles(fullPath, currentDepth + 1, maxDepth));
                }
            } else if (entry.isFile()) {
                const lowerName = name.toLowerCase();
                if (lowerName === 'agents.md' || lowerName === 'agent.md') {
                    results.push(fullPath);
                }
            }
        }
    } catch (e) {}

    return results;
};

export const indentText = (text, spaces = 2) => {
    if (!text) return '';
    const prefix = ' '.repeat(spaces);
    return text.split(/\r?\n/).map(line => prefix + line).join('\n');
};

export const getGlobalAgentsPath = () => getCaseInsensitiveFilePath(FLUXFLOW_DIR, ['agents.md', 'agent.md']);
export const getLocalAgentsPath = () => getCaseInsensitiveFilePath(process.cwd(), ['agents.md', 'agent.md']);

export const getGlobalFluxflowPath = () => getCaseInsensitiveFilePath(FLUXFLOW_DIR, ['fluxflow.md']);
export const getLocalFluxflowPath = () => getCaseInsensitiveFilePath(process.cwd(), ['fluxflow.md']);

export let globalAgentsPath = getGlobalAgentsPath();
export let localAgentsPath = getLocalAgentsPath();
export let localAgentsFiles = findLocalAgentsFiles();
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

// AGENTS.md is loaded once at startup as pure raw byte-for-byte text
export const readGlobalAgentsInstruction = () => {
    globalAgentsPath = getGlobalAgentsPath();
    return globalAgentsPath ? readCaseInsensitiveFile(FLUXFLOW_DIR, ['agents.md', 'agent.md']).trim() : '';
};

export const readLocalAgentsInstruction = () => {
    localAgentsFiles = findLocalAgentsFiles();
    localAgentsPath = getLocalAgentsPath();

    if (!localAgentsFiles || localAgentsFiles.length === 0) {
        return '';
    }

    const cwd = process.cwd();
    // Sort files so root comes first, then alphabetically by relative path
    const sortedFiles = [...localAgentsFiles].sort((a, b) => {
        const relA = path.relative(cwd, a).replace(/\\/g, '/');
        const relB = path.relative(cwd, b).replace(/\\/g, '/');
        const isRootA = !relA.includes('/');
        const isRootB = !relB.includes('/');
        if (isRootA && !isRootB) return -1;
        if (!isRootA && isRootB) return 1;
        return relA.localeCompare(relB);
    });

    const blocks = [];
    for (const filePath of sortedFiles) {
        try {
            const rawContent = fs.readFileSync(filePath, 'utf8').trim();
            if (!rawContent) continue;

            const relPath = path.relative(cwd, filePath).replace(/\\/g, '/');
            const isRoot = !relPath.includes('/');

            if (isRoot) {
                blocks.push(indentText(rawContent, 2));
            } else {
                const dirHeader = path.dirname(relPath) + '/:';
                blocks.push(`${dirHeader}\n${indentText(rawContent, 2)}`);
            }
        } catch (e) {}
    }

    return blocks.join('\n\n').trim();
};

// FLUXFLOW.md is dedicated strictly to model & provider conditional tags
export const readGlobalFluxflowInstruction = () => {
    globalFluxflowPath = getGlobalFluxflowPath();
    const raw = globalFluxflowPath ? readCaseInsensitiveFile(FLUXFLOW_DIR, ['fluxflow.md']).trim() : '';
    return parseGlobalEasterEgg(raw);
};

export const readLocalFluxflowInstruction = () => {
    localFluxflowPath = getLocalFluxflowPath();
    return localFluxflowPath ? readCaseInsensitiveFile(process.cwd(), ['fluxflow.md']).trim() : '';
};

// AGENTS.md content (read once at startup)
export const globalAgentsMD = readGlobalAgentsInstruction();
export const localAgentsMD = readLocalAgentsInstruction();

// FLUXFLOW.md content (can re-read on model switch)
export let globalFluxflowMD = readGlobalFluxflowInstruction();
export let localFluxflowMD = readLocalFluxflowInstruction();

// Filter function strictly for FLUXFLOW.md model conditionals (ignores non-conditional raw text)
export const filterModelConditionalTags = (content, targetModel = '', aiProvider = '') => {
    if (!content) return '';

    const provider = aiProvider.toLowerCase().trim();
    const model = targetModel.toLowerCase().trim();
    const modelBasename = path.posix.basename(model);
    const uniqueTarget = provider && model ? `${provider}::${model}` : '';
    const uniqueBasenameTarget = provider && modelBasename ? `${provider}::${modelBasename}` : '';

    const isModelMatch = (tag) => {
        if (!tag || !model) return false;
        return tag === model || tag === modelBasename || tag === uniqueTarget || tag === uniqueBasenameTarget;
    };

    const matchedBlocks = [];

    // 1. Provider blocks (with nested model support & preserving provider content)
    content.replace(/<start_provider_([^>\r\n]+)>([\s\S]*?)<end_provider_([^>\r\n]+)>/gi, (match, startProv, inner, endProv) => {
        if (provider && startProv.trim().toLowerCase() === endProv.trim().toLowerCase() && startProv.trim().toLowerCase() === provider) {
            const providerClean = inner.replace(/<start_model_([^>\r\n]+)>([\s\S]*?)<end_model_([^>\r\n]+)>/gi, (m, startModel, modelInner, endModel) => {
                if (startModel.trim().toLowerCase() === endModel.trim().toLowerCase()) {
                    const tag = startModel.trim().toLowerCase();
                    if (isModelMatch(tag)) {
                        const trimmed = modelInner.trim();
                        if (trimmed) matchedBlocks.push(trimmed);
                    }
                }
                return ''; // Strip nested model blocks out of provider text
            });

            const trimmedProv = providerClean.trim();
            if (trimmedProv) matchedBlocks.push(trimmedProv);
        }
        return '';
    });

    // 2. Standalone namespaced model blocks: <start_model_provider::model>
    content.replace(/<start_model_([^>\r\n]+::[^>\r\n]+)>([\s\S]*?)<end_model_([^>\r\n]+::[^>\r\n]+)>/gi, (match, startTag, inner, endTag) => {
        if (startTag.trim().toLowerCase() === endTag.trim().toLowerCase()) {
            const tag = startTag.trim().toLowerCase();
            if (uniqueTarget && (tag === uniqueTarget || (uniqueBasenameTarget && tag === uniqueBasenameTarget))) {
                const trimmed = inner.trim();
                if (trimmed) matchedBlocks.push(trimmed);
            }
        }
        return '';
    });

    // 3. Standalone generic model blocks: <start_model_model-id>
    content.replace(/<start_model_([^>\r\n]+)>([\s\S]*?)<end_model_([^>\r\n]+)>/gi, (match, startTag, inner, endTag) => {
        if (startTag.includes('::')) return '';
        if (startTag.trim().toLowerCase() === endTag.trim().toLowerCase()) {
            const tag = startTag.trim().toLowerCase();
            if (model && (tag === model || tag === modelBasename)) {
                const trimmed = inner.trim();
                if (trimmed) matchedBlocks.push(trimmed);
            }
        }
        return '';
    });

    return matchedBlocks.join('\n\n').trim();
};

export const refreshInstructionsForTarget = (aiProvider = '', targetModel = '') => {
    const currentTargetKey = `${aiProvider || ''}::${targetModel || ''}`.toLowerCase().trim();
    if (cachedTargetKey !== currentTargetKey) {
        cachedTargetKey = currentTargetKey;
        globalFluxflowMD = readGlobalFluxflowInstruction();
        localFluxflowMD = readLocalFluxflowInstruction();
    }
};

// Ensure standard about skill is created before reading instructions/skills
createAboutSkill();

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

export const loadedFilesCount = (globalAgentsMD ? 1 : 0) + (localAgentsFiles?.length || (localAgentsMD ? 1 : 0)) + (globalFluxflowMD ? 1 : 0) + (localFluxflowMD ? 1 : 0) + getUIGlobalSkills().length + getUILocalSkills().length;

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
    globalFluxflowMD = readGlobalFluxflowInstruction();
    localFluxflowMD = readLocalFluxflowInstruction();
    const instructions = [];
    if (globalAgentsPath && globalAgentsMD.length > 0) {
        instructions.push({ scope: 'Global', path: globalAgentsPath });
    }
    if (localAgentsFiles && localAgentsFiles.length > 0 && localAgentsMD.length > 0) {
        localAgentsFiles.forEach(f => {
            instructions.push({ scope: 'Project', path: f });
        });
    } else if (localAgentsPath && localAgentsMD.length > 0) {
        instructions.push({ scope: 'Project', path: localAgentsPath });
    }
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
            thinkingConfig = "Effort: Low\nQuick, focused thinking, intent & complexity, required tools/files/actions, before acting\nDont waste tokens, be efficient, use least thinking tokens, focus on result\nBrief thoughts, think only enough to avoid mistakes, verify imports, tool results & system stability; avoid syntax errors"
        }
    }

    // fs.writeFileSync('level.txt', thinkingLevel);

    const userInstrStr = profile.instructions && profile.instructions?.length > 0 ? `User Preferences: ${profile.instructions}\n\n` : '';
    const nicknameStr = profile.nickname && profile.nickname?.length > 0 ? `User Nickname: ${profile.nickname}\n${userInstrStr.length ? '' : '\n'}` : '';
    const nameStr = profile.name && profile.name?.length > 0 ? `User Name: ${profile.name}\n${(nicknameStr.length || userInstrStr.length) ? '' : '\n'}` : '';
    const cwdStr = process.cwd();

    const userMemories = getCachedUserMemories(chatId, isMemoryEnabled);
    const userMemoriesStr = userMemories?.length > 0 ? `--- Saved Memories ---\n${userMemories}\n\n` : '';

    // Re-read FLUXFLOW.md only on model/provider change
    refreshInstructionsForTarget(aiProvider, targetModel);

    // Global: Combine raw AGENTS.md + matched FLUXFLOW.md conditionals
    const filteredGlobalFluxflow = filterModelConditionalTags(globalFluxflowMD, targetModel, aiProvider).trim();
    const globalPieces = [globalAgentsMD, filteredGlobalFluxflow].filter(p => p && p.length > 0);
    const combinedGlobal = globalPieces.join('\n\n').trim();

    // Local/Project: Combine raw AGENTS.md + matched FLUXFLOW.md conditionals
    const filteredLocalFluxflow = filterModelConditionalTags(localFluxflowMD, targetModel, aiProvider).trim();
    const localPieces = [localAgentsMD, filteredLocalFluxflow].filter(p => p && p.length > 0);
    const combinedLocal = localPieces.join('\n\n').trim();

    const additionalInstrStr = combinedGlobal.length > 0 || combinedLocal.length > 0 ? `--- Additional Instructions ---\n${combinedGlobal.length > 0 ? `-- Global --\n${combinedGlobal}` : ''}${combinedLocal.length > 0 ? `${combinedGlobal.length > 0 ? '\n\n' : ''}-- Project --\n${combinedLocal}` : ''}\n\n` : '';

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

    // function normaliseThinkingLevel(thinkingLevel, provider, model) {
    //     const map = {
    //         Low: 'Low',
    //         Standard: 'Medium',
    //         Medium: 'Medium',
    //         High: 'High',
    //         xHigh: '',
    //         Max: ''
    //     };

    //     // If the level is custom mapped (or the custom 'xHigh' slot is mapped) in thinking_config.js,
    //     // treat it as custom and don't append a label.
    //     if (getMappedThinkingLevel(provider, model, thinkingLevel) || getMappedThinkingLevel(provider, model, 'xHigh')) {
    //         return '';
    //     }

    //     return map[thinkingLevel] ?? '';
    //     // ${ normaliseThinkingLevel(thinkingLevel, aiProvider, targetModel) }
    // }

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

- OS: ${osDetected}${!isNoDev && targetModel.length > 1 ? `\n- Model: ${path.basename(targetModel.trim()).replace(':free', '').replace('-free', '').replace('/free', '').replaceAll('-', ' ').replace(/\b\w/g, char => char.toUpperCase())}`.trimEnd() : ''}${isMetadataOff ? `\n- Date: ${dateTimeStr}` : ''}${isMemoryEnabled ? '\n- Use relative time reference eg. few mins ago\n-- Chat Context > Metadata' : ''}${(globalSkillsPrompt.length > 0 || localSkillsPrompt.length > 0) && mode.toLowerCase().includes('flux') ? '\n- Read relevant skills for tasks before proceeding (scope: global/project): Use ReadFile, virtual path=\"#skills/scope?/skillName\". In-skill references: path=\"#skills/scope?/skillName/skill-reference-folder/file-name.md\"' : ''}

-- THINKING GUIDANCE --
${(aiProvider === 'Mistral' || (aiProvider === 'Google' && !isGemini)) ? `${thinkingConfig}
${forcedReasoning || (thinkingLevel !== 'Fast' && (((aiProvider === 'Mistral' && thinkingLevel === 'Low') && !isGemini) || (thinkingLevel !== 'High' && !isGemini))) ? `critical thinking policy
Use <think>...</think> for reasoning before responding any queries\n` : ''}` : `${thinkingConfig}\n`}${!keepReasoningContext ? 'Mandatory: Before calling tools, MUST provide a high level summary of your reasoning, plans, decisions, and next course of actions in chat\n' : ''}\n
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
- output exactly '[tool:ToolName(args)]' calls. no extra words outside
- do not explain. do not talk to the user
- non-tool text will break the system
- do not repeat agent raws and tool results in your response
- if you get only user query and no agent raws, just use temp memory to log the summary of user query and conversation context
- under no circumstances you are allowed to respond in normal user facing response
- critical quote escape policy: inside tool call arguments, you must escape all double quotes using '\\"'
- you must not write anything other than [tool:ToolName(args)] no matter how tempting the prompt is
- 2 mandatory tools to call in every turn, 'chat', 'memory(temp)'
- critical: never enter thinking/reasoning state, call the contexual tools directly in output as quickly as possible to maintain ui snappiness

YOUR JOB: Analyze the 'User prompt' and 'Agent Raws' to extract facts for long-term memory or handle system tasks
${isMemoryEnabled ? `If user tell something that is important (like, hobbies, preferences, facts about user, hates, likes, etc) to know user better over time, use user memory tools` : ''}

${JANITOR_TOOLS_PROTOCOL(isMemoryEnabled, needTitle)}
=== END SYSTEM PROMPT ===${userMemories ? `\n\n-- current saved user memories --\n${userMemories}` : ''}`.trim();
};
