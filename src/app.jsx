import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import fs from 'fs-extra';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { MultilineInput } from 'ink-multiline-input';
import TextInput from 'ink-text-input';
import ChatLayout, { MessageItem } from './components/ChatLayout.jsx';
import StatusBar from './components/StatusBar.jsx';
import CommandMenu from './components/CommandMenu.jsx';
import ProfileForm from './components/ProfileForm.jsx';
import AskUserModal from './components/AskUserModal.jsx';
import gradient from 'gradient-string';
import { getAPIKey, saveAPIKey, removeAPIKey } from './utils/secrets.js';
import { initAI, getAIStream, signalTermination } from './utils/ai.js';
import { loadSettings, saveSettings } from './utils/settings.js';
import { loadHistory, saveChat, deleteChat, generateChatId, cleanupOldHistory } from './utils/history.js';
import ResumeModal from './components/ResumeModal.jsx';
import MemoryModal from './components/MemoryModal.jsx';
import { getDailyUsage } from './utils/usage.js';
import { TerminalBox } from './components/TerminalBox.jsx';
import { parseArgs } from './utils/arg_parser.js';
import { FLUXFLOW_DIR, LOGS_DIR, SECRET_DIR, SETTINGS_FILE } from './utils/paths.js';
import { emojiSpace } from './utils/terminal.js';

// 1. RAW JS SESSION TRACKER (Vanilla JS for zero-render overhead)
const SESSION_START_TIME = Date.now();
const CHANGELOG_URL = 'https://fluxflow-cli.onrender.com/changelog.html';
const versionFluxflow = '1.2.0';
const updatedOn = '2026-04-27';

const ResolutionModal = ({ data, onResolve, onEdit }) => (
    <Box flexDirection="column" borderStyle="round" borderColor="magenta" paddingX={2} paddingY={1} width="100%">
        <Text color="magenta" bold underline>🟣 STEERING HINT RESOLUTION</Text>
        <Text marginTop={1}>The agent already finished the task (turn: finish) before your hint was consumed.</Text>
        <Box marginTop={1} backgroundColor="#222" paddingX={1} width="100%">
            <Text italic color="gray">"{data}"</Text>
        </Box>
        <Box marginTop={1}>
            <Text color="cyan">How would you like to proceed?</Text>
        </Box>
        <Box marginTop={1}>
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

export default function App() {
    const { stdout } = useStdout();

    const [input, setInput] = useState('');
    const [isExpanded, setIsExpanded] = useState(false);
    const [mode, setMode] = useState('Flux');
    const [terminalSize, setTerminalSize] = useState({
        columns: stdout?.columns || 80,
        rows: stdout?.rows || 24
    });

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

    useEffect(() => {
        const checkVersion = async () => {
            try {
                const response = await fetch('https://registry.npmjs.org/fluxflow-cli/latest');
                const data = await response.json();
                const latestVersion = data?.version;
                if (latestVersion) setLatestVer(latestVersion);
                if (latestVersion && latestVersion !== versionFluxflow) {
                    setMessages(prev => {
                        // Insert after the welcome message (index 0)
                        const newMsgs = [...prev];
                        newMsgs.splice(1, 0, {
                            id: 'update-' + Date.now(),
                            role: 'system',
                            text: `🚀 **New version 'v${latestVersion}' is available!**\nType \`npm i -g fluxflow-cli\` to update.\nCheck what's new using \`/changelog\` command.`,
                            isUpdateNotification: true,
                            isMeta: true
                        });
                        return newMsgs;
                    });
                }
            } catch (err) {
                // Silently fail version check to avoid blocking the user
            }
        };
        checkVersion();
    }, []);

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
    const [quotas, setQuotas] = useState({ agentLimit: 1500, backgroundLimit: 1500, searchLimit: 100, customModelId: '', customLimit: 0 });
    const [inputConfig, setInputConfig] = useState(null); // { label, key, subKey, value, next }
    const [systemSettings, setSystemSettings] = useState({ memory: true, compression: 0.0, autoExec: false, autoDeleteHistory: '7d' });
    const [profileData, setProfileData] = useState({ name: null, nickname: null, instructions: null });
    const [sessionStats, setSessionStats] = useState({ tokens: 0 });
    const [sessionAgentCalls, setSessionAgentCalls] = useState(0);
    const [sessionBackgroundCalls, setSessionBackgroundCalls] = useState(0);
    const [sessionTotalTokens, setSessionTotalTokens] = useState(0);
    const [dailyUsage, setDailyUsage] = useState(null);
    const [chatId, setChatId] = useState(generateChatId());
    const [activeCommand, setActiveCommand] = useState(null);
    const [execOutput, setExecOutput] = useState('');

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

        if (h > 0) {
            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        }
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };
    const [statusText, setStatusText] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [escPressed, setEscPressed] = useState(false);
    const [escTimer, setEscTimer] = useState(null);
    const [queuedPrompt, setQueuedPrompt] = useState(null);
    const [resolutionData, setResolutionData] = useState(null);
    const [tempModelOverride, setTempModelOverride] = useState(null);

    const [messages, setMessages] = useState([
        { id: 'welcome', role: 'system', text: FLUX_LOGO + '\n\n🌊⚡ Welcome to Flux Flow! Type /help for commands.\n' }
    ]);
    const queuedPromptRef = useRef(null);
    const [completedIndex, setCompletedIndex] = useState(1);

    const windowedHistory = useMemo(() => {
        const MAX_LINES = 1000;
        const width = stdout?.columns || 80;
        let totalLines = 0;
        let startIdx = 0;

        // Iterate backwards to find how many messages fit in the window
        for (let i = completedIndex - 1; i >= 0; i--) {
            const msg = messages[i];
            if (!msg) continue;

            // Estimate lines for this message
            let lines = (msg.text || '').split(/\r?\n/).length;
            msg.text.split(/\r?\n/).forEach(l => {
                lines += Math.floor(l.length / width);
            });
            lines += msg.role === 'think' ? 3 : 2; // Padding/overhead

            // If adding this message exceeds the limit, stop here
            // (But always show at least the 2 most recent completed messages to avoid an empty-looking screen)
            if (totalLines + lines > MAX_LINES && (completedIndex - i) > 2) {
                startIdx = i + 1;
                break;
            }
            totalLines += lines;
        }

        return {
            items: messages.slice(startIdx, completedIndex),
            isTruncated: startIdx > 0
        };
    }, [messages, completedIndex, stdout?.columns]);

    // Calculate visual line count for the input buffer (used for Paste UI)
    const terminalWidth = stdout?.columns || 80;
    const wrapWidth = Math.max(20, terminalWidth - 10);
    const wrappedLinesCount = input.split(/\r?\n/).reduce((acc, line) => {
        return acc + Math.max(1, Math.ceil(line.length / wrapWidth));
    }, 0);
    const maxLines = Math.max(1, wrappedLinesCount);

    // Global Key Listener (ONE listener to rule them all)
    useInput((inputText, key) => {
        // 0. Atomic Paste Expansion Logic
        if (maxLines > 2 && !isExpanded && activeView === 'chat') {
            if (key.backspace || key.delete) {
                setInput('');
                return;
            }
            if (key.return) {
                setIsExpanded(true);
                return;
            }
        }

        // 1. ESC Logic
        if (key.escape) {
            if (isProcessing) {
                if (!escPressed) {
                    setEscPressed(true);
                    if (escTimer) clearTimeout(escTimer);
                    setEscTimer(setTimeout(() => setEscPressed(false), 3000));
                } else {
                    signalTermination();
                    setEscPressed(false);
                    if (escTimer) clearTimeout(escTimer);
                }
            } else if (activeView !== 'chat') {
                setActiveView('chat');
            }
        }

        // 2. Tab Completion (only if input mode)
        if (key.tab && suggestions.length > 0 && activeView === 'chat') {
            const nextCmd = suggestions[0];
            setInput(nextCmd + ' ');
        }

        // 3. CTRL+C Exit Protocol
        if (key.ctrl && inputText === 'c' && activeView !== 'exit') {
            setActiveView('exit');
        }

        // 4. Ctrl + Enter or Ctrl + J (Reliable Newline on Windows)
        if (key.return && (key.ctrl || key.meta)) {
            setInput(prev => prev.replace(/\\\r?$/, '').replace(/\r?$/, '') + '\n');
        }
    });

    useEffect(() => {
        async function init() {
            // 1. Load persisted settings
            const saved = await loadSettings();
            setMode(saved.mode);
            setThinkingLevel(saved.thinkingLevel);
            setActiveModel(saved.activeModel);
            setShowFullThinking(saved.showFullThinking);
            setApiTier(saved.apiTier || 'Free');
            setQuotas(saved.quotas || { agentLimit: 1500, searchLimit: 100, customModelId: '', customLimit: 0 });
            setSystemSettings(saved.systemSettings);
            setProfileData(saved.profileData);

            // 2. Load API key
            const key = await getAPIKey();
            if (key) {
                setApiKey(key);
                initAI(key); // Initialize Gemini SDK
            }

            // 3. Clean up old history
            if (saved.systemSettings?.autoDeleteHistory) {
                cleanupOldHistory(saved.systemSettings.autoDeleteHistory);
            }

            setIsInitializing(false);
        }
        init();
    }, []);

    // Auto-save watcher
    useEffect(() => {
        if (!isInitializing) {
            saveSettings({
                mode,
                thinkingLevel,
                activeModel,
                showFullThinking,
                systemSettings,
                profileData
            });
        }
    }, [mode, thinkingLevel, activeModel, showFullThinking, systemSettings, profileData, isInitializing]);

    const handleSetup = async (val) => {
        const key = val.trim();
        if (key.length >= 30) {
            await saveAPIKey(key);
            setApiKey(key);
            initAI(key); // Initialize Gemini SDK
            setMessages(prev => [...prev, { role: 'system', text: '✅ API Key saved successfully! Initialization complete.' }]);
        } else {
            setMessages(prev => [...prev, { role: 'system', text: `❌ INVALID KEY: Gemini API keys must be at least 30 characters.` }]);
            setTempKey('');
        }
    };

    const COMMANDS = ['/mode', '/thinking', '/model', '/resume', '/memory', '/profile', '/settings', '/key', '/stats', '/reset', '/help', '/clear', '/quit', '/changelog', '/about'];

    const handleSubmit = (value) => {
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
                                    resumedMsgs.unshift({ id: 'welcome-' + Date.now(), role: 'system', text: FLUX_LOGO + '\n\n🌊⚡ Resuming Flux Flow Session...\n' });
                                }

                                setMessages(resumedMsgs);
                                setMessages(prev => [...prev, { id: 'sys-' + Date.now(), role: 'system', text: `📡 SESSION RESUMED: [${targetId}]` }]);
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
                    // Perform full terminal hardware reset + clear scrollback buffer
                    stdout.write('\x1b[2J\x1b[3J\x1b[H');
                    setMessages([{ id: 'welcome-' + Date.now(), role: 'system', text: FLUX_LOGO + '\n\n🌊⚡ Welcome back to Flux Flow! Context cleared.\n' }]);
                    setCompletedIndex(0); // Trigger re-flush
                    setChatId(generateChatId()); // Brand new identity for the new chat
                    setSessionStats({ tokens: 0 });
                    setIsExpanded(false);
                    break;
                }
                case '/mode': {
                    if (parts[1]) {
                        const newMode = parts[1].toLowerCase() === 'flow' ? 'Flow' : 'Flux';
                        setMode(newMode);
                        setMessages(prev => { setCompletedIndex(prev.length + 1); return [...prev, { id: Date.now(), role: 'system', text: `⚙️ [SYSTEM] Mode switched to ${newMode}`, isMeta: true }]; });
                    } else {
                        setActiveView('mode');
                    }
                    break;
                }
                case '/thinking': {
                    const arg = parts[1]?.toLowerCase();
                    if (arg === 'show') {
                        setShowFullThinking(true);
                        setMessages(prev => { setCompletedIndex(prev.length + 1); return [...prev, { id: Date.now(), role: 'system', text: '⚙️ [SYSTEM] Full Thinking Process: VISIBLE', isMeta: true }]; });
                    } else if (arg === 'hide') {
                        setShowFullThinking(false);
                        setMessages(prev => { setCompletedIndex(prev.length + 1); return [...prev, { id: Date.now(), role: 'system', text: '⚙️ [SYSTEM] Full Thinking Process: HIDDEN (Headings only)', isMeta: true }]; });
                    } else if (parts[1]) {
                        let val = parts[1].toLowerCase();
                        if (val === 'xhigh') val = 'max';
                        const formattedLevel = val.charAt(0).toUpperCase() + val.slice(1);

                        // Strict Mode Validation
                        if (mode === 'Flow' && (formattedLevel === 'High' || formattedLevel === 'Max')) {
                            setMessages(prev => {
                                setCompletedIndex(prev.length + 1);
                                return [...prev, { id: Date.now(), role: 'system', text: `❌ [RESTRICTED] "${formattedLevel}" is restricted in Flow mode. Switch to /mode Flux to enable Deep Thinking.` }];
                            });
                        } else {
                            setThinkingLevel(formattedLevel);
                            setMessages(prev => { setCompletedIndex(prev.length + 1); return [...prev, { id: Date.now(), role: 'system', text: `⚙️ [SYSTEM] Thinking level set to ${formattedLevel}`, isMeta: true }]; });
                        }
                    } else {
                        setActiveView('thinking');
                    }
                    break;
                }
                case '/model': {
                    if (parts[1]) {
                        const mod = parts.slice(1).join(' ');
                        setActiveModel(mod);
                        setMessages(prev => { setCompletedIndex(prev.length + 1); return [...prev, { id: Date.now(), role: 'system', text: `⚙️ [SYSTEM] Model switched to ${mod}`, isMeta: true }]; });
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
                            } catch (e) {}

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
                    const updateStatus = latestVer
                        ? (latestVer !== versionFluxflow ? `Update Available [v${latestVer}]` : 'No Update Available')
                        : 'Checking for updates...';
                    const s = emojiSpace(2);
                    const aboutText = `ℹ️${s}**FluxFlow Version:** v${versionFluxflow}\n` +
                                     `🔄 **Status:** ${updateStatus}\n` +
                                     `📅 **Updated on:** ${updatedOn}`;
                    setMessages(prev => {
                        setCompletedIndex(prev.length + 1);
                        return [...prev, { id: Date.now(), role: 'system', text: aboutText, isMeta: true }];
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
                case '/help': {
                    setMessages(prev => { setCompletedIndex(prev.length + 1); return [...prev, { id: Date.now(), role: 'system', text: '⚙️ [SYSTEM] Available commands: ' + COMMANDS.join(', '), isMeta: true }]; });
                    break;
                }
                default:
                    setMessages(prev => { setCompletedIndex(prev.length + 1); return [...prev, { id: Date.now(), role: 'system', text: `⚙️ [SYSTEM] Unknown command: ${cmd}`, isMeta: true }]; });
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
                setIsProcessing(true);
                setIsExpanded(false);
                try {                    const cleanHistoryForAI = [...messages, userMessage].filter(m =>
                        m.role !== 'think' &&
                        !String(m.id).startsWith('welcome')
                    );
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
                            onExecStart: (cmd) => {
                                setActiveCommand(cmd);
                                setExecOutput('');
                            },
                            onExecChunk: (chunk) => {
                                setExecOutput(prev => prev + chunk);
                            },
                            onExecEnd: () => {
                                setMessages(prev => {
                                    const finalStatus = `[TERMINAL_RECORD]
COMMAND: ${activeCommandRef.current}
OUTPUT: ${execOutputRef.current}`;
                                    return [...prev, { id: 'term-' + Date.now(), role: 'system', text: finalStatus, isTerminalRecord: true }];
                                });
                                setActiveCommand(null);
                                setExecOutput('');
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
                        }
                    );

                    let inThinkMode = false;
                    let currentThinkId = null;
                    let currentAgentId = null;
                    // const signalRegex = /\[?\s*turn\s*:\s*.*?\s*\]?/gi;
                    const signalRegex = /\[?_DISABLED_SIGNAL_REGEX_\]?/gi;

                    for await (const packet of stream) {
                        if (packet.type === 'status') {
                            setStatusText(packet.content);
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
                            continue;
                        }
                        if (packet.type === 'memory_updated') {
                            setMessages(prev => {
                                const newMsgs = [...prev];
                                if (newMsgs.length > 0) {
                                    newMsgs[newMsgs.length - 1].memoryUpdated = true;
                                }
                                return newMsgs;
                            });
                            continue;
                        }
                        if (packet.type === 'exec_start') {
                            continue; // Yield consumed just to trigger React render loop
                        }
                        if (packet.type === 'usage') {
                            const total = packet.content.totalTokenCount || 0;
                            setSessionStats({ tokens: total });
                            setSessionTotalTokens(prev => prev + total);
                            setSessionAgentCalls(prev => prev + 1);
                            continue;
                        }


                        if (packet.type === 'background_increment') {
                            setSessionBackgroundCalls(prev => prev + 1);
                            continue;
                        }
                        if (packet.type === 'tool_result') {
                            setMessages(prev => [...prev, { id: 'tool-' + Date.now(), role: 'system', text: packet.content }]);
                            continue;
                        }

                        let chunkText = packet.content;

                        // 1. Detect transition to THINK mode
                        if (chunkText.toLowerCase().includes('<think') && !inThinkMode) {
                            inThinkMode = true;
                            // Clean up any partial tags from the visible text
                            chunkText = chunkText.replace(/<think>/gi, '');
                            currentThinkId = 'think-' + Date.now();
                            setMessages(prev => [...prev, { id: currentThinkId, role: 'think', text: '' }]);
                        }

                        // 2. Aggressive Transition Analysis
                        // We check for </think> in EVERY chunk if we are in think mode
                        if (chunkText.toLowerCase().includes('</think>')) {
                            const parts = chunkText.split(/<\/think>/gi);
                            const thinkPart = parts[0] || '';
                            const agentPart = parts.slice(1).join('</think>') || '';

                            setMessages(prev => {
                                const newMsgs = prev.map(m =>
                                    m.id === currentThinkId
                                        ? { ...m, text: m.text + thinkPart }
                                        : m
                                );

                                inThinkMode = false;
                                currentAgentId = 'agent-' + Date.now();
                                return [...newMsgs, { id: currentAgentId, role: 'agent', text: agentPart.replace(/<\/?think>/gi, '') }];
                            });
                            continue;
                        }

                        // 3. Append to target role with Leak Protection
                        if (inThinkMode && currentThinkId) {
                            // Even if the tag was split across chunks (e.g. </th then ink>),
                            // we catch the 'ink>' part here by checking if the resulting thought block
                            // now contains the full tag.
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
                                            return { ...m, text: parts[0] };
                                        }
                                        return { ...m, text: newText };
                                    }
                                    return m;
                                });

                                if (transitioning) {
                                    inThinkMode = false;
                                    currentAgentId = 'agent-' + Date.now();
                                    return [...newMsgs, { id: currentAgentId, role: 'agent', text: transitionContent.replace(/<\/?think>/gi, '') }];
                                }
                                return newMsgs;
                            });
                        } else if (!inThinkMode) {
                            const cleanedText = chunkText.replace(/<\/?think>/gi, '').replace(signalRegex, '');
                            if (!currentAgentId) {
                                currentAgentId = 'agent-' + Date.now();
                                setMessages(prev => [...prev, { id: currentAgentId, role: 'agent', text: cleanedText }]);
                            } else {
                                setMessages(prev => prev.map(m =>
                                    m.id === currentAgentId
                                        ? { ...m, text: m.text + cleanedText }
                                        : m
                                ));
                            }
                        }
                    }
                } catch (err) {
                    setMessages(prev => {
                        setCompletedIndex(prev.length + 1);
                        return [...prev, { id: 'error-' + Date.now(), role: 'system', text: `❌ ERROR: ${err.message}` }];
                    });
                } finally {
                    setIsProcessing(false);
                    setStatusText(null);

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
                        const historyToSave = prev.filter(m => !String(m.id).startsWith('welcome'));
                        // Pass null as name to preserve whatever the Janitor has set in the background
                        saveChat(chatId, null, historyToSave);
                        setCompletedIndex(prev.length);
                        return prev;
                    });
                }
            };

            streamChat();
        }

        setInput('');
        setIsExpanded(false);
    };

    const getSuggestions = () => {
        if (!input.startsWith('/') || input.includes(' ')) return [];
        return COMMANDS.filter(c => c.startsWith(input.toLowerCase()));
    };

    const suggestions = getSuggestions();

    const renderActiveView = () => {
        switch (activeView) {
            case 'mode':
                return (
                    <CommandMenu
                        title="⚡ Select Operating Mode"
                        items={[{ label: 'Flux (Dev mode - Tools Enabled)', value: 'Flux' }, { label: 'Flow (Chat mode - No Tools)', value: 'Flow' }, { label: 'Cancel', value: 'Cancel' }]}
                        onSelect={(item) => {
                            if (item.value !== 'Cancel') {
                                setMode(item.value);
                                // Auto-clamp thinking levels based on the new mode
                                if (item.value === 'Flow') {
                                    setThinkingLevel('Medium');
                                } else if (item.value === 'Flux') {
                                    setThinkingLevel('High');
                                }
                            }
                            setActiveView('chat');
                        }}
                    />
                );
            case 'thinking': {
                const options = mode === 'Flow'
                    ? [
                        { label: 'Low (Fastest)', value: 'Low' },
                        { label: 'Medium (Balanced)', value: 'Medium' }
                    ]
                    : [
                        { label: 'Low (Fastest)', value: 'Low' },
                        { label: 'Medium (Balanced)', value: 'Medium' },
                        { label: 'High (Complex coding)', value: 'High' },
                        { label: 'Max (Architecture)', value: 'Max' }
                    ];
                options.push({ label: 'Cancel', value: 'Cancel' });

                return (
                    <CommandMenu
                        title={`🧠 Select Thinking Level (${mode} Mode)`}
                        items={options}
                        onSelect={(item) => {
                            if (item.value !== 'Cancel') setThinkingLevel(item.value);
                            setActiveView('chat');
                        }}
                    />
                );
            }
            case 'model':
                return (
                    <CommandMenu

                        title="🤖 Select AI Model"
                        items={[{ label: 'Gemma 4 31B (Default)', value: 'gemma-4-31b-it' }, { label: 'Gemini 3.1 Pro (Req. paid API Key)', value: 'gemini-3.1-pro-preview' }, { label: 'Gemini 3 Flash', value: 'gemini-3-flash-preview' }, { label: 'Gemini 3.1 Flash Lite', value: 'gemini-3.1-flash-lite-preview' }, { label: 'Cancel', value: 'Cancel' }]}
                        onSelect={(item) => {
                            if (item.value !== 'Cancel') setActiveModel(item.value);
                            setActiveView('chat');
                        }}
                    />
                );
            case 'settings':
                return (
                    <CommandMenu
                        title="System Settings"
                        items={[
                            { label: `Toggle Memory                           [ ${systemSettings.memory ? 'ON' : 'OFF'} ]`, value: 'memory' },
                            { label: `Toggle Auto-Exec                        [ ${systemSettings.autoExec ? 'ON' : 'OFF'} ]`, value: 'autoExec' },
                            { label: `Alternate Screen Buffer (Experimental)  [ ${systemSettings.useAlternateBuffer ? 'ON' : 'OFF'} ]`, value: 'altBuffer' },
                            { label: `External Workspace Access               [ ${systemSettings.allowExternalAccess ? 'ON' : 'OFF'} ]`, value: 'externalAccess' },
                            { label: `API Tier                                [ ${apiTier} ]`, value: 'apiTier' },
                            { label: `Auto-Delete History                     [ ${systemSettings.autoDeleteHistory} ]`, value: 'autoDelete' },
                            { label: 'Exit Settings', value: 'Cancel' }
                        ]}
                        onSelect={(item) => {
                            if (item.value === 'memory') setSystemSettings(s => ({ ...s, memory: !s.memory }));
                            else if (item.value === 'autoExec') {
                                if (!systemSettings.autoExec) {
                                    if (systemSettings.allowExternalAccess) {
                                        setActiveView('doubleDanger');
                                    } else {
                                        setActiveView('autoExecDanger');
                                    }
                                } else {
                                    setSystemSettings(s => ({ ...s, autoExec: false }));
                                }
                            }
                            else if (item.value === 'externalAccess') {
                                if (!systemSettings.allowExternalAccess) {
                                    if (systemSettings.autoExec) {
                                        setActiveView('doubleDanger');
                                    } else {
                                        setActiveView('externalDanger');
                                    }
                                } else {
                                    setSystemSettings(s => ({ ...s, allowExternalAccess: false }));
                                }
                            }
                            else if (item.value === 'apiTier') setActiveView('apiTier');
                            else if (item.value === 'autoDelete') {
                                const options = ['1d', '7d', '30d'];
                                const currentIndex = options.indexOf(systemSettings.autoDeleteHistory || '30d');
                                const nextIndex = (currentIndex + 1) % options.length;
                                setSystemSettings(s => ({ ...s, autoDeleteHistory: options[nextIndex] }));
                            }
                            else if (item.value === 'Cancel') setActiveView('chat');
                        }}
                    />
                );
            case 'apiTier':
                return (
                    <CommandMenu
                        title={`API Tier: ${apiTier}`}
                        items={[
                            { label: 'Free Tier (1,500/day)', value: 'Free' },
                            { label: `Paid Tier (Budget: ${quotas.agentLimit})`, value: 'Paid' },
                            { label: `Custom Model (Endpoint: ${quotas.customModelId || 'None'})`, value: 'Custom' },
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
                                    label: "Daily Agent Limit for default model (Gemma 4 31B):",
                                    note: "NOTE: If you have your own Gemini API supported model, use Custom mode.",
                                    key: 'quotas',
                                    subKey: 'agentLimit',
                                    value: String(quotas.agentLimit),
                                    next: (q) => ({
                                        label: "Daily default background model limit (Gemma 4 26B A4B):",
                                        key: 'quotas',
                                        subKey: 'backgroundLimit',
                                        value: String(q.backgroundLimit)
                                    })
                                });
                                setActiveView('input');
                            } else if (newTier === 'Custom') {
                                setInputConfig({
                                    label: "Enter Agent Model ID:",
                                    key: 'activeModel',
                                    value: activeModel,
                                    next: (val) => ({
                                        label: "Enter Background Model ID:",
                                        key: 'janitorModel',
                                        value: janitorModel,
                                        next: (val2) => ({
                                            label: "Enter Agent daily limit (calls):",
                                            key: 'quotas',
                                            subKey: 'agentLimit',
                                            value: String(quotas.agentLimit),
                                            next: (q) => ({
                                                label: "Enter Background daily limit (calls):",
                                                key: 'quotas',
                                                subKey: 'backgroundLimit',
                                                value: String(quotas.backgroundLimit)
                                            })
                                        })
                                    })
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
                    <Box flexDirection="column" borderStyle="round" paddingX={2} paddingY={1}>
                        {inputConfig?.note && (
                            <Box marginBottom={1}>
                                <Text color="yellow" dimColor>
                                    {inputConfig.note}
                                </Text>
                            </Box>
                        )}
                        <Text color="cyan">{inputConfig?.label}</Text>
                        <Box marginTop={1}>
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
                                    }

                                    if (next) {
                                        setInputConfig(next(key === 'quotas' ? newQuotas : val));
                                    } else {
                                        saveSettings({ ...newSettings, apiTier, quotas: newQuotas });
                                        setInputConfig(null);
                                        setActiveView('settings');
                                    }
                                }}
                            />
                        </Box>
                        <Text dimColor marginTop={1}>(Press Enter to confirm)</Text>
                    </Box>
                );
            case 'stats':
                return (
                    <Box flexDirection="column" borderStyle="round" paddingX={2} paddingY={1}>
                        <Text color="cyan" bold>📊 DAILY PERFORMANCE LEDGER</Text>
                        <Box flexDirection="column" marginTop={1}>
                            <Text>• Agent Model Calls:    <Text color="green">{dailyUsage?.agent || 0}</Text></Text>
                            <Text>• Background Tasks:     <Text color="blue">{dailyUsage?.background || 0}</Text></Text>
                        </Box>
                        <Text dimColor marginTop={1}>(Press ESC to return to chat)</Text>
                    </Box>
                );
            case 'autoExecDanger':
                return (
                    <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={2} paddingY={1} width="100%">
                        <Text color="yellow" bold underline>⚠️ SECURITY WARNING: AUTO-EXEC MODE</Text>
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
                        <Text marginTop={1}>You are attempting to enable BOTH [Auto-Exec] and [External Workspace Access] simultaneously.</Text>
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
                                setMessages(prev => [...prev, { id: Date.now(), role: 'system', text: '🗝️ [ACTION] Flux waiting for new API Key...' }]);
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
                        <Text color="red" bold>⚠️ DANGER: PURGE API KEY</Text>
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
                                        setMessages(prev => [...prev, { id: Date.now(), role: 'system', text: '🧼 [VAULT PURGED] API Key removed successfully.' }]);
                                    } else {
                                        setActiveView('key');
                                    }
                                }}
                            />
                        </Box>
                    </Box>
                );
            case 'exit':
                return (
                    <Box flexDirection="column" borderStyle="round" paddingX={3} paddingY={1} borderColor="red">
                        <Text color="red" bold>🏁 SESSION DASHBOARD</Text>
                        <Box flexDirection="column" marginTop={1}>
                            <Text>• Agent Active For:      <Text color="yellow">{formatDuration(Math.floor((Date.now() - SESSION_START_TIME) / 1000))}</Text></Text>
                            <Text>• Total Agent Queries:  <Text color="green">{sessionAgentCalls}</Text></Text>
                            <Text>• Memory Tasks:        <Text color="blue">{sessionBackgroundCalls}</Text></Text>
                            <Text>• Total Tokens Consumed: <Text color="magenta">{(sessionTotalTokens / 1000).toFixed(2)}k</Text></Text>
                        </Box>
                        <Text marginTop={1}>Are you sure you want to exit?</Text>
                        <Box marginTop={1}>
                            <CommandMenu
                                title="Exit Confirmation"
                                items={[
                                    { label: "Yes, Shutdown Flux", value: 'yes' },
                                    { label: "No, Back to terminal", value: 'no' }
                                ]}
                                onSelect={(item) => {
                                    if (item.value === 'yes') {
                                        process.exit(0);
                                    } else {
                                        setActiveView('chat');
                                    }
                                }}
                            />
                        </Box>
                    </Box>
                );
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
                                        resumedMsgs.unshift({ id: 'welcome-' + Date.now(), role: 'system', text: FLUX_LOGO + '\n\n🌊⚡ Resuming Flux Flow Session...\n' });
                                    }

                                    setMessages(resumedMsgs);
                                    setActiveView('chat');
                                    setMessages(prev => [...prev, { id: 'sys-' + Date.now(), role: 'system', text: `📡 SESSION RESUMED: [${id}]` }]);
                                    setCompletedIndex(0);
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
                                    handleSubmit(val);
                                }, 50);
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
                        <Text color="yellow" bold underline>🛡️ SECURITY GATE: FILE WRITE PERMISSION</Text>
                        <Text marginTop={1}>The agent is attempting to modify: <Text color="cyan">{parseArgs(pendingApproval?.args || '{}').path || 'Unknown File'}</Text></Text>

                        <Box marginTop={1} borderStyle="single" borderColor="#333" paddingX={1} flexDirection="column">
                            <Text color="gray">--- PROPOSED CONTENT / DIFF ---</Text>
                            {(() => {
                                const args = parseArgs(pendingApproval?.args || '{}');
                                const oldVal = args.TargetContent || args.content_to_replace || null;
                                const newVal = args.content || args.ReplacementContent || args.content_to_add || args.replacementContent || null;

                                if (oldVal && newVal) {
                                    return (
                                        <Box flexDirection="column" marginTop={1}>
                                            <Box><Text color="red" wrap="anywhere" bold>- {oldVal}</Text></Box>
                                            <Box marginTop={1}><Text color="green" wrap="anywhere" bold>+ {newVal}</Text></Box>
                                        </Box>
                                    );
                                }
                                return <Text color="white" wrap="anywhere">{newVal || 'Updating file content...'}</Text>;
                            })()}
                        </Box>

                        <Box marginTop={1}>
                            <CommandMenu
                                title="Action Required"
                                items={[
                                    { label: '✅ Accept this time', value: 'allow' },
                                    { label: '🛡️ Accept for this session', value: 'always' },
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
            case 'terminalApproval':
                return (
                    <Box flexDirection="column" borderStyle="round" borderColor="red" paddingX={2} paddingY={1} width="100%">
                        <Text color="red" bold underline>🛡️ SECURITY GATE: TERMINAL COMMAND OVERSIGHT</Text>
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
                        <Box paddingX={1} marginBottom={0} justifyContent="space-between" width="100%">
                            <Box>
                                {statusText && (
                                    <Text color="magenta" italic>⏳ {statusText}</Text>
                                )}
                            </Box>
                            <Text color="gray" dimColor>({tempModelOverride || activeModel})</Text>
                        </Box>
                        {suggestions.length > 0 && (
                            <Box paddingX={1} marginBottom={0}>
                                <Text color="gray">💡 Suggestions: </Text>
                                {suggestions.map((s, i) => (
                                    <Text key={s} color="yellow" bold={i === 0}> {s} </Text>
                                ))}
                            </Box>
                        )}
                        <Box backgroundColor="#333333" paddingX={1} paddingY={1} width="100%">
                            <Box flexDirection="column" width="100%">
                                {maxLines > 2 && !isExpanded ? (
                                    <Box flexDirection="row" width="100%" paddingY={0} height={1} overflow="hidden">
                                        <Box flexShrink={0} width={3}>
                                            <Text color="yellow">❯ </Text>
                                        </Box>
                                        <Box flexGrow={1} flexDirection="row">
                                            {/* Atomic Paste Tag - Properly colored */}
                                            <Box flexShrink={0}>
                                                <Text color="magenta" bold>[Pasted {maxLines} Lines]</Text>
                                            </Box>

                                            {/* Input for Expansion/Submit */}
                                            <Box flexGrow={1} marginLeft={1}>
                                                <MultilineInput
                                                    value=""
                                                    placeholder=" (Backspace to delete / Enter to expand)"
                                                    onChange={(val) => {
                                                        // Any typing expands
                                                        if (val.length > 0) {
                                                            setIsExpanded(true);
                                                            setInput(input + val);
                                                        }
                                                    }}
                                                    onSubmit={() => setIsExpanded(true)}
                                                    keyBindings={{
                                                        submit: (key) => key.return && !key.shift && !key.ctrl,
                                                        newline: (key) => (key.return && key.shift) || (key.return && key.ctrl)
                                                    }}
                                                />
                                            </Box>
                                        </Box>
                                    </Box>
                                ) : (
                                    <Box flexDirection="row" width="100%" paddingY={0}>
                                        <Box flexShrink={0} width={3}>
                                            <Text color="yellow">❯ </Text>
                                        </Box>
                                        <Box flexGrow={1}>
                                            <Box flexGrow={1} position="relative">
                                                {input === '' && !isProcessing && (
                                                    <Box position="absolute" paddingLeft={0}>
                                                        <Text color="gray" dimColor>{escPressed ? "  Press ESC again to cancel the request." : "  Type your message or /command..."}</Text>
                                                    </Box>
                                                )}
                                                <MultilineInput
                                                    value={input}
                                                    onChange={(val) => {
                                                        // Handle manual backslash escapes without stripping them prematurely
                                                        const cleanVal = val.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\\\s*\n/g, '\n');
                                                        setInput(cleanVal);
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
                                )}
                            </Box>
                        </Box>
                    </Box>
                );
        }
    };

    return (
        <Box flexDirection="column" width="100%">
            {windowedHistory.isTruncated && (
                <Box borderStyle="single" borderColor="gray" paddingX={1} marginBottom={1} width="100%" justifyContent="center">
                    <Text color="gray" dimColor italic>
                        [ ↑ History truncated for performance (showing last ~1000 lines) ]
                    </Text>
                </Box>
            )}
            <Box flexDirection="column">
                {windowedHistory.items.map((msg, idx) => (
                    <MessageItem key={msg.id || idx} msg={msg} showFullThinking={showFullThinking} />
                ))}
            </Box>

            <Box flexDirection="column" padding={1} width="100%">
                {(activeView === 'chat' || ['ask', 'approval', 'terminalApproval'].includes(activeView)) && (
                    <Box flexDirection="column" width="100%">
                        <ChatLayout messages={messages.slice(completedIndex)} showFullThinking={showFullThinking} />
                        {activeCommand && (
                            <Box marginTop={1}>
                                <TerminalBox command={activeCommand} output={execOutput} />
                            </Box>
                        )}
                    </Box>
                )}

                {isInitializing ? (
                    <Box borderStyle="double" borderColor="magenta" padding={1} flexShrink={0}>
                        <Text color="magenta">🌊 Starting Flux Flow...</Text>
                    </Box>
                ) : !apiKey ? (
                    <Box borderStyle="bold" borderColor="yellow" padding={1} flexDirection="column" flexShrink={0}>
                        <Text color="yellow" bold>🔑 API KEY REQUIRED</Text>
                        <Text>Please enter your Gemini API Key to initialize the agent's brain.</Text>
                        <Box marginTop={1}>
                            <Text color="cyan">❯ </Text>
                            <TextInput
                                value={tempKey}
                                onChange={setTempKey}
                                onSubmit={handleSetup}
                                mask="*"
                            />
                        </Box>
                    </Box>
                ) : (
                    renderActiveView()
                )}

                <Box flexShrink={0} width="100%">
                    <StatusBar
                        mode={mode}
                        thinkingLevel={thinkingLevel}
                        tokens={sessionStats.tokens}
                        tokensTotal={sessionStats.tokens}
                        chatId={chatId}
                        isMemoryEnabled={systemSettings.memory}
                    />
                </Box>
            </Box>
        </Box>
    );
}
