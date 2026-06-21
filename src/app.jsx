import os from 'os';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import fs from 'fs-extra';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { MultilineInput } from './components/MultilineInput.jsx';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';
import ChatLayout, { MessageItem, CodeRenderer } from './components/ChatLayout.jsx';
import StatusBar from './components/StatusBar.jsx';
import CommandMenu from './components/CommandMenu.jsx';
import SettingsMenu from './components/SettingsMenu.jsx';
import ProfileForm from './components/ProfileForm.jsx';
import AskUserModal from './components/AskUserModal.jsx';
import gradient from 'gradient-string';
import { getAPIKey, saveAPIKey, removeAPIKey, getProviderAPIKey, saveProviderAPIKey } from './utils/secrets.js';
import { initAI, getAIStream, signalTermination, runJanitorTask, compressHistory, deleteChatSummary } from './utils/ai.js';
import { loadSettings, saveSettings } from './utils/settings.js';
import { loadHistory, saveChat, deleteChat, generateChatId, cleanupOldHistory, cleanupOldLogs, saveChatContext, loadChatContext } from './utils/history.js';
import ResumeModal from './components/ResumeModal.jsx';
import MemoryModal from './components/MemoryModal.jsx';
import UpdateProcessor from './components/UpdateProcessor.jsx';
import ParserDownloadModal from './components/ParserDownloadModal.jsx';
import { RevertManager } from './utils/revert.js';
import { GEMINI_QUOTES } from './data/gemini_quotes.js';
import { WITTY_LOADING_PHRASES } from './data/witty_phrases.js';
import RevertModal from './components/RevertModal.jsx';
import { getDailyUsage, getMonthlyUsage, getCustomPeriodUsage, addToUsage, initUsage, forceFlushUsage, getImageQuotaStats } from './utils/usage.js';
import { TerminalBox } from './components/TerminalBox.jsx';
import { parseArgs } from './utils/arg_parser.js';
import { FLUXFLOW_DIR, LOGS_DIR, SECRET_DIR, SETTINGS_FILE } from './utils/paths.js';
import { emojiSpace, getFluxLogo } from './utils/terminal.js';
import { writeToActiveCommand, terminateActiveCommand, isActiveCommandPty, cleanTerminalOutput } from './tools/exec_command.js';
import { checkPuppeteerReady, installPuppeteerBrowser } from './utils/setup.js';
import { formatTokens } from './utils/text.js';
import { isBridgeConnected, initBridge, sendStatus } from './utils/editor.js';

const getIDEName = () => {
    const termProgram = (process.env.TERM_PROGRAM || '').toLowerCase();

    // 1. Direct high-priority terminal check
    if (process.env.WT_SESSION) return 'Windows Terminal';

    // 2. Helper for safer string searching (ignores paths/noisy keys)
    const inEnvVars = (target) => {
        const query = target.toLowerCase();
        for (const [key, val] of Object.entries(process.env)) {
            if (['PATH', 'PWD', 'CWD', 'PS1', 'LS_COLORS', 'PROMPT'].includes(key)) continue;
            if (String(val).toLowerCase().includes(query)) return true;
        }
        return false;
    };

    // 3. IDE Forks (Must check BEFORE generic 'vscode')
    if (termProgram === 'cursor' || process.env.CURSOR_SETTINGS_DIR || inEnvVars('cursor')) return 'Cursor';
    if (termProgram === 'windsurf' || inEnvVars('windsurf')) return 'Windsurf';
    if (inEnvVars('antigravity')) return 'Antigravity';
    if (termProgram === 'trae' || inEnvVars('trae')) return 'Trae';
    if (termProgram === 'codium' || inEnvVars('codium') || inEnvVars('vscode-oss')) return 'VSCodium';
    if (inEnvVars('positron')) return 'Positron';

    // 4. Standard VS Code & Insiders
    if (termProgram === 'vscode-insiders' || inEnvVars('insiders')) return 'VS Code Insiders';
    if (termProgram === 'vscode' || process.env.VSCODE_GIT_IPC_HANDLE || inEnvVars('vscode')) return 'VS Code';

    // 5. Other
    if (process.env.INTELLIJ_TERMINAL_COMMAND_BLOCKS || inEnvVars('intellij')) return 'JetBrains';

    return 'Terminal';
};

const getIDEDirName = (ideName) => {
    switch (ideName) {
        case 'VS Code': return 'Code';
        case 'VS Code Insiders': return 'Code - Insiders';
        case 'Antigravity': return 'Antigravity IDE';
        default: return ideName;
    }
};

const getKeybindingsPath = (ideName) => {
    const dirName = getIDEDirName(ideName);
    const home = os.homedir();
    if (process.platform === 'win32') {
        const appData = process.env.APPDATA;
        if (!appData) return null;
        return path.join(appData, dirName, 'User', 'keybindings.json');
    } else if (process.platform === 'darwin') {
        return path.join(home, 'Library', 'Application Support', dirName, 'User', 'keybindings.json');
    } else {
        return path.join(home, '.config', dirName, 'User', 'keybindings.json');
    }
};

const parseJsonc = (content) => {
    const clean = content.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1');
    return JSON.parse(clean);
};

const hasShiftEnterBinding = (bindings) => {
    if (!Array.isArray(bindings)) return false;
    return bindings.some(b =>
        b &&
        typeof b.key === 'string' &&
        b.key.toLowerCase().replace(/\s+/g, '') === 'shift+enter' &&
        b.command === 'workbench.action.terminal.sendSequence' &&
        b.args &&
        b.args.text === '\u001b[13;2u' &&
        typeof b.when === 'string' &&
        b.when.includes('terminalFocus')
    );
};

const getPromoOptions = (ideName) => {
    const isStandardVSCode = ideName === 'VS Code';
    const options = [];

    if (isStandardVSCode) {
        options.push({ label: 'Install Manually (VSIX)', url: 'https://github.com/KushalRoyChowdhury/fluxflow-cli/releases' });
        options.push({ label: 'Install from VS Code Marketplace', url: 'https://marketplace.visualstudio.com/items?itemName=fluxflow-cli.fluxflow-cli-companion' });
    } else {
        options.push({ label: `Download for ${ideName} (GitHub)`, url: 'https://github.com/KushalRoyChowdhury/fluxflow-cli/releases' });
    }

    options.push({ label: 'Continue to CLI only', action: 'dismiss' });
    return options;
};

const BridgePromo = ({ width, height, selectedIndex }) => {
    const ideName = getIDEName();
    const options = getPromoOptions(ideName);

    return (
        <Box
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            width={width}
            height={height}
        >
            <Box marginBottom={1} width={Math.min(80, width - 4)} justifyContent="flex-start">
                <Text>{getFluxLogo(versionFluxflow)}</Text>
            </Box>
            <Box flexDirection="column" borderStyle="double" borderColor="grey" paddingX={3} paddingY={1} width={Math.min(80, width - 4)}>
                <Text bold color="white" textAlign="center">🚀 UPGRADE YOUR WORKFLOW</Text>
                <Box marginY={1} flexDirection="column" alignItems="left">
                    <Text>You're in <Text bold color="cyan">{ideName}</Text>, but the <Text bold color="white">FluxFlow-CLI Companion</Text> is not installed.</Text>
                    <Box flexDirection="column" marginY={1}>
                        <Text color="gray">  ✅ Real-time IDE context & Error Resolution</Text>
                        <Text color="gray">  ✅ Auto-open files created by agent</Text>
                        <Text color="gray">  ✅ Native DIFFing for AI edits</Text>
                        <Text color="gray">  ✅ Direct IDE context sharing</Text>
                        <Text color="gray">  ✅ Surgical Diagnostic Sync</Text>
                        <Text color="gray">  ✅ Native Right-Click ❯ Chat integration</Text>
                        <Text color="gray">  ✅ Live Status in IDE</Text>
                        <Text color="gray">  ✅ Clickable terminal-to-code links</Text>
                    </Box>
                </Box>

                <Box flexDirection="column" marginTop={1}>
                    {options.map((opt, i) => (
                        <Box key={i}>
                            <Text color={selectedIndex === i ? "yellow" : "white"} bold={selectedIndex === i}>
                                {selectedIndex === i ? " ❯ " : "   "}
                                {opt.label}
                            </Text>
                        </Box>
                    ))}
                </Box>

                <Box marginTop={1} alignItems="center" justifyContent="center">
                    <Text dimColor italic>(Use arrows to navigate, Enter to select)</Text>
                </Box>
            </Box>
        </Box>
    );
};

// 1. RAW JS SESSION TRACKER (Vanilla JS for zero-render overhead)
const SESSION_START_TIME = Date.now();
const CHANGELOG_URL = 'https://fluxflow-cli.onrender.com/changelog';
const DOCS_URL = 'https://fluxflow-cli.onrender.com/';
let linesAdded = 0;
let linesRemoved = 0;

// Centralized Version Control: dynamically fetch version and date from package.json
const packageJsonPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const versionFluxflow = packageJson.version;
const updatedOn = packageJson.date || '2026-05-20';

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

const StatusSpinner = () => {
    const [tick, setTick] = useState(0);
    useEffect(() => {
        const interval = setInterval(() => {
            setTick(t => (t + 1) % 1000);
        }, 33);
        return () => clearInterval(interval);
    }, []);
    return <Text color="magenta">{SPINNER_FRAMES[Math.floor(tick / 3) % SPINNER_FRAMES.length]}</Text>;
};

const ResolutionModal = ({ data, onResolve, onEdit }) => (
    <Box flexDirection="column" borderStyle="round" borderColor="grey" padding={0} width="100%">
        <Box paddingX={1}>
            <Text color="white" bold underline>{data.startsWith('/btw') ? 'QUESTION' : 'STEERING HINT'} RESOLUTION</Text>
        </Box>
        <Box paddingX={1} marginTop={1}>
            <Text>The agent already finished the task before your {data.startsWith('/btw') ? 'question' : 'hint'} was consumed.</Text>
        </Box>
        <Box marginTop={1} backgroundColor="#222" paddingX={2} width="100%">
            <Text italic color="gray">"{data.replace('/btw', '').trim()}"</Text>
        </Box>
        <Box paddingX={1} marginTop={1}>
            <Text color="grey">How would you like to proceed?</Text>
        </Box>
        <Box marginTop={0}>
            <CommandMenu
                title="Select Action"
                items={[
                    { label: 'Send Anyway', value: 'send' },
                    { label: 'Edit Prompt', value: 'edit' }
                ]}
                onSelect={(val) => {
                    if (val === 'send') onResolve(data);
                    else onEdit(data);
                }}
            />
        </Box>
    </Box>
);


const parseAgentText = (text) => {
    const blocks = [];
    const toolRegex = /\[\s*tool:functions\.([a-z0-9_]+)\s*\(/gi;

    let lastIdx = 0;
    let match;
    while ((match = toolRegex.exec(text)) !== null) {
        const toolName = match[1];
        const startIdx = match.index + match[0].length - 1; // Index of '('

        let balance = 0;
        let inString = null;
        let endIdx = -1;
        let closingParenIdx = -1;

        for (let i = startIdx; i < text.length; i++) {
            const char = text[i];

            if (inString) {
                if (char === inString) {
                    // Check if escaped: count backslashes preceding this quote
                    let backslashCount = 0;
                    for (let j = i - 1; j >= 0 && text[j] === '\\'; j--) {
                        backslashCount++;
                    }
                    if (backslashCount % 2 === 0) {
                        inString = null;
                    }
                }
            } else {
                if (char === '"' || char === "'" || char === '`') {
                    inString = char;
                } else if (char === '(') {
                    balance++;
                } else if (char === ')') {
                    balance--;
                    if (balance === 0) {
                        closingParenIdx = i;
                        let j = i + 1;
                        while (j < text.length && /\s/.test(text[j])) j++;
                        if (j < text.length && text[j] === ']') {
                            endIdx = j;
                            break;
                        }
                    }
                }
            }
        }

        if (endIdx !== -1) {
            // Text before the tool call
            const beforeText = text.substring(lastIdx, match.index);
            if (beforeText.trim()) {
                blocks.push({ type: 'output', content: beforeText });
            }

            const finalArgsText = text.substring(startIdx + 1, closingParenIdx);
            blocks.push({
                type: 'tool',
                toolName: toolName.trim(),
                args: finalArgsText.trim()
            });

            lastIdx = endIdx + 1;
            toolRegex.lastIndex = lastIdx;
        } else {
            // If it didn't find a closing bracket, just break
            break;
        }
    }

    if (lastIdx < text.length) {
        const remainingText = text.substring(lastIdx);
        if (remainingText.trim()) {
            blocks.push({ type: 'output', content: remainingText });
        }
    }

    return blocks;
};

const getProjectFiles = (() => {
    let cachedFiles = null;
    let lastScanTime = 0;

    return (dir) => {
        const now = Date.now();
        if (cachedFiles && now - lastScanTime < 5000) { // Cache for 5 seconds
            return cachedFiles;
        }

        const fileList = [];
        const scan = (currentDir) => {
            try {
                const files = fs.readdirSync(currentDir);
                for (const file of files) {
                    if (['node_modules', '.git', '.gemini', 'dist', 'build', '.next', '.cache', 'out'].includes(file)) {
                        continue;
                    }
                    const filePath = path.join(currentDir, file);
                    const stat = fs.statSync(filePath);
                    if (stat.isDirectory()) {
                        scan(filePath);
                    } else {
                        fileList.push({
                            name: file,
                            relativePath: path.relative(process.cwd(), filePath)
                        });
                    }
                }
            } catch (e) {
                // Ignore errors
            }
        };

        scan(dir);
        cachedFiles = fileList;
        lastScanTime = now;
        return fileList;
    };
})();

let cachedShortcut = '\\ + Enter';

export default function App({ args = [] }) {
    const [confirmExit, setConfirmExit] = useState(false);
    const [exitCountdown, setExitCountdown] = useState(10);
    const { stdout } = useStdout();

    const [input, setInput] = useState('');
    const [inputKey, setInputKey] = useState(0);
    const [isExpanded, setIsExpanded] = useState(false);
    const [mode, setMode] = useState('Flux');
    const [terminalSize, setTerminalSize] = useState({
        columns: stdout?.columns || 80,
        rows: stdout?.rows || 24
    });

    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isFilePickerDismissed, setIsFilePickerDismissed] = useState(false);
    const [showBridgePromo, setShowBridgePromo] = useState(false);
    const [promoSelectedIndex, setPromoSelectedIndex] = useState(0);
    const suggestionOffsetRef = useRef(0);
    const persistedModelRef = useRef(null);
    useEffect(() => {
        const ideName = getIDEName();
        const isIDE = !['Terminal', 'Windows Terminal'].includes(ideName) || !!process.env.VSC_TERMINAL_URL;

        // Wait 500ms before showing promo to allow WebSocket to connect
        const graceTimer = setTimeout(() => {
            if (isIDE && !isBridgeConnected()) {
                setShowBridgePromo(true);
            }
        }, 500);

        // Keep checking connection
        const interval = setInterval(() => {
            if (isBridgeConnected()) {
                setShowBridgePromo(false);
            }
        }, 1000);

        return () => {
            clearTimeout(graceTimer);
            clearInterval(interval);
        };
    }, []);
    // Parse CLI startup arguments
    const parsedArgs = useMemo(() => {
        const parsed = {};
        // Pass 1: Parse --key first to determine default keys and potentially providers from suffixes
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            if (arg === '--key' && args[i + 1]) {
                const val = args[i + 1];
                parsed.key = val;
                if (val.includes('@')) {
                    const parts = val.split('@');
                    const keyPart = parts[0];
                    const provPart = parts[1].toLowerCase();
                    if (['google', 'deepseek', 'openrouter', 'nvidia'].includes(provPart)) {
                        let mapped = 'Google';
                        if (provPart === 'google') mapped = 'Google';
                        else if (provPart === 'deepseek') mapped = 'DeepSeek';
                        else if (provPart === 'openrouter') mapped = 'OpenRouter';
                        else if (provPart === 'nvidia') mapped = 'NVIDIA';
                        parsed.key = keyPart;
                        parsed.provider = mapped;
                    }
                }
            }
        }
        // Pass 2: Parse other arguments (and skip --key since it was already parsed)
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            if (arg === '--key') {
                i++; // Skip key value
                continue;
            }
            if (arg === '--model' && args[i + 1]) {
                parsed.model = args[i + 1];
                i++;
            } else if (arg === '--memory' && args[i + 1]) {
                parsed.memory = args[i + 1].toLowerCase();
                i++;
            } else if (arg === '--resume' && args[i + 1]) {
                parsed.resume = args[i + 1];
                i++;
            } else if (arg === '--package' && args[i + 1]) {
                const pkg = args[i + 1].toLowerCase();
                if (['npm', 'pnpm', 'yarn', 'bun'].includes(pkg)) {
                    parsed.package = pkg;
                }
                i++;
            } else if (arg === '--auto-del' && args[i + 1]) {
                const del = args[i + 1].toLowerCase();
                if (['1d', '7d', '30d'].includes(del)) {
                    parsed.autoDel = del;
                }
                i++;
            } else if (arg === '--auto-exec' && args[i + 1]) {
                parsed.autoExec = args[i + 1].toLowerCase();
                i++;
            } else if (arg === '--yolo' && args[i + 1]) {
                parsed.autoExec = args[i + 1].toLowerCase();
                i++;
            } else if (arg === '--external-access' && args[i + 1]) {
                parsed.externalAccess = args[i + 1].toLowerCase();
                i++;
            } else if (arg === '--mode' && args[i + 1]) {
                const val = args[i + 1];
                const lower = val.toLowerCase();
                if (['flux', 'flow'].includes(lower)) {
                    let mapped = 'Flux';
                    if (lower === 'flux') mapped = 'Flux';
                    else if (lower === 'flow') mapped = 'Flow';
                    parsed.mode = mapped;
                }
                i++;
            } else if (arg === '--thinking' && args[i + 1]) {
                const val = args[i + 1];
                const lower = val.toLowerCase();
                if (['fast', 'low', 'medium', 'high', 'xhigh', 'standard'].includes(lower)) {
                    let mapped = 'Medium';
                    if (lower === 'fast') mapped = 'Fast';
                    else if (lower === 'low') mapped = 'Low';
                    else if (lower === 'standard') mapped = 'Standard';
                    else if (lower === 'medium') mapped = 'Medium';
                    else if (lower === 'high') mapped = 'High';
                    else if (lower === 'xhigh') mapped = 'xHigh';
                    parsed.thinking = mapped;
                }
                i++;
            } else if (arg === '--provider' && args[i + 1]) {
                const val = args[i + 1].toLowerCase();
                if (['google', 'deepseek', 'openrouter', 'nvidia'].includes(val)) {
                    let mapped = 'Google';
                    if (val === 'google') mapped = 'Google';
                    else if (val === 'deepseek') mapped = 'DeepSeek';
                    else if (val === 'openrouter') mapped = 'OpenRouter';
                    else if (val === 'nvidia') mapped = 'NVIDIA';
                    parsed.provider = mapped;
                }
                i++;
            } else if ((arg === '--resume' || arg === '-r') && args[i + 1]) {
                parsed.resume = args[i + 1];
                i++;
            }
        }
        return parsed;
    }, [args]);

    const performVersionCheck = async (manual = false, settingsOverride = null) => {
        const settingsToUse = settingsOverride || systemSettings;
        if (manual) {
            setMessages(prev => {
                setCompletedIndex(prev.length + 1);
                return [...prev, { id: 'check-' + Date.now(), role: 'system', text: '🔍 Checking for updates...', isMeta: true }];
            });
        }
        try {
            const response = await fetch('https://registry.npmjs.org/fluxflow-cli', { cache: 'no-store' });
            const data = await response.json();
            const latestVersion = data['dist-tags']?.latest;
            const stableVersion = data['dist-tags']?.stable;
            if (latestVersion) setLatestVer(latestVersion);

            if (latestVersion && latestVersion !== versionFluxflow) {
                const versionDisplay = latestVersion === stableVersion ? `v${latestVersion}-stable` : `v${latestVersion}`;

                if (!manual && settingsToUse.autoUpdate) {
                    setActiveView('update');
                } else {
                    setMessages(prev => {
                        const newMsgs = [...prev];
                        // Splice after logo (0), welcome (1), and home warning (2 if exists)
                        const spliceIdx = manual ? newMsgs.length : Math.min(newMsgs.length, 3);
                        newMsgs.splice(spliceIdx, 0, {
                            id: 'update-' + Date.now(),
                            role: 'system',
                            text: `A new version (${versionDisplay}) is here.\n\n` +
                                `  • Type \`/update latest\` to apply the update.\n` +
                                `  • Type \`/changelog\` to view the release notes.`,
                            isUpdateNotification: true,
                            isMeta: true
                        });
                        return newMsgs;
                    });
                }
            } else if (manual) {
                setMessages(prev => {
                    setCompletedIndex(prev.length + 1);
                    const displayVer = latestVersion && latestVersion === stableVersion ? `${versionFluxflow}-stable` : versionFluxflow;
                    return [...prev, { id: 'uptodate-' + Date.now(), role: 'system', text: `[SYSTEM] Flux Flow is already up to date (${displayVer}).`, isMeta: true }];
                });
            }
        } catch (err) {
            if (manual) {
                setMessages(prev => {
                    setCompletedIndex(prev.length + 1);
                    return [...prev, { id: 'check-err-' + Date.now(), role: 'system', text: `ERROR: Failed to check for updates: ${err.message}`, isMeta: true }];
                });
            }
        }
    };

    useEffect(() => {
        const handleResize = () => {
            // Use a non-destructive clear to prevent title/mode reset
            stdout.write('\x1b[2J\x1b[3J\x1b[H');
            setTerminalSize({
                columns: stdout.columns,
                rows: stdout.rows
            });
        };

        stdout.on('resize', handleResize);
        return () => {
            stdout.off('resize', handleResize);
        };
    }, [stdout]);

    // ... (rest of the component logic)
    const [thinkingLevel, setThinkingLevel] = useState('Medium');
    const [aiProvider, setAiProvider] = useState('Google');
    const [setupStep, setSetupStep] = useState(0);
    const [latestVer, setLatestVer] = useState(null);
    const [showFullThinking, setShowFullThinking] = useState(false);
    const [activeModel, setActiveModel] = useState('gemma-4-31b-it');
    const [janitorModel, setJanitorModel] = useState('gemma-4-26b-a4b-it');
    const [isInitializing, setIsInitializing] = useState(true);
    const [isAppFocused, setIsAppFocused] = useState(true);
    const lastFocusEventTime = useRef(0);
    const [apiKey, setApiKey] = useState(null);
    const [tempKey, setTempKey] = useState('');

    const addShiftEnterBinding = async (ideName) => {
        const kbPath = getKeybindingsPath(ideName);
        if (!kbPath) return;
        try {
            await fs.ensureDir(path.dirname(kbPath));
            let bindings = [];
            if (fs.existsSync(kbPath)) {
                const content = fs.readFileSync(kbPath, 'utf8').trim();
                if (content) {
                    try {
                        bindings = parseJsonc(content);
                    } catch (e) {
                        bindings = [];
                    }
                }
            }
            if (!Array.isArray(bindings)) {
                bindings = [];
            }
            // Add the binding
            bindings.push({
                "key": "shift+enter",
                "command": "workbench.action.terminal.sendSequence",
                "args": {
                    "text": "\u001b[13;2u"
                },
                "when": "terminalFocus"
            });
            fs.writeFileSync(kbPath, JSON.stringify(bindings, null, 4), 'utf8');
            cachedShortcut = 'Shift + Enter';
            setMessages(prev => {
                setCompletedIndex(prev.length + 1);
                return [...prev, {
                    id: 'kb-success-' + Date.now(),
                    role: 'system',
                    text: `✅ Successfully configured Shift+Enter in your ${ideName} keybindings!`,
                    isMeta: true
                }];
            });
        } catch (err) {
            setMessages(prev => {
                setCompletedIndex(prev.length + 1);
                return [...prev, {
                    id: 'kb-error-' + Date.now(),
                    role: 'system',
                    text: `❌ Failed to update keybindings: ${err.message}`,
                    isMeta: true
                }];
            });
        }
    };

    const [activeView, setActiveView] = useState('chat'); // chat, mode, thinking, model, settings, profile
    const [apiTier, setApiTier] = useState('Free');
    const [quotas, setQuotas] = useState({ limitMode: 'Daily', agentLimit: 99999999, tokenLimit: 99999999999999, backgroundLimit: 999999, searchLimit: 100, customModelId: '', customLimit: 0 });
    const [inputConfig, setInputConfig] = useState(null); // { label, key, subKey, value, next }
    const [systemSettings, setSystemSettings] = useState({ memory: true, compression: 0.0, autoExec: false, autoDeleteHistory: '7d', autoUpdate: false, updateManager: 'npm', customUpdateCommand: '' });
    const [profileData, setProfileData] = useState({ name: null, nickname: null, instructions: null });
    const [imageSettings, setImageSettings] = useState({ keyType: 'Default', quality: 'Low-High', apiKey: '' });
    const [sessionStats, setSessionStats] = useState({ tokens: 0 });
    const [sessionAgentCalls, setSessionAgentCalls] = useState(0);
    const [sessionBackgroundCalls, setSessionBackgroundCalls] = useState(0);
    const [sessionTotalTokens, setSessionTotalTokens] = useState(0);
    const [chatTokens, setChatTokens] = useState(0);
    const chatTokenStartRef = useRef(0);

    const [sessionTotalCachedTokens, setSessionTotalCachedTokens] = useState(0);
    const [sessionTotalCandidateTokens, setSessionTotalCandidateTokens] = useState(0);
    const [sessionToolSuccess, setSessionToolSuccess] = useState(0);
    const [sessionToolFailure, setSessionToolFailure] = useState(0);
    const [sessionToolDenied, setSessionToolDenied] = useState(0);
    const [sessionApiTime, setSessionApiTime] = useState(0);
    const [sessionToolTime, setSessionToolTime] = useState(0);
    const [sessionImageCount, setSessionImageCount] = useState(0);
    const [sessionImageCredits, setSessionImageCredits] = useState(0);
    const [dailyUsage, setDailyUsage] = useState(null);
    const [monthlyUsage, setMonthlyUsage] = useState(null);
    const [customPeriodUsage, setCustomPeriodUsage] = useState(null);
    const [statsMode, setStatsMode] = useState('daily');
    const [chatId, setChatId] = useState(generateChatId());

    useEffect(() => {
        const nextTokens = sessionTotalTokens - chatTokenStartRef.current;
        setChatTokens(nextTokens);
        if (chatId) {
            saveChatContext(chatId, nextTokens, sessionStats.tokens).catch(() => { });
        }
    }, [sessionTotalTokens, chatId, sessionStats.tokens]);

    useEffect(() => {
        if (activeView === 'apiTier') {
            const load = async () => {
                const d = await getDailyUsage();
                setDailyUsage(d);
                const m = await getMonthlyUsage();
                setMonthlyUsage(m);
                const c = await getCustomPeriodUsage(quotas.resetDay || 1);
                setCustomPeriodUsage(c);
            };
            load();
        }
    }, [activeView, quotas.resetDay]);
    const [activeCommand, setActiveCommand] = useState(null);
    const [execOutput, setExecOutput] = useState('');
    const [isTerminalFocused, setIsTerminalFocused] = useState(false);

    const [tick, setTick] = useState(0); // Only used for SPINNER_FRAMES reference if needed elsewhere, but mainly tick is gone now
    const isFirstRender = useRef(true);
    const isSecondRender = useRef(true);
    const isThirdRender = useRef(true);
    const prevProviderRef = useRef(aiProvider);

    // [THINKING DEPTH AWARENESS] Auto-switch reasoning depth based on model and provider capabilities
    useEffect(() => {
        if (prevProviderRef.current !== aiProvider) {
            prevProviderRef.current = aiProvider;
            const hasStandard = aiProvider === 'DeepSeek' || aiProvider === 'NVIDIA';
            setThinkingLevel(hasStandard ? 'Standard' : 'Medium');
        } else {
            if (aiProvider === 'Google' && thinkingLevel === 'xHigh') {
                if (activeModel && activeModel.toLowerCase().startsWith('gemini-3')) {
                    setThinkingLevel('High');
                }
            }
        }
    }, [aiProvider, activeModel, thinkingLevel]);

    // [TIER AWARENESS] Auto-switch models if moving between Free and Paid tiers
    useEffect(() => {
        if (!apiKey) return;

        if (isFirstRender.current) {
            isFirstRender.current = false;
            setTimeout(() => {
                isSecondRender.current = false;
                setTimeout(() => {
                    isThirdRender.current = false;
                }, 1000);
            }, 2000);
            return;
        }

        if (isSecondRender.current) {
            return;
        }

        if (isThirdRender.current) {
            return;
        }

        const s = emojiSpace(2);
        let defaultModel = '';
        let modelDisplayName = '';

        if (apiTier === 'Free') {
            if (aiProvider === 'Google') {
                defaultModel = 'gemma-4-31b-it';
                modelDisplayName = 'Gemma 4 (Free default)';
            } else if (aiProvider === 'DeepSeek') {
                defaultModel = 'deepseek-v4-flash';
                modelDisplayName = 'DeepSeek Flash (Free default)';
            } else if (aiProvider === 'NVIDIA') {
                defaultModel = 'moonshotai/kimi-k2.6';
                modelDisplayName = 'Moonshot Kimi (NVIDIA)';
            } else { // OpenRouter
                defaultModel = 'google/gemma-4-31b-it:free';
                modelDisplayName = 'Gemma 4 (Free default)';
            }
        } else {
            if (aiProvider === 'Google') {
                defaultModel = 'gemini-3-flash-preview';
                modelDisplayName = 'Gemini 3 Flash';
            } else if (aiProvider === 'DeepSeek') {
                defaultModel = 'deepseek-v4-flash';
                modelDisplayName = 'DeepSeek Flash';
            } else if (aiProvider === 'NVIDIA') {
                defaultModel = 'moonshotai/kimi-k2.6';
                modelDisplayName = 'Moonshot Kimi (NVIDIA)';
            } else { // OpenRouter
                defaultModel = 'deepseek/deepseek-v4-flash';
                modelDisplayName = 'DeepSeek Flash';
            }
        }

        setActiveModel(defaultModel);
        saveSettings({ apiTier, activeModel: defaultModel });
        setMessages(prev => {
            setCompletedIndex(prev.length + 1);
            return [...prev, {
                id: 'tier-switch-' + Date.now(),
                role: 'system',
                text: `**[TIER LIMIT]** Auto-switched to ${modelDisplayName}.`,
                isMeta: true
            }];
        });
    }, [apiTier, aiProvider, apiKey]); // Synchronize with both apiTier, aiProvider, and apiKey

    // [ENVIRONMENT AWARENESS] Detect if we are in VS Code, JetBrains, etc.
    const terminalEnv = useMemo(() => {
        const ideName = getIDEName();
        const isIDE = !['Terminal', 'Windows Terminal'].includes(ideName) || !!process.env.VSC_TERMINAL_URL || !!process.env.INTELLIJ_TERMINAL_COMMAND_BLOCKS;
        return {
            isIDE,
            get shortcut() {
                return cachedShortcut;
            }
        };
    }, []);

    const activeCommandRef = useRef(null);
    const execOutputRef = useRef('');

    useEffect(() => { activeCommandRef.current = activeCommand; }, [activeCommand]);
    useEffect(() => { execOutputRef.current = execOutput; }, [execOutput]);

    const [autoAcceptWrites, setAutoAcceptWrites] = useState(false);
    const [pendingApproval, setPendingApproval] = useState(null);
    const [pendingAsk, setPendingAsk] = useState(null);

    const resetPendingApproval = (decision) => {
        setPendingApproval(null);
        setActiveView('chat');
    };

    const formatDuration = (totalSecs) => {
        const h = Math.floor(totalSecs / 3600);
        const m = Math.floor((totalSecs % 3600) / 60);
        const s = totalSecs % 60;

        let parts = [];
        if (h > 0) parts.push(`${h}h`);
        if (m > 0 || h > 0) parts.push(`${m}m`);
        parts.push(`${s}s`);

        return parts.join(' ');
    };

    const formatMsDuration = (ms) => {
        if (ms < 1000) return `${ms}ms`;
        return formatDuration(Math.floor(ms / 1000));
    };
    const [statusText, setStatusText] = useState(null);
    const [wittyPhrase, setWittyPhrase] = useState('');

    useEffect(() => {
        let interval;
        if (statusText) {
            const updatePhrase = () => {
                const randomPhrase = WITTY_LOADING_PHRASES[Math.floor(Math.random() * WITTY_LOADING_PHRASES.length)];
                setWittyPhrase(randomPhrase);
            };
            if (!wittyPhrase) updatePhrase(); // Initial pick
            interval = setInterval(updatePhrase, 10000);
        } else {
            setWittyPhrase('');
        }
        return () => clearInterval(interval);
    }, [statusText]);

    const [isSpinnerActive, setIsSpinnerActive] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isCompressing, setIsCompressing] = useState(false);
    const [escPressed, setEscPressed] = useState(false);
    const [escTimer, setEscTimer] = useState(null);
    const [escPressCount, setEscPressCount] = useState(0);
    const [recentPrompts, setRecentPrompts] = useState([]);
    const escDoubleTimerRef = useRef(null);
    const [queuedPrompt, setQueuedPrompt] = useState(null);
    const [resolutionData, setResolutionData] = useState(null);
    const [tempModelOverride, setTempModelOverride] = useState(null);

    useEffect(() => setEscPressCount(0), [input]);

    const [messages, setMessages] = useState(() => {
        const logoMsg = { id: 'logo-' + Date.now(), role: 'system', isLogo: true, isMeta: true };
        const isHomeDir = process.cwd() === os.homedir();
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

        const msgs = [logoMsg];
        if (isSystemDir) {
            msgs.push({
                id: 'system-warning',
                role: 'system',
                text: `[CRITICAL SECURITY ALERT] SYSTEM DIRECTORY DETECTED`,
                subText: `You are currently in a PROTECTED SYSTEM DIRECTORY (${process.cwd()}). Operating here is EXTREMELY dangerous as the agent could accidentally corrupt your OS or installed applications. Open FluxFlow in project folder to work safely.`,
                isHomeWarning: true
            });
        } else if (isHomeDir) {
            msgs.push({
                id: 'home-warning',
                role: 'system',
                text: `[SECURITY ALERT] HOME DIRECTORY DETECTED`,
                subText: `You are currently in ${os.homedir()}. Working here is high-risk as the agent may modify system-sensitive configurations. Please open FluxFlow in project folder.`,
                isHomeWarning: true
            });
        }
        return msgs;
    });
    const queuedPromptRef = useRef(null);
    const [btwResponse, setBtwResponse] = useState('');
    const [showBtwBox, setShowBtwBox] = useState(false);
    const btwResponseRef = useRef('');
    const btwClosedRef = useRef(null);

    useEffect(() => {
        if (messages.length === 0) return;
        const lastMsg = messages[messages.length - 1];
        if (lastMsg && (lastMsg.role === 'agent' || lastMsg.role === 'assistant')) {
            const text = lastMsg.text || '';
            const match = text.match(/\[ANSWER\]([\s\S]*?)(?:\[\/ANSWER\]|$)/i);
            if (match) {
                const content = match[1].trim();
                if (content && content !== btwResponseRef.current) {
                    setBtwResponse(content);
                    btwResponseRef.current = content;
                    if (btwClosedRef.current !== lastMsg.id) {
                        setShowBtwBox(true);
                    }
                }
            }
        }
    }, [messages]);

    const [completedIndex, setCompletedIndex] = useState(messages.length);

    const windowedHistory = useMemo(() => {
        // [SCROLLBACK-SAFE SNAP-TO-BOTTOM]
        // We keep 1536 lines of history in the render tree so the user can scroll up.
        const MAX_HISTORY_LINES = 2000;
        const width = terminalSize.columns || 80;

        let totalLines = 0;
        let startIdx = 0;

        // Step 1: Find the total line count of all messages (backwards)
        // We go back until we hit the 1536 line scrollback limit.
        for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i];
            if (!msg) continue;

            const text = msg.text || '';
            let lines = text.split(/\r?\n/).length;
            text.split(/\r?\n/).forEach(l => {
                lines += Math.floor(l.length / width);
            });

            if (msg.isHelpRecord) lines = 15;
            if (msg.isUpdateNotification) lines = 8;
            if (msg.isTerminalRecord) lines = 10;
            lines += msg.role === 'think' ? 3 : 2;

            if (totalLines + lines > MAX_HISTORY_LINES) {
                startIdx = i + 1;
                break;
            }
            totalLines += lines;
        }

        return {
            items: messages.slice(startIdx, completedIndex),
            isTruncated: startIdx > 0
        };
    }, [messages, terminalSize.columns, terminalSize.rows]);

    // Heuristic to detect if terminal is likely waiting for input (ends with ? or :)
    const isTerminalWaitingForInput = useMemo(() => {
        if (!activeCommand || !execOutput) return false;
        const lastChunk = execOutput.trim();
        return lastChunk.endsWith('?') || lastChunk.endsWith(':') || /\[[yYnN/]+\]\s*$/.test(lastChunk) || /\([yYnN]\)\s*$/.test(lastChunk);
    }, [activeCommand, execOutput]);

    // Global Key Listener (ONE listener to rule them all)
    useInput((inputText, key) => {
        // Aggressively swallow focus reporting artifacts
        if (inputText === '\x1b[I' || inputText === '\x1b[O' || inputText === '[I' || inputText === '[O') {
            return;
        }

        if (activeView === 'stats') {
            if (key.tab && !key.shift) {
                setStatsMode(prev => {
                    if (prev === 'modelBreakdown') return 'daily';
                    return prev === 'daily' ? 'monthly' : 'daily';
                });
                return;
            }
            if (key.space || inputText === ' ') {
                setStatsMode(prev => prev === 'modelBreakdown' ? 'daily' : 'modelBreakdown');
                return;
            }
        }

        if (showBridgePromo) {
            const ideName = getIDEName();
            const options = getPromoOptions(ideName);

            if (key.upArrow) {
                setPromoSelectedIndex(prev => (prev > 0 ? prev - 1 : options.length - 1));
            } else if (key.downArrow) {
                setPromoSelectedIndex(prev => (prev < options.length - 1 ? prev + 1 : 0));
            } else if (key.return) {
                const opt = options[promoSelectedIndex];
                if (opt.action === 'dismiss') {
                    setShowBridgePromo(false);
                } else if (opt.url) {
                    const openCmd = process.platform === 'win32' ? `start ${opt.url}` : process.platform === 'darwin' ? `open ${opt.url}` : `xdg-open ${opt.url}`;
                    exec(openCmd);
                    setShowBridgePromo(false);
                }
            }
            return;
        }

        // [LIVE TERMINAL FOCUS TOGGLE]
        if (key.tab && activeCommand) {
            setIsTerminalFocused(prev => !prev);
            return;
        }

        // [LIVE TERMINAL INPUT FORWARDING]
        if (isTerminalFocused && activeCommand) {
            if (key.return) {
                const isWin = process.platform === 'win32';
                writeToActiveCommand(isWin ? '\r\n' : '\n');
                if (!isActiveCommandPty) setExecOutput(prev => prev + '\n');
            } else if (key.backspace || key.delete) {
                if (isActiveCommandPty) {
                    writeToActiveCommand('\x7f'); // ASCII DEL for backspace in many TTYs
                } else {
                    writeToActiveCommand('\b \b');
                    setExecOutput(prev => prev.slice(0, -1)); // Rudimentary backspace mirroring
                }
            } else if (key.upArrow) {
                writeToActiveCommand(key.shift ? '\x1B[1;2A' : '\x1B[A');
            } else if (key.downArrow) {
                writeToActiveCommand(key.shift ? '\x1B[1;2B' : '\x1B[B');
            } else if (key.rightArrow) {
                writeToActiveCommand(key.shift ? '\x1B[1;2C' : '\x1B[C');
            } else if (key.leftArrow) {
                writeToActiveCommand(key.shift ? '\x1B[1;2D' : '\x1B[D');
            } else if (key.escape) {
                writeToActiveCommand('\x1B');
            } else if (key.ctrl && inputText) {
                const charCode = inputText.toLowerCase().charCodeAt(0);
                if (charCode >= 97 && charCode <= 122) { // a-z
                    writeToActiveCommand(String.fromCharCode(charCode - 96));
                } else {
                    writeToActiveCommand(inputText);
                }
            } else if (inputText) {
                writeToActiveCommand(inputText);
                if (!isActiveCommandPty) setExecOutput(prev => prev + inputText);
            }
            return;
        }

        // 1. ESC Logic
        if (key.escape) {
            if (showBtwBox) {
                setShowBtwBox(false);
                if (messages.length > 0) {
                    const lastMsg = messages[messages.length - 1];
                    if (lastMsg) {
                        btwClosedRef.current = lastMsg.id;
                    }
                }
                return;
            }
            if (suggestions.length > 0 && activeView === 'chat') {
                setIsFilePickerDismissed(true);
                return;
            }
            if (confirmExit) {
                setConfirmExit(false);
                return;
            }
            if (isProcessing || activeCommand) {
                if (!escPressed) {
                    setEscPressed(true);
                    if (escTimer) clearTimeout(escTimer);
                    setEscTimer(setTimeout(() => setEscPressed(false), 3000));
                } else {
                    signalTermination();
                    terminateActiveCommand();
                    setEscPressed(false);
                    if (escTimer) clearTimeout(escTimer);
                }
            } else {
                if (activeView === 'revert') {
                    setActiveView('chat');
                    setEscPressCount(0);
                } else if (activeView !== 'chat' && activeView !== 'settings') {
                    setActiveView('chat');
                } else {
                    if (!apiKey && setupStep === 1) {
                        setSetupStep(0);
                        setTempKey('');
                        return;
                    }
                    setEscPressCount(prev => {
                        const nextCount = prev + 1;
                        if (nextCount === 1) {
                            if (escDoubleTimerRef.current) clearTimeout(escDoubleTimerRef.current);
                            escDoubleTimerRef.current = setTimeout(() => setEscPressCount(0), 2000);
                        } else if (nextCount === 2) {
                            if (escDoubleTimerRef.current) clearTimeout(escDoubleTimerRef.current);
                            setEscPressCount(0);

                            if (input.length > 0) {
                                setInput('');
                            } else {
                                RevertManager.getChatHistory(chatId).then(prompts => {
                                    if (prompts.length > 0) {
                                        setRecentPrompts(prompts.reverse()); // latest first
                                        setActiveView('revert');
                                    } else {
                                        setMessages(prev => {
                                            setCompletedIndex(prev.length + 1);
                                            return [...prev, { id: 'revert-empty-' + Date.now(), role: 'system', text: '🛈 Nothing to revert to.', isMeta: true }];
                                        });
                                    }
                                });
                            }
                        }
                        return nextCount;
                    });
                }
            }
        }

        // 2. Suggestion Interaction (Arrows & Enter)
        if (suggestions.length > 0 && activeView === 'chat') {
            if (key.upArrow) {
                setSelectedIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
                return;
            }
            if (key.downArrow) {
                setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
                return;
            }
            if (key.return) {
                // Return handling is now coordinated with TextInput onSubmit for stability
                return;
            }
        }

        // 3. Tab Completion (Retired - focus on Enter/Arrows)
        if (key.tab && activeView === 'chat') {
            // Tab is now ignored for suggestions to prevent [object Object] errors
        }

        // 3. CTRL+C Protocol (Clear input OR Exit)
        if (key.ctrl && inputText === 'c' && activeView !== 'exit') {
            if (input.length > 0) {
                // If there's text, act as a "clear line" cancel
                setInput('');
                return;
            }

            if (key.shift) {
                // Instant bypass for power users
                setActiveView('exit');
                setConfirmExit(false);
                return;
            }
            if (!confirmExit) {
                setConfirmExit(true);
            } else {
                setActiveView('exit');
                setConfirmExit(false);
            }
        }

        // 4. Modifier + Enter (Newline Protocol - Supports Shift/Ctrl/Alt/Meta)
        if (key.return && (key.shift || key.ctrl || key.meta || key.leftAlt || key.rightAlt)) {
            setInput(prev => prev.replace(/\\\r?$/, '').replace(/\r?$/, '') + '\n');
        }
    });

    useEffect(() => {
        // Enable Focus Reporting (DEC mode 1004)
        process.stdout.write('\x1b[?1004h');

        const onData = (data) => {
            const str = data.toString();
            if (str.includes('\x1b[I')) {
                setIsAppFocused(true);
                lastFocusEventTime.current = Date.now();
            } else if (str.includes('\x1b[O')) {
                setIsAppFocused(false);
                lastFocusEventTime.current = Date.now();
            }
        };

        process.stdin.on('data', onData);

        return () => {
            // Disable Focus Reporting on exit
            process.stdout.write('\x1b[?1004l');
            process.stdin.off('data', onData);
        };
    }, []);

    useEffect(() => {
        async function init() {
            // 0. Initialize IDE Bridge with dynamic version
            try {
                const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
                initBridge(versionFluxflow || pkg.version || '2.0.0');
            } catch (e) {
                initBridge('2.0.0');
            }

            // Set custom terminal tab title (Standard + VS Code specific)
            if (process.stdout.isTTY) {
                process.stdout.write('\x1b]0;FluxFlow\x07');
                process.stdout.write('\x1b]633;P;TerminalTitle=FluxFlow\x07');
            }

            // 0. System Integrity Check (Build-in Chromium)
            if (!checkPuppeteerReady()) {
                setMessages(prev => {
                    setCompletedIndex(prev.length + 1);
                    return [...prev, { id: 'setup-' + Date.now(), role: 'system', text: '[SYSTEM] Installing Required dependencies... (One-time setup)', isMeta: true }];
                });
                await installPuppeteerBrowser();
                setMessages(prev => {
                    setCompletedIndex(prev.length + 1);
                    return [...prev, { id: 'setup-done-' + Date.now(), role: 'system', text: '[SYSTEM] All dependencies installed successfully.', isMeta: true }];
                });
            }

            // 1. Load persisted settings
            const saved = await loadSettings();
            if (parsedArgs.mode) {
                setMode(parsedArgs.mode);
            } else {
                setMode(saved.mode);
            }
            if (parsedArgs.thinking) {
                setThinkingLevel(parsedArgs.thinking);
            } else {
                setThinkingLevel(saved.thinkingLevel);
            }

            const startupProvider = parsedArgs.provider || saved.aiProvider || 'Google';
            setAiProvider(startupProvider);

            const currentTier = saved.apiTier || 'Free';

            persistedModelRef.current = saved.activeModel;
            if (parsedArgs.model) {
                setActiveModel(parsedArgs.model);
            } else if (parsedArgs.provider) {
                let defaultModel = '';
                if (currentTier === 'Free') {
                    if (startupProvider === 'Google') {
                        defaultModel = 'gemma-4-31b-it';
                    } else if (startupProvider === 'DeepSeek') {
                        defaultModel = 'deepseek-v4-flash';
                    } else if (startupProvider === 'OpenRouter') {
                        defaultModel = 'google/gemma-4-31b-it:free';
                    } else if (startupProvider === 'NVIDIA') {
                        defaultModel = 'moonshotai/kimi-k2.6';
                    }
                } else {
                    if (startupProvider === 'Google') {
                        defaultModel = 'gemini-3-flash-preview';
                    } else if (startupProvider === 'DeepSeek') {
                        defaultModel = 'deepseek-v4-flash';
                    } else if (startupProvider === 'OpenRouter') {
                        defaultModel = 'deepseek/deepseek-v4-flash';
                    } else if (startupProvider === 'NVIDIA') {
                        defaultModel = 'moonshotai/kimi-k2.6';
                    }
                }
                setActiveModel(defaultModel);
            } else {
                setActiveModel(saved.activeModel);
            }

            setShowFullThinking(saved.showFullThinking);
            setApiTier(saved.apiTier || 'Free');
            setQuotas(saved.quotas || { limitMode: 'Daily', agentLimit: 99999999, tokenLimit: 99999999999999, backgroundLimit: 999999, searchLimit: 100, customModelId: '', customLimit: 0 });
            const freshSettings = {
                memory: true,
                compression: 0.0,
                autoExec: false,
                autoDeleteHistory: '7d',
                autoUpdate: false,
                updateManager: 'npm',
                customUpdateCommand: '',
                ...(saved.systemSettings || {})
            };

            if (parsedArgs.memory === 'on') {
                freshSettings.memory = true;
            } else if (parsedArgs.memory === 'off') {
                freshSettings.memory = false;
            }

            if (parsedArgs.package) {
                freshSettings.updateManager = parsedArgs.package;
            }

            if (parsedArgs.autoDel) {
                freshSettings.autoDeleteHistory = parsedArgs.autoDel;
            }

            if (parsedArgs.autoExec === 'on') {
                freshSettings.autoExec = true;
            } else if (parsedArgs.autoExec === 'off') {
                freshSettings.autoExec = false;
            }

            if (parsedArgs.externalAccess === 'on') {
                freshSettings.allowExternalAccess = true;
            } else if (parsedArgs.externalAccess === 'off') {
                freshSettings.allowExternalAccess = false;
            }

            setSystemSettings(freshSettings);
            setProfileData(saved.profileData);
            setImageSettings(saved.imageSettings || { keyType: 'Default', quality: 'Low-High', apiKey: '' });

            // 2. Load API key
            let key = parsedArgs.key;
            if (!key) {
                key = await getProviderAPIKey(startupProvider);
            }
            if (key) {
                setApiKey(key);
                initAI(key, { aiProvider: startupProvider, onIDEApproval: resetPendingApproval }); // Initialize SDK
            }

            // 3. Clean up old history and logs (older than 7 days)
            if (saved.systemSettings?.autoDeleteHistory) {
                cleanupOldHistory(saved.systemSettings.autoDeleteHistory);
            }
            cleanupOldLogs(LOGS_DIR);

            // 4. Check for updates
            performVersionCheck(false, freshSettings);

            // 5. Prime usage cache and handle resume flag
            await initUsage();
            await RevertManager.recoverCrashedTransaction();

            if (parsedArgs.resume) {
                const h = await loadHistory();
                const id = parsedArgs.resume;
                if (h[id]) {
                    setChatId(id);
                    const savedData = await loadChatContext(id);
                    chatTokenStartRef.current = sessionTotalTokens - savedData.total;
                    setChatTokens(savedData.total);
                    setSessionStats({ tokens: savedData.context });

                    const resumedMsgs = [...h[id].messages];
                    const hasLogo = resumedMsgs[0]?.text?.includes('░░░███');
                    if (!hasLogo) {
                        resumedMsgs.unshift({ id: 'logo-' + Date.now(), role: 'system', isLogo: true, isMeta: true });
                    }
                    setMessages(resumedMsgs);
                    setActiveView('chat');
                    setMessages(prev => {
                        const newMsgs = [...prev, { id: 'sys-' + Date.now(), role: 'system', text: `SESSION RESUMED VIA CLI: [${id}]`, isMeta: true }];
                        setCompletedIndex(newMsgs.length);
                        return newMsgs;
                    });
                } else {
                    setMessages(prev => [...prev, { id: 'sys-err-' + Date.now(), role: 'system', text: `ERROR: Chat session [${id}] not found. Started new session.`, isMeta: true }]);
                }
            }

            // Check keybindings configuration
            const detectedIde = getIDEName();
            const isIDE = !['Terminal', 'Windows Terminal'].includes(detectedIde);
            if (isIDE) {
                const kbPath = getKeybindingsPath(detectedIde);
                if (kbPath) {
                    try {
                        let bindings = [];
                        if (fs.existsSync(kbPath)) {
                            const content = fs.readFileSync(kbPath, 'utf8').trim();
                            if (content) {
                                bindings = parseJsonc(content);
                            }
                        }
                        if (!hasShiftEnterBinding(bindings)) {
                            setActiveView('keybindingsPrompt');
                        } else {
                            cachedShortcut = 'Shift + Enter';
                        }
                    } catch (e) {
                        // Ignore parse errors or check failures
                    }
                }
            }

            setIsInitializing(false);
        }
        init();
    }, []);

    // [SAFE-EXIT TIMER]
    useEffect(() => {
        let timer;
        if (confirmExit) {
            setExitCountdown(10);
            timer = setInterval(() => {
                setExitCountdown(prev => {
                    if (prev <= 1) {
                        setConfirmExit(false);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [confirmExit]);

    // Auto-save watcher
    useEffect(() => {
        if (!isInitializing) {
            const modelToSave = (parsedArgs.model && activeModel === parsedArgs.model) ? persistedModelRef.current : activeModel;
            saveSettings({
                mode,
                thinkingLevel,
                aiProvider,
                activeModel: modelToSave || activeModel,
                showFullThinking,
                systemSettings,
                profileData,
                imageSettings,
                apiTier
            });
        }
    }, [mode, thinkingLevel, aiProvider, activeModel, showFullThinking, systemSettings, profileData, imageSettings, isInitializing, parsedArgs, apiTier]);

    const handleSetup = async (val) => {
        const key = val.trim();
        let minLength = 38;
        if (aiProvider === 'OpenRouter') minLength = 30;
        if (aiProvider === 'DeepSeek') minLength = 30;
        if (aiProvider === 'NVIDIA') minLength = 30;

        if (key.length >= minLength) {
            await saveProviderAPIKey(aiProvider, key);
            setApiKey(key);
            initAI(key, { aiProvider, onIDEApproval: resetPendingApproval }); // Initialize SDK

            let defaultModel = 'gemma-4-31b-it';
            if (aiProvider === 'OpenRouter') {
                defaultModel = 'google/gemma-4-31b-it:free';
            } else if (aiProvider === 'DeepSeek') {
                defaultModel = 'deepseek-v4-flash';
            } else if (aiProvider === 'NVIDIA') {
                defaultModel = 'moonshotai/kimi-k2.6';
            }
            setActiveModel(defaultModel);

            setMessages(prev => [...prev, { role: 'system', text: `${aiProvider} API Key saved successfully! Model set to ${defaultModel}. Initialization complete.`, isMeta: true }]);
        } else {
            setMessages(prev => [...prev, { role: 'system', text: `INVALID KEY: ${aiProvider} API keys must be at least ${minLength} characters.`, isMeta: true }]);
            setTempKey('');
        }
    };

    const lastSavedTimeRef = useRef(SESSION_START_TIME);

    // Auto-Exit Trigger
    useEffect(() => {
        if (activeView === 'exit') {
            // Final Telemetry Flush
            const flush = async () => {
                const now = Date.now();
                const deltaSecs = Math.floor((now - lastSavedTimeRef.current) / 1000);
                if (deltaSecs >= 1) {
                    await addToUsage('duration', deltaSecs);
                    lastSavedTimeRef.current += deltaSecs * 1000;
                }
                await forceFlushUsage();

                // Optional: Force save chat state to history
                // saveChat(chatId, `Auto-Saved ${new Date().toLocaleTimeString()}`, messages);
            };
            flush();

            const timer = setTimeout(() => {
                process.exit(0);
            }, 1700); // Give user 1.7s to see the final stats dashboard
            return () => clearTimeout(timer);
        }
    }, [activeView]);

    // Duration Watcher (Telemetry)
    useEffect(() => {
        const interval = setInterval(async () => {
            if (!isInitializing) {
                const now = Date.now();
                const deltaSecs = Math.floor((now - lastSavedTimeRef.current) / 1000);
                if (deltaSecs >= 1) {
                    await addToUsage('duration', deltaSecs);
                    lastSavedTimeRef.current += deltaSecs * 1000;
                }
            }
        }, 1500); // 1.5s "vibe" interval
        return () => clearInterval(interval);
    }, [isInitializing]);

    const COMMANDS = [
        { cmd: '/quit', desc: 'Exit and shutdown Flux' },
        { cmd: '/help', desc: 'Show all available commands' },
        { cmd: '/compress', desc: 'Summarize and compress chat history' },
        { cmd: '/clear', desc: 'Clear terminal screen' },
        { cmd: '/resume', desc: 'Load previous session' },
        { cmd: '/revert', desc: 'Revert codebase back to a checkpoint' },
        { cmd: '/gemini', desc: 'Get a happy message from Gemini CLI' },
        { cmd: '/save', desc: 'Force save current chat' },
        { cmd: '/export', desc: 'Export current chat in a .txt file' },
        { cmd: '/chats', desc: 'List all chat sessions' },
        { cmd: '/btw', desc: 'Ask a question without intefering with ongoing tasks' },
        // {
        //     cmd: '/image', desc: 'Generate images using Pollinations', subs: [
        //         {
        //             cmd: 'setup', desc: 'Configure defaults', subs: [
        //                 {
        //                     cmd: 'key', desc: 'Set API key strategy', subs: [
        //                         { cmd: 'default', desc: 'Default (Quota: Dynamic 25 max/hr)' },
        //                         { cmd: 'custom', desc: 'Custom Key' }
        //                     ]
        //                 },
        //                 {
        //                     cmd: 'quality', desc: 'Set default quality', subs: [
        //                         { cmd: 'low', desc: imageSettings?.keyType === 'Custom' ? '(0.001/img)' : '(1/img)' },
        //                         { cmd: 'low-high', desc: imageSettings?.keyType === 'Custom' ? '(0.002/img)' : '(2/img)' },
        //                         { cmd: 'medium', desc: imageSettings?.keyType === 'Custom' ? '(0.008/img)' : '(8/img)' },
        //                         { cmd: 'medium-high', desc: imageSettings?.keyType === 'Custom' ? '(0.01/img)' : '(10/img)' },
        //                         { cmd: 'high', desc: imageSettings?.keyType === 'Custom' ? '(0.045/img)' : '(45/img)' },
        //                         { cmd: 'ultra', desc: imageSettings?.keyType === 'Custom' ? '(0.0488/img)' : '(49/img)' },
        //                         { cmd: 'premium', desc: imageSettings?.keyType === 'Custom' ? '(0.1/img)' : '(100/img)' }
        //                     ]
        //                 }
        //             ]
        //         },
        //         { cmd: 'stats', desc: 'Show remaining credits or Pollinations balance status' }
        //     ]
        // },
        {
            cmd: '/mode', desc: 'Toggle Flux/Flow modes', subs: [
                { cmd: 'flux', desc: 'Enable Dev toolset' },
                { cmd: 'flow', desc: 'Enable Chat mode' }
            ]
        },
        {
            cmd: '/thinking', desc: 'Set AI reasoning depth', subs: aiProvider === 'DeepSeek'
                ? [
                    { cmd: 'Fast', desc: 'Fastest' },
                    { cmd: 'Standard', desc: 'Standard Reasoning' },
                    { cmd: 'High', desc: 'Extended Reasoning' }
                ]
                : aiProvider === 'NVIDIA'
                    ? [
                        { cmd: 'Fast', desc: 'Reasoning Disabled' },
                        { cmd: 'Standard', desc: 'Balanced Reasoning' },
                        { cmd: 'High', desc: 'Reasoning Enabled' }
                    ]
                    : aiProvider === 'OpenRouter'
                        ? [
                            { cmd: 'Fast', desc: 'Fastest' },
                            { cmd: 'Low', desc: 'Quick Reasoning' },
                            { cmd: 'Medium', desc: 'Balanced Reasoning' },
                            { cmd: 'High', desc: 'Deep Reasoning' },
                            { cmd: 'xHigh', desc: 'Extended Reasoning' }
                        ]
                        : activeModel && activeModel.toLowerCase().startsWith('gemini-3')
                            ? [
                                { cmd: 'Fast', desc: 'Fastest' },
                                { cmd: 'Low', desc: 'Quick Reasoning' },
                                { cmd: 'Medium', desc: 'Balanced Reasoning' },
                                { cmd: 'High', desc: 'Deep Reasoning' }
                            ]
                            : [ // Google General / Gemma
                                { cmd: 'Fast', desc: 'Fastest' },
                                { cmd: 'Low', desc: 'Quick Reasoning' },
                                { cmd: 'Medium', desc: 'Balanced Reasoning' },
                                { cmd: 'High', desc: 'Deep Reasoning' },
                                { cmd: 'xHigh', desc: 'Extended Reasoning' }
                            ]
        },
        {
            cmd: '/model',
            desc: 'Switch Model for Agent',
            subs: aiProvider === 'OpenRouter'
                ? (apiTier === 'Free'
                    ? [
                        {
                            cmd: 'google/gemma-4-31b-it:free',
                            desc: 'Multimodal'
                        },
                        {
                            cmd: 'moonshotai/kimi-k2.6:free',
                            desc: 'Multimodal'
                        },
                        {
                            cmd: 'qwen/qwen3-coder:free',
                            desc: ''
                        },
                        {
                            cmd: 'z-ai/glm-4.5-air:free',
                            desc: ''
                        },
                    ]
                    : [
                        {
                            cmd: 'google/gemini-3.5-flash',
                            desc: 'Multimodal'
                        },
                        {
                            cmd: 'qwen/qwen3.7-plus',
                            desc: 'Multimodal'
                        },
                        {
                            cmd: 'minimax/minimax-m3',
                            desc: 'Multimodal'
                        },
                        {
                            cmd: 'anthropic/claude-sonnet-4.5',
                            desc: 'Multimodal'
                        },
                        {
                            cmd: 'anthropic/claude-opus-4.6',
                            desc: 'Multimodal'
                        },
                        {
                            cmd: 'anthropic/claude-opus-4.8',
                            desc: 'Multimodal'
                        },
                        {
                            cmd: 'deepseek/deepseek-v4-pro',
                            desc: ''
                        },
                        {
                            cmd: 'deepseek/deepseek-v4-flash',
                            desc: ''
                        },
                        {
                            cmd: 'xiaomi/mimo-v2.5-pro',
                            desc: ''
                        },
                        {
                            cmd: 'z-ai/glm-5',
                            desc: ''
                        },
                        {
                            cmd: 'openai/gpt-5.2-codex',
                            desc: 'Multimodal'
                        },
                        {
                            cmd: 'openai/gpt-5.2-pro',
                            desc: 'Multimodal'
                        },
                        {
                            cmd: 'openai/gpt-5.5-pro',
                            desc: 'Multimodal'
                        },
                        {
                            cmd: 'moonshotai/kimi-k2.6',
                            desc: 'Multimodal'
                        },
                    ])
                : aiProvider === 'DeepSeek'
                    ? [
                        {
                            cmd: 'deepseek-v4-flash',
                            desc: 'Fast & Efficient'
                        },
                        {
                            cmd: 'deepseek-v4-pro',
                            desc: 'High-Intelligence Reasoning'
                        }
                    ]
                    : aiProvider === 'NVIDIA'
                        ? [
                            {
                                cmd: 'moonshotai/kimi-k2.6',
                                desc: 'Multimodal'
                            },
                            {
                                cmd: 'google/gemma-4-31b-it',
                                desc: ''
                            },
                            {
                                cmd: 'stepfun-ai/step-3.7-flash',
                                desc: ''
                            },
                            {
                                cmd: 'minimaxai/minimax-m2.7',
                                desc: ''
                            },
                            {
                                cmd: 'deepseek-ai/deepseek-v4-flash',
                                desc: ''
                            },
                            {
                                cmd: 'deepseek-ai/deepseek-v4-pro',
                                desc: ''
                            },
                            {
                                cmd: 'mistralai/mistral-medium-3.5-128b',
                                desc: ''
                            },
                            {
                                cmd: 'z-ai/glm-5.1',
                                desc: ''
                            },
                            {
                                cmd: 'google/diffusiongemma-26b-a4b-it',
                                desc: 'Mega Fast [Experimental]'
                            },
                            {
                                cmd: 'minimaxai/minimax-m3',
                                desc: ''
                            }
                        ]
                        : (apiTier === 'Free'
                            ? [
                                {
                                    cmd: 'gemma-4-26b-a4b-it',
                                    desc: 'Standard & Faster'
                                },
                                {
                                    cmd: 'gemma-4-31b-it',
                                    desc: 'Standard Default'
                                },
                                {
                                    cmd: 'gemini-2.5-flash-lite',
                                    desc: 'Fast & Cheap (Limited Free Quota)'
                                },
                                {
                                    cmd: 'gemini-2.5-flash',
                                    desc: 'Fast & Reliable (Limited Free Quota)'
                                },
                                {
                                    cmd: 'gemini-3-flash-preview',
                                    desc: 'Fast & Lightweight (Limited Free Quota)'
                                },
                                {
                                    cmd: 'gemini-3.5-flash',
                                    desc: 'Flash Latest (Limited Free Quota) [Instability Issues]'
                                }
                            ]
                            : [
                                {
                                    cmd: 'gemini-2.5-flash-lite',
                                    desc: 'Fast & Cheap'
                                },
                                {
                                    cmd: 'gemini-2.5-flash',
                                    desc: 'Fast & Reliable'
                                },
                                {
                                    cmd: 'gemini-2.5-pro',
                                    desc: 'Last gen Pro reasoning'
                                },
                                {
                                    cmd: 'gemini-3.1-flash-lite',
                                    desc: 'Ultra-Fast & Lite'
                                },
                                {
                                    cmd: 'gemini-3-flash-preview',
                                    desc: 'Default, Fast & Lightweight'
                                },
                                {
                                    cmd: 'gemini-3.5-flash',
                                    desc: 'Flash Latest  [Instability Issues]'
                                },
                                {
                                    cmd: 'gemini-3.1-pro-preview',
                                    desc: 'Pro Reasoning'
                                },

                            ])
        },
        { cmd: '/settings', desc: 'Configure system prefs' },
        { cmd: '/key', desc: 'Manage API keys' },
        { cmd: '/profile', desc: 'Edit developer persona' },
        { cmd: '/memory', desc: 'Manage agent memory' },
        { cmd: '/stats', desc: 'Show session usage' },
        { cmd: '/reset', desc: 'Wipe all project data' },
        { cmd: '/about', desc: 'Project info & credits' },
        { cmd: '/changelog', desc: 'View latest updates' },
        { cmd: '/docs', desc: 'View Documentation' },
        {
            cmd: '/fluxflow', desc: 'Project management', subs: [
                { cmd: 'init', desc: 'Create FluxFlow.md template' }
            ]
        },
        {
            cmd: '/update', desc: 'Check/Install updates', subs: [
                { cmd: 'check', desc: 'Check for new version' },
                { cmd: 'latest', desc: 'Install latest release' }
            ]
        }
    ];

    const handleSubmit = async (value, isProgrammatic = false) => {
        // [INTELLIGENT AUTOCOMPLETE] If suggestions are active, Enter fills the command instead of submitting.
        if (!isProgrammatic && suggestions.length > 0) {
            const nextMatch = suggestions[selectedIndex] || suggestions[0];
            const parts = value.split(' ');
            if (parts.length === 1) {
                setInput(nextMatch.cmd + ' ');
            } else {
                // Replace the last part (the query) with the selected command
                const parentParts = parts.slice(0, -1);
                setInput(parentParts.join(' ') + ' ' + nextMatch.cmd + ' ');
            }
            setSelectedIndex(0);
            setInputKey(prev => prev + 1);
            return;
        }

        // 1. HARD NORMALIZATION: Vaporize Windows \r\n artifacts immediately
        const normalizedValue = value
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .trimEnd(); // Remove the trailing newline that triggered the submit

        // 2. Standard EOL Escape: If line ends with \, treat as Newline
        if (normalizedValue.endsWith('\\')) {
            setInput(normalizedValue.slice(0, -1) + '\n');
            return;
        }

        // 3. Final Scrub: Strip terminal ghosts and manual breaks
        const absoluteClean = normalizedValue
            .replace(/\\\s*\n/g, '\n')
            .split(/\r?\n/)
            .map(l => l.replace(/\\$/, ''))
            .join('\n');

        // Prevent sending empty or whitespace-only prompts
        if (!absoluteClean.trim()) return;

        if (isProcessing) {
            // STEERING HINT ENGINE
            const hintText = absoluteClean.trim();
            if (hintText.startsWith('/btw')) {
                const question = hintText.replace(/^\/btw\s*/, '').trim();
                if (question.length <= 3) {
                    setMessages(prev => {
                        setCompletedIndex(prev.length + 1);
                        return [...prev, { id: 'hint-err-' + Date.now(), role: 'system', text: '[RESTRICTED] Inquiry question must be more than 3 characters.', isMeta: true }];
                    });
                    setInput('');
                    return;
                }
            } else if (hintText.startsWith('/')) {
                setMessages(prev => {
                    setCompletedIndex(prev.length + 1);
                    return [...prev, { id: 'hint-err-' + Date.now(), role: 'system', text: '[RESTRICTED] Steering Hints cannot start with /', isMeta: true }];
                });
                setInput('');
                return;
            }

            setQueuedPrompt(hintText);
            queuedPromptRef.current = hintText;
            setMessages(prev => {
                setCompletedIndex(prev.length + 1);
                const isBtw = hintText.startsWith('/btw');
                const cleanText = isBtw ? hintText.replace(/^\/btw\s*/, '') : hintText;
                const prefix = isBtw ? '[QUESTION: QUEUED]' : '[STEERING HINT: QUEUED]';
                return [...prev, { id: 'hint-' + Date.now(), role: 'user', text: `${prefix} \n${cleanText}`, color: 'magenta' }];
            });
            setInput('');
            return;
        }

        // Check if we are in setup mode (missing API key)
        if (!apiKey) {
            handleSetup(absoluteClean);
            setTempKey('');
            return;
        }

        if (absoluteClean.startsWith('/')) {
            const parts = absoluteClean.split(' ');
            const cmd = parts[0]?.toLowerCase();

            switch (cmd) {
                case '/quit': {
                    setActiveView('exit');
                    break;
                }

                case '/resume': {
                    if (parts[1]) {
                        // Direct resume logic
                        const targetId = parts[1];
                        const resumeSession = async () => {
                            const h = await loadHistory();
                            const target = h[targetId] || Object.values(h).find(h => h.name.toLowerCase() === targetId.toLowerCase());

                            if (target) {
                                stdout.write('\x1b[2J\x1b[3J\x1b[H'); // Thorough clear for fresh context
                                setChatId(targetId);

                                const savedData = await loadChatContext(targetId);
                                chatTokenStartRef.current = sessionTotalTokens - savedData.total;
                                setChatTokens(savedData.total);
                                setSessionStats({ tokens: savedData.context });

                                // Ensure logo is present at the start of resumed history
                                const resumedMsgs = [...target.messages];
                                const hasLogo = resumedMsgs[0]?.text?.includes('░░░███');
                                if (!hasLogo) {
                                    resumedMsgs.unshift({ id: 'logo-' + Date.now(), role: 'system', isLogo: true, isMeta: true });
                                }

                                setMessages(resumedMsgs);
                                setMessages(prev => [...prev, { id: 'sys-' + Date.now(), role: 'system', text: `SESSION RESUMED: [${targetId}]`, isMeta: true }]);
                                setCompletedIndex(0);
                            } else {
                                setMessages(prev => [...prev, { id: 'err-' + Date.now(), role: 'system', text: `ERROR: Session [${targetId}] not found.` }]);
                            }
                        };
                        resumeSession();
                    } else {
                        setActiveView('resume');
                    }
                    break;
                }

                case '/clear': {
                    // Soft clear by resetting message state (Ink handles the visual refresh)
                    setMessages([
                        { id: 'logo-' + Date.now(), role: 'system', isLogo: true, isMeta: true }
                    ]);
                    setCompletedIndex(1);
                    setChatId(generateChatId());
                    setSessionStats({ tokens: 0 });
                    setIsExpanded(false);
                    setChatTokens(0);
                    chatTokenStartRef.current = sessionTotalTokens;
                    break;
                }
                case '/revert': {
                    RevertManager.getChatHistory(chatId).then(prompts => {
                        if (prompts.length > 0) {
                            setRecentPrompts(prompts.reverse()); // latest first
                            setActiveView('revert');
                        } else {
                            const s = emojiSpace(2);
                            setMessages(prev => {
                                setCompletedIndex(prev.length + 1);
                                return [...prev, { id: 'revert-empty-' + Date.now(), role: 'system', text: `Nothing to revert to.`, isMeta: true }];
                            });
                        }
                    });
                    break;
                }
                case '/mode': {
                    if (parts[1]) {
                        const newMode = parts[1].toLowerCase() === 'flow' ? 'Flow' : 'Flux';
                        setMode(newMode);
                        if (newMode === 'Flow') {
                            setThinkingLevel('Fast');
                        } else if (newMode === 'Flux') {
                            setThinkingLevel('High');
                        }
                        const s = emojiSpace(2);
                        setMessages(prev => { setCompletedIndex(prev.length + 1); return [...prev, { id: Date.now(), role: 'system', text: `[SYSTEM] Mode switched to ${newMode}`, isMeta: true }]; });
                    } else {
                        setActiveView('mode');
                    }
                    break;
                }
                case '/image': {
                    if (parts[1]?.toLowerCase() === 'stats') {
                        const s = emojiSpace(2);
                        if (imageSettings.keyType === 'Custom') {
                            setMessages(prev => {
                                setCompletedIndex(prev.length + 1);
                                return [...prev, {
                                    id: Date.now(),
                                    role: 'system',
                                    text: `[SYSTEM] Key strategy is Custom. Redirecting to Pollinations dashboard (https://enter.pollinations.ai/#pollen)...`,
                                    isMeta: true
                                }];
                            });
                            exec('start https://enter.pollinations.ai/#pollen');
                        } else {
                            try {
                                const stats = await getImageQuotaStats();
                                setMessages(prev => {
                                    setCompletedIndex(prev.length + 1);
                                    return [...prev, {
                                        id: Date.now(),
                                        role: 'system',
                                        isImageStats: true,
                                        text: `• Hourly Limit: ${Number((stats.limit * 1000).toFixed(0))} credits\n` +
                                            `• Spent (Last 1hr): ${Number((stats.totalSpent * 1000).toFixed(0))} credits\n` +
                                            `• Remaining: ${Number((stats.remaining * 1000).toFixed(0))} credits\n` +
                                            `• Requests (Last 1hr): ${stats.activeCallsCount} requests\n` +
                                            (stats.nextResetMin > 0 ? `• Refreshes in: ${stats.nextResetMin}m` : ''),
                                        isMeta: true
                                    }];
                                });
                            } catch (e) {
                                setMessages(prev => {
                                    setCompletedIndex(prev.length + 1);
                                    return [...prev, {
                                        id: Date.now(),
                                        role: 'system',
                                        text: `[SYSTEM] Failed to load image quota stats.`,
                                        isMeta: true
                                    }];
                                });
                            }
                        }
                    } else if (parts[1]?.toLowerCase() === 'setup') {
                        if (parts[2]?.toLowerCase() === 'key') {
                            if (parts[3]) {
                                const matchedKey = ['default', 'custom'].find(k => k === parts[3].toLowerCase());
                                if (matchedKey) {
                                    const strategy = matchedKey === 'default' ? 'Default' : 'Custom';
                                    setImageSettings(prev => ({ ...prev, keyType: strategy }));
                                    const s = emojiSpace(2);
                                    setMessages(prev => {
                                        setCompletedIndex(prev.length + 1);
                                        return [...prev, { id: Date.now(), role: 'system', text: `[SYSTEM] Image key strategy set to ${strategy}`, isMeta: true }];
                                    });

                                    if (strategy === 'Custom') {
                                        setInputConfig({
                                            label: "Enter Pollinations API key (starting with sk_):",
                                            note: "Get a key from https://enter.pollinations.ai",
                                            key: 'imageSettings',
                                            subKey: 'apiKey',
                                            value: imageSettings.apiKey || '',
                                            returnView: 'chat'
                                        });
                                        setActiveView('input');
                                    }
                                } else {
                                    const s = emojiSpace(2);
                                    setMessages(prev => {
                                        setCompletedIndex(prev.length + 1);
                                        return [...prev, { id: Date.now(), role: 'system', text: `[SYSTEM] Invalid key option. Choose: Default or Custom.`, isMeta: true }];
                                    });
                                }
                            } else {
                                const s = emojiSpace(2);
                                setMessages(prev => {
                                    setCompletedIndex(prev.length + 1);
                                    return [...prev, { id: Date.now(), role: 'system', text: `[SYSTEM] Usage: /image setup Key <Default|Custom>`, isMeta: true }];
                                });
                            }
                        } else if (parts[2]?.toLowerCase() === 'quality') {
                            if (parts[3]) {
                                // Match exactly Low, Low-High, Medium, Medium-High, High, Ultra, Premium (case-insensitive check)
                                const matched = ['low', 'low-high', 'medium', 'medium-high', 'high', 'ultra', 'premium'].find(q => q === parts[3].toLowerCase());
                                if (matched) {
                                    // Map to the correct capitalized quality name
                                    const qualityMap = {
                                        'low': 'Low',
                                        'low-high': 'Low-High',
                                        'medium': 'Medium',
                                        'medium-high': 'Medium-High',
                                        'high': 'High',
                                        'ultra': 'Ultra',
                                        'premium': 'Premium'
                                    };
                                    const chosenQuality = qualityMap[matched];
                                    setImageSettings(prev => ({ ...prev, quality: chosenQuality }));
                                    const s = emojiSpace(2);
                                    setMessages(prev => {
                                        setCompletedIndex(prev.length + 1);
                                        return [...prev, { id: Date.now(), role: 'system', text: `[SYSTEM] Image quality set to ${chosenQuality}`, isMeta: true }];
                                    });
                                } else {
                                    const s = emojiSpace(2);
                                    setMessages(prev => {
                                        setCompletedIndex(prev.length + 1);
                                        return [...prev, { id: Date.now(), role: 'system', text: `[SYSTEM] Invalid quality level. Choose from: Low, Low-High, Medium, Medium-High, High, Ultra, Premium.`, isMeta: true }];
                                    });
                                }
                            } else {
                                const s = emojiSpace(2);
                                setMessages(prev => {
                                    setCompletedIndex(prev.length + 1);
                                    return [...prev, { id: Date.now(), role: 'system', text: `[SYSTEM] Usage: /image setup Quality <Low|Low-High|Medium|Medium-High|High|Ultra>`, isMeta: true }];
                                });
                            }
                        } else {
                            const s = emojiSpace(2);
                            setMessages(prev => {
                                setCompletedIndex(prev.length + 1);
                                return [...prev, { id: Date.now(), role: 'system', text: `[SYSTEM] Usage: /image setup <Key|Quality> ...`, isMeta: true }];
                            });
                        }
                    } else {
                        const s = emojiSpace(2);
                        setMessages(prev => {
                            setCompletedIndex(prev.length + 1);
                            return [...prev, { id: Date.now(), role: 'system', text: `[SYSTEM] Usage: /image setup <Key|Quality> ...`, isMeta: true }];
                        });
                    }
                    break;
                }
                case '/thinking': {
                    let formattedLevel;
                    if (parts[1]) {
                        let val = parts[1].toLowerCase();
                        const isBypass = parts.includes('--bypass');
                        formattedLevel = val.charAt(0).toUpperCase() + val.slice(1);
                        if (val === 'xhigh') {
                            formattedLevel = 'xHigh';
                        }

                        // Strict Mode Validation
                        if (!isBypass && mode === 'Flow' && (formattedLevel === 'High' || formattedLevel === 'xHigh')) {
                            setMessages(prev => {
                                setCompletedIndex(prev.length + 1);
                                return [...prev, { id: Date.now(), role: 'system', text: `[RESTRICTED] "${formattedLevel}" is restricted in Flow mode. Switch to Flux to enable Higher Thinking Levels.`, isMeta: true }];
                            });
                        } else {
                            setThinkingLevel(formattedLevel);
                            const s = emojiSpace(1);
                            setMessages(prev => { setCompletedIndex(prev.length + 1); return [...prev, { id: Date.now(), role: 'system', text: `[SYSTEM] Thinking level set to ${formattedLevel}${isBypass ? ` (Bypass Activated)` : ''}`, isMeta: true }]; });
                        }
                    } else {
                        setActiveView('thinking');
                    }
                    break;
                }
                case '/model': {
                    if (parts[1]) {
                        const mod = parts.slice(1).join(' ');
                        if (mod === 'gemma-4-31b-it' && apiTier !== 'Free' && aiProvider === 'Google') {
                            setMessages(prev => {
                                setCompletedIndex(prev.length + 1);
                                return [...prev, {
                                    id: Date.now(),
                                    role: 'system',
                                    text: `**[ACCESS DENIED]** Gemma is restricted to the Free API tier. Automatically switching you to **Gemini 3 Flash Preview** for optimal performance.`,
                                    isMeta: true
                                }];
                            });
                            setActiveModel('gemini-3-flash-preview');
                        } else {
                            setActiveModel(mod);
                            const s = emojiSpace(2);
                            setMessages(prev => { setCompletedIndex(prev.length + 1); return [...prev, { id: Date.now(), role: 'system', text: `[SYSTEM] Model switched to ${mod}`, isMeta: true }]; });
                        }
                    } else {
                        setActiveView('model');
                    }
                    break;
                }
                case '/settings': {
                    setActiveView('settings');
                    break;
                }
                case '/key': {
                    setActiveView('key');
                    break;
                }
                case '/profile': {
                    setActiveView('profile');
                    break;
                }
                case '/stats': {
                    const run = async () => {
                        const usage = await getDailyUsage();
                        const mUsage = await getMonthlyUsage();
                        setDailyUsage(usage);
                        setMonthlyUsage(mUsage);
                        setStatsMode('daily');
                        setActiveView('stats');
                    };
                    run();
                    break;
                }
                case '/save': {
                    const name = parts.slice(1).join(' ') || `Session ${new Date().toLocaleTimeString()}`;
                    saveChat(chatId, name, messages);
                    setMessages(prev => { setCompletedIndex(prev.length + 1); return [...prev, { id: Date.now(), role: 'system', text: `[MEMORY] Chat saved as "${name}" (ID: ${chatId})`, isMeta: true }]; });
                    break;
                }
                case '/export': {
                    const exportFile = `export-fluxflow-${chatId}.txt`;
                    const exportPath = path.join(process.cwd(), exportFile);

                    const exportLines = [];
                    let insideAgentBlock = false;

                    for (let i = 0; i < messages.length; i++) {
                        const msg = messages[i];
                        if (!msg) continue;

                        if (msg.role === 'system' || msg.isMeta || msg.isLogo || String(msg.id).startsWith('welcome')) {
                            continue;
                        }

                        if (msg.role === 'user') {
                            let cleanUserText = msg.text || '';
                            cleanUserText = cleanUserText.replace(/\s*\[Prompted on:.*?\]/g, '').trim();

                            if (exportLines.length > 0) {
                                exportLines.push('');
                            }
                            exportLines.push('[USER]');
                            exportLines.push(cleanUserText);
                            insideAgentBlock = false;
                        } else if (msg.role === 'think') {
                            if (!insideAgentBlock) {
                                exportLines.push('');
                                exportLines.push('[AGENT]');
                                insideAgentBlock = true;
                            }
                            const cleanThinkText = (msg.text || '')
                                .replace(/\[\[\s*turn\s*:\s*(continue|finish)\s*\]\]/gi, '')
                                .replace(/\[\[END\]\]/gi, '')
                                .replace(/\[\[TOOL RESULTS\]\]/gi, '')
                                .replace(/\[TOOL RESULTS\]/gi, '')
                                .replace(/\[TOOL RESULT\]/gi, '')
                                .trim();
                            if (cleanThinkText) {
                                exportLines.push('[thoughts]');
                                exportLines.push(cleanThinkText);
                            }
                        } else if (msg.role === 'agent') {
                            if (!insideAgentBlock) {
                                exportLines.push('');
                                exportLines.push('[AGENT]');
                                insideAgentBlock = true;
                            }

                            const blocks = parseAgentText(msg.text || '');
                            for (const block of blocks) {
                                if (block.type === 'output') {
                                    const cleanContent = block.content
                                        .replace(/\[\[\s*turn\s*:\s*(continue|finish)\s*\]\]/gi, '')
                                        .replace(/\[\[END\]\]/gi, '')
                                        .replace(/\[\[TOOL RESULTS\]\]/gi, '')
                                        .replace(/\[TOOL RESULTS\]/gi, '')
                                        .replace(/\[TOOL RESULT\]/gi, '')
                                        .trim();
                                    if (cleanContent) {
                                        exportLines.push('[output]');
                                        exportLines.push(cleanContent);
                                    }
                                } else if (block.type === 'tool') {
                                    exportLines.push('[tool]');
                                    exportLines.push(`${block.toolName} ${block.args}`);
                                }
                            }
                        }
                    }

                    const fileContent = exportLines.join('\n');
                    try {
                        fs.writeFileSync(exportPath, fileContent, 'utf8');

                        setMessages(prev => {
                            setCompletedIndex(prev.length + 1);
                            return [...prev, {
                                id: Date.now(),
                                role: 'system',
                                text: `[EXPORT] Chat exported to "${exportFile}"`,
                                isMeta: true
                            }];
                        });
                    } catch (err) {
                        setMessages(prev => {
                            setCompletedIndex(prev.length + 1);
                            return [...prev, {
                                id: Date.now(),
                                role: 'system',
                                text: `[EXPORT ERROR] Failed to export chat: ${err.message}`,
                                isMeta: true
                            }];
                        });
                    }
                    break;
                }
                case '/chats': {
                    const run = async () => {
                        const history = await loadHistory();
                        const list = Object.entries(history).map(([id, info]) => `• ${id}: ${info.name}`).join('\n');
                        setMessages(prev => {
                            setCompletedIndex(prev.length + 1);
                            return [...prev, { id: Date.now(), role: 'system', text: `[HISTORY] Saved Chats:\n${list || 'No saved chats found.'}`, isMeta: true }];
                        });
                    };
                    run();
                    break;
                }
                case '/memory': {
                    setActiveView('memory');
                    break;
                }
                case '/reset': {
                    const runReset = async () => {
                        try {
                            setMessages(prev => {
                                setCompletedIndex(prev.length + 1);
                                return [...prev, { id: Date.now(), role: 'system', text: '[NUCLEAR] Initiating reset...', isMeta: true }];
                            });

                            if (fs.existsSync(LOGS_DIR)) fs.removeSync(LOGS_DIR);
                            if (fs.existsSync(SECRET_DIR)) fs.removeSync(SECRET_DIR);
                            if (fs.existsSync(SETTINGS_FILE)) fs.removeSync(SETTINGS_FILE);

                            // Optional: Wipe the entire ~/.fluxflow root if empty
                            try {
                                const items = fs.readdirSync(FLUXFLOW_DIR);
                                if (items.length === 0) fs.removeSync(FLUXFLOW_DIR);
                            } catch (e) { }

                            setTimeout(() => {
                                setActiveView('exit');
                                setTimeout(() => process.exit(0), 500);
                            }, 500);
                        } catch (err) {
                            setMessages(prev => {
                                setCompletedIndex(prev.length + 1);
                                return [...prev, { id: Date.now(), role: 'system', text: `[RESET ERROR] Failed to clear data: ${err.message}` }];
                            });
                        }
                    };
                    runReset();
                    break;
                }
                case '/about': {
                    const s = emojiSpace(2);
                    const aboutText = `• FluxFlow Version: v${versionFluxflow}\n` +
                        `• Status: ${latestVer && latestVer !== versionFluxflow ? `Update Available [v${latestVer}]` : 'Up to date'}\n` +
                        `• Released on: ${updatedOn}`;
                    setMessages(prev => {
                        setCompletedIndex(prev.length + 1);
                        return [...prev, { id: 'about-' + Date.now(), role: 'system', text: aboutText, isAboutRecord: true, isMeta: true }];
                    });
                    break;
                }
                case '/changelog': {
                    const platform = process.platform;
                    const command = platform === 'win32' ? 'start' : platform === 'darwin' ? 'open' : 'xdg-open';
                    exec(`${command} ${CHANGELOG_URL}`);
                    setMessages(prev => {
                        setCompletedIndex(prev.length + 1);
                        return [...prev, { id: Date.now(), role: 'system', text: `[BROWSER] Opening changelog: ${CHANGELOG_URL}`, isMeta: true }];
                    });
                    break;
                }
                case '/docs': {
                    if (!DOCS_URL) {
                        setMessages(prev => {
                            setCompletedIndex(prev.length + 1);
                            return [...prev, { id: Date.now(), role: 'system', text: `[BROWSER] Documentation URL is not configured.`, isMeta: true }];
                        });
                        break;
                    }
                    const platform = process.platform;
                    const command = platform === 'win32' ? 'start' : platform === 'darwin' ? 'open' : 'xdg-open';
                    exec(`${command} ${DOCS_URL}`);
                    setMessages(prev => {
                        setCompletedIndex(prev.length + 1);
                        return [...prev, { id: Date.now(), role: 'system', text: `[BROWSER] Opening documentation: ${DOCS_URL}`, isMeta: true }];
                    });
                    break;
                }
                case '/fluxflow': {
                    const args = parts.slice(1);
                    if (args[0] === 'init') {
                        const template = `# FluxFlow Configuration\n# This file defines project-specific instructions for the Flux Flow Agent.\n\n# IDENTITY & TONE\n- Tone: Technical, precise, and highly efficient.\n\n# PROJECT CONTEXT\n- Goal: [Describe your project goal here]\n- Tech Stack: [List your technologies here]\n\n# CUSTOM RULES\n- [Add specific coding standards or rules here]\n\n# SKILLS & WORKFLOWS\n- [Define custom step-by-step recipes for this project here]\n`;
                        const filePath = path.join(process.cwd(), 'FluxFlow.md');
                        if (fs.pathExistsSync(filePath)) {
                            setMessages(prev => {
                                setCompletedIndex(prev.length + 1);
                                return [...prev, { id: 'init-err-' + Date.now(), role: 'system', text: 'ERROR: FluxFlow.md already exists in this directory.', isMeta: true }];
                            });
                        } else {
                            try {
                                fs.writeFileSync(filePath, template);
                                setMessages(prev => {
                                    setCompletedIndex(prev.length + 1);
                                    return [...prev, { id: 'init-ok-' + Date.now(), role: 'system', text: '[SUCCESS] FluxFlow.md has been initialized. You can now customize it for this project.', isMeta: true }];
                                });
                            } catch (err) {
                                setMessages(prev => {
                                    setCompletedIndex(prev.length + 1);
                                    return [...prev, { id: 'init-err-' + Date.now(), role: 'system', text: `ERROR: Failed to initialize FluxFlow.md: ${err.message}`, isMeta: true }];
                                });
                            }
                        }
                    } else {
                        setMessages(prev => {
                            setCompletedIndex(prev.length + 1);
                            return [...prev, { id: 'ff-err-' + Date.now(), role: 'system', text: 'Usage: /fluxflow init', isMeta: true }];
                        });
                    }
                    break;
                }
                case '/update': {
                    const arg = parts[1]?.toLowerCase();
                    if (arg === 'check') {
                        performVersionCheck(true);
                        break;
                    }
                    const isForce = parts.includes('--latest');
                    setActiveView('update');
                    break;
                }
                case '/gemini': {
                    const randomQuote = GEMINI_QUOTES[Math.floor(Math.random() * GEMINI_QUOTES.length)];
                    setMessages(prev => {
                        setCompletedIndex(prev.length + 1);
                        return [...prev, { id: Date.now(), role: 'system', text: `✨ [GEMINI CLI] ${randomQuote}` }];
                    });
                    setInput('');
                    break;
                }
                case '/compress': {
                    setInput('');
                    const cleanCount = messages.filter(m => (m.role === 'user' || m.role === 'agent' || m.role === 'system') && !String(m.id).startsWith('welcome') && !m.isMeta).length;
                    const tokens = sessionStats?.tokens || 0;
                    if (cleanCount < 100 || tokens < 32768) {
                        const s = emojiSpace(2);
                        setMessages(prev => {
                            setCompletedIndex(prev.length + 1);
                            return [...prev, {
                                id: Date.now(),
                                role: 'system',
                                text: `[SYSTEM] Compression skipped: History requires at least 100 messages and 32k tokens (current: ${cleanCount}/100 msgs, ${tokens}/32768 tokens).`,
                                isMeta: true
                            }];
                        });
                        break;
                    }
                    const runCompress = async () => {
                        setIsCompressing(true);
                        const s = emojiSpace(2);
                        setMessages(prev => {
                            setCompletedIndex(prev.length + 1);
                            return [...prev, { id: Date.now(), role: 'system', text: `[SYSTEM] Compressing session history...`, isMeta: true }];
                        });

                        try {
                            const config = {
                                chatId,
                                aiProvider,
                                apiKey,
                                thinkingLevel,
                                mode,
                                janitorModel,
                                systemSettings,
                                sessionStats
                            };
                            const summary = await compressHistory(config, messages);
                            if (summary) {
                                const s = emojiSpace(2);
                                setMessages(prev => {
                                    const finalMsgs = [...prev, {
                                        id: Date.now(),
                                        role: 'system',
                                        text: `[SYSTEM] Chat History compressed saving tokens.`,
                                        isMeta: true
                                    }];
                                    setCompletedIndex(finalMsgs.length);
                                    return finalMsgs;
                                });
                            } else {
                                setMessages(prev => {
                                    setCompletedIndex(prev.length + 1);
                                    return [...prev, { id: Date.now(), role: 'system', text: '[SYSTEM] Compression failed (no summary returned).', isMeta: true }];
                                });
                            }
                        } catch (err) {
                            setMessages(prev => {
                                setCompletedIndex(prev.length + 1);
                                return [...prev, { id: Date.now(), role: 'system', text: `[SYSTEM] Error during compression: ${err.message}`, isMeta: true }];
                            });
                        } finally {
                            setIsCompressing(false);
                        }
                    };
                    runCompress();
                    break;
                }
                case '/help': {
                    setMessages(prev => {
                        setCompletedIndex(prev.length + 1);
                        return [...prev, { id: Date.now(), role: 'system', isHelpRecord: true, isMeta: true }];
                    });
                    break;
                }
                case '/btw': {
                    setMessages(prev => { setCompletedIndex(prev.length + 1); return [...prev, { id: Date.now(), role: 'system', text: `[SYSTEM] /btw only available when agent is working`, isMeta: true }]; });
                    break;
                }
                default:
                    const s = emojiSpace(2);
                    setMessages(prev => { setCompletedIndex(prev.length + 1); return [...prev, { id: Date.now(), role: 'system', text: `[SYSTEM] Unknown command: ${cmd}`, isMeta: true }]; });
            }
        } else {
            // Normal chat message with temporal grounding
            const timestamp = `[Prompted on: ${new Date().toLocaleString(undefined, { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}]`;
            const userMessage = { id: 'user-' + Date.now(), role: 'user', text: `${absoluteClean}\n\n${timestamp}` };
            setMessages(prev => {
                setCompletedIndex(prev.length + 1); // Flush the user message immediately
                return [...prev, userMessage];
            });

            const streamChat = async () => {
                let hasFiredJanitor = false;
                setIsProcessing(true);
                setIsExpanded(false);
                let apiStart = Date.now();
                let isFirstPacket = true;
                try {
                    const rawHistory = [...messages, userMessage]
                        .filter(m =>
                            m.role !== 'think' &&
                            !m.isVisualFeedback &&
                            !m.isMeta &&
                            !String(m.id).startsWith('welcome')
                        );

                    const cleanHistoryForAI = [];
                    rawHistory.forEach((m, idx) => {
                        let text = m.fullText || m.text;
                        // Strip metadata from older user messages
                        if (m.role === 'user' && idx < rawHistory.length - 1) {
                            if (text.includes('**CONTEXT SUMMARY OF PREVIOUS TURNS')) {
                                const summaryIndex = text.indexOf('[SYSTEM METADATA (PRIORITY: DYNAMIC)]');
                                if (summaryIndex !== -1) {
                                    text = text.substring(summaryIndex).trim();
                                }
                            } else {
                                const userIndex = text.lastIndexOf('[USER]');
                                if (userIndex !== -1) {
                                    text = text.substring(userIndex + 6).trim();
                                }
                            }
                        }

                        // Group consecutive tool results
                        if (m.role === 'system' && text?.startsWith('[TOOL RESULT]')) {
                            const prev = cleanHistoryForAI[cleanHistoryForAI.length - 1];
                            if (prev && prev.role === 'system' && prev.text?.startsWith('[TOOL RESULT]')) {
                                prev.text += '\n\n' + text;
                                return;
                            }
                        }

                        cleanHistoryForAI.push({
                            ...m,
                            text
                        });
                    });
                    const stream = getAIStream(
                        activeModel,
                        cleanHistoryForAI,
                        {
                            profile: profileData,
                            thinkingLevel,
                            mode,
                            systemSettings,
                            janitorModel,
                            sessionStats,
                            chatId,
                            aiProvider,
                            apiKey,
                            apiTier,
                            cols: terminalSize.columns - 6,
                            rows: 30,
                            onExecStart: (cmd) => {
                                setActiveCommand(cmd);
                                setExecOutput('');
                            },
                            onExecChunk: (chunk) => {
                                setExecOutput(prev => prev + chunk);
                            },
                            onExecEnd: () => {
                                setMessages(prev => {
                                    if (!activeCommandRef.current) return prev;
                                    // Normalize output for history/agent (resolve carriage returns and terminal movements to simulate terminal overwrite)
                                    const rawOutput = execOutputRef.current || '';
                                    const normalizedOutput = cleanTerminalOutput(rawOutput);
                                    const finalStatus = `[TERMINAL_RECORD]
                                    COMMAND: ${activeCommandRef.current}
                                    PTY: ${isActiveCommandPty}
                                    OUTPUT: ${normalizedOutput.replace(/\n{3,}/g, '\n\n')}`;
                                    return [...prev, { id: 'term-' + Date.now(), role: 'system', text: finalStatus, isTerminalRecord: true }];
                                });
                                setActiveCommand(null);
                                setIsTerminalFocused(false);
                                setExecOutput('');
                            },
                            onToolResult: (status, toolName) => {
                                if (status === 'success') {
                                    setSessionToolSuccess(prev => prev + 1);
                                    if (toolName === 'generate_image') {
                                        setSessionImageCount(prev => prev + 1);
                                        const costs = {
                                            'Low': 0.001,
                                            'Low-High': 0.002,
                                            'Medium': 0.008,
                                            'Medium-High': 0.01,
                                            'High': 0.045,
                                            'Ultra': 0.0488,
                                            'Premium': 0.1
                                        };
                                        const cost = costs[imageSettings.quality] || 0.002;
                                        setSessionImageCredits(prev => prev + cost);
                                    }
                                } else if (status === 'denied') {
                                    setSessionToolDenied(prev => prev + 1);
                                } else {
                                    setSessionToolFailure(prev => prev + 1);
                                }
                            },
                            onToolApproval: async (tool, args) => {
                                const isAuto = autoAcceptWrites || systemSettings.autoExec;

                                if (tool === 'exec_command') {
                                    const { command } = parseArgs(args || '{}');
                                    const safeRegex = /^(echo|ls|dir|pwd|cd|git status|git log|git diff|type|cat|help)\b/i;

                                    if (isAuto || (command && safeRegex.test(command.trim()))) return 'allow';

                                    return new Promise((resolve) => {
                                        setPendingApproval({ tool, args, resolve });
                                        setActiveView('terminalApproval');
                                    });
                                }

                                if (isAuto) return 'allow';

                                return new Promise((resolve) => {
                                    setPendingApproval({ tool, args, resolve });
                                    setActiveView('approval');
                                });
                            },
                            onAskUser: async (question, options) => {
                                return new Promise((resolve) => {
                                    setPendingAsk({
                                        question,
                                        options,
                                        resolve: (val) => {
                                            setMessages(prev => [
                                                ...prev,
                                                {
                                                    id: 'ask-' + Date.now(),
                                                    role: 'system',
                                                    text: `💬 **Ask User**\nSelection: ${val}`,
                                                    isAskRecord: true
                                                }
                                            ]);
                                            resolve(val);
                                        }
                                    });
                                    setActiveView('ask');
                                });
                            }
                        },
                        async () => {
                            // Use the Ref directly to avoid stale closure issues with current state
                            if (queuedPromptRef.current) {
                                const p = queuedPromptRef.current;
                                setQueuedPrompt(null);
                                queuedPromptRef.current = null;

                                // [SYNC] Mark the manual hint as "INJECTED" in the UI thread
                                setMessages(prev => {
                                    const index = [...prev].reverse().findIndex(m => m.text?.includes('[STEERING HINT: QUEUED]') || m.text?.includes('[QUESTION: QUEUED]'));
                                    if (index !== -1) {
                                        const actualIndex = prev.length - 1 - index;
                                        const newMsgs = [...prev];
                                        let text = newMsgs[actualIndex].text;
                                        if (text.includes('[STEERING HINT: QUEUED]')) {
                                            text = text.replace('[STEERING HINT: QUEUED]', '[STEERING HINT: INJECTED]');
                                        } else if (text.includes('[QUESTION: QUEUED]')) {
                                            text = text.replace('[QUESTION: QUEUED]', '[QUESTION: ASKED]');
                                        }
                                        newMsgs[actualIndex] = {
                                            ...newMsgs[actualIndex],
                                            text,
                                            color: 'cyan'
                                        };
                                        return newMsgs;
                                    }
                                    return prev;
                                });

                                return p;
                            }
                            return null;
                        },
                        versionFluxflow
                    );

                    let inThinkMode = false;
                    let currentThinkId = null;
                    let currentAgentId = null;
                    let inCodeBlock = false;
                    let inToolCall = false;
                    let thinkConsumedInTurn = false;
                    let toolCallEncounteredInTurn = false;
                    let toolCallBalance = 0;
                    let inToolCallString = null;
                    const signalRegex = /\[?\s*turn\s*:\s*.*?\s*\]?/gi;
                    // const signalRegex = /\[?_DISABLED_SIGNAL_REGEX_\]?/gi;

                    for await (const packet of stream) {
                        // fs.appendFileSync("DEBUG.txt", JSON.stringify(packet) + "\n");
                        if (isFirstPacket && packet.type === 'text') {
                            apiStart = Date.now();
                            isFirstPacket = false;
                        }
                        if (packet.type === 'status') {
                            setStatusText(packet.content);
                            if (isBridgeConnected()) {
                                sendStatus(packet.content);
                            }
                            continue;
                        }
                        if (packet.type === 'status_history') {
                            setStatusText(packet.content);
                            if (isBridgeConnected()) {
                                sendStatus(packet.content);
                            }
                            setMessages(prev => [...prev, { id: 'condense-' + Date.now(), role: 'system', text: `[SYSTEM] ${packet.content}`, isMeta: true }]);
                            continue;
                        }
                        if (packet.type === 'summary_injected') {
                            setMessages(prev => prev.map(m =>
                                m.id === packet.content.id
                                    ? { ...m, fullText: packet.content.text }
                                    : m
                            ));
                            continue;
                        }
                        if (packet.type === 'spinner') {
                            setIsSpinnerActive(packet.content);
                            continue;
                        }
                        if (packet.type === 'model_update') {
                            setTempModelOverride(packet.content);
                            continue;
                        }
                        if (packet.type === 'turn_reset') {
                            currentThinkId = null;
                            currentAgentId = null;
                            inThinkMode = false;
                            inCodeBlock = false;
                            inToolCall = false;
                            toolCallEncounteredInTurn = false;
                            thinkConsumedInTurn = false;
                            continue;
                        }
                        if (packet.type === 'interactive_turn_finished') {
                            setIsProcessing(false);
                            if (isBridgeConnected()) {
                                sendStatus(null);
                            }
                            hasFiredJanitor = true;

                            runJanitorTask(
                                { profile: profileData, thinkingLevel, mode, janitorModel, chatId, systemSettings, sessionStats, aiProvider, apiKey },
                                packet.data.agentText,
                                packet.data.fullAgentTextRaw,
                                packet.data.history,
                                {
                                    onMemoryUpdated: () => setMessages(prev => {
                                        const newMsgs = [...prev];
                                        if (newMsgs.length > 0) newMsgs[newMsgs.length - 1].memoryUpdated = true;
                                        return newMsgs;
                                    }),
                                    onBackgroundIncrement: () => setSessionBackgroundCalls(prev => prev + 1)
                                }
                            );
                            continue;
                        }
                        if (packet.type === 'visual_feedback') {
                            setMessages(prev => [...prev, {
                                id: 'feedback-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9),
                                role: 'system',
                                text: packet.content,
                                isVisualFeedback: true
                            }]);
                            continue;
                        }
                        if (packet.type === 'exec_start') {
                            continue; // Yield consumed just to trigger React render loop
                        }
                        if (packet.type === 'liveTokens') {
                            setSessionStats({ tokens: packet.content });
                            continue;
                        }
                        if (packet.type === 'usage') {
                            const total = packet.content.totalTokenCount || 0;
                            const cached = packet.content.cachedContentTokenCount || 0;
                            const candidates = packet.content.candidatesTokenCount || 0;
                            setSessionStats({ tokens: total });
                            setSessionTotalTokens(prev => prev + total);
                            if (cached > 0) {
                                setSessionTotalCachedTokens(prev => prev + cached);
                            }
                            if (candidates > 0) {
                                setSessionTotalCandidateTokens(prev => prev + candidates);
                            }
                            setSessionAgentCalls(prev => prev + 1);
                            continue;
                        }
                        if (packet.type === 'tool_time') {
                            setSessionToolTime(prev => prev + packet.content);
                            continue;
                        }
                        if (packet.type === 'tool_result') {
                            setMessages(prev => [...prev, {
                                id: 'tool-' + Date.now(),
                                role: 'system',
                                text: packet.content,
                                fullText: packet.aiContent, // Preserve raw data for next turn
                                binaryPart: packet.binaryPart, // v1.5.0 Multimodal Support
                                toolName: packet.toolName
                            }]);

                            // Track code changes
                            if (packet.toolName === 'update_file' && packet.aiContent) {
                                const diffLines = packet.aiContent.split('\n');
                                let added = 0;
                                let removed = 0;
                                let insideDiff = false;
                                for (const line of diffLines) {
                                    if (line.includes('[DIFF_START]')) {
                                        insideDiff = true;
                                        continue;
                                    }
                                    if (line.includes('[DIFF_END]')) {
                                        insideDiff = false;
                                        continue;
                                    }
                                    if (insideDiff) {
                                        if (/^\+\d+/.test(line)) {
                                            added++;
                                        } else if (/^\-\d+/.test(line)) {
                                            removed++;
                                        }
                                    }
                                }
                                linesAdded += added;
                                linesRemoved += removed;
                                addToUsage('linesAdded', added);
                                addToUsage('linesRemoved', removed);
                            } else if (packet.toolName === 'write_file' && packet.aiContent) {
                                const statsMatch = packet.aiContent.match(/- Stats: \[(\d+) lines/);
                                const verifiedLinesCount = statsMatch ? parseInt(statsMatch[1]) : 0;

                                let oldLinesCount = 0;
                                if (packet.aiContent.includes('Old File contents:')) {
                                    const ancestryLines = packet.aiContent.split('\n');
                                    let insideOldFile = false;
                                    for (const line of ancestryLines) {
                                        if (line.includes('Old File contents:')) {
                                            insideOldFile = true;
                                            continue;
                                        }
                                        if (insideOldFile) {
                                            if (line.trim() === '') {
                                                insideOldFile = false;
                                            } else if (/^\d+ \|/.test(line)) {
                                                oldLinesCount++;
                                            }
                                        }
                                    }
                                }
                                linesAdded += verifiedLinesCount;
                                linesRemoved += oldLinesCount;
                                addToUsage('linesAdded', verifiedLinesCount);
                                addToUsage('linesRemoved', oldLinesCount);
                            }

                            continue;
                        }

                        let chunkText = packet.content;
                        const chunkLower = chunkText.toLowerCase();

                        // [CONTEXT TRACKING] Update state based on chunk content
                        if (chunkText.includes('```')) inCodeBlock = !inCodeBlock;

                        if (chunkLower.includes('tool:functions.')) {
                            inToolCall = true;
                            // [HARDENING] Reset balance and look for outer bracket in context
                            toolCallBalance = 0;
                            inToolCallString = null;
                            if (chunkText.includes('[tool:functions.')) toolCallBalance = 0; // The '[' will be counted in the loop
                        }

                        if (inToolCall) {
                            for (let j = 0; j < chunkText.length; j++) {
                                const char = chunkText[j];
                                if (!inToolCallString && (char === "'" || char === '"' || char === '`')) {
                                    inToolCallString = char;
                                } else if (inToolCallString && char === inToolCallString && chunkText[j - 1] !== '\\') {
                                    inToolCallString = null;
                                }

                                if (!inToolCallString) {
                                    if (char === '(' || char === '[') toolCallBalance++;
                                    else if (char === ')' || char === ']') toolCallBalance--;
                                }
                            }
                            if (toolCallBalance <= 0 && !inToolCallString) {
                                inToolCall = false;
                            }
                        }

                        // 1. Detect transition to THINK mode (Handles <think> or <thought>)
                        const hasThinkTag = chunkLower.includes('<think') || chunkLower.includes('<thought');
                        const canThink = !inThinkMode && !inCodeBlock && !inToolCall && !thinkConsumedInTurn;

                        if (hasThinkTag && canThink) {
                            const match = chunkText.match(/<(think|thought)/i);
                            const tagIndex = match.index;
                            const beforeText = chunkText.substring(0, tagIndex);
                            const afterText = chunkText.substring(tagIndex);

                            if (beforeText) {
                                if (!currentAgentId) {
                                    currentAgentId = 'agent-' + Date.now();
                                    setMessages(prev => [...prev, { id: currentAgentId, role: 'agent', text: beforeText, isStreaming: true }]);
                                } else {
                                    setMessages(prev => prev.map(m =>
                                        m.id === currentAgentId
                                            ? { ...m, text: m.text + beforeText, isStreaming: true }
                                            : m
                                    ));
                                }
                            }

                            inThinkMode = true;
                            thinkConsumedInTurn = true;
                            let thinkStartText = afterText.replace(/<(think|thought)>/gi, '');
                            currentThinkId = 'think-' + Date.now();
                            setMessages(prev => [...prev, { id: currentThinkId, role: 'think', text: thinkStartText, isStreaming: true, startTime: Date.now() }]);
                            continue;
                        }

                        // 2. Aggressive Transition Analysis (Handles </think> or </thought>)
                        if ((chunkLower.includes('</think>') || chunkLower.includes('</thought>')) && currentThinkId) {
                            const parts = chunkText.split(/<\/(think|thought)>/gi);
                            const thinkPart = parts[0] || '';
                            // Parts indices: 0: text before </think>, 1: 'think' or 'thought', 2+: rest
                            const agentPart = parts.slice(2).join('').replace(/<\/?(think|thought)>/gi, '');

                            setMessages(prev => {
                                const newMsgs = prev.map(m => {
                                    if (m.id === currentThinkId && typeof m.id === 'string') {
                                        const startTime = m.startTime || parseInt(m.id.split('-')[1]) || Date.now();
                                        const duration = Date.now() - startTime;
                                        return { ...m, text: m.text + thinkPart, isStreaming: false, duration };
                                    }
                                    return m;
                                });

                                inThinkMode = false;
                                currentAgentId = 'agent-' + Date.now();
                                return [...newMsgs, { id: currentAgentId, role: 'agent', text: agentPart, isStreaming: true }];
                            });
                            continue;
                        }

                        // 3. Append to target role with Leak Protection
                        if (inThinkMode && currentThinkId) {
                            setMessages(prev => {
                                let transitioning = false;
                                let transitionContent = '';

                                const newMsgs = prev.map(m => {
                                    if (m.id === currentThinkId) {
                                        const newText = m.text + chunkText;
                                        if (newText.toLowerCase().includes('</think>')) {
                                            transitioning = true;
                                            const parts = newText.split(/<\/think>/gi);
                                            transitionContent = parts.slice(1).join('</think>') || '';
                                            const startTime = m.startTime || parseInt(m.id.split('-')[1]) || Date.now();
                                            const duration = Date.now() - startTime;
                                            return { ...m, text: parts[0], isStreaming: false, duration };
                                        }
                                        return { ...m, text: newText, isStreaming: true };
                                    }
                                    return m;
                                });

                                if (transitioning) {
                                    inThinkMode = false;
                                    currentAgentId = 'agent-' + Date.now();
                                    return [...newMsgs, { id: currentAgentId, role: 'agent', text: transitionContent.replace(/<\/?(think|thought)>/gi, ''), isStreaming: true }];
                                }
                                return newMsgs;
                            });
                        } else if (!inThinkMode) {
                            // [SIGNAL MONITOR] Mark turn state if tool call encountered
                            const chunkLower = chunkText.toLowerCase();
                            if (!toolCallEncounteredInTurn && chunkLower.includes('tool:functions.')) {
                                toolCallEncounteredInTurn = true;
                            }

                            if (!currentAgentId) {
                                currentAgentId = 'agent-' + Date.now();
                                setMessages(prev => [...prev, { id: currentAgentId, role: 'agent', text: chunkText, isStreaming: true }]);
                            } else {
                                setMessages(prev => prev.map(m =>
                                    m.id === currentAgentId
                                        ? { ...m, text: m.text + chunkText, isStreaming: true }
                                        : m
                                ));
                            }
                        }
                    }
                    const apiEnd = Date.now();
                    setSessionApiTime(prev => prev + (apiEnd - apiStart));
                } catch (err) {
                    setMessages(prev => {
                        setCompletedIndex(prev.length + 1);
                        return [...prev, { id: 'error-' + Date.now(), role: 'system', text: `❌ ERROR: ${err.message}` }];
                    });
                } finally {
                    setIsProcessing(false);
                    setStatusText(null);

                    if (!hasFiredJanitor) {
                        if (process.stdout.isTTY) {
                            process.stdout.write('\x1b]0;FluxFlow | Idle\x07');
                            process.stdout.write('\x1b]633;P;TerminalTitle=FluxFlow | Idle\x07');
                        }
                    }

                    // If a prompt was queued but the agent finished, show resolution modal
                    if (queuedPromptRef.current) {
                        setResolutionData(queuedPromptRef.current);
                        setQueuedPrompt(null);
                        const hintToResolve = queuedPromptRef.current;
                        queuedPromptRef.current = null;

                        // [SYNC] Mark as "BUFFERED" (waiting for resolution)
                        setMessages(prev => {
                            const newMsgs = [...prev];
                            const hintMsg = newMsgs.reverse().find(m => m.text?.includes('[STEERING HINT: QUEUED]') || m.text?.includes('[QUESTION: QUEUED]'));
                            if (hintMsg) {
                                if (hintMsg.text.includes('[STEERING HINT: QUEUED]')) {
                                    hintMsg.text = hintMsg.text.replace('[STEERING HINT: QUEUED]', '[STEERING HINT: FINISHED_TURN]');
                                } else if (hintMsg.text.includes('[QUESTION: QUEUED]')) {
                                    hintMsg.text = hintMsg.text.replace('[QUESTION: QUEUED]', '[QUESTION: FINISHED_TURN]');
                                }
                            }
                            return newMsgs.reverse();
                        });

                        setActiveView('resolution');
                    }

                    setMessages(prev => {
                        const totalDuration = Date.now() - apiStart;
                        let foundLastAgent = false;
                        const newMsgs = [...prev].reverse().map(m => {
                            let updated = m.isStreaming ? { ...m, isStreaming: false } : m;
                            if (!foundLastAgent && updated.role === 'agent') {
                                foundLastAgent = true;
                                updated = { ...updated, workedDuration: totalDuration };
                            }
                            return updated;
                        }).reverse();
                        const historyToSave = newMsgs.filter(m => !String(m.id).startsWith('welcome') && !m.isMeta);
                        // Pass null as name to preserve whatever the Janitor has set in the background
                        saveChat(chatId, null, historyToSave);
                        setCompletedIndex(newMsgs.length);
                        return newMsgs;
                    });
                }
            };

            streamChat();
        }

        setInput('');
        setIsExpanded(false);
    };

    const suggestions = useMemo(() => {
        if (input.startsWith('/') && !isFilePickerDismissed) {
            const parts = input.split(' ');
            const query = parts[parts.length - 1].toLowerCase();

            // Level 1: Main Commands
            if (parts.length === 1) {
                const cleanQuery = query.startsWith('/') ? query.slice(1) : query;
                return COMMANDS.filter(c => {
                    const cleanCmd = c.cmd.startsWith('/') ? c.cmd.slice(1) : c.cmd;
                    return cleanCmd.toLowerCase().includes(cleanQuery);
                });
            }

            // Deep Nested Commands Autocomplete Engine
            let currentList = COMMANDS;
            for (let i = 0; i < parts.length - 1; i++) {
                const part = parts[i].toLowerCase();
                const found = currentList.find(c => c.cmd.toLowerCase() === part);
                if (found && found.subs) {
                    currentList = found.subs;
                } else {
                    return [];
                }
            }

            return currentList.filter(s => s.cmd.toLowerCase().includes(query));
        }

        // File Autocomplete Support
        const parts = input.split(' ');
        const lastPart = parts[parts.length - 1];
        if (lastPart && lastPart.startsWith('@') && !isFilePickerDismissed) {
            const hashIndex = lastPart.indexOf('#');
            const hasHash = hashIndex !== -1;
            const query = hasHash ? lastPart.substring(1, hashIndex).toLowerCase() : lastPart.slice(1).toLowerCase();
            const suffix = hasHash ? lastPart.substring(hashIndex) : '';
            const projectFiles = getProjectFiles(process.cwd());

            const matches = projectFiles.filter(f => f.name.toLowerCase().includes(query));
            return matches.map(f => {
                const relPath = f.relativePath.replace(/\\/g, '/');
                const formattedPath = relPath.startsWith('.') ? relPath : './' + relPath;
                return {
                    cmd: '@[' + formattedPath + suffix + ']',
                    desc: f.relativePath
                };
            });
        }

        return [];
    }, [input, isFilePickerDismissed]);

    // Reset selected index when input changes to avoid OOB
    useEffect(() => {
        setSelectedIndex(0);
    }, [suggestions]);

    const CustomMenuItem = ({ label, isSelected }) => {
        const isCancel = label === 'Cancel' || label === 'Back' || label.toLowerCase().includes('exit') || label.toLowerCase().includes('back');
        return (
            <Box
                marginTop={isCancel ? 1 : 0}
                backgroundColor={isSelected ? "#2a2a2a" : undefined}
                paddingX={1}
                width="100%"
            >
                <Text color={isSelected ? 'white' : 'gray'} bold={isSelected}>
                    {isSelected ? '❯ ' : '  '}{label}
                </Text>
            </Box>
        );
    };

    const renderProgressBar = (label, current, limit) => {
        const percent = limit > 0 ? Math.min(100, Math.round((current / limit) * 100)) : 0;
        const barWidth = 15;
        const filledCount = Math.round((percent / 100) * barWidth);
        const barStr = '█'.repeat(filledCount) + '░'.repeat(Math.max(0, barWidth - filledCount));

        let barColor = 'gray';
        if (percent >= 40 && percent <= 80) {
            barColor = 'yellow';
        } else if (percent > 80) {
            barColor = 'red';
        }

        return (
            <Box flexDirection="row" paddingLeft={4} key={label}>
                <Box width={18}>
                    <Text color="gray">{label}: </Text>
                </Box>
                <Text color={barColor}>{barStr}</Text>
                <Text color="gray"> {percent}% ({current}/{limit >= 99999999 ? '∞' : limit})</Text>
            </Box>
        );
    };

    const renderActiveView = () => {
        switch (activeView) {
            case 'settings':
                return (
                    <SettingsMenu
                        systemSettings={systemSettings}
                        setSystemSettings={setSystemSettings}
                        apiTier={apiTier}
                        setActiveView={setActiveView}
                        setInputConfig={setInputConfig}
                        saveSettings={saveSettings}
                        quotas={quotas}
                        setMessages={setMessages}
                        aiProvider={aiProvider}
                    />
                );

            case 'selectProvider':
                return (
                    <CommandMenu
                        title="SELECT AI PROVIDER"
                        items={[
                            { label: 'Google (Free/Paid)', value: 'Google' },
                            { label: 'Nvidia (Free/Paid)', value: 'NVIDIA' },
                            { label: 'DeepSeek (Paid)', value: 'DeepSeek' },
                            { label: 'OpenRouter (Free/Paid) [EXPERIMENTAL]', value: 'OpenRouter' },
                            { label: 'Back', value: 'settings' }
                        ]}
                        onSelect={async (item) => {
                            if (item.value === 'settings' || item.value === 'Back') {
                                setActiveView('settings');
                                return;
                            }

                            const selectedProvider = item.value;
                            const key = await getProviderAPIKey(selectedProvider);

                            if (key) {
                                setAiProvider(selectedProvider);
                                setApiKey(key);
                                initAI(key, { aiProvider: selectedProvider, onIDEApproval: resetPendingApproval });
                                let defaultModel = 'gemma-4-31b-it';
                                if (selectedProvider === 'OpenRouter') {
                                    defaultModel = 'google/gemma-4-31b-it:free';
                                } else if (selectedProvider === 'DeepSeek') {
                                    defaultModel = 'deepseek-v4-flash';
                                } else if (selectedProvider === 'NVIDIA') {
                                    defaultModel = 'moonshotai/kimi-k2.6';
                                }
                                setActiveModel(defaultModel);
                                saveSettings({ aiProvider: selectedProvider, activeModel: defaultModel, apiTier, quotas });
                                setMessages(prev => [
                                    ...prev,
                                    {
                                        role: 'system',
                                        text: `[SYSTEM] Switched to ${selectedProvider}! Key loaded from Cache. Model set to ${defaultModel}.`,
                                        isMeta: true
                                    }
                                ]);
                                setActiveView('settings');
                            } else {
                                setInputConfig({
                                    label: `Enter ${selectedProvider} API Key:`,
                                    key: 'providerKey',
                                    provider: selectedProvider,
                                    value: '',
                                    returnView: 'settings'
                                });
                                setActiveView('input');
                            }
                        }}
                        onClose={() => setActiveView('settings')}
                    />
                );

            case 'apiTier': {
                const reqCurrent = dailyUsage?.agent || 0;
                const reqLimit = quotas.agentLimit || 99999999;
                const tokenCurrent = dailyUsage?.tokens || 0;
                const tokenLimit = quotas.tokenLimit || 99999999999999;
                const monthlyCurrent = quotas.resetMode === 'Custom' ? (customPeriodUsage?.tokens || 0) : (monthlyUsage?.tokens || 0);
                const monthlyLimit = quotas.monthlyTokenLimit || 99999999999999;

                let resetInfo = '';
                if (quotas.resetMode === 'Custom') {
                    const today = new Date();
                    const resetDay = quotas.resetDay || 1;
                    let resetMonth = today.getMonth();
                    if (today.getDate() >= resetDay) {
                        resetMonth += 1;
                    }
                    const resetDate = new Date(today.getFullYear(), resetMonth, resetDay);
                    const monthName = resetDate.toLocaleString('default', { month: 'short' });
                    resetInfo = `Resets on: ${resetDay}-${monthName}`;
                }

                return (
                    <Box flexDirection="column" borderStyle="round" borderColor="white" padding={0} width="100%">
                        <Box paddingX={1} marginBottom={1}>
                            <Text color="gray" bold>SELECT YOUR CURRENT API TIER BASED ON YOUR PROVIDER. (Provider: { aiProvider })</Text>
                        </Box>

                        <SelectInput
                            items={[
                                { label: 'Provider Limits', value: 'Free' },
                                { label: `Set Budgets (API with Billing Account) ${apiTier === 'Paid' ? '●' : ''}`, value: 'Paid' },
                                { label: 'Back', value: 'settings' }
                            ]}
                            onSelect={(item) => {
                                if (item.value === 'settings' || item.value === 'Back') {
                                    setActiveView('settings');
                                    return;
                                }

                                const newTier = item.value;
                                setApiTier(newTier);

                                if (newTier === 'Paid') {
                                    setInputConfig({
                                        label: "Enter Agent daily budget (requests made):",
                                        key: 'quotas',
                                        subKey: 'agentLimit',
                                        value: quotas.agentLimit >= 99999999 ? '' : String(quotas.agentLimit),
                                        returnView: 'settings',
                                        next: (newQuotas) => ({
                                            label: "Enter Agent daily budget (tokens used):",
                                            key: 'quotas',
                                            subKey: 'tokenLimit',
                                            value: (newQuotas.tokenLimit >= 99999999999999 || newQuotas.tokenLimit === 0) ? '' : String(newQuotas.tokenLimit),
                                            returnView: 'settings',
                                            next: (q2) => ({
                                                label: "Enter Agent monthly budget (tokens used):",
                                                key: 'quotas',
                                                subKey: 'monthlyTokenLimit',
                                                value: (q2.monthlyTokenLimit >= 99999999999999 || q2.monthlyTokenLimit === 0) ? '' : String(q2.monthlyTokenLimit),
                                                returnView: 'resetMode'
                                            })
                                        })
                                    });
                                    setActiveView('input');
                                } else {
                                    const newQuotas = { ...quotas, agentLimit: 99999999, tokenLimit: 99999999999999, monthlyTokenLimit: 99999999999999 };
                                    setQuotas(newQuotas);
                                    saveSettings({ apiTier: newTier, quotas: newQuotas });
                                    setActiveView('settings');
                                }
                            }}
                            itemComponent={CustomMenuItem}
                            indicatorComponent={() => null}
                        />

                        {apiTier === 'Paid' && (
                            <Box flexDirection="column" marginTop={1} borderStyle="single" borderColor="gray" paddingX={1} width="100%">
                                <Box marginBottom={1}>
                                    <Text color="white" bold>USAGE BUDGET STATUS</Text>
                                </Box>
                                {renderProgressBar('Daily Requests', reqCurrent, reqLimit, 'cyan')}
                                {renderProgressBar('Daily Tokens', tokenCurrent, tokenLimit, 'green')}
                                {renderProgressBar('Monthly Tokens', monthlyCurrent, monthlyLimit, 'yellow')}
                                {resetInfo ? (
                                    <Box marginLeft={4} marginTop={1}>
                                        <Text color="gray">Monthly Reset  : </Text>
                                        <Text color="magenta" bold>{resetInfo}</Text>
                                    </Box>
                                ) : (
                                    <Box marginLeft={4} marginTop={1}>
                                        <Text color="gray">Monthly Reset  : </Text>
                                        <Text color="blue" bold>Rolling 30-Day Window</Text>
                                    </Box>
                                )}
                            </Box>
                        )}

                        <Box paddingX={1} marginTop={1}>
                            <Text color="gray" italic>(Arrows to select • Enter to confirm)</Text>
                        </Box>
                    </Box>
                );
            }

            case 'resetMode':
                return (
                    <CommandMenu
                        title="SELECT MONTHLY RESET MODE"
                        items={[
                            { label: 'Default (Rolling 30-Day Window)', value: 'Rolling' },
                            { label: 'Custom (Set reset day of month)', value: 'Custom' },
                            { label: 'Back', value: 'apiTier' }
                        ]}
                        onSelect={(item) => {
                            if (item.value === 'apiTier' || item.value === 'Back') {
                                setActiveView('apiTier');
                                return;
                            }

                            const selectedMode = item.value;
                            const updatedQuotas = { ...quotas, resetMode: selectedMode };
                            setQuotas(updatedQuotas);

                            if (selectedMode === 'Custom') {
                                setInputConfig({
                                    label: "Enter monthly reset day (1-30):",
                                    key: 'quotas',
                                    subKey: 'resetDay',
                                    value: String(quotas.resetDay || 1),
                                    returnView: 'settings'
                                });
                                setActiveView('input');
                            } else {
                                saveSettings({ apiTier, quotas: updatedQuotas });
                                setActiveView('settings');
                            }
                        }}
                        onClose={() => setActiveView('apiTier')}
                    />
                );

            case 'input':
                return (
                    <Box flexDirection="column" borderStyle="round" borderColor="white" padding={0} width="100%">
                        <Box paddingX={1}>
                            <Text color="white" bold>DATA CONFIGURATION</Text>
                        </Box>

                        {inputConfig?.note && (
                            <Box paddingX={1} marginBottom={1}>
                                <Text color="gray" italic>
                                    {inputConfig.note}
                                </Text>
                            </Box>
                        )}

                        <Box paddingX={1} flexDirection="row">
                            <Text color="white" bold>{inputConfig?.label} </Text>
                            <TextInput
                                value={inputConfig?.value || ''}
                                onChange={(val) => setInputConfig(prev => ({ ...prev, value: val }))}
                                onSubmit={async (val) => {
                                    const { key, subKey, next } = inputConfig;

                                    let newQuotas = { ...quotas };
                                    let newSettings = {};

                                    if (key === 'quotas') {
                                        let parsedValue = (subKey.toLowerCase().includes('limit') || subKey === 'resetDay') ? parseInt(val) || 0 : val;
                                        if (subKey === 'resetDay') {
                                            parsedValue = Math.max(1, Math.min(30, parsedValue));
                                        }
                                        newQuotas[subKey] = parsedValue;
                                        setQuotas(newQuotas);
                                        newSettings.quotas = newQuotas;
                                    } else if (key === 'activeModel') {
                                        setActiveModel(val);
                                        newSettings.activeModel = val;
                                    } else if (key === 'janitorModel') {
                                        setJanitorModel(val);
                                        newSettings.janitorModel = val;
                                    } else if (key === 'autoApproveCommands' || key === 'autoDisallowCommands' || key === 'alwaysAskCommands') {
                                        const newSysSettings = { ...systemSettings, [key]: val.trim(), sandboxPreset: 'Custom' };
                                        setSystemSettings(newSysSettings);
                                        newSettings.systemSettings = newSysSettings;
                                    } else if (key === 'externalDataPath') {
                                        const newSysSettings = { ...systemSettings, useExternalData: true, externalDataPath: val.trim() };
                                        setSystemSettings(newSysSettings);
                                        newSettings.systemSettings = newSysSettings;
                                        setMessages(prev => [...prev, { id: Date.now(), role: 'system', text: '[EXTERNAL STORAGE] Flux Flow will use ' + val.trim() + ' for data after restart.' }]);
                                    } else if (key === 'imageSettings') {
                                        const apiKeyInput = val.trim();
                                        if (apiKeyInput.startsWith('sk_')) {
                                            const updatedSettings = { ...imageSettings, apiKey: apiKeyInput };
                                            setImageSettings(updatedSettings);
                                            newSettings.imageSettings = updatedSettings;
                                            setMessages(prev => {
                                                setCompletedIndex(prev.length + 1);
                                                return [...prev, { id: Date.now(), role: 'system', text: `[IMAGE KEY] Custom API key saved successfully.`, isMeta: true }];
                                            });
                                        } else {
                                            setImageSettings(prev => ({ ...prev, keyType: 'Default' }));
                                            newSettings.imageSettings = { ...imageSettings, keyType: 'Default' };
                                            setMessages(prev => {
                                                setCompletedIndex(prev.length + 1);
                                                return [...prev, { id: Date.now(), role: 'system', text: `[IMAGE KEY ERROR] API key must start with sk_. Key strategy reset to Default.`, isMeta: true }];
                                            });
                                        }
                                    } else if (key === 'providerKey') {
                                        const keyInput = val.trim();
                                        const prov = inputConfig.provider;
                                        await saveProviderAPIKey(prov, keyInput);
                                        setAiProvider(prov);
                                        setApiKey(keyInput);
                                        initAI(keyInput, { aiProvider: prov, onIDEApproval: resetPendingApproval });
                                        let defaultModel = 'gemma-4-31b-it';
                                        if (prov === 'OpenRouter') {
                                            defaultModel = 'google/gemma-4-31b-it:free';
                                        } else if (prov === 'DeepSeek') {
                                            defaultModel = 'deepseek-v4-flash';
                                        } else if (prov === 'NVIDIA') {
                                            defaultModel = 'moonshotai/kimi-k2.6';
                                        } setActiveModel(defaultModel);
                                        newSettings.aiProvider = prov;
                                        newSettings.activeModel = defaultModel;

                                        setMessages(prev => {
                                            setCompletedIndex(prev.length + 1);
                                            return [...prev, { id: Date.now(), role: 'system', text: `✅ ${prov} API Key saved successfully! Model set to ${defaultModel}.`, isMeta: true }];
                                        });
                                    }

                                    if (next) {
                                        setInputConfig(next(key === 'quotas' ? newQuotas : val));
                                    } else {
                                        saveSettings({ ...newSettings, apiTier, quotas: newQuotas, imageSettings: newSettings.imageSettings || imageSettings });
                                        setInputConfig(null);
                                        setActiveView(inputConfig?.returnView || 'settings');
                                    }
                                }}
                            />
                        </Box>

                        <Box paddingX={1} marginTop={1}>
                            <Text color="gray" dimColor italic>(Press Enter to confirm selection)</Text>
                        </Box>
                    </Box>
                );

            case 'stats': {
                const u = statsMode === 'monthly' ? monthlyUsage : dailyUsage;
                const trackerTitle = statsMode === 'monthly' ? 'LAST 30 DAYS USAGE' : 'TODAY\'s USAGE';
                const timeLabel = statsMode === 'monthly' ? 'Wall Time:' : 'Wall Time:';
                const tokensLabel = statsMode === 'monthly' ? 'Tokens Used:' : 'Tokens Used:';
                const imagesLabel = statsMode === 'monthly' ? 'Images Made:' : 'Images Made:';
                const imageCreditsLabel = statsMode === 'monthly' ? 'Image Credits:' : 'Image Credits:';
                const codeChangesLabel = statsMode === 'monthly' ? 'Code Changes:' : 'Code Changes:';
                const toolCallsLabel = statsMode === 'monthly' ? 'Tool Calls:' : 'Tool Calls:';
                return (
                    <Box flexDirection="column" borderStyle="round" borderColor={'grey'} paddingX={3} paddingY={1} paddingBottom={0} width={Math.min(125, (stdout?.columns || 100) - 2)}>
                        {statsMode === 'modelBreakdown' ? (
                            <Box flexDirection="column">
                                <Text color="white" bold underline>30-DAY MODEL TOKEN BREAKDOWN</Text>
                                {(!monthlyUsage?.models || Object.keys(monthlyUsage.models).length === 0) ? (
                                    <Box marginTop={1}>
                                        <Text color="grey" italic>No model token usage recorded in the last 30 days.</Text>
                                    </Box>
                                ) : (
                                    Object.entries(monthlyUsage.models).map(([provider, models]) => {
                                        const providerTotalTokens = Object.values(models).reduce((sum, m) => sum + (m.tokens || 0), 0);
                                        return (
                                            <Box key={provider} flexDirection="column" marginTop={1}>
                                                <Box>
                                                    <Box width={40}><Text color="cyan" bold>{provider}:</Text></Box>
                                                    <Text color="white" bold>{formatTokens(providerTotalTokens)}</Text>
                                                </Box>
                                                {Object.entries(models).map(([modelName, stats]) => (
                                                    <Box key={modelName} flexDirection="column" marginLeft={4} marginTop={1}>
                                                        <Box>
                                                            <Box width={36}><Text color="blue">» {modelName}:</Text></Box>
                                                            <Text color="white">{formatTokens(stats.tokens || 0)}</Text>
                                                        </Box>
                                                        <Box marginLeft={4}>
                                                            <Box width={32}><Text color="grey">» Input Tokens:</Text></Box>
                                                            <Text color="white">{formatTokens((stats.tokens || 0) - (stats.candidateTokens || 0))}</Text>
                                                        </Box>
                                                        {(stats.cachedTokens || 0) > 0 && (
                                                            <Box marginLeft={5}>
                                                                <Box width={31}><Text color="grey">» Cached:</Text></Box>
                                                                <Text color="white">{formatTokens(stats.cachedTokens)}</Text>
                                                            </Box>
                                                        )}
                                                        <Box marginLeft={4}>
                                                            <Box width={32}><Text color="grey">» Output Tokens:</Text></Box>
                                                            <Text color="white">{formatTokens(stats.candidateTokens || 0)}</Text>
                                                        </Box>
                                                    </Box>
                                                ))}
                                            </Box>
                                        );
                                    })
                                )}
                            </Box>
                        ) : (
                            <>
                                <Box marginBottom={1}>
                                    <Text color="white" bold underline>SESSION TELEMETRY</Text>
                                </Box>

                                <Box flexDirection="column">
                                    <Box>
                                        <Box width={25}><Text color="blue">Session Duration:</Text></Box>
                                        <Text color="white">{formatMsDuration(Date.now() - SESSION_START_TIME)}</Text>
                                    </Box>
                                    <Box>
                                        <Box width={25}><Text color="blue">Model Requests:</Text></Box>
                                        <Text color="white">{sessionAgentCalls}</Text>
                                    </Box>
                                    <Box marginLeft={2}>
                                        <Box width={23}><Text color="grey">» API Time:</Text></Box>
                                        <Text color="white">{formatMsDuration(sessionApiTime)}</Text>
                                    </Box>
                                    <Box marginLeft={2}>
                                        <Box width={23}><Text color="grey">» Tool Time:</Text></Box>
                                        <Text color="white">{formatMsDuration(sessionToolTime)}</Text>
                                    </Box>
                                    <Box>
                                        <Box width={25}><Text color="blue">Memory Agent:</Text></Box>
                                        <Text color="white">{sessionBackgroundCalls}</Text>
                                    </Box>
                                    <Box>
                                        <Box width={25}><Text color="blue">Tokens Consumed:</Text></Box>
                                        <Text color="white">{formatTokens(sessionTotalTokens)}</Text>
                                    </Box>
                                    <Box>
                                        <Box width={25}><Text color="blue">Active Context:</Text></Box>
                                        <Text color="white">{formatTokens(sessionStats.tokens)}</Text>
                                    </Box>
                                    {sessionTotalTokens > 0 && (
                                        <>
                                            <Box marginLeft={2}>
                                                <Box width={23}><Text color="grey">» Input Tokens:</Text></Box>
                                                <Text color="white">{formatTokens(sessionTotalTokens - sessionTotalCandidateTokens)}</Text>
                                            </Box>
                                            {sessionTotalCachedTokens > 0 && (
                                                <Box marginLeft={4}>
                                                    <Box width={21}><Text color="grey">» Cached:</Text></Box>
                                                    <Text color="white">{formatTokens(sessionTotalCachedTokens)}</Text>
                                                </Box>
                                            )}
                                            {sessionTotalCandidateTokens > 0 && (
                                                <Box marginLeft={2}>
                                                    <Box width={23}><Text color="grey">» Output Tokens:</Text></Box>
                                                    <Text color="white">{formatTokens(sessionTotalCandidateTokens)}</Text>
                                                </Box>
                                            )}
                                        </>
                                    )}
                                    {sessionImageCount > 0 && (
                                        <>
                                            <Box>
                                                <Box width={25}><Text color="blue">Images Made:</Text></Box>
                                                <Text color="white">{sessionImageCount}</Text>
                                            </Box>
                                            <Box>
                                                <Box width={25}><Text color="blue">Image Credits:</Text></Box>
                                                <Text color="white">{Number(((sessionImageCredits || 0) * 1000).toFixed(0))} credits</Text>
                                            </Box>
                                        </>
                                    )}
                                    <Box>
                                        <Box width={25}><Text color="blue">Code Changes (Sess):</Text></Box>
                                        <Text color="white"><Text color="green">+{linesAdded}</Text> <Text color="red">-{linesRemoved}</Text></Text>
                                    </Box>
                                    <Box>
                                        <Box width={25}><Text color="blue">Tool Calls (Sess):</Text></Box>
                                        <Text color="white">{sessionToolSuccess + sessionToolFailure + sessionToolDenied} ( </Text>
                                        <Text color="green">✓ {sessionToolSuccess}</Text>
                                        <Text color="white"> </Text>
                                        <Text color="yellow">⊘ {sessionToolDenied}</Text>
                                        <Text color="white"> </Text>
                                        <Text color="red">✕ {sessionToolFailure}</Text>
                                        <Text color="white"> )</Text>
                                    </Box>
                                </Box>

                                <Box flexDirection="column" marginTop={1}>
                                    <Text color="white" bold underline>{trackerTitle}</Text>
                                    <Box marginTop={1}>
                                        <Box width={25}><Text color="blue">{timeLabel}</Text></Box>
                                        <Text color="white">{formatDuration(u?.duration || 0)}</Text>
                                    </Box>
                                    <Box>
                                        <Box width={25}><Text color="blue">Model Requests:</Text></Box>
                                        <Text color="white">{u?.agent || 0}</Text>
                                    </Box>
                                    <Box>
                                        <Box width={25}><Text color="blue">Memory Agent:</Text></Box>
                                        <Text color="white">{u?.background || 0}</Text>
                                    </Box>
                                    <Box>
                                        <Box width={25}><Text color="blue">{tokensLabel}</Text></Box>
                                        <Text color="white">{formatTokens(u?.tokens || 0)}</Text>
                                    </Box>
                                    {(u?.tokens || 0) > 0 && (
                                        <>
                                            <Box marginLeft={2}>
                                                <Box width={23}><Text color="grey">» Input Tokens:</Text></Box>
                                                <Text color="white">{formatTokens((u?.tokens || 0) - (u?.candidateTokens || 0))}</Text>
                                            </Box>
                                            {(u?.cachedTokens || 0) > 0 && (
                                                <Box marginLeft={4}>
                                                    <Box width={21}><Text color="grey">» Cached:</Text></Box>
                                                    <Text color="white">{formatTokens(u.cachedTokens)}</Text>
                                                </Box>
                                            )}
                                            {(u?.candidateTokens || 0) > 0 && (
                                                <Box marginLeft={2}>
                                                    <Box width={23}><Text color="grey">» Output Tokens:</Text></Box>
                                                    <Text color="white">{formatTokens(u.candidateTokens)}</Text>
                                                </Box>
                                            )}
                                        </>
                                    )}
                                    {(u?.imageCalls?.length || 0) > 0 && (
                                        <>
                                            <Box>
                                                <Box width={25}><Text color="blue">{imagesLabel}</Text></Box>
                                                <Text color="white">{u.imageCalls.length}</Text>
                                            </Box>
                                            <Box>
                                                <Box width={25}><Text color="blue">{imageCreditsLabel}</Text></Box>
                                                <Text color="white">{Number(((u.imageCalls.reduce((sum, c) => sum + c.cost, 0) || 0) * 1000).toFixed(0))} credits</Text>
                                            </Box>
                                        </>
                                    )}
                                    <Box>
                                        <Box width={25}><Text color="blue">{codeChangesLabel}</Text></Box>
                                        <Text color="white"><Text color="green">+{u?.linesAdded || 0}</Text> <Text color="red">-{u?.linesRemoved || 0}</Text></Text>
                                    </Box>
                                    <Box>
                                        <Box width={25}><Text color="blue">{toolCallsLabel}</Text></Box>
                                        <Text color="white">{(u?.toolSuccess || 0) + (u?.toolFailure || 0) + (u?.toolDenied || 0)} ( </Text>
                                        <Text color="green">✓ {u?.toolSuccess || 0}</Text>
                                        <Text color="white"> </Text>
                                        <Text color="yellow">⊘ {u?.toolDenied || 0}</Text>
                                        <Text color="white"> </Text>
                                        <Text color="red">✕ {u?.toolFailure || 0}</Text>
                                        <Text color="white"> )</Text>
                                    </Box>
                                </Box>
                            </>
                        )}

                        <Text dimColor marginTop={1} italic>(Press TAB to toggle Daily/Monthly views, SPACE for Model Breakdown, ESC to return)</Text>
                    </Box>
                );
            }
            case 'autoExecDanger':
                return (
                    <Box flexDirection="column" borderStyle="round" borderColor="grey" paddingX={2} paddingY={1} width="100%">
                        <Text color="white" bold underline>SECURITY WARNING: YOLO MODE</Text>
                        <Text marginTop={1}>Turning this ON allows the agent to execute terminal commands automatically without requiring your approval for each step.</Text>
                        <Text marginTop={1} color="white">RISKS INVOLVED:</Text>
                        <Text>• The agent may execute destructive commands (rm -rf, etc.) by mistake unless specified in sandbox rules.</Text>
                        <Text>• Unintended system changes if the agent hallucinates a path or command.</Text>
                        <Text>• Reduced control over the agent's step-by-step decision making.</Text>
                        <Box marginTop={1}>
                            <CommandMenu
                                title="Confirm Intent"
                                items={[
                                    { label: 'I know the risk and turning on intentionally', value: 'on' },
                                    { label: 'Keep Off (Recommended)', value: 'off' }
                                ]}
                                onSelect={(item) => {
                                    if (item.value === 'on') {
                                        setSystemSettings(s => ({ ...s, autoExec: true }));
                                    }
                                    setActiveView('settings');
                                }}
                            />
                        </Box>
                    </Box>
                );
            case 'externalDanger':
                return (
                    <Box flexDirection="column" borderStyle="round" borderColor="grey" paddingX={2} paddingY={1} width="100%">
                        <Text color="white" bold underline>SECURITY WARNING: EXTERNAL WORKSPACE ACCESS</Text>
                        <Text marginTop={1}>Turning this ON allows the agent to execute tools (Read/Write/Exec) outside of the current active workspace directory.</Text>
                        <Text marginTop={1} color="white">RISKS INVOLVED:</Text>
                        <Text>• Access to sensitive system files (SSH keys, Browser data, etc.)</Text>
                        <Text>• Potential for accidental or malicious deletion of OS-critical files.</Text>
                        <Text>• Unauthorized script execution across your entire file system.</Text>
                        <Box marginTop={1}>
                            <CommandMenu
                                title="Confirm Intent"
                                items={[
                                    { label: 'I know the risk and turning on intentionally', value: 'on' },
                                    { label: 'Keep Off (Recommended)', value: 'off' }
                                ]}
                                onSelect={(item) => {
                                    if (item.value === 'on') {
                                        setSystemSettings(s => ({ ...s, allowExternalAccess: true }));
                                    }
                                    setActiveView('settings');
                                }}
                            />
                        </Box>
                    </Box>
                );
            case 'doubleDanger':
                return (
                    <Box flexDirection="column" borderStyle="round" borderColor="white" paddingX={2} paddingY={1} width="100%">
                        <Text color="white" bold underline>CRITICAL SECURITY WARNING: COMBINED SYSTEM RISK</Text>
                        <Text marginTop={1}>You are attempting to enable BOTH [YOLO Mode] and [External Workspace Access] simultaneously.</Text>
                        <Text marginTop={1} color="red" bold>THIS IS NOT RECOMMENDED.</Text>
                        <Text marginTop={1} color="white">THE CRITICAL RISK:</Text>
                        <Text>The agent will have the power to execute any command across your entire system WITHOUT your approval or supervision.</Text>
                        <Text color="red" italic marginTop={1}>A single hallucination or error could result in full system wipe or data theft.</Text>
                        <Box marginTop={1}>
                            <CommandMenu
                                title="Final Confirmation"
                                items={[
                                    { label: 'I agree knowing the consequences', value: 'on' },
                                    { label: 'Keep Off', value: 'off' }
                                ]}
                                onSelect={(item) => {
                                    if (item.value === 'on') {
                                        setSystemSettings(s => ({ ...s, autoExec: true, allowExternalAccess: true }));
                                    }
                                    setActiveView('settings');
                                }}
                            />
                        </Box>
                    </Box>
                );
            case 'key':
                return (
                    <CommandMenu
                        title="API KEY MANAGEMENT"
                        items={[
                            { label: 'Edit Current Key (Update)', value: 'edit' },
                            { label: 'Remove Current Key (Delete)', value: 'remove' },
                            { label: 'Cancel', value: 'Cancel' }
                        ]}
                        onSelect={(item) => {
                            if (item.value === 'edit') {
                                setApiKey(null); // Re-triggers manual setup mode
                                setActiveView('chat');
                                const s = emojiSpace(2);
                                setMessages(prev => [...prev, { id: Date.now(), role: 'system', text: `[ACTION] Flux waiting for new API Key...` }]);
                            } else if (item.value === 'remove') {
                                setActiveView('deleteKey');
                            } else {
                                setActiveView('chat');
                            }
                        }}
                    />
                );
            case 'deleteKey':
                return (
                    <Box flexDirection="column" borderStyle="round" borderColor="grey" paddingX={2} paddingY={1}>
                        {(() => {
                            const s = emojiSpace(2);
                            return <Text color="white" bold>DANGER: CLEAR CREDENTIALS</Text>;
                        })()}
                        <Text marginTop={1}>This will permanently delete all saved API keys in credential cache. You will need to enter it again to use Flux.</Text>
                        <Box marginTop={1}>
                            <CommandMenu
                                title="Are you sure?"
                                items={[
                                    { label: 'YES, CLEAR CREDENTIALS', value: 'yes' },
                                    { label: 'NO, GO BACK', value: 'no' }
                                ]}
                                onSelect={async (item) => {
                                    if (item.value === 'yes') {
                                        await removeAPIKey();
                                        setApiKey(null);
                                        setActiveView('chat');
                                        const s = emojiSpace(2);
                                        setMessages(prev => [...prev, { id: Date.now(), role: 'system', text: `[CREDENTIAL CLEARED] API Key removed successfully.` }]);
                                    } else {
                                        setActiveView('key');
                                    }
                                }}
                            />
                        </Box>
                    </Box>
                );
            case 'exit':
                return null;
            case 'ask':
                return (
                    <Box width="100%">
                        <AskUserModal
                            question={pendingAsk?.question}
                            options={pendingAsk?.options}
                            onResolve={(choice) => {
                                if (pendingAsk?.resolve) {
                                    pendingAsk.resolve(choice);
                                }
                                setPendingAsk(null);
                                setActiveView('chat');
                            }}
                        />
                    </Box>
                );
            case 'revert':
                return (
                    <Box width="100%" alignItems="center" justifyContent="center">
                        <RevertModal
                            prompts={recentPrompts}
                            onSelect={async (txId) => {
                                try {
                                    const result = await RevertManager.rollbackToBefore(txId);
                                    if (result.success) {
                                        const { targetPrompt } = result;
                                        deleteChatSummary(chatId);

                                        // Find index of reverted user message
                                        const targetIdx = messages.findLastIndex(m =>
                                            m.role === 'user' &&
                                            m.text &&
                                            (m.text.startsWith(targetPrompt) || m.text.includes(targetPrompt))
                                        );

                                        let newMsgs = [...messages];
                                        if (targetIdx !== -1) {
                                            newMsgs = messages.slice(0, targetIdx);
                                        }

                                        setMessages(newMsgs);
                                        setCompletedIndex(newMsgs.length);
                                        setInput(targetPrompt);
                                        setIsExpanded(targetPrompt.split('\n').length > 2);

                                        // Persist reverted history
                                        const historyToSave = newMsgs.filter(m => !String(m.id).startsWith('welcome') && !m.isMeta);
                                        await saveChat(chatId, null, historyToSave);

                                        const s = emojiSpace(2);
                                        setMessages(prev => {
                                            const finalMsgs = [...prev, {
                                                id: 'revert-ok-' + Date.now(),
                                                role: 'system',
                                                text: `[ROLLBACK SUCCESSFUL] Reverted prompt loaded to input box.`,
                                                isMeta: true
                                            }];
                                            setCompletedIndex(finalMsgs.length);
                                            return finalMsgs;
                                        });

                                        setActiveView('chat');
                                    }
                                } catch (err) {
                                    const s = emojiSpace(2);
                                    setMessages(prev => {
                                        const finalMsgs = [...prev, {
                                            id: 'revert-err-' + Date.now(),
                                            role: 'system',
                                            text: `[ROLLBACK ERROR] ${err.message}`,
                                            isMeta: true
                                        }];
                                        setCompletedIndex(finalMsgs.length);
                                        return finalMsgs;
                                    });
                                    setActiveView('chat');
                                }
                            }}
                            onClose={() => setActiveView('chat')}
                        />
                    </Box>
                );
            case 'resume':
                return (
                    <Box width="100%" alignItems="center" justifyContent="center">
                        <ResumeModal
                            onSelect={async (id) => {
                                const h = await loadHistory();
                                if (h[id]) {
                                    stdout.write('\x1b[2J\x1b[3J\x1b[H'); // Thorough clear for fresh context
                                    setChatId(id);

                                    const savedData = await loadChatContext(id);
                                    chatTokenStartRef.current = sessionTotalTokens - savedData.total;
                                    setChatTokens(savedData.total);
                                    setSessionStats({ tokens: savedData.context });

                                    // Ensure logo is present at the start of resumed history
                                    const resumedMsgs = [...h[id].messages];
                                    const hasLogo = resumedMsgs[0]?.text?.includes('░░░███');
                                    if (!hasLogo) {
                                        resumedMsgs.unshift({ id: 'logo-' + Date.now(), role: 'system', isLogo: true, isMeta: true });
                                    }

                                    setMessages(resumedMsgs);
                                    setActiveView('chat');
                                    setMessages(prev => {
                                        const newMsgs = [...prev, { id: 'sys-' + Date.now(), role: 'system', text: `SESSION RESUMED: [${id}]`, isMeta: true }];
                                        setCompletedIndex(newMsgs.length);
                                        return newMsgs;
                                    });
                                }
                            }}
                            onDelete={async (id) => {
                                const newHistory = await deleteChat(id);
                                return newHistory;
                            }}
                            onClose={() => setActiveView('chat')}
                        />
                    </Box>
                );
            case 'keybindingsPrompt':
                return (
                    <Box flexDirection="column" borderStyle="round" borderColor="grey" paddingX={2} paddingY={1} width="100%">
                        <Text color="white" bold underline>⌨ CONFIGURE SHIFT+ENTER NEWLINE</Text>
                        <Text marginTop={1}>
                            To support multi-line inputs with <Text bold color="white">Shift + Enter</Text> for newline, a terminal sequence keybinding needs to be added to your IDE configuration.
                        </Text>
                        <Text marginTop={1}>
                            Would you like FluxFlow to automatically add this to your {getIDEName()} keybindings?
                        </Text>
                        <Box marginTop={1}>
                            <CommandMenu
                                title="Add Keybinding?"
                                items={[
                                    { label: 'Yes, configure automatically', value: 'yes' },
                                    { label: 'No, skip', value: 'no' }
                                ]}
                                onSelect={async (item) => {
                                    if (item.value === 'yes') {
                                        await addShiftEnterBinding(getIDEName());
                                    } else {
                                        cachedShortcut = '\\ + Enter';
                                    }
                                    setActiveView('chat');
                                }}
                            />
                        </Box>
                    </Box>
                );
            case 'memory':
                return (
                    <Box width="100%" alignItems="center" justifyContent="center">
                        <MemoryModal onClose={() => setActiveView('chat')} />
                    </Box>
                );
            case 'parserDownload':
                return (
                    <Box width="100%" alignItems="center" justifyContent="center">
                        <ParserDownloadModal onClose={() => setActiveView('settings')} />
                    </Box>
                );
            case 'profile':
                return (
                    <ProfileForm
                        initialData={profileData}
                        onSave={(profile) => {
                            setProfileData(profile);
                            setMessages(prev => [...prev, { id: Date.now(), role: 'system', text: `Profile updated: ${profile.name} (${profile.nickname})` }]);
                            setActiveView('chat');
                        }}
                        onCancel={() => setActiveView('chat')}
                    />
                );
            case 'resolution':
                return (
                    <Box width="100%" alignItems="center" justifyContent="center">
                        <ResolutionModal
                            data={resolutionData}
                            onResolve={(val) => {
                                setResolutionData(null);
                                setActiveView('chat');
                                // Defer execution to ensure state has settled and modal is unmounted
                                setTimeout(() => {
                                    handleSubmit(val, true);
                                }, 500);
                            }}
                            onEdit={(val) => {
                                setResolutionData(null);
                                setActiveView('chat');
                                setInput(val);
                            }}
                        />
                    </Box>
                );
            case 'approval':
                return (
                    <Box flexDirection="column" borderStyle="round" borderColor="white" paddingX={2} paddingY={1} width="100%">
                        <Text color="white" bold underline>FILE WRITE PERMISSION</Text>
                        <Text marginTop={1}>The agent is attempting to modify: <Text color="cyan">{parseArgs(pendingApproval?.args || '{}').path || 'Unknown File'}</Text></Text>

                        {!isBridgeConnected() ? (
                            <Box marginTop={1} borderStyle="single" borderColor="#333" paddingX={1} flexDirection="column">
                                <Text color="gray">--- PROPOSED CONTENT ---</Text>
                                {(() => {
                                    const args = parseArgs(pendingApproval?.args || '{}');

                                    // Collect all patch pairs
                                    const patchPairs = [];
                                    const indices = new Set();
                                    Object.keys(args).forEach(key => {
                                        const m = key.match(/^(replaceContent|newContent|content_to_replace|content_to_add|TargetContent|ReplacementContent|replacementContent)(\d+)?$/);
                                        if (m) {
                                            const index = m[2] ? parseInt(m[2]) : 1;
                                            indices.add(index);
                                        }
                                    });

                                    const sortedIndices = Array.from(indices).sort((a, b) => a - b);
                                    sortedIndices.forEach(i => {
                                        let r, n;
                                        if (i === 1) {
                                            r = args.replaceContent1 ?? args.content_to_replace1 ?? args.replaceContent ?? args.content_to_replace ?? args.TargetContent ?? null;
                                            n = args.newContent1 ?? args.content_to_add1 ?? args.newContent ?? args.content_to_add ?? args.ReplacementContent ?? args.replacementContent ?? null;
                                        } else {
                                            r = args[`replaceContent${i}`] ?? args[`content_to_replace${i}`] ?? null;
                                            n = args[`newContent${i}`] ?? args[`content_to_add${i}`] ?? null;
                                        }
                                        if (r !== null || n !== null) {
                                            patchPairs.push({ replace: r, new: n });
                                        }
                                    });

                                    if (patchPairs.length > 0) {
                                        return (
                                            <Box flexDirection="column" marginTop={1}>
                                                {patchPairs.map((pair, idx) => {
                                                    const hasOld = pair.replace !== null;
                                                    const hasNew = pair.new !== null;
                                                    return (
                                                        <Box key={idx} flexDirection="column" marginTop={idx > 0 ? 1 : 0}>
                                                            {patchPairs.length > 1 && <Text color="gray">Block {idx + 1}:</Text>}
                                                            {hasOld && <Box><Text color="red" wrap="anywhere" bold>- {pair.replace}</Text></Box>}
                                                            {hasNew && <Box marginTop={hasOld ? 0 : 0}><Text color="green" wrap="anywhere" bold>+ {pair.new.replace(/\[\/n\]?/g, '\\n')}</Text></Box>}
                                                        </Box>
                                                    );
                                                })}
                                            </Box>
                                        );
                                    }

                                    const newVal = args.content || args.ReplacementContent || args.content_to_add || args.replacementContent || args.newContent || null;
                                    return <Text color="white" wrap="anywhere">{(newVal ? newVal.replace(/\[\/n\]?/g, '\\n') : null) || 'Updating file content...'}</Text>;
                                })()}
                            </Box>
                        ) : (
                            <Box marginTop={1} paddingX={1}>
                                <Text color="cyan" italic>⚡️ FluxFlow Companion is active. Review the changes in your editor.</Text>
                            </Box>
                        )}

                        <Box marginTop={1}>
                            <CommandMenu
                                title="Action Required"
                                items={[
                                    { label: 'Accept this time', value: 'allow' },
                                    { label: 'Accept for this session', value: 'always' },
                                    { label: 'Don\'t accept', value: 'deny' }
                                ]}
                                onSelect={(item) => {
                                    if (item.value === 'always') setAutoAcceptWrites(true);

                                    const decision = item.value === 'deny' ? 'deny' : 'allow';
                                    pendingApproval.resolve(decision);
                                    setPendingApproval(null);
                                    setActiveView('chat');
                                }}
                            />
                        </Box>
                    </Box>
                );
            case 'updateManager':
                return (
                    <CommandMenu
                        title="Select Preferred Update Manager"
                        subtitle="NOTE: If you are unsure about these, go with NPM"
                        items={[
                            { label: 'NPM   (Standard)', value: 'npm' },
                            { label: 'PNPM  (Recommended)', value: 'pnpm' },
                            { label: 'BUN   (Ultra Fast)', value: 'bun' },
                            { label: 'YARN  (Classic)', value: 'yarn' },
                            { label: 'Custom Command', value: 'custom' },
                            { label: 'Back', value: 'settings' }
                        ]}
                        onSelect={(item) => {
                            if (item.value === 'settings' || item.value === 'Back') {
                                setActiveView('settings');
                                return;
                            }

                            if (item.value === 'custom') {
                                setInputConfig({
                                    label: "Enter Custom Update Command (Global install recommended):",
                                    key: 'customUpdateCommand',
                                    value: systemSettings.customUpdateCommand,
                                    next: (val) => {
                                        setSystemSettings(s => ({ ...s, updateManager: 'custom', customUpdateCommand: val }));
                                        return null; // Return to settings handled below
                                    }
                                });
                                setActiveView('input');
                            } else {
                                setSystemSettings(s => ({ ...s, updateManager: item.value }));
                                setActiveView('settings');
                            }
                        }}
                    />
                );
            case 'update':
                return (
                    <UpdateProcessor
                        latest={latestVer}
                        current={versionFluxflow}
                        settings={systemSettings}
                        onClose={() => setActiveView('chat')}
                        onSuccess={() => {
                            setMessages(prev => {
                                setCompletedIndex(prev.length + 1);
                                return [...prev, {
                                    id: 'update-success-' + Date.now(),
                                    role: 'system',
                                    text: `**[UPDATE COMPLETED]** Flux Flow successfully updated to v${latestVer}.\n **Restart to see changes.**`,
                                    isMeta: true
                                }];
                            });
                            setActiveView('chat');
                        }}
                        onUpdateSettings={(manager) => {
                            setActiveView('updateManager');
                        }}
                    />
                );
            case 'terminalApproval':
                return (
                    <Box flexDirection="column" borderStyle="round" borderColor="white" paddingX={2} paddingY={1} width="100%">
                        <Text color="white" bold underline>TERMINAL COMMAND OVERSIGHT</Text>
                        <Box marginTop={1}>
                            <Text>Agent requested to run: <Text color="yellow" bold>{parseArgs(pendingApproval?.args || '{}').command || 'Unknown Command'}</Text></Text>
                        </Box>

                        <Box marginTop={1}>
                            <CommandMenu
                                title="Risk Assessment Required"
                                items={[
                                    { label: 'Run', value: 'allow' },
                                    { label: 'Deny', value: 'deny' }
                                ]}
                                onSelect={(item) => {
                                    pendingApproval.resolve(item.value);
                                    setPendingApproval(null);
                                    setActiveView('chat');
                                }}
                            />
                        </Box>
                    </Box>
                );
            default:
                return (
                    <Box flexDirection="column" marginTop={1} flexShrink={0} width="100%">
                        {showBtwBox && btwResponse && (
                            <Box flexDirection="column" borderStyle="round" borderColor="grey" paddingX={2} paddingY={1} width="100%" marginBottom={1}>
                                <Box justifyContent="space-between" width="100%">
                                    <Text color="white" bold underline>INQUIRY RESPONSE</Text>
                                    <Text color="gray">[ ESC to Close ]</Text>
                                </Box>
                                <Box marginTop={1} width="100%">
                                    <CodeRenderer text={btwResponse} columns={terminalSize.columns - 6} />
                                </Box>
                            </Box>
                        )}
                        {/* 🏗️ INPUT HEADER BAR */}
                        <Box paddingX={1} marginBottom={0} justifyContent="space-between" width="100%">
                            <Box>
                                {statusText ? (
                                    <Box>
                                        <Text color="gray" bold italic>{statusText}</Text>
                                    </Box>
                                ) : (
                                    <Text color="gray" italic>{input.length > 0 && escPressCount ? "Press ESC again to clear input" : "Waiting for input..."}</Text>
                                )}
                            </Box>
                            <Box>
                                {wittyPhrase && (
                                    <Text color="gray" italic>{wittyPhrase} </Text>
                                )}
                                <Text color="gray" bold>[ </Text>
                                <Text color="white">{tempModelOverride || activeModel}</Text>
                                <Text color="gray" bold> ]</Text>
                            </Box>
                        </Box>

                        {/* 🌊 MAIN COMMAND CONSOLE */}
                        <Box flexDirection="column" width="100%">
                            <Box width="100%" height={1} overflow="hidden">
                                <Text color="#555555">{'▄'.repeat(Math.max(1, terminalSize.columns))}</Text>
                            </Box>
                            <Box
                                backgroundColor="#555555"
                                paddingX={1}
                                paddingY={0}
                                width="100%"
                                flexDirection="column"
                            >
                                <Box flexDirection="column" width="100%">
                                    <Box flexDirection="row" width="100%" paddingY={0}>
                                        <Box flexShrink={0} width={4}>
                                            <Text color="white" bold>{(isProcessing || isCompressing) ? "✦  " : " ❯  "}</Text>
                                        </Box>
                                        <Box flexGrow={1}>
                                            <Box flexGrow={1} position="relative">
                                                {input === '' && (
                                                    <Box position="absolute" paddingLeft={0}>
                                                        {activeCommand && !isTerminalFocused ? (
                                                            <Text color="yellow">{isTerminalWaitingForInput ? "  Terminal is waiting for user input. Press TAB to interact" : "  Press TAB to interact with terminal..."}</Text>
                                                        ) : activeCommand && isTerminalFocused ? (
                                                            <Text color="yellow" bold>  [ TERMINAL FOCUSED ] Type to interact, press TAB to exit...</Text>
                                                        ) : escPressCount === 1 ? (
                                                            <Text color="white" bold>  Press ESC again to {input.length > 0 ? 'clear input' : 'revert codebase to checkpoint'}...</Text>
                                                        ) : (
                                                            <Text color="#cccccc">{escPressed ? "  Press ESC again to cancel the request." : isCompressing ? "  Compressing session history, please wait..." : !isProcessing ? `  Send message, @file or /cmd ... (${terminalEnv.shortcut} for newline)` : "  Enter a prompt to steer the agent."}</Text>
                                                        )}
                                                    </Box>
                                                )}
                                                <MultilineInput
                                                    key={`input-${inputKey}`}
                                                    focus={!isTerminalFocused && !isCompressing}
                                                    showCursor={isAppFocused && !isCompressing}
                                                    lastFocusEventTime={lastFocusEventTime.current}
                                                    value={input}
                                                    textStyle={{ bold: true }}
                                                    columns={terminalSize.columns}
                                                    onChange={(val) => {
                                                        const cleanVal = val.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\\\s*\n/g, '\n');
                                                        setInput(cleanVal);
                                                        setIsFilePickerDismissed(false);
                                                    }}
                                                    onSubmit={handleSubmit}
                                                    rows={1}
                                                    maxRows={10}
                                                    keyBindings={{
                                                        submit: (key) => key.return && !key.shift && !key.ctrl,
                                                        newline: (key) => (key.return && key.shift) || (key.return && key.ctrl)
                                                    }}
                                                />
                                            </Box>
                                        </Box>
                                    </Box>
                                </Box>
                            </Box>
                            <Box width="100%" height={1} overflow="hidden">
                                <Text color="#555555">{'▀'.repeat(Math.max(1, terminalSize.columns))}</Text>
                            </Box>
                        </Box>
                    </Box>
                );
        }
    };

    return (
        <Box flexDirection="column" width="100%">
            {showBridgePromo ? (
                <BridgePromo width={stdout?.columns || 80} height={stdout?.rows || 24} selectedIndex={promoSelectedIndex} />
            ) : (
                <>
                    <Box flexDirection="column" width="100%" flexGrow={1}>
                        {windowedHistory.items.map((msg, idx) => (
                            <MessageItem
                                key={msg.id || idx}
                                msg={msg}
                                showFullThinking={showFullThinking}
                                columns={stdout?.columns || 80}
                                aiProvider={aiProvider}
                                version={versionFluxflow}
                            />
                        ))}
                    </Box>

                    <Box flexDirection="column" padding={1} width="100%">
                        {(activeView === 'chat' || ['ask', 'approval', 'terminalApproval'].includes(activeView)) && (
                            <Box flexDirection="column" width="100%">
                                <ChatLayout
                                    messages={messages.slice(completedIndex)}
                                    showFullThinking={showFullThinking}
                                    columns={Math.max(20, (stdout?.columns || 80) - 1)}
                                    aiProvider={aiProvider}
                                    version={versionFluxflow}
                                />
                                {activeCommand && (
                                    <Box marginTop={1}>
                                        <TerminalBox command={activeCommand} output={execOutput} isFocused={isTerminalFocused} isPty={isActiveCommandPty} />
                                    </Box>
                                )}
                            </Box>
                        )}

                        {isInitializing ? (
                            <Box borderStyle="double" borderColor="grey" padding={1} flexShrink={0}>
                                <Text color="white">Starting Flux Flow...</Text>
                            </Box>
                        ) : !apiKey ? (
                            <Box borderStyle="round" borderColor="white" padding={0} flexDirection="column" flexShrink={0} width="100%">
                                <Box paddingX={1} marginBottom={1}>
                                    <Text color="gray" bold>API KEY REQUIRED</Text>
                                </Box>

                                <Box paddingX={1} flexDirection="column">
                                    {setupStep === 0 ? (
                                        <>
                                            <Text color="white">Select your Preferred Provider:</Text>
                                            <Box marginTop={1}>
                                                <CommandMenu
                                                    items={[
                                                        { label: 'Google (Free/Paid)', value: 'Google' },
                                                        { label: 'Nvidia (Free/Paid)', value: 'NVIDIA' },
                                                        { label: 'DeepSeek (Paid)', value: 'DeepSeek' },
                                                        { label: 'OpenRouter (Free/Paid) [EXPERIMENTAL]', value: 'OpenRouter' },
                                                    ]}
                                                    onSelect={(item) => {
                                                        setAiProvider(item.value);
                                                        setSetupStep(1);
                                                    }}
                                                />
                                            </Box>
                                        </>
                                    ) : (
                                        <>
                                            <Text color="white">Please enter your {aiProvider} API Key to initialize the agent (If billing is enabled set Tier to paid in /settings → other → API Tier).</Text>
                                            <Box marginTop={1}>
                                                <Text color="gray" bold> {'>'} </Text>
                                                <TextInput
                                                    value={tempKey}
                                                    onChange={setTempKey}
                                                    onSubmit={handleSetup}
                                                    mask="*"
                                                />
                                            </Box>
                                            <Box marginTop={1}>
                                                <Text color="gray" italic>(Press ESC to go back to provider selection)</Text>
                                            </Box>
                                        </>
                                    )}
                                </Box>

                                <Box paddingX={1} marginTop={1}>
                                    <Text color="gray" italic>{setupStep === 0 ? '(Use arrows to select and Enter to confirm)' : '(Press Enter to confirm and initialize)'}</Text>
                                </Box>
                            </Box>
                        ) : (
                            renderActiveView()
                        )}

                        {confirmExit && (
                            <Box borderStyle="round" borderColor="white" paddingX={2} marginY={0} width="100%">
                                <Text color="white" bold>🔴 EXIT CONFIRMATION: </Text>
                                <Text color="white">Press </Text>
                                <Text color="white" bold>CTRL + C</Text>
                                <Text color="white"> again to exit ({exitCountdown}s). Press </Text>
                                <Text color="gray" bold>ESC</Text>
                                <Text color="white"> to cancel.</Text>
                            </Box>
                        )}

                        {/* 💡 Modernized Suggestion Box - Sleek, structured, and premium */}
                        {suggestions.length > 0 && (() => {
                            const windowSize = 5;
                            let startIdx = suggestionOffsetRef.current;

                            // Adjust offset based on selectedIndex to scroll only at edges
                            if (selectedIndex < startIdx) {
                                startIdx = selectedIndex;
                            } else if (selectedIndex >= startIdx + windowSize) {
                                startIdx = selectedIndex - windowSize + 1;
                            }

                            // Clamp to bounds in case suggestions list shrinks
                            startIdx = Math.max(0, Math.min(startIdx, Math.max(0, suggestions.length - windowSize)));
                            suggestionOffsetRef.current = startIdx;

                            const visible = suggestions.slice(startIdx, startIdx + windowSize);
                            const remaining = suggestions.length - (startIdx + visible.length);

                            return (
                                <Box
                                    flexDirection="column"
                                    width="100%"
                                    marginBottom={1}
                                >
                                    <Box paddingX={1} marginBottom={0} justifyContent="space-between" width="100%">
                                        <Text color="white" bold>
                                            {suggestions[0]?.cmd?.startsWith('@') ? "FILE SUGGESTIONS" : "COMMAND SUGGESTIONS"}
                                        </Text>
                                        {suggestions[0]?.cmd?.startsWith('@') ? (
                                            <Text color="gray" italic>
                                                (Use '#Lstart-Lend' to specify line numbers)
                                            </Text>
                                        ) : (input.startsWith('/model') && apiTier === 'Free') ? (() => {
                                            let url = "https://aistudio.google.com/billing";
                                            let label = "billing";
                                            if (aiProvider === 'DeepSeek') {
                                                url = "https://platform.deepseek.com/usage";
                                                label = "billing";
                                            } else if (aiProvider === 'OpenRouter') {
                                                url = "https://openrouter.ai/settings/profile";
                                                label = "profile";
                                            } else if (aiProvider === 'NVIDIA') {
                                                url = "https://build.nvidia.com/settings/api-keys";
                                                label = "billing";
                                            }
                                            return (
                                                <Text color="gray" dimColor italic>
                                                    Paid API has more models. Configure <Text color="cyan" underline>{`\u001b]8;;${url}\u0007${label}\u001b]8;;\u0007`}</Text> & /settings
                                                </Text>
                                            );
                                        })() : null}
                                    </Box>

                                    {visible.map((s, i) => {
                                        const actualIdx = startIdx + i;
                                        const isActive = actualIdx === selectedIndex;
                                        const isGemmaDisabled = s.cmd === 'gemma-4-31b-it' && apiTier !== 'Free';

                                        return (
                                            <Box
                                                key={s.cmd}
                                                flexDirection="row"
                                                backgroundColor={isActive ? "#2a2a2a" : undefined}
                                                paddingX={1}
                                            >
                                                <Box width={3}>
                                                    <Text color={isActive ? "white" : "gray"} bold={isActive}>{isActive ? " ❯" : "  "}</Text>
                                                </Box>
                                                <Box width={55}>
                                                    <Text
                                                        color={isGemmaDisabled ? "gray" : (isActive ? "white" : "grey")}
                                                        bold={isActive}
                                                    // dimColor={isGemmaDisabled && !isActive}
                                                    >
                                                        {s.cmd?.startsWith('@[') && s.cmd?.endsWith(']') ? (() => {
                                                            const pathPart = s.cmd.slice(2, -1);
                                                            const parts = pathPart.split(/[/\\]/);
                                                            return parts[parts.length - 1];
                                                        })() : s.cmd}
                                                    </Text>
                                                </Box>
                                                <Box flexGrow={1}>
                                                    <Text color={`${!isActive ? "gray" : "white"}`} italic>{s.desc}</Text>
                                                </Box>
                                            </Box>
                                        );
                                    })}

                                    {/* ⚓ Height Anchor: More indicators for long lists */}
                                    {suggestions.length > 5 && (
                                        <Box paddingX={1} height={1}>
                                            {remaining > 0 ? (
                                                <Text color="gray" dimColor italic>   ... ({remaining} more commands available)</Text>
                                            ) : (
                                                <Text color="gray" dimColor italic>   (End of list)</Text>
                                            )}
                                        </Box>
                                    )}
                                </Box>
                            );
                        })()}

                        <Box flexShrink={0} width="100%">
                            <StatusBar
                                mode={mode}
                                thinkingLevel={thinkingLevel}
                                tokens={sessionStats.tokens}
                                tokensTotal={chatTokens}
                                chatId={chatId}
                                isMemoryEnabled={systemSettings.memory}
                                apiTier={apiTier}
                                aiProvider={aiProvider}
                            />
                        </Box>

                        {activeView === 'exit' && (() => {
                            const wallTimeMs = Date.now() - SESSION_START_TIME;

                            const totalTools = sessionToolSuccess + sessionToolFailure;
                            const successRate = totalTools > 0 ? ((sessionToolSuccess / totalTools) * 100).toFixed(1) : '0.0';

                            const agentActiveMs = sessionApiTime + sessionToolTime;
                            const apiPercent = agentActiveMs > 0 ? ((sessionApiTime / agentActiveMs) * 100).toFixed(1) : '0.0';
                            const toolPercent = agentActiveMs > 0 ? ((sessionToolTime / agentActiveMs) * 100).toFixed(1) : '0.0';

                            return (
                                <Box flexDirection="column" borderStyle="round" paddingX={3} paddingY={1} borderColor="grey" width={Math.min(100, (stdout?.columns || 100) - 2)} marginTop={0} marginBottom={0}>
                                    <Box marginBottom={1}>
                                        <Text bold>{gradient(['blue', 'purple'])('Agent powering down. Goodbye!')}</Text>
                                    </Box>
                                    <Box flexDirection="column">
                                        <Text color="white" bold underline>Interaction Summary</Text>
                                        <Box marginTop={1}>
                                            <Box width={20}><Text color="blue">Session ID:</Text></Box>
                                            <Text color="white">{chatId}</Text>
                                        </Box>
                                        <Box>
                                            <Box width={20}><Text color="blue">Tool Calls:</Text></Box>
                                            <Text color="white">{sessionToolSuccess + sessionToolFailure + sessionToolDenied} ( <Text color="green">✓ {sessionToolSuccess}</Text> <Text color="yellow">⊘ {sessionToolDenied}</Text> <Text color="red">✕ {sessionToolFailure}</Text> )</Text>
                                        </Box>
                                        <Box>
                                            <Box width={20}><Text color="blue">Success Rate:</Text></Box>
                                            <Text color="white">{successRate}%</Text>
                                        </Box>
                                        <Box>
                                            <Box width={20}><Text color="blue">Code Changes:</Text></Box>
                                            <Text color="white"><Text color="green">+{linesAdded}</Text> <Text color="red">-{linesRemoved}</Text></Text>
                                        </Box>
                                        <Box>
                                            <Box width={20}><Text color="blue">Tokens Consumed:</Text></Box>
                                            <Text color="white">{formatTokens(sessionTotalTokens)}</Text>
                                        </Box>
                                        {sessionTotalTokens > 0 && (
                                            <>
                                                <Box marginLeft={2}>
                                                    <Box width={18}><Text color="grey">» Input Tokens:</Text></Box>
                                                    <Text color="white">{formatTokens(sessionTotalTokens - sessionTotalCandidateTokens)}</Text>
                                                </Box>
                                                {sessionTotalCachedTokens > 0 && (
                                                    <Box marginLeft={4}>
                                                        <Box width={16}><Text color="grey">» Cached:</Text></Box>
                                                        <Text color="white">{formatTokens(sessionTotalCachedTokens)}</Text>
                                                    </Box>
                                                )}
                                                {sessionTotalCandidateTokens > 0 && (
                                                    <Box marginLeft={2}>
                                                        <Box width={18}><Text color="grey">» Output Tokens:</Text></Box>
                                                        <Text color="white">{formatTokens(sessionTotalCandidateTokens)}</Text>
                                                    </Box>
                                                )}
                                            </>
                                        )}
                                        {sessionImageCount > 0 && (
                                            <>
                                                <Box>
                                                    <Box width={20}><Text color="blue">Images Made:</Text></Box>
                                                    <Text color="white">{sessionImageCount}</Text>
                                                </Box>
                                                <Box>
                                                    <Box width={20}><Text color="blue">Image Credits:</Text></Box>
                                                    <Text color="white">{Number(((sessionImageCredits || 0) * 1000).toFixed(0))} credits</Text>
                                                </Box>
                                            </>
                                        )}
                                    </Box>

                                    <Box flexDirection="column" marginTop={1}>
                                        <Text color="white" bold underline>Performance</Text>
                                        <Box marginTop={1}>
                                            <Box width={20}><Text color="blue">Wall Time:</Text></Box>
                                            <Text color="white">{formatMsDuration(wallTimeMs)}</Text>
                                        </Box>
                                        <Box>
                                            <Box width={20}><Text color="blue">Agent Active:</Text></Box>
                                            <Text color="white">{formatMsDuration(agentActiveMs)}</Text>
                                        </Box>
                                        <Box marginLeft={2}>
                                            <Box width={18}><Text color="grey">» API Time:</Text></Box>
                                            <Text color="white">{formatMsDuration(sessionApiTime)} ({apiPercent}%)</Text>
                                        </Box>
                                        <Box marginLeft={2}>
                                            <Box width={18}><Text color="grey">» Tool Time:</Text></Box>
                                            <Text color="white">{formatMsDuration(sessionToolTime)} ({toolPercent}%)</Text>
                                        </Box>
                                    </Box>
                                </Box>
                            );
                        })()}
                    </Box>
                </>
            )}
        </Box>
    );
}
