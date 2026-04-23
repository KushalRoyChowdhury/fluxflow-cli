import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Box, Text, useInput, useStdout, Static } from 'ink';
import { MultilineInput } from 'ink-multiline-input';
import TextInput from 'ink-text-input';
import ChatLayout from './components/ChatLayout.jsx';
import StatusBar from './components/StatusBar.jsx';
import CommandMenu from './components/CommandMenu.jsx';
import ProfileForm from './components/ProfileForm.jsx';
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

// 1. RAW JS SESSION TRACKER (Vanilla JS for zero-render overhead)
const SESSION_START_TIME = Date.now();

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

    // ... (rest of the component logic)
    const [thinkingLevel, setThinkingLevel] = useState('Medium');
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

    const [messages, setMessages] = useState([
        { id: 'welcome', role: 'system', text: FLUX_LOGO + '\n\n🌊⚡ Welcome to Flux Flow! Type /help for commands.\n' }
    ]);
    const [completedIndex, setCompletedIndex] = useState(1);

    // Global Key Listener (ONE listener to rule them all)
    useInput((inputText, key) => {
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

    const COMMANDS = ['/mode', '/thinking', '/model', '/resume', '/memory', '/profile', '/settings', '/key', '/stats', '/help', '/clear', '/quit'];

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
            .split('\n')
            .map(l => l.replace(/\\$/, ''))
            .join('\n');

        // Prevent sending empty or whitespace-only prompts
        if (!absoluteClean.trim()) return;

        if (isProcessing) {
            // STEERING HINT ENGINE
            const hintText = absoluteClean.trim();
            setQueuedPrompt(hintText);
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
                                process.stdout.write('\x1Bc'); // Clear for fresh context
                                setChatId(targetId);
                                setMessages(target.messages);
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
                    // Perform full terminal hardware reset for Static mode
                    process.stdout.write('\x1Bc');
                    setMessages([{ id: 'welcome-' + Date.now(), role: 'system', text: FLUX_LOGO + '\n\n🌊⚡ Welcome back to Flux Flow! Context cleared.\n' }]);
                    setCompletedIndex(0); // Trigger full Static re-flush to show logo
                    setChatId(generateChatId()); // Brand new identity for the new chat
                    setSessionStats({ tokens: 0 });
                    break;
                }
                case '/mode': {
                    if (parts[1]) {
                        const newMode = parts[1].toLowerCase() === 'flow' ? 'Flow' : 'Flux';
                        setMode(newMode);
                        setMessages(prev => { setCompletedIndex(prev.length + 1); return [...prev, { id: Date.now(), role: 'system', text: `⚙️ [SYSTEM] Mode switched to ${newMode}` }]; });
                    } else {
                        setActiveView('mode');
                    }
                    break;
                }
                case '/thinking': {
                    const arg = parts[1]?.toLowerCase();
                    if (arg === 'show') {
                        setShowFullThinking(true);
                        setMessages(prev => { setCompletedIndex(prev.length + 1); return [...prev, { id: Date.now(), role: 'system', text: '⚙️ [SYSTEM] Full Thinking Process: VISIBLE' }]; });
                    } else if (arg === 'hide') {
                        setShowFullThinking(false);
                        setMessages(prev => { setCompletedIndex(prev.length + 1); return [...prev, { id: Date.now(), role: 'system', text: '⚙️ [SYSTEM] Full Thinking Process: HIDDEN (Headings only)' }]; });
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
                            setMessages(prev => { setCompletedIndex(prev.length + 1); return [...prev, { id: Date.now(), role: 'system', text: `⚙️ [SYSTEM] Thinking level set to ${formattedLevel}` }]; });
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
                        setMessages(prev => { setCompletedIndex(prev.length + 1); return [...prev, { id: Date.now(), role: 'system', text: `⚙️ [SYSTEM] Model switched to ${mod}` }]; });
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
                    setMessages(prev => { setCompletedIndex(prev.length + 1); return [...prev, { id: Date.now(), role: 'system', text: `💾 [MEMORY] Chat saved as "${name}" (ID: ${chatId})` }]; });
                    break;
                }
                case '/chats': {
                    const run = async () => {
                        const history = await loadHistory();
                        const list = Object.entries(history).map(([id, info]) => `• ${id}: ${info.name}`).join('\n');
                        setMessages(prev => {
                            setCompletedIndex(prev.length + 1);
                            return [...prev, { id: Date.now(), role: 'system', text: `🗃️ [HISTORY] Saved Chats:\n${list || 'No saved chats found.'}` }];
                        });
                    };
                    run();
                    break;
                }
                case '/memory': {
                    setActiveView('memory');
                    break;
                }
                case '/help': {
                    setMessages(prev => { setCompletedIndex(prev.length + 1); return [...prev, { id: Date.now(), role: 'system', text: '⚙️ [SYSTEM] Available commands: ' + COMMANDS.join(', ') }]; });
                    break;
                }
                default:
                    setMessages(prev => { setCompletedIndex(prev.length + 1); return [...prev, { id: Date.now(), role: 'system', text: `⚙️ [SYSTEM] Unknown command: ${cmd}` }]; });
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
                try {
                    const cleanHistoryForAI = [...messages, userMessage].filter(m =>
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
                            }
                        },
                        async () => {
                            // STEERING CALLBACK
                            if (queuedPrompt) {
                                const p = queuedPrompt;
                                setQueuedPrompt(null);
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
                        if (chunkText.includes('<think>') && !inThinkMode) {
                            inThinkMode = true;
                            chunkText = chunkText.replace('<think>', '');
                            currentThinkId = 'think-' + Date.now();
                            setMessages(prev => [...prev, { id: currentThinkId, role: 'think', text: '' }]);
                        }

                        // 2. Detect transition to AGENT mode (Normal or Stray)
                        if (chunkText.includes('</think>')) {
                            const [thinkPart, agentPart] = chunkText.split('</think>');

                            if (inThinkMode) {
                                setMessages(prev => {
                                    const newMsgs = [...prev];
                                    const thinkMsg = newMsgs.find(m => m.id === currentThinkId);
                                    if (thinkMsg) thinkMsg.text += thinkPart.replace(signalRegex, '');

                                    currentAgentId = 'agent-' + Date.now();
                                    const cleanedAgentPart = (agentPart || '').replace(signalRegex, '');
                                    return [...newMsgs, { id: currentAgentId, role: 'agent', text: cleanedAgentPart }];
                                });
                                inThinkMode = false;
                            } else {
                                // Stray </think> case - clean it and ensure agent mode
                                const cleanedContent = (agentPart || thinkPart || '').replace(signalRegex, '');
                                if (!currentAgentId) {
                                    currentAgentId = 'agent-' + Date.now();
                                    setMessages(prev => [...prev, { id: currentAgentId, role: 'agent', text: cleanedContent }]);
                                } else {
                                    setMessages(prev => {
                                        const newMsgs = [...prev];
                                        const msg = newMsgs.find(m => m.id === currentAgentId);
                                        if (msg) msg.text += cleanedContent;
                                        return newMsgs;
                                    });
                                }
                            }
                            continue;
                        }

                        // 3. Append to target role
                        if (inThinkMode && currentThinkId) {
                            setMessages(prev => {
                                const newMsgs = [...prev];
                                const msg = newMsgs.find(m => m.id === currentThinkId);
                                if (msg) msg.text += chunkText.replace(signalRegex, '');
                                return newMsgs;
                            });
                        } else if (!inThinkMode) {
                            // Strip protocol signals and any stray opening tags
                            const cleanedText = chunkText
                                .replace('<think>', '')
                                .replace(signalRegex, '');

                            // Ensure an agent message exists
                            if (!currentAgentId) {
                                currentAgentId = 'agent-' + Date.now();
                                setMessages(prev => [...prev, { id: currentAgentId, role: 'agent', text: cleanedText }]);
                            } else {
                                setMessages(prev => {
                                    const newMsgs = [...prev];
                                    const msg = newMsgs.find(m => m.id === currentAgentId);
                                    if (msg) msg.text += cleanedText;
                                    return newMsgs;
                                });
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
                    if (queuedPrompt) {
                        setResolutionData(queuedPrompt);
                        setQueuedPrompt(null);
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
                        items={[{ label: 'Gemma 4 31B (Default)', value: 'gemma-4-31b-it' }, { label: 'Gemini 3.1 Pro (Req. paid API Key)', value: 'gemini-3.1-pro-preview' }, { label: 'Gemini 3 Flash', value: 'gemini-3-flash-preview' }, { label: 'Gemini 3.1 Flash Lite', value: 'gemini-3.1-flash-lite' }, { label: 'Cancel', value: 'Cancel' }]}
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
                            { label: `Toggle Memory [ ${systemSettings.memory ? 'ON' : 'OFF'} ]`, value: 'memory' },
                            { label: `Toggle Auto-Exec [ ${systemSettings.autoExec ? 'ON' : 'OFF'} ]`, value: 'autoExec' },
                            { label: `External Workspace Access [ ${systemSettings.allowExternalAccess ? 'ON' : 'OFF'} ]`, value: 'externalAccess' },
                            { label: `API Tier [ ${apiTier} ]`, value: 'apiTier' },
                            { label: `Auto-Delete History [ ${systemSettings.autoDeleteHistory} ]`, value: 'autoDelete' },
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
            case 'resume':
                return (
                    <Box width="100%" alignItems="center" justifyContent="center">
                        <ResumeModal
                            onSelect={async (id) => {
                                const h = await loadHistory();
                                if (h[id]) {
                                    setChatId(id);
                                    setMessages(h[id].messages);
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
                                handleSubmit(val);
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
                const terminalWidth = stdout.columns || 80;
                const wrapWidth = Math.max(20, terminalWidth - 10);

                // Simple wrap-count for the payload indicator decision
                const wrappedLines = input.split('\n').reduce((acc, line) => {
                    return acc + Math.max(1, Math.ceil(line.length / wrapWidth));
                }, 0);
                const maxLines = Math.max(1, wrappedLines);

                return (
                    <Box flexDirection="column" marginTop={1} flexShrink={0} width="100%">
                        {statusText && (
                            <Box paddingX={1} marginBottom={0}>
                                <Text color="magenta" italic>⏳ {statusText}</Text>
                            </Box>
                        )}
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
                                {maxLines > 3 ? (
                                    <Box flexDirection="column" width="100%" paddingY={0}>
                                        <Text color="gray" dimColor>
                                            [📦 {maxLines} lines of text in buffer - Full content will be sent]
                                        </Text>
                                        <Box
                                            flexDirection="row"
                                            width="100%"
                                            height={1}
                                            overflow="hidden"
                                            alignItems="flex-end"
                                        >
                                            <Box flexShrink={0} width={3}>
                                                <Text color="yellow">❯ </Text>
                                            </Box>
                                            <Box flexGrow={1}>
                                                <MultilineInput
                                                    value={input.split('\n').pop() || ''}
                                                    onChange={(val) => {
                                                        const cleanVal = val.replace(/\\$/, '');
                                                        const lines = input.split('\n');
                                                        lines[lines.length - 1] = cleanVal;
                                                        setInput(lines.join('\n'));
                                                    }}
                                                    onSubmit={handleSubmit}
                                                    placeholder={escPressed ? "Press ESC again to cancel the request." : (isProcessing ? "Flux Flow is thinking..." : "Type your message or /command...")}
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
                                            <MultilineInput
                                                value={input}
                                                onChange={(val) => {
                                                    // Handle manual backslash escapes without stripping them prematurely
                                                    const cleanVal = val.replace(/\\\s*\n/g, '\n');
                                                    setInput(cleanVal);
                                                }}
                                                onSubmit={handleSubmit}
                                                placeholder={escPressed ? "Press ESC again to cancel the request." : (isProcessing ? "Flux Flow is thinking..." : "Type your message or /command...")}
                                                maxRows={3}
                                                keyBindings={{
                                                    submit: (key) => key.return && !key.shift && !key.ctrl,
                                                    newline: (key) => (key.return && key.shift) || (key.return && key.ctrl)
                                                }}
                                            />
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
            <Box flexDirection="column">
                {messages.slice(0, completedIndex).map((msg, idx) => (
                    <ChatLayout key={msg.id || idx} messages={[msg]} showFullThinking={showFullThinking} />
                ))}
            </Box>

            <Box flexDirection="column" padding={1} width="100%">
                {activeView === 'chat' && (
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
                        chatId={chatId}
                        isMemoryEnabled={systemSettings.memory}
                    />
                </Box>
            </Box>
        </Box>
    );
}
