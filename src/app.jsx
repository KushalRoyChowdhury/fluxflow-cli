import os from 'os';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import fs from 'fs-extra';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { MultilineInput } from './components/MultilineInput.jsx';
import TextInput from 'ink-text-input';
import ChatLayout, { MessageItem } from './components/ChatLayout.jsx';
import StatusBar from './components/StatusBar.jsx';
import CommandMenu from './components/CommandMenu.jsx';
import SettingsMenu from './components/SettingsMenu.jsx';
import ProfileForm from './components/ProfileForm.jsx';
import AskUserModal from './components/AskUserModal.jsx';
import gradient from 'gradient-string';
import { getAPIKey, saveAPIKey, removeAPIKey } from './utils/secrets.js';
import { initAI, getAIStream, signalTermination, runJanitorTask } from './utils/ai.js';
import { loadSettings, saveSettings } from './utils/settings.js';
import { loadHistory, saveChat, deleteChat, generateChatId, cleanupOldHistory, cleanupOldLogs } from './utils/history.js';
import ResumeModal from './components/ResumeModal.jsx';
import MemoryModal from './components/MemoryModal.jsx';
import UpdateProcessor from './components/UpdateProcessor.jsx';
import { RevertManager } from './utils/revert.js';
import RevertModal from './components/RevertModal.jsx';
import { getDailyUsage, addToUsage, initUsage, forceFlushUsage, getImageQuotaStats } from './utils/usage.js';
import { TerminalBox } from './components/TerminalBox.jsx';
import { parseArgs } from './utils/arg_parser.js';
import { FLUXFLOW_DIR, LOGS_DIR, SECRET_DIR, SETTINGS_FILE } from './utils/paths.js';
import { emojiSpace } from './utils/terminal.js';
import { writeToActiveCommand, terminateActiveCommand, isActiveCommandPty } from './tools/exec_command.js';
import { checkPuppeteerReady, installPuppeteerBrowser } from './utils/setup.js';
import { formatTokens } from './utils/text.js';

// 1. RAW JS SESSION TRACKER (Vanilla JS for zero-render overhead)
const SESSION_START_TIME = Date.now();
const CHANGELOG_URL = 'https://fluxflow-cli.onrender.com/changelog.html';
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
    <Box flexDirection="column" borderStyle="round" borderColor="gray" padding={0} width="100%">
        <Box paddingX={1}>
            <Text color="magenta" bold underline>🟣 STEERING HINT RESOLUTION</Text>
        </Box>
        <Box paddingX={1} marginTop={1}>
            <Text>The agent already finished the task before your hint was consumed.</Text>
        </Box>
        <Box marginTop={1} backgroundColor="#222" paddingX={2} width="100%">
            <Text italic color="gray">"{data}"</Text>
        </Box>
        <Box paddingX={1} marginTop={1}>
            <Text color="cyan">How would you like to proceed?</Text>
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


const FLUX_LOGO = gradient(['#00ffff', '#0077ff', '#ff00ff']).multiline(
    `███████╗██╗     ██╗   ██╗██╗  ██╗    ███████╗██╗      ██████╗ ██╗    ██╗
██╔════╝██║     ██║   ██║╚██╗██╔╝    ██╔════╝██║     ██╔═══██╗██║    ██║
█████╗  ██║     ██║   ██║ ╚███╔╝     █████╗  ██║     ██║   ██║██║ █╗ ██║
██╔══╝  ██║     ██║   ██║ ██╔██╗     ██╔══╝  ██║     ██║   ██║██║███╗██║
██║     ███████╗╚██████╔╝██╔╝ ██╗    ██║     ███████╗╚██████╔╝╚███╔███╔╝
╚═╝     ╚══════╝ ╚═════╝ ╚═╝  ╚═╝    ╚═╝     ╚══════╝ ╚═════╝  ╚══╝╚══╝`
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
    const persistedModelRef = useRef(null);

    // Parse CLI startup arguments
    const parsedArgs = useMemo(() => {
        const parsed = {};
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            if (arg === '--model' && args[i + 1]) {
                parsed.model = args[i + 1];
                i++;
            } else if (arg === '--memory' && args[i + 1]) {
                parsed.memory = args[i + 1].toLowerCase();
                i++;
            } else if (arg === '--resume' && args[i + 1]) {
                parsed.resume = args[i + 1];
                i++;
            } else if (arg === '--update' && args[i + 1]) {
                parsed.update = args[i + 1].toLowerCase();
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
            }
            else if (arg === '--thinking' && args[i + 1]) {
                const val = args[i + 1];
                const lower = val.toLowerCase();
                if (['fast', 'low', 'medium', 'high', 'xhigh'].includes(lower)) {
                    let mapped = 'Medium';
                    if (lower === 'fast') mapped = 'Fast';
                    else if (lower === 'low') mapped = 'Low';
                    else if (lower === 'medium') mapped = 'Medium';
                    else if (lower === 'high') mapped = 'High';
                    else if (lower === 'xhigh') mapped = 'xHigh';
                    parsed.thinking = mapped;
                }
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
                    return [...prev, { id: 'uptodate-' + Date.now(), role: 'system', text: `✅ [SYSTEM] Flux Flow is already up to date (${displayVer}).`, isMeta: true }];
                });
            }
        } catch (err) {
            if (manual) {
                setMessages(prev => {
                    setCompletedIndex(prev.length + 1);
                    return [...prev, { id: 'check-err-' + Date.now(), role: 'system', text: `❌ ERROR: Failed to check for updates: ${err.message}`, isMeta: true }];
                });
            }
        }
    };

    useEffect(() => {
        const handleResize = () => {
            // Force a HARD terminal reset (powerful for Windows) to prevent background spill
            stdout.write('\x1Bc');
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
    const [latestVer, setLatestVer] = useState(null);
    const [showFullThinking, setShowFullThinking] = useState(false);
    const [activeModel, setActiveModel] = useState('gemma-4-31b-it');
    const [janitorModel, setJanitorModel] = useState('gemma-4-26b-a4b-it');
    const [isInitializing, setIsInitializing] = useState(true);
    const [apiKey, setApiKey] = useState(null);
    const [tempKey, setTempKey] = useState('');

    const [activeView, setActiveView] = useState('chat'); // chat, mode, thinking, model, settings, profile
    const [apiTier, setApiTier] = useState('Free');
    const [quotas, setQuotas] = useState({ agentLimit: 999999, backgroundLimit: 999999, searchLimit: 100, customModelId: '', customLimit: 0 });
    const [inputConfig, setInputConfig] = useState(null); // { label, key, subKey, value, next }
    const [systemSettings, setSystemSettings] = useState({ memory: true, compression: 0.0, autoExec: false, autoDeleteHistory: '7d', autoUpdate: false, updateManager: 'npm', customUpdateCommand: '' });
    const [profileData, setProfileData] = useState({ name: null, nickname: null, instructions: null });
    const [imageSettings, setImageSettings] = useState({ keyType: 'Default', quality: 'Low-High', apiKey: '' });
    const [sessionStats, setSessionStats] = useState({ tokens: 0 });
    const [sessionAgentCalls, setSessionAgentCalls] = useState(0);
    const [sessionBackgroundCalls, setSessionBackgroundCalls] = useState(0);
    const [sessionTotalTokens, setSessionTotalTokens] = useState(0);
    const [sessionTotalCachedTokens, setSessionTotalCachedTokens] = useState(0);
    const [sessionToolSuccess, setSessionToolSuccess] = useState(0);
    const [sessionToolFailure, setSessionToolFailure] = useState(0);
    const [sessionToolDenied, setSessionToolDenied] = useState(0);
    const [sessionApiTime, setSessionApiTime] = useState(0);
    const [sessionToolTime, setSessionToolTime] = useState(0);
    const [sessionImageCount, setSessionImageCount] = useState(0);
    const [sessionImageCredits, setSessionImageCredits] = useState(0);
    const [dailyUsage, setDailyUsage] = useState(null);
    const [chatId, setChatId] = useState(generateChatId());
    const [activeCommand, setActiveCommand] = useState(null);
    const [execOutput, setExecOutput] = useState('');
    const [isTerminalFocused, setIsTerminalFocused] = useState(false);
    const [tick, setTick] = useState(0); // Only used for SPINNER_FRAMES reference if needed elsewhere, but mainly tick is gone now
    const isFirstRender = useRef(true);
    const isSecondRender = useRef(true);

    // [TIER AWARENESS] Auto-switch from Gemma if moving to Paid tier
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            setTimeout(() => {
                isSecondRender.current = false;
            }, 2000);
            return;
        }

        if (isSecondRender.current) {
            return;
        }

        const s = emojiSpace(2);
        if (apiTier === 'Free') {
            setActiveModel('gemma-4-31b-it');
            saveSettings({ apiTier: 'Free', activeModel: 'gemma-4-31b-it' });
            setMessages(prev => {
                setCompletedIndex(prev.length + 1);
                return [...prev, {
                    id: 'tier-switch-' + Date.now(),
                    role: 'system',
                    text: `⚠️${s}**[TIER LIMIT]** Auto-switched to Gemma (Free default).`,
                    isMeta: true
                }];
            });
        } else {
            setActiveModel('gemini-3-flash-preview');
            saveSettings({ apiTier: 'Paid', activeModel: 'gemini-3-flash-preview' });
            setMessages(prev => {
                setCompletedIndex(prev.length + 1);
                return [...prev, {
                    id: 'tier-switch-' + Date.now(),
                    role: 'system',
                    text: `⚠️${s}**[TIER LIMIT]** Auto-switched to Gemini 3 Flash.`,
                    isMeta: true
                }];
            });
        }
    }, [apiTier]); // Look, only apiTier matters now!

    // [ENVIRONMENT AWARENESS] Detect if we are in VS Code, JetBrains, etc.
    const terminalEnv = useMemo(() => {
        const isIDE = process.env.TERM_PROGRAM === 'vscode' || !!process.env.VSC_TERMINAL_URL || !!process.env.INTELLIJ_TERMINAL_COMMAND_BLOCKS;
        return {
            isIDE,
            shortcut: isIDE ? 'Shift + Enter' : 'Ctrl + Enter'
        };
    }, []);

    const activeCommandRef = useRef(null);
    const execOutputRef = useRef('');

    useEffect(() => { activeCommandRef.current = activeCommand; }, [activeCommand]);
    useEffect(() => { execOutputRef.current = execOutput; }, [execOutput]);

    const [autoAcceptWrites, setAutoAcceptWrites] = useState(false);
    const [pendingApproval, setPendingApproval] = useState(null);
    const [pendingAsk, setPendingAsk] = useState(null);

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
    const [isSpinnerActive, setIsSpinnerActive] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
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
        const logoMsg = { id: 'logo-' + Date.now(), role: 'system', text: FLUX_LOGO, isLogo: true, isMeta: true };
        const welcomeMsg = { id: 'welcome', role: 'system', text: '🌊⚡ Welcome to Flux Flow! Type /help for commands.', isMeta: true };
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

        const msgs = [logoMsg, welcomeMsg];
        if (isSystemDir) {
            msgs.push({
                id: 'system-warning',
                role: 'system',
                text: `🛑 [CRITICAL SECURITY ALERT] SYSTEM DIRECTORY DETECTED`,
                subText: `You are currently in a PROTECTED SYSTEM DIRECTORY (${process.cwd()}). Operating here is EXTREMELY dangerous as the agent could accidentally corrupt your OS or installed applications. PLEASE MOVE TO A PROJECT FOLDER FOR SAFETY.`,
                isHomeWarning: true,
                isMeta: true
            });
        } else if (isHomeDir) {
            msgs.push({
                id: 'home-warning',
                role: 'system',
                text: `[SECURITY ALERT] HOME DIRECTORY DETECTED`,
                subText: `You are currently in ${os.homedir()}. Working here is high-risk as the agent may modify system-sensitive configurations. Please move to a project folder for safety.`,
                isHomeWarning: true,
                isMeta: true
            });
        }
        return msgs;
    });
    const queuedPromptRef = useRef(null);
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
                                            return [...prev, { id: 'revert-empty-' + Date.now(), role: 'system', text: '🛈 No revert checkpoints found for this session.', isMeta: true }];
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
        async function init() {
            // Set custom terminal tab title
            if (process.stdout.isTTY) {
                process.stdout.write(`\u001b]0;FluxFlow | Ready\u0007`);
            }

            // 0. System Integrity Check (Build-in Chromium)
            if (!checkPuppeteerReady()) {
                setMessages(prev => {
                    setCompletedIndex(prev.length + 1);
                    return [...prev, { id: 'setup-' + Date.now(), role: 'system', text: '🔧 [SYSTEM] Installing Required dependencies... (One-time setup)', isMeta: true }];
                });
                await installPuppeteerBrowser();
                setMessages(prev => {
                    setCompletedIndex(prev.length + 1);
                    return [...prev, { id: 'setup-done-' + Date.now(), role: 'system', text: '✅ [SYSTEM] All dependencies installed successfully.', isMeta: true }];
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

            persistedModelRef.current = saved.activeModel;
            if (parsedArgs.model) {
                setActiveModel(parsedArgs.model);
            } else {
                setActiveModel(saved.activeModel);
            }

            setShowFullThinking(saved.showFullThinking);
            setApiTier(saved.apiTier || 'Free');
            setQuotas(saved.quotas || { agentLimit: 999999, backgroundLimit: 999999, searchLimit: 100, customModelId: '', customLimit: 0 });
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
            const key = await getAPIKey();
            if (key) {
                setApiKey(key);
                initAI(key); // Initialize Gemini SDK
            }

            // 3. Clean up old history and logs (older than 7 days)
            if (saved.systemSettings?.autoDeleteHistory) {
                cleanupOldHistory(saved.systemSettings.autoDeleteHistory);
            }
            cleanupOldLogs(LOGS_DIR);

            // 4. Check for updates / handle CLI flags
            if (parsedArgs.update === 'check') {
                performVersionCheck(true, freshSettings);
            } else if (parsedArgs.update === 'latest') {
                setActiveView('update');
                performVersionCheck(true, freshSettings);
            } else {
                performVersionCheck(false, freshSettings);
            }

            // 5. Prime usage cache and handle resume flag
            await initUsage();

            if (parsedArgs.resume) {
                const h = await loadHistory();
                const id = parsedArgs.resume;
                if (h[id]) {
                    setChatId(id);
                    const resumedMsgs = [...h[id].messages];
                    const hasLogo = resumedMsgs[0]?.text?.includes('███████╗');
                    if (!hasLogo) {
                        resumedMsgs.unshift({ id: 'welcome-' + Date.now(), role: 'system', text: FLUX_LOGO + '\n\n🌊⚡ Resuming Flux Flow Session...', isMeta: true });
                    }
                    setMessages(resumedMsgs);
                    setActiveView('chat');
                    setMessages(prev => {
                        const newMsgs = [...prev, { id: 'sys-' + Date.now(), role: 'system', text: `📡 SESSION RESUMED VIA CLI: [${id}]`, isMeta: true }];
                        setCompletedIndex(newMsgs.length);
                        return newMsgs;
                    });
                } else {
                    setMessages(prev => [...prev, { id: 'sys-err-' + Date.now(), role: 'system', text: `❌ ERROR: Chat session [${id}] not found. Started new session.`, isMeta: true }]);
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
                activeModel: modelToSave || activeModel,
                showFullThinking,
                systemSettings,
                profileData,
                imageSettings,
                apiTier
            });
        }
    }, [mode, thinkingLevel, activeModel, showFullThinking, systemSettings, profileData, imageSettings, isInitializing, parsedArgs, apiTier]);

    const handleSetup = async (val) => {
        const key = val.trim();
        if (key.length >= 30) {
            await saveAPIKey(key);
            setApiKey(key);
            initAI(key); // Initialize Gemini SDK
            setMessages(prev => [...prev, { role: 'system', text: '✅ API Key saved successfully! Initialization complete.', isMeta: true }]);
        } else {
            setMessages(prev => [...prev, { role: 'system', text: `❌ INVALID KEY: Gemini API keys must be at least 30 characters.`, isMeta: true }]);
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
        { cmd: '/clear', desc: 'Clear terminal screen' },
        { cmd: '/resume', desc: 'Load previous session' },
        { cmd: '/revert', desc: 'Revert codebase back to a checkpoint' },
        { cmd: '/save', desc: 'Force save current chat' },
        { cmd: '/export', desc: 'Export current chat in a .txt file' },
        { cmd: '/chats', desc: 'List all chat sessions' },
        {
            cmd: '/image', desc: 'Generate images using Pollinations', subs: [
                {
                    cmd: 'setup', desc: 'Configure defaults', subs: [
                        {
                            cmd: 'key', desc: 'Set API key strategy', subs: [
                                { cmd: 'default', desc: 'Default (Quota: Dynamic 25 max/hr)' },
                                { cmd: 'custom', desc: 'Custom Key' }
                            ]
                        },
                        {
                            cmd: 'quality', desc: 'Set default quality', subs: [
                                { cmd: 'low', desc: imageSettings?.keyType === 'Custom' ? '(0.001/img)' : '(1/img)' },
                                { cmd: 'low-high', desc: imageSettings?.keyType === 'Custom' ? '(0.002/img)' : '(2/img)' },
                                { cmd: 'medium', desc: imageSettings?.keyType === 'Custom' ? '(0.008/img)' : '(8/img)' },
                                { cmd: 'medium-high', desc: imageSettings?.keyType === 'Custom' ? '(0.01/img)' : '(10/img)' },
                                { cmd: 'high', desc: imageSettings?.keyType === 'Custom' ? '(0.045/img)' : '(45/img)' },
                                { cmd: 'ultra', desc: imageSettings?.keyType === 'Custom' ? '(0.0488/img)' : '(49/img)' },
                                { cmd: 'premium', desc: imageSettings?.keyType === 'Custom' ? '(0.1/img)' : '(100/img)' }
                            ]
                        }
                    ]
                },
                { cmd: 'stats', desc: 'Show remaining credits or Pollinations balance status' }
            ]
        },
        {
            cmd: '/mode', desc: 'Toggle Flux/Flow modes', subs: [
                { cmd: 'flux', desc: 'Enable Dev toolset' },
                { cmd: 'flow', desc: 'Enable Chat mode' }
            ]
        },
        {
            cmd: '/thinking', desc: 'Set AI reasoning depth', subs: [
                { cmd: 'Fast', desc: 'No Reasoning        (Fastest)' },
                { cmd: 'Low', desc: 'Quick Reasoning     (Answers Quickly)' },
                { cmd: 'Medium', desc: 'Balanced Reasoning  (Decent Depth)' },
                { cmd: 'High', desc: 'Deep Reasoning      (Complex Problems)' },
                { cmd: 'xHigh', desc: 'Extended Reasoning  (Advanced Logic & Code)' }
            ]
        },
        {
            cmd: '/model',
            desc: 'Switch Model for Agent',
            subs: apiTier === 'Free'
                ? [
                    {
                        cmd: 'gemma-4-31b-it',
                        desc: 'Standard Default'
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

                ]
        },
        { cmd: '/settings', desc: 'Configure system prefs' },
        { cmd: '/key', desc: 'Manage API keys' },
        { cmd: '/profile', desc: 'Edit developer persona' },
        { cmd: '/memory', desc: 'Manage agent memory' },
        { cmd: '/stats', desc: 'Show session usage' },
        { cmd: '/reset', desc: 'Wipe all project data' },
        { cmd: '/about', desc: 'Project info & credits' },
        { cmd: '/changelog', desc: 'View latest updates' },
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
            if (hintText.startsWith('/')) {
                setMessages(prev => {
                    setCompletedIndex(prev.length + 1);
                    return [...prev, { id: 'hint-err-' + Date.now(), role: 'system', text: '❌ [RESTRICTED] Steering Hints cannot start with /', isMeta: true }];
                });
                setInput('');
                return;
            }

            setQueuedPrompt(hintText);
            queuedPromptRef.current = hintText;
            setMessages(prev => {
                setCompletedIndex(prev.length + 1);
                return [...prev, { id: 'hint-' + Date.now(), role: 'user', text: `[STEERING HINT: QUEUED] \n${hintText}`, color: 'magenta' }];
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

                                // Ensure logo is present at the start of resumed history
                                const resumedMsgs = [...target.messages];
                                const hasLogo = resumedMsgs[0]?.text?.includes('███████╗');
                                if (!hasLogo) {
                                    resumedMsgs.unshift({ id: 'welcome-' + Date.now(), role: 'system', text: '🌊⚡ Resuming Flux Flow Session...', isMeta: true });
                                    resumedMsgs.unshift({ id: 'logo-' + Date.now(), role: 'system', text: FLUX_LOGO, isLogo: true, isMeta: true });
                                }

                                setMessages(resumedMsgs);
                                setMessages(prev => [...prev, { id: 'sys-' + Date.now(), role: 'system', text: `📡 SESSION RESUMED: [${targetId}]`, isMeta: true }]);
                                setCompletedIndex(0);
                            } else {
                                setMessages(prev => [...prev, { id: 'err-' + Date.now(), role: 'system', text: `❌ ERROR: Session [${targetId}] not found.` }]);
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
                        { id: 'logo-' + Date.now(), role: 'system', text: FLUX_LOGO, isLogo: true, isMeta: true },
                        { id: 'welcome-' + Date.now(), role: 'system', text: '🌊⚡ Welcome back to Flux Flow! Context cleared.', isMeta: true }
                    ]);
                    setCompletedIndex(2);
                    setChatId(generateChatId());
                    setSessionStats({ tokens: 0 });
                    setIsExpanded(false);
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
                                return [...prev, { id: 'revert-empty-' + Date.now(), role: 'system', text: `No revert checkpoints found for this session.`, isMeta: true }];
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
                        setMessages(prev => { setCompletedIndex(prev.length + 1); return [...prev, { id: Date.now(), role: 'system', text: `🔧${s}[SYSTEM] Mode switched to ${newMode}`, isMeta: true }]; });
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
                                    text: `🔗${s}[SYSTEM] Key strategy is Custom. Redirecting to Pollinations dashboard (https://enter.pollinations.ai/#pollen)...`,
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
                                        text: `❌ [SYSTEM] Failed to load image quota stats.`,
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
                                        return [...prev, { id: Date.now(), role: 'system', text: `🔧${s}[SYSTEM] Image key strategy set to ${strategy}`, isMeta: true }];
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
                                        return [...prev, { id: Date.now(), role: 'system', text: `❌ [SYSTEM] Invalid key option. Choose: Default or Custom.`, isMeta: true }];
                                    });
                                }
                            } else {
                                const s = emojiSpace(2);
                                setMessages(prev => {
                                    setCompletedIndex(prev.length + 1);
                                    return [...prev, { id: Date.now(), role: 'system', text: `❌ [SYSTEM] Usage: /image setup Key <Default|Custom>`, isMeta: true }];
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
                                        return [...prev, { id: Date.now(), role: 'system', text: `🔧${s}[SYSTEM] Image quality set to ${chosenQuality}`, isMeta: true }];
                                    });
                                } else {
                                    const s = emojiSpace(2);
                                    setMessages(prev => {
                                        setCompletedIndex(prev.length + 1);
                                        return [...prev, { id: Date.now(), role: 'system', text: `❌ [SYSTEM] Invalid quality level. Choose from: Low, Low-High, Medium, Medium-High, High, Ultra, Premium.`, isMeta: true }];
                                    });
                                }
                            } else {
                                const s = emojiSpace(2);
                                setMessages(prev => {
                                    setCompletedIndex(prev.length + 1);
                                    return [...prev, { id: Date.now(), role: 'system', text: `❌ [SYSTEM] Usage: /image setup Quality <Low|Low-High|Medium|Medium-High|High|Ultra>`, isMeta: true }];
                                });
                            }
                        } else {
                            const s = emojiSpace(2);
                            setMessages(prev => {
                                setCompletedIndex(prev.length + 1);
                                return [...prev, { id: Date.now(), role: 'system', text: `❌ [SYSTEM] Usage: /image setup <Key|Quality> ...`, isMeta: true }];
                            });
                        }
                    } else {
                        const s = emojiSpace(2);
                        setMessages(prev => {
                            setCompletedIndex(prev.length + 1);
                            return [...prev, { id: Date.now(), role: 'system', text: `❌ [SYSTEM] Usage: /image setup <Key|Quality> ...`, isMeta: true }];
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
                        if (!isBypass && mode === 'Flow' && (formattedLevel === 'Medium' || formattedLevel === 'High' || formattedLevel === 'xHigh')) {
                            setMessages(prev => {
                                setCompletedIndex(prev.length + 1);
                                return [...prev, { id: Date.now(), role: 'system', text: `❌ [RESTRICTED] "${formattedLevel}" is restricted in Flow mode. Switch to Flux to enable Higher Thinking Levels.`, isMeta: true }];
                            });
                        } else {
                            setThinkingLevel(formattedLevel);
                            const s = emojiSpace(1);
                            setMessages(prev => { setCompletedIndex(prev.length + 1); return [...prev, { id: Date.now(), role: 'system', text: `🔧 [SYSTEM] Thinking level set to ${formattedLevel}${isBypass ? ` (Bypass Activated 🕵️${s})` : ''}`, isMeta: true }]; });
                        }
                    } else {
                        setActiveView('thinking');
                    }
                    break;
                }
                case '/model': {
                    if (parts[1]) {
                        const mod = parts.slice(1).join(' ');
                        if (mod === 'gemma-4-31b-it' && apiTier !== 'Free') {
                            setMessages(prev => {
                                setCompletedIndex(prev.length + 1);
                                return [...prev, {
                                    id: Date.now(),
                                    role: 'system',
                                    text: `❌ **[ACCESS DENIED]** Gemma is restricted to the Free API tier. Automatically switching you to **Gemini 3 Flash Preview** for optimal performance.`,
                                    isMeta: true
                                }];
                            });
                            setActiveModel('gemini-3-flash-preview');
                        } else {
                            setActiveModel(mod);
                            const s = emojiSpace(2);
                            setMessages(prev => { setCompletedIndex(prev.length + 1); return [...prev, { id: Date.now(), role: 'system', text: `🔧${s}[SYSTEM] Model switched to ${mod}`, isMeta: true }]; });
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
                        setDailyUsage(usage);
                        setActiveView('stats');
                    };
                    run();
                    break;
                }
                case '/save': {
                    const name = parts.slice(1).join(' ') || `Session ${new Date().toLocaleTimeString()}`;
                    saveChat(chatId, name, messages);
                    setMessages(prev => { setCompletedIndex(prev.length + 1); return [...prev, { id: Date.now(), role: 'system', text: `💾 [MEMORY] Chat saved as "${name}" (ID: ${chatId})`, isMeta: true }]; });
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
                                .replace(/\[turn:\s*continue\]/gi, '')
                                .replace(/\[turn:\s*finish\]/gi, '')
                                .replace(/\[TOOL RESULTS\]/gi, '')
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
                                        .replace(/\[turn:\s*continue\]/gi, '')
                                        .replace(/\[turn:\s*finish\]/gi, '')
                                        .replace(/\[TOOL RESULTS\]/gi, '')
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
                                text: `📤 [EXPORT] Chat exported successfully to "${exportFile}"`,
                                isMeta: true
                            }];
                        });
                    } catch (err) {
                        setMessages(prev => {
                            setCompletedIndex(prev.length + 1);
                            return [...prev, {
                                id: Date.now(),
                                role: 'system',
                                text: `❌ [EXPORT ERROR] Failed to export chat: ${err.message}`,
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
                            return [...prev, { id: Date.now(), role: 'system', text: `🗃️ [HISTORY] Saved Chats:\n${list || 'No saved chats found.'}`, isMeta: true }];
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
                                return [...prev, { id: Date.now(), role: 'system', text: '☢️ [NUCLEAR] Initiating reset...', isMeta: true }];
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
                                return [...prev, { id: Date.now(), role: 'system', text: `❌ [RESET ERROR] Failed to purge data: ${err.message}` }];
                            });
                        }
                    };
                    runReset();
                    break;
                }
                case '/about': {
                    const s = emojiSpace(2);
                    const aboutText = `🔹 FluxFlow Version: v${versionFluxflow}\n` +
                        `🔹 Status: ${latestVer && latestVer !== versionFluxflow ? `Update Available [v${latestVer}]` : 'Up to date'}\n` +
                        `🔹 Released on: ${updatedOn}`;
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
                        return [...prev, { id: Date.now(), role: 'system', text: `🌐 [BROWSER] Opening changelog: ${CHANGELOG_URL}`, isMeta: true }];
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
                                return [...prev, { id: 'init-err-' + Date.now(), role: 'system', text: '❌ ERROR: FluxFlow.md already exists in this directory.', isMeta: true }];
                            });
                        } else {
                            try {
                                fs.writeFileSync(filePath, template);
                                setMessages(prev => {
                                    setCompletedIndex(prev.length + 1);
                                    return [...prev, { id: 'init-ok-' + Date.now(), role: 'system', text: '✅ [SUCCESS] FluxFlow.md has been initialized. You can now customize it for this project.', isMeta: true }];
                                });
                            } catch (err) {
                                setMessages(prev => {
                                    setCompletedIndex(prev.length + 1);
                                    return [...prev, { id: 'init-err-' + Date.now(), role: 'system', text: `❌ ERROR: Failed to initialize FluxFlow.md: ${err.message}`, isMeta: true }];
                                });
                            }
                        }
                    } else {
                        setMessages(prev => {
                            setCompletedIndex(prev.length + 1);
                            return [...prev, { id: 'ff-err-' + Date.now(), role: 'system', text: '❓ Usage: /fluxflow init', isMeta: true }];
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
                case '/help': {
                    setMessages(prev => {
                        setCompletedIndex(prev.length + 1);
                        return [...prev, { id: Date.now(), role: 'system', isHelpRecord: true, isMeta: true }];
                    });
                    break;
                }
                default:
                    const s = emojiSpace(2);
                    setMessages(prev => { setCompletedIndex(prev.length + 1); return [...prev, { id: Date.now(), role: 'system', text: `🔧${s}[SYSTEM] Unknown command: ${cmd}`, isMeta: true }]; });
            }
        } else {
            // Normal chat message with temporal grounding
            const timestamp = `[Prompted on: ${new Date().toLocaleString()}]`;
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
                    const cleanHistoryForAI = [...messages, userMessage]
                        .filter(m =>
                            m.role !== 'think' &&
                            !m.isVisualFeedback &&
                            !String(m.id).startsWith('welcome')
                        )
                        .map(m => ({
                            ...m,
                            text: m.fullText || m.text
                        }));
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
                                    // Normalize output for history/agent (resolve carriage returns to simulate terminal overwrite)
                                    const rawOutput = execOutputRef.current || '';
                                    let normalizedOutput = '';
                                    if (isActiveCommandPty) {
                                        // 1. Handle Hard Clears: Discard everything before the last clear screen/home signal
                                        const screenResetRegex = /\x1b\[H|\x1b\[2J|\x1b\[3J|\x1bc/g;
                                        const resetMatches = [...rawOutput.matchAll(screenResetRegex)];
                                        let workingText = rawOutput;
                                        if (resetMatches.length > 0) {
                                            const lastMatch = resetMatches[resetMatches.length - 1];
                                            workingText = rawOutput.substring(lastMatch.index + lastMatch[0].length);
                                        }

                                        const noTrailingCr = workingText.replace(/\r+\n/g, '\n');
                                        normalizedOutput = noTrailingCr.split('\n').map(line => {
                                            const parts = line.split('\r');
                                            return parts[parts.length - 1];
                                        }).join('\n');
                                    } else {
                                        normalizedOutput = rawOutput.replace(/\r\n/g, '\n');
                                    }
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
                                    const index = [...prev].reverse().findIndex(m => m.text?.includes('[STEERING HINT: QUEUED]'));
                                    if (index !== -1) {
                                        const actualIndex = prev.length - 1 - index;
                                        const newMsgs = [...prev];
                                        newMsgs[actualIndex] = {
                                            ...newMsgs[actualIndex],
                                            text: newMsgs[actualIndex].text.replace('[STEERING HINT: QUEUED]', '[STEERING HINT: INJECTED]'),
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
                        if (isFirstPacket && packet.type === 'text') {
                            apiStart = Date.now();
                            isFirstPacket = false;
                        }
                        if (packet.type === 'status') {
                            setStatusText(packet.content);
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
                            hasFiredJanitor = true;
                            
                            // [CACHE SYNC] Update messages with augmented text (stored in fullText to keep UI clean)
                            setMessages(prev => {
                                const aiHistory = packet.data.history;
                                return prev.map((msg, idx) => {
                                    if (aiHistory[idx]) {
                                        return { ...msg, fullText: aiHistory[idx].text };
                                    }
                                    return msg;
                                });
                            });

                            runJanitorTask(
                                { profile: profileData, thinkingLevel, mode, janitorModel, chatId, systemSettings, sessionStats },
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
                                id: 'feedback-' + Date.now(),
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
                            setSessionStats({ tokens: total });
                            setSessionTotalTokens(prev => prev + total);
                            if (cached > 0) {
                                setSessionTotalCachedTokens(prev => prev + cached);
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
                            inThinkMode = true;
                            thinkConsumedInTurn = true;
                            // Clean up any partial tags from the visible text
                            chunkText = chunkText.replace(/<(think|thought)>[\s\S]*?<\/(think|thought)>/gi, '').replace(/<(think|thought)>/gi, '');
                            currentThinkId = 'think-' + Date.now();
                            setMessages(prev => [...prev, { id: currentThinkId, role: 'think', text: '', isStreaming: true, startTime: Date.now() }]);
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
                            process.stdout.write(`\u001b]0;FluxFlow | Idle\u0007`);
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
                            const hintMsg = newMsgs.reverse().find(m => m.text?.includes('[STEERING HINT: QUEUED]'));
                            if (hintMsg) {
                                hintMsg.text = hintMsg.text.replace('[STEERING HINT: QUEUED]', '[STEERING HINT: FINISHED_TURN]');
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
                    />
                );

            case 'apiTier':
                return (
                    <CommandMenu
                        title={
                            <Text>
                                SELECT YOUR CURRENT API TIER BASED ON <Text color="cyan" underline bold>{"\u001b]8;;https://aistudio.google.com/projects\u0007AI STUDIO\u001b]8;;\u0007"}</Text>. (CURRENT: {apiTier.toUpperCase()})
                            </Text>
                        }
                        items={[
                            { label: 'Free Tier (Gemini API Free Tier)', value: 'Free' },
                            { label: `Paid Tier (API with Billing Account)`, value: 'Paid' },
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
                                    value: String(quotas.agentLimit),
                                });
                                setActiveView('input');
                            } else {
                                saveSettings({ apiTier: newTier, quotas });
                                setActiveView('settings');
                            }
                        }}
                        onClose={() => setActiveView('settings')}
                    />
                );

            case 'input':
                return (
                    <Box flexDirection="column" borderStyle="round" borderColor="gray" padding={0} width="100%">
                        <Box paddingX={1}>
                            <Text color="magenta" bold>🔧 DATA CONFIGURATION</Text>
                        </Box>

                        {inputConfig?.note && (
                            <Box paddingX={1} marginBottom={1}>
                                <Text color="yellow" dimColor italic>
                                    {inputConfig.note}
                                </Text>
                            </Box>
                        )}

                        <Box paddingX={1} flexDirection="row">
                            <Text color="cyan" bold>{inputConfig?.label} </Text>
                            <TextInput
                                value={inputConfig?.value || ''}
                                onChange={(val) => setInputConfig(prev => ({ ...prev, value: val }))}
                                onSubmit={(val) => {
                                    const { key, subKey, next } = inputConfig;

                                    let newQuotas = { ...quotas };
                                    let newSettings = {};

                                    if (key === 'quotas') {
                                        const parsedValue = subKey.toLowerCase().includes('limit') ? parseInt(val) || 0 : val;
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
                                        setMessages(prev => [...prev, { id: Date.now(), role: 'system', text: '📁 [EXTERNAL STORAGE] Flux Flow will use ' + val.trim() + ' for data after restart.' }]);
                                    } else if (key === 'imageSettings') {
                                        const apiKeyInput = val.trim();
                                        if (apiKeyInput.startsWith('sk_')) {
                                            const updatedSettings = { ...imageSettings, apiKey: apiKeyInput };
                                            setImageSettings(updatedSettings);
                                            newSettings.imageSettings = updatedSettings;
                                            setMessages(prev => {
                                                setCompletedIndex(prev.length + 1);
                                                return [...prev, { id: Date.now(), role: 'system', text: `🔑 [IMAGE KEY] Custom API key saved successfully.`, isMeta: true }];
                                            });
                                        } else {
                                            setImageSettings(prev => ({ ...prev, keyType: 'Default' }));
                                            newSettings.imageSettings = { ...imageSettings, keyType: 'Default' };
                                            setMessages(prev => {
                                                setCompletedIndex(prev.length + 1);
                                                return [...prev, { id: Date.now(), role: 'system', text: `❌ [IMAGE KEY ERROR] API key must start with sk_. Key strategy reset to Default.`, isMeta: true }];
                                            });
                                        }
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

            case 'stats':
                return (
                    <Box flexDirection="column" borderStyle="round" paddingX={3} paddingY={1} width={Math.min(100, (stdout?.columns || 100) - 2)}>
                        <Box marginBottom={1}>
                            <Text color="white" bold underline>SESSION TELEMETRY</Text>
                        </Box>

                        <Box flexDirection="column">
                            <Box>
                                <Box width={25}><Text color="blue">Session Duration:</Text></Box>
                                <Text color="white">{formatMsDuration(Date.now() - SESSION_START_TIME)}</Text>
                            </Box>
                            <Box>
                                <Box width={25}><Text color="blue">Agent Interactions:</Text></Box>
                                <Text color="white">{sessionAgentCalls}</Text>
                            </Box>
                            <Box marginLeft={2}>
                                <Box width={23}><Text color="blue" dimColor>» API Time:</Text></Box>
                                <Text color="white">{formatMsDuration(sessionApiTime)}</Text>
                            </Box>
                            <Box marginLeft={2}>
                                <Box width={23}><Text color="blue" dimColor>» Tool Time:</Text></Box>
                                <Text color="white">{formatMsDuration(sessionToolTime)}</Text>
                            </Box>
                            <Box>
                                <Box width={25}><Text color="blue">Background Tasks:</Text></Box>
                                <Text color="white">{sessionBackgroundCalls}</Text>
                            </Box>
                            <Box>
                                <Box width={25}><Text color="blue">Tokens Consumed:</Text></Box>
                                <Text color="white">{formatTokens(sessionTotalTokens)}</Text>
                            </Box>
                            {sessionTotalCachedTokens > 0 && (
                                <Box>
                                    <Box width={25}><Text color="blue">Cached Tokens:</Text></Box>
                                    <Text color="white">{formatTokens(sessionTotalCachedTokens)}</Text>
                                </Box>
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
                            <Text color="white" bold underline>DAILY USAGE TRACKER</Text>
                            <Box marginTop={1}>
                                <Box width={25}><Text color="blue">Wall Time Today:</Text></Box>
                                <Text color="white">{formatDuration(dailyUsage?.duration || 0)}</Text>
                            </Box>
                            <Box>
                                <Box width={25}><Text color="blue">Agent Interactions:</Text></Box>
                                <Text color="white">{dailyUsage?.agent || 0}</Text>
                            </Box>
                            <Box>
                                <Box width={25}><Text color="blue">Background Tasks:</Text></Box>
                                <Text color="white">{dailyUsage?.background || 0}</Text>
                            </Box>
                            <Box>
                                <Box width={25}><Text color="blue">Tokens Used Today:</Text></Box>
                                <Text color="white">{formatTokens(dailyUsage?.tokens || 0)}</Text>
                            </Box>
                            {(dailyUsage?.cachedTokens || 0) > 0 && (
                                <Box>
                                    <Box width={25}><Text color="blue">Saved (cached):</Text></Box>
                                    <Text color="white">{formatTokens(dailyUsage.cachedTokens)}</Text>
                                </Box>
                            )}
                            {(dailyUsage?.imageCalls?.length || 0) > 0 && (
                                <>
                                    <Box>
                                        <Box width={25}><Text color="blue">Images Made Today:</Text></Box>
                                        <Text color="white">{dailyUsage.imageCalls.length}</Text>
                                    </Box>
                                    <Box>
                                        <Box width={25}><Text color="blue">Image Credits Today:</Text></Box>
                                        <Text color="white">{Number(((dailyUsage.imageCalls.reduce((sum, c) => sum + c.cost, 0) || 0) * 1000).toFixed(0))} credits</Text>
                                    </Box>
                                </>
                            )}
                            <Box>
                                <Box width={25}><Text color="blue">Code Changes Today:</Text></Box>
                                <Text color="white"><Text color="green">+{dailyUsage?.linesAdded || 0}</Text> <Text color="red">-{dailyUsage?.linesRemoved || 0}</Text></Text>
                            </Box>
                            <Box>
                                <Box width={25}><Text color="blue">Tool Calls Today:</Text></Box>
                                <Text color="white">{(dailyUsage?.toolSuccess || 0) + (dailyUsage?.toolFailure || 0) + (dailyUsage?.toolDenied || 0)} ( </Text>
                                <Text color="green">✓ {dailyUsage?.toolSuccess || 0}</Text>
                                <Text color="white"> </Text>
                                <Text color="yellow">⊘ {dailyUsage?.toolDenied || 0}</Text>
                                <Text color="white"> </Text>
                                <Text color="red">✕ {dailyUsage?.toolFailure || 0}</Text>
                                <Text color="white"> )</Text>
                            </Box>
                        </Box>

                        <Text dimColor marginTop={1} italic>(Press ESC to return to chat)</Text>
                    </Box>
                );
            case 'autoExecDanger':
                return (
                    <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={2} paddingY={1} width="100%">
                        <Text color="yellow" bold underline>⚠️ SECURITY WARNING: AUTO EXECUTE MODE</Text>
                        <Text marginTop={1}>Turning this ON allows the agent to execute terminal commands automatically without requiring your approval for each step.</Text>
                        <Text marginTop={1} color="yellow">RISKS INVOLVED:</Text>
                        <Text>• The agent may execute destructive commands (rm -rf, etc.) by mistake.</Text>
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
                    <Box flexDirection="column" borderStyle="round" borderColor="red" paddingX={2} paddingY={1} width="100%">
                        <Text color="red" bold underline>⚠️ SECURITY WARNING: EXTERNAL WORKSPACE ACCESS</Text>
                        <Text marginTop={1}>Turning this ON allows the agent to execute tools (Read/Write/Exec) outside of the current active workspace directory.</Text>
                        <Text marginTop={1} color="yellow">RISKS INVOLVED:</Text>
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
                    <Box flexDirection="column" borderStyle="round" borderColor="red" paddingX={2} paddingY={1} width="100%">
                        <Text color="red" bold underline>⛔ CRITICAL SECURITY WARNING: COMBINED SYSTEM RISK</Text>
                        <Text marginTop={1}>You are attempting to enable BOTH [Auto Execute] and [External Workspace Access] simultaneously.</Text>
                        <Text marginTop={1} color="red" bold>THIS IS NOT RECOMMENDED.</Text>
                        <Text marginTop={1} color="yellow">THE CRITICAL RISK:</Text>
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
                        title="🔑 API KEY MANAGEMENT"
                        items={[
                            { label: 'Edit Current Key (Update)', value: 'edit' },
                            { label: 'Remove Current Key (Purge)', value: 'remove' },
                            { label: 'Cancel', value: 'Cancel' }
                        ]}
                        onSelect={(item) => {
                            if (item.value === 'edit') {
                                setApiKey(null); // Re-triggers manual setup mode
                                setActiveView('chat');
                                const s = emojiSpace(2);
                                setMessages(prev => [...prev, { id: Date.now(), role: 'system', text: `🔑${s}[ACTION] Flux waiting for new API Key...` }]);
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
                    <Box flexDirection="column" borderStyle="round" borderColor="red" paddingX={2} paddingY={1}>
                        {(() => {
                            const s = emojiSpace(2);
                            return <Text color="red" bold>⛔{s}DANGER: PURGE API KEY</Text>;
                        })()}
                        <Text marginTop={1}>This will permanently delete the saved API key from the project vault. You will need to enter it again to use Flux.</Text>
                        <Box marginTop={1}>
                            <CommandMenu
                                title="Are you absolutely sure?"
                                items={[
                                    { label: 'YES, PURGE KEY', value: 'yes' },
                                    { label: 'NO, GO BACK', value: 'no' }
                                ]}
                                onSelect={async (item) => {
                                    if (item.value === 'yes') {
                                        await removeAPIKey();
                                        setApiKey(null);
                                        setActiveView('chat');
                                        const s = emojiSpace(2);
                                        setMessages(prev => [...prev, { id: Date.now(), role: 'system', text: `✨${s}[VAULT PURGED] API Key removed successfully.` }]);
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

                                        // Find index of reverted user message
                                        const targetIdx = messages.findIndex(m =>
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
                                                text: `🔄${s}[TIME TRAVEL] Codebase rolled back successfully! Reverted prompt loaded to input box.`,
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
                                            text: `❌${s}[TIME TRAVEL ERROR] Failed to rollback: ${err.message}`,
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

                                    // Ensure logo is present at the start of resumed history
                                    const resumedMsgs = [...h[id].messages];
                                    const hasLogo = resumedMsgs[0]?.text?.includes('███████╗');
                                    if (!hasLogo) {
                                        resumedMsgs.unshift({ id: 'welcome-' + Date.now(), role: 'system', text: FLUX_LOGO + '\n\n🌊⚡ Resuming Flux Flow Session...', isMeta: true });
                                    }

                                    setMessages(resumedMsgs);
                                    setActiveView('chat');
                                    setMessages(prev => {
                                        const newMsgs = [...prev, { id: 'sys-' + Date.now(), role: 'system', text: `📡 SESSION RESUMED: [${id}]`, isMeta: true }];
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
            case 'memory':
                return (
                    <Box width="100%" alignItems="center" justifyContent="center">
                        <MemoryModal onClose={() => setActiveView('chat')} />
                    </Box>
                );
            case 'profile':
                return (
                    <ProfileForm
                        initialData={profileData}
                        onSave={(profile) => {
                            setProfileData(profile);
                            setMessages(prev => [...prev, { id: Date.now(), role: 'system', text: `✅ Profile updated: ${profile.name} (${profile.nickname})` }]);
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
                    <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={2} paddingY={1} width="100%">
                        <Text color="yellow" bold underline>🔐 SECURITY GATE: FILE WRITE PERMISSION</Text>
                        <Text marginTop={1}>The agent is attempting to modify: <Text color="cyan">{parseArgs(pendingApproval?.args || '{}').path || 'Unknown File'}</Text></Text>

                        <Box marginTop={1} borderStyle="single" borderColor="#333" paddingX={1} flexDirection="column">
                            <Text color="gray">--- PROPOSED CONTENT / DIFF ---</Text>
                            {(() => {
                                const args = parseArgs(pendingApproval?.args || '{}');
                                const oldVal = args.TargetContent || args.content_to_replace || args.replaceContent || null;
                                const newVal = args.content || args.ReplacementContent || args.content_to_add || args.replacementContent || args.newContent || null;

                                if (oldVal && newVal) {
                                    return (
                                        <Box flexDirection="column" marginTop={1}>
                                            <Box><Text color="red" wrap="anywhere" bold>- {oldVal}</Text></Box>
                                            <Box marginTop={1}><Text color="green" wrap="anywhere" bold>+ {newVal.replace(/\[\/n\]?/g, '\\n')}</Text></Box>
                                        </Box>
                                    );
                                }
                                return <Text color="white" wrap="anywhere">{(newVal ? newVal.replace(/\[\/n\]?/g, '\\n') : null) || 'Updating file content...'}</Text>;
                            })()}
                        </Box>

                        <Box marginTop={1}>
                            <CommandMenu
                                title="Action Required"
                                items={[
                                    { label: '✅ Accept this time', value: 'allow' },
                                    { label: '🔐 Accept for this session', value: 'always' },
                                    { label: '❌ Don\'t accept', value: 'deny' }
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
                                    text: `✨ **[UPDATE COMPLETED]** Flux Flow successfully upgraded to v${latestVer}.\n🚀 **Restart Flux Flow to see changes.**`,
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
                    <Box flexDirection="column" borderStyle="round" borderColor="red" paddingX={2} paddingY={1} width="100%">
                        <Text color="red" bold underline>🔐 SECURITY GATE: TERMINAL COMMAND OVERSIGHT</Text>
                        <Box marginTop={1}>
                            <Text>Agent requested to run: <Text color="yellow" bold>{parseArgs(pendingApproval?.args || '{}').command || 'Unknown Command'}</Text></Text>
                        </Box>

                        <Box marginTop={1}>
                            <CommandMenu
                                title="Risk Assessment Required"
                                items={[
                                    { label: '🚀 Run', value: 'allow' },
                                    { label: '❌ Deny', value: 'deny' }
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
                        {/* 🏗️ INPUT HEADER BAR (NO MODIFICATION HERE OR...) */}
                        <Box paddingX={1} marginBottom={0} justifyContent="space-between" width="100%">
                            <Box>
                                {statusText ? (
                                    <Box>
                                        {isSpinnerActive && !isSpinnerActive && <StatusSpinner />}
                                        <Text color="magenta" bold italic>{isSpinnerActive && !isSpinnerActive ? ' ' : ''}{statusText.toUpperCase()}</Text>
                                    </Box>
                                ) : (
                                    <Text color="cyan" dimColor italic> {input.length > 0 && escPressCount ? "Press ESC again to clear input" : "READY FOR COMMAND..."}</Text>
                                )}
                            </Box>
                            <Box>
                                <Text color="gray" bold>[ </Text>
                                <Text color="white">{tempModelOverride || activeModel}</Text>
                                <Text color="gray" bold> ]</Text>
                            </Box>
                        </Box>

                        {/* 🌊 MAIN COMMAND CONSOLE */}
                        <Box
                            borderStyle="round"
                            borderColor={isProcessing ? "magenta" : "cyan"}
                            paddingX={1}
                            paddingY={0}
                            width="100%"
                        >
                            <Box flexDirection="column" width="100%">
                                <Box flexDirection="row" width="100%" paddingY={0}>
                                    <Box flexShrink={0} width={4}>
                                        <Text color={isProcessing ? "magenta" : "cyan"} bold>{isProcessing ? "✦  " : "💠 "}</Text>
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
                                                        <Text color="cyan" bold>  Press ESC again to {input.length > 0 ? 'clear input' : 'revert codebase to checkpoint'}...</Text>
                                                    ) : (
                                                        <Text color="gray">{escPressed ? "  Press ESC again to cancel the request." : !isProcessing ? `  Send message or /cmd... (${terminalEnv.shortcut} for newline)` : "  Enter a prompt to steer the agent."}</Text>
                                                    )}
                                                </Box>
                                            )}
                                            <MultilineInput
                                                key={`input-${inputKey}`}
                                                focus={!isTerminalFocused}
                                                value={input}
                                                columns={terminalSize.columns}
                                                onChange={(val) => {
                                                    const cleanVal = val.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\\\s*\n/g, '\n');
                                                    setInput(cleanVal);
                                                    setIsFilePickerDismissed(false);
                                                }}
                                                onSubmit={handleSubmit}
                                                maxRows={3}
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
                    </Box>
                );
        }
    };

    return (
        <Box flexDirection="column" width="100%">

            <Box flexDirection="column" width="100%" flexGrow={1}>
                {windowedHistory.items.map((msg, idx) => (
                    <MessageItem key={msg.id || idx} msg={msg} showFullThinking={showFullThinking} columns={stdout?.columns || 80} />
                ))}
            </Box>

            <Box flexDirection="column" padding={1} width="100%">
                {(activeView === 'chat' || ['ask', 'approval', 'terminalApproval'].includes(activeView)) && (
                    <Box flexDirection="column" width="100%">
                        <ChatLayout
                            messages={messages.slice(completedIndex)}
                            showFullThinking={showFullThinking}
                            columns={Math.max(20, (stdout?.columns || 80) - 1)}
                        />
                        {activeCommand && (
                            <Box marginTop={1}>
                                <TerminalBox command={activeCommand} output={execOutput} isFocused={isTerminalFocused} isPty={isActiveCommandPty} />
                            </Box>
                        )}
                    </Box>
                )}

                {isInitializing ? (
                    <Box borderStyle="double" borderColor="magenta" padding={1} flexShrink={0}>
                        <Text color="magenta">🌊 Starting Flux Flow...</Text>
                    </Box>
                ) : !apiKey ? (
                    <Box borderStyle="round" borderColor="gray" padding={0} flexDirection="column" flexShrink={0} width="100%">
                        <Box paddingX={1} marginBottom={1}>
                            <Text color="yellow" bold>🔑{emojiSpace(2)}API KEY REQUIRED</Text>
                        </Box>

                        <Box paddingX={1} flexDirection="column">
                            <Text>Please enter your Gemini API Key to initialize the agent (If billing is enabled set Tier to paid in /settings → other → API Tier).</Text>
                            <Box marginTop={1}>
                                <Text color="cyan" bold>💠 </Text>
                                <TextInput
                                    value={tempKey}
                                    onChange={setTempKey}
                                    onSubmit={handleSetup}
                                    mask="*"
                                />
                            </Box>
                        </Box>

                        <Box paddingX={1} marginTop={1}>
                            <Text color="gray" dimColor italic>(Press Enter to confirm and initialize)</Text>
                        </Box>
                    </Box>
                ) : (
                    renderActiveView()
                )}

                {confirmExit && (
                    <Box borderStyle="round" borderColor="red" paddingX={2} marginY={0} width="100%">
                        <Text color="red" bold>🔴 EXIT CONFIRMATION: </Text>
                        <Text color="white">Press </Text>
                        <Text color="red" bold>CTRL + C</Text>
                        <Text color="white"> again to exit ({exitCountdown}s). Press </Text>
                        <Text color="cyan" bold>ESC</Text>
                        <Text color="white"> to cancel.</Text>
                    </Box>
                )}

                <Box flexShrink={0} width="100%">
                    <StatusBar
                        mode={mode}
                        thinkingLevel={thinkingLevel}
                        tokens={sessionStats.tokens}
                        tokensTotal={sessionStats.tokens}
                        chatId={chatId}
                        isMemoryEnabled={systemSettings.memory}
                        apiTier={apiTier}
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
                        <Box flexDirection="column" borderStyle="round" paddingX={3} paddingY={1} borderColor="red" width={Math.min(100, (stdout?.columns || 100) - 2)} marginTop={0} marginBottom={1}>
                            <Box marginBottom={1}>
                                <Text color="cyan" bold>Agent powering down. <Text color="magenta">Goodbye!</Text></Text>
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
                                {sessionTotalCachedTokens > 0 && (
                                    <Box>
                                        <Box width={20}><Text color="blue">Cached Tokens:</Text></Box>
                                        <Text color="white">{formatTokens(sessionTotalCachedTokens)}</Text>
                                    </Box>
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
                                    <Box width={18}><Text color="blue" dimColor>» API Time:</Text></Box>
                                    <Text color="white">{formatMsDuration(sessionApiTime)} ({apiPercent}%)</Text>
                                </Box>
                                <Box marginLeft={2}>
                                    <Box width={18}><Text color="blue" dimColor>» Tool Time:</Text></Box>
                                    <Text color="white">{formatMsDuration(sessionToolTime)} ({toolPercent}%)</Text>
                                </Box>
                            </Box>
                        </Box>
                    );
                })()}

                {/* 💡 Modernized Suggestion Box - Sleek, structured, and premium */}
                {suggestions.length > 0 && (() => {
                    const windowSize = 5;
                    const startIdx = Math.max(0, Math.min(selectedIndex - 2, suggestions.length - windowSize));
                    const visible = suggestions.slice(startIdx, startIdx + windowSize);
                    const remaining = suggestions.length - (startIdx + visible.length);

                    return (
                        <Box
                            flexDirection="column"
                            borderStyle="round"
                            borderColor="gray"
                            paddingX={0}
                            paddingY={0}
                            width="100%"
                        >
                            <Box paddingX={1} marginBottom={0} justifyContent="space-between" width="100%">
                                <Text color="gray" bold dimColor>
                                    {suggestions[0]?.cmd?.startsWith('@') ? "📁 FILE SUGGESTIONS" : "🔍 COMMAND SUGGESTIONS"}
                                </Text>
                                {suggestions[0]?.cmd?.startsWith('@') ? (
                                    <Text color="gray" dimColor italic>
                                        (Use '#Lstart-Lend' to specify line numbers)
                                    </Text>
                                ) : (input.startsWith('/model') && apiTier === 'Free') ? (
                                    <Text color="gray" dimColor italic>
                                        Paid API has more models. Configure <Text color="cyan" underline>{"\u001b]8;;https://aistudio.google.com/billing\u0007billing\u001b]8;;\u0007"}</Text> & /settings
                                    </Text>
                                ) : null}
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
                                            <Text color={isActive ? "cyan" : "gray"} bold={isActive}>{isActive ? " ❯" : "  "}</Text>
                                        </Box>
                                        <Box width={32}>
                                            <Text
                                                color={isGemmaDisabled ? "gray" : (isActive ? "yellow" : "white")}
                                                bold={isActive}
                                                dimColor={isGemmaDisabled && !isActive}
                                            >
                                                {s.cmd?.startsWith('@[') && s.cmd?.endsWith(']') ? (() => {
                                                    const pathPart = s.cmd.slice(2, -1);
                                                    const parts = pathPart.split(/[/\\]/);
                                                    return parts[parts.length - 1];
                                                })() : s.cmd}
                                            </Text>
                                        </Box>
                                        <Box flexGrow={1}>
                                            <Text color="gray" italic dimColor={!isActive}>{s.desc}</Text>
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
            </Box>
        </Box>
    );
}
