import os from 'os';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Box, Text, useInput, useStdout, Static } from 'ink';
import Spinner from 'ink-spinner';
import fs from 'fs-extra';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { MultilineInput } from './components/MultilineInput.jsx';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';
import ChatLayout, { MessageItem, CodeRenderer, BlockItem } from './components/ChatLayout.jsx';
import StatusBar, { getMemoryInfo } from './components/StatusBar.jsx';
import CommandMenu from './components/CommandMenu.jsx';
import SettingsMenu from './components/SettingsMenu.jsx';
import ProfileForm from './components/ProfileForm.jsx';
import AskUserModal from './components/AskUserModal.jsx';
import gradient from 'gradient-string';
import { getAPIKey, saveAPIKey, removeAPIKey, getProviderAPIKey, saveProviderAPIKey } from './utils/secrets.js';
import { initAI, getAIStream, signalTermination, runJanitorTask, compressHistory, deleteChatSummary } from './utils/ai.js';
import { subagentProgress } from './utils/subagent_state.js';
import { loadSettings, saveSettings } from './utils/settings.js';
import { getThemeColors } from './utils/theme.js';
import { loadHistory, saveChat, deleteChat, generateChatId, cleanupOldHistory, cleanupOldLogs, saveChatContext, loadChatContext } from './utils/history.js';
import ResumeModal from './components/ResumeModal.jsx';
import MemoryModal from './components/MemoryModal.jsx';
import UpdateProcessor from './components/UpdateProcessor.jsx';
import ParserDownloadModal from './components/ParserDownloadModal.jsx';
import { RevertManager } from './utils/revert.js';
import { GEMINI_QUOTES } from './data/gemini_quotes.js';
import { WITTY_LOADING_PHRASES } from './data/witty_phrases.js';
import Gradient from 'ink-gradient';
import RevertModal from './components/RevertModal.jsx';
import { getDailyUsage, getMonthlyUsage, getCustomPeriodUsage, addToUsage, initUsage, forceFlushUsage, getImageQuotaStats, runtimeSession } from './utils/usage.js';
import { loadRemoteModelConfig, getModels, getDefaultModel, getFallbackValue, setOllamaMultimodal, isModelMultimodal } from './data/model_config.js';
import { TerminalBox } from './components/TerminalBox.jsx';
import { parseArgs } from './utils/arg_parser.js';
import { FLUXFLOW_DIR, DATA_DIR, LOGS_DIR, SECRET_DIR, SETTINGS_FILE } from './utils/paths.js';
import { emojiSpace, getFluxLogo } from './utils/terminal.js';
import { writeToActiveCommand, terminateActiveCommand, isActiveCommandPty, cleanTerminalOutput } from './tools/exec_command.js';
import { checkPuppeteerReady, installPuppeteerBrowser } from './utils/setup.js';
import { formatTokens, parseMessageToBlocks, clearBlocksCache, flattenString } from './utils/text.js';
import { isBridgeConnected, initBridge, sendStatus } from './utils/editor.js';
import GlintText from './components/GlintText.jsx';
import { handleExport } from './utils/export.js';

const shouldClearValue = (val) => {
    const s = String(val);
    return s.startsWith('999') && s.endsWith('9');
};

const getPrefilledValue = (val) => {
    if (val === undefined || val === null || val === 0 || shouldClearValue(val)) {
        return '';
    }
    return String(val);
};

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

const MODE_DISPLAY_NAMES = {
    'Flux': 'Workspace',
    'Flow': 'Studio',
    'ICU': 'Computer Use',
    'FluxCU': 'Omni'
};

const getModeDisplayName = (mode) => {
    if (!mode) return 'Workspace';
    const key = Object.keys(MODE_DISPLAY_NAMES).find(k => k.toLowerCase() === mode.toLowerCase());
    return key ? MODE_DISPLAY_NAMES[key] : mode;
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

const BridgePromo = ({ width, height, selectedIndex, aiProvider, theme = 'Dark' }) => {
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
                <Text>{getFluxLogo(versionFluxflow, aiProvider, theme)}</Text>
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

// Centralized Version Control: dynamically fetch version and date from package.json
const packageJsonPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const versionFluxflow = packageJson.version;
const updatedOn = packageJson.date || '2026-05-20';

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
let interval_for_timer;

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

const ResolutionModal = ({ data, onResolve, onEdit, theme = 'Dark' }) => {
    const colors = getThemeColors(theme);
    return (
        <Box flexDirection="column" borderStyle="round" borderColor={colors.borderMuted} padding={0} width="100%">
            <Box paddingX={1}>
                <Text color={colors.text} bold underline>{data.startsWith('/btw') ? 'QUESTION' : 'STEERING HINT'} RESOLUTION</Text>
            </Box>
            <Box paddingX={1} marginTop={1}>
                <Text color={colors.text}>The agent already finished the task before your {data.startsWith('/btw') ? 'question' : 'hint'} was consumed.</Text>
            </Box>
            <Box marginTop={1} backgroundColor={colors.cardBg || colors.codeBg || '#222'} paddingX={2} width="100%">
                <Text italic color={colors.textMuted}>"{data.replace('/btw', '').trim()}"</Text>
            </Box>
            <Box paddingX={1} marginTop={1}>
                <Text color={colors.textDim || colors.textMuted}>How would you like to proceed?</Text>
            </Box>
            <Box marginTop={0}>
                <CommandMenu
                    title="Select Action"
                    items={[
                        { label: 'Send Anyway', value: 'send' },
                        { label: 'Edit Prompt', value: 'edit' }
                    ]}
                    onSelect={(item) => {
                        const val = typeof item === 'object' && item !== null ? item.value : item;
                        if (val === 'send') onResolve(data);
                        else onEdit(data);
                    }}
                    theme={theme}
                />
            </Box>
        </Box>
    );
};


const parseAgentText = (text) => {
    const blocks = [];
    const toolRegex = /\[\s*(?:tool:functions\.|agent:generalist\.)([a-z0-9_]+)\s*\(/gi;

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
            const beforeText = flattenString(text.substring(lastIdx, match.index));
            if (beforeText.trim()) {
                blocks.push({ type: 'output', content: beforeText });
            }

            const finalArgsText = flattenString(text.substring(startIdx + 1, closingParenIdx));
            blocks.push({
                type: 'tool',
                toolName: flattenString(toolName.trim()),
                args: flattenString(finalArgsText.trim())
            });

            lastIdx = endIdx + 1;
            toolRegex.lastIndex = lastIdx;
        } else {
            // If it didn't find a closing bracket, just break
            break;
        }
    }

    if (lastIdx < text.length) {
        const remainingText = flattenString(text.substring(lastIdx));
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
        if (cachedFiles && now - lastScanTime < 10000) { // Cache for 10 seconds
            return cachedFiles;
        }

        const fileList = [];
        const scan = (currentDir) => {
            if (fileList.length >= 2000) return; // Hard cap to prevent memory bloat
            try {
                const files = fs.readdirSync(currentDir);
                for (const file of files) {
                    if (fileList.length >= 2000) return;
                    if (['node_modules', '.git', '.gemini', 'dist', 'build', '.next', '.cache', 'out'].includes(file)) {
                        continue;
                    }
                    const filePath = path.join(currentDir, file);
                    const stat = fs.statSync(filePath);
                    if (stat.isDirectory()) {
                        scan(filePath);
                    } else {
                        fileList.push({
                            name: flattenString(file),
                            relativePath: flattenString(path.relative(process.cwd(), filePath))
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

let cachedShortcut = "Ctrl + Enter";

const getLatencyColor = (delay) => {
    if (delay <= 370) return '#00a564'; // Deep green
    if (delay >= 5000) return '#ff0000'; // Pure red

    // More stops = smoother perceptual gradient across the full range
    const points = [
        { t: 370, r: 0, g: 165, b: 100 }, // deep green
        { t: 550, r: 40, g: 195, b: 80 }, // green
        { t: 800, r: 120, g: 220, b: 50 }, // lime-green
        { t: 1100, r: 190, g: 225, b: 20 }, // yellow-green
        { t: 1500, r: 250, g: 210, b: 15 }, // yellow
        { t: 2000, r: 255, g: 170, b: 0 }, // amber
        { t: 2800, r: 255, g: 110, b: 0 }, // orange
        { t: 3800, r: 255, g: 50, b: 0 }, // deep orange
        { t: 5000, r: 255, g: 0, b: 0 }  // red
    ];

    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        if (delay >= p1.t && delay <= p2.t) {
            // Smoothstep easing so mid-range transitions feel less abrupt
            let ratio = (delay - p1.t) / (p2.t - p1.t);
            ratio = ratio * ratio * (3 - 2 * ratio); // smoothstep
            const r = Math.round(p1.r + (p2.r - p1.r) * ratio);
            const g = Math.round(p1.g + (p2.g - p1.g) * ratio);
            const b = Math.round(p1.b + (p2.b - p1.b) * ratio);
            return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
        }
    }
    return '#ff0000';
};

const SubagentRow = React.memo(({ sa, showTPMEstimate = false }) => {
    const [dotColor, setDotColor] = useState('green');
    const [displayedWps, setDisplayedWps] = useState(0);
    const chunkTimesRef = useRef([]);
    const smoothedDelayRef = useRef(370); // EMA of delay, starts at fast/green
    const wpsHistoryRef = useRef([]);
    const lastChunkTimeRef = useRef(sa.lastChunkTime);

    // Keep lastChunkTimeRef in sync so the interval can read it without re-subscribing
    useEffect(() => {
        lastChunkTimeRef.current = sa.lastChunkTime;
    }, [sa.lastChunkTime]);

    // Collect WPS samples into moving average history ref (mirrors StatusBar)
    useEffect(() => {
        if (sa.status !== 'running') {
            wpsHistoryRef.current = [];
            return;
        }
        if (sa.wps > 0) {
            const history = wpsHistoryRef.current;
            history.push(sa.wps);
            if (history.length > 3) {
                history.shift();
            }
            // Show immediately — don't wait for the smoothing timer
            setDisplayedWps(Math.round(sa.wps));
        }
    }, [sa.status, sa.wps, sa.lastChunkTime]);

    // 1350ms display-update timer with decay (mirrors StatusBar exactly)
    useEffect(() => {
        if (sa.status !== 'running') {
            setDisplayedWps(0);
            return;
        }

        const timer = setInterval(() => {
            const lastTime = lastChunkTimeRef.current;
            const timeSinceLast = lastTime > 0 ? (Date.now() - lastTime) : 0;

            if (lastTime > 0 && timeSinceLast > 1500) {
                wpsHistoryRef.current = [];
                setDisplayedWps(0);
            } else if (lastTime > 0 && timeSinceLast > 600) {
                // Chunks paused >600ms — decay the history
                if (wpsHistoryRef.current.length > 0) {
                    wpsHistoryRef.current.shift();
                }
                const history = wpsHistoryRef.current;
                if (history.length > 0) {
                    const sum = history.reduce((acc, val) => acc + val, 0);
                    setDisplayedWps(Math.round(sum / history.length));
                } else {
                    setDisplayedWps(0);
                }
            } else {
                const history = wpsHistoryRef.current;
                if (history.length > 0) {
                    const sum = history.reduce((acc, val) => acc + val, 0);
                    setDisplayedWps(Math.round(sum / history.length));
                } else if (sa.wps > 0) {
                    setDisplayedWps(Math.round(sa.wps));
                }
            }
        }, 750);

        return () => clearInterval(timer);
    }, [sa.status]);

    useEffect(() => {
        if (sa.status !== 'running') {
            chunkTimesRef.current = [];
            return;
        }

        const lastChunkTime = sa.lastChunkTime;
        if (lastChunkTime > 0) {
            const times = chunkTimesRef.current;
            if (times.length === 0 || times[times.length - 1] !== lastChunkTime) {
                times.push(lastChunkTime);
                if (times.length > 10) {
                    times.shift();
                }
            }
        }

        const checkLatency = () => {
            if (!lastChunkTime) {
                setDotColor('#00a564');
                return;
            }
            const times = chunkTimesRef.current;
            let averageInterval = 0;
            if (times.length > 1) {
                let sum = 0;
                for (let i = 1; i < times.length; i++) {
                    sum += (times[i] - times[i - 1]);
                }
                averageInterval = sum / (times.length - 1);
            }
            const timeSinceLast = Date.now() - lastChunkTime;

            // Two-zone logic:
            // • Brief pause  (<2.5s): cap at 3× avg so tool calls / context pauses
            //   don't catastrophize the color.
            // • Genuine stall (≥2.5s): bypass cap entirely so the dot turns red,
            //   signalling the model is dead — not just thinking.
            const STALL_THRESHOLD = 2500;
            const isStalled = timeSinceLast >= STALL_THRESHOLD;
            const cappedTimeSinceLast = (!isStalled && averageInterval > 0)
                ? Math.min(timeSinceLast, averageInterval * 3)
                : timeSinceLast;
            const rawDelay = Math.max(averageInterval, cappedTimeSinceLast);

            // EMA: react faster (α=0.4) during a stall so red arrives in ~3 ticks,
            // stay slow (α=0.2) during normal streaming to absorb spikes.
            const alpha = isStalled ? 0.4 : 0.2;
            smoothedDelayRef.current = smoothedDelayRef.current * (1 - alpha) + rawDelay * alpha;
            setDotColor(getLatencyColor(smoothedDelayRef.current));
        };

        checkLatency();
        const timer = setInterval(checkLatency, 100);
        return () => clearInterval(timer);
    }, [sa.status, sa.lastChunkTime]);

    return (
        <Box justifyContent="space-between" width="100%">
            <Text color="white"> • {sa.title} <Text color="white" dimColor>({sa.id})</Text></Text>
            <Text color="white"><Text color="white" dimColor bold>{sa.currentTool || 'Active'}</Text><Text color={dotColor}> ●</Text>{showTPMEstimate && <Text color="white" dimColor bold> ({displayedWps} tps)</Text>}</Text>
        </Box>
    );
});

export default function App({ args = [] }) {
    const lastGCTimeRef = useRef(1);
    const [confirmExit, setConfirmExit] = useState(false);
    const [exitCountdown, setExitCountdown] = useState(10);
    const { stdout } = useStdout();

    const [input, setInput] = useState('');
    const [inputKey, setInputKey] = useState(0);
    const [isExpanded, setIsExpanded] = useState(false);
    const [mode, setMode] = useState('Flux');
    const [activeDisplay, setActiveDisplay] = useState(0);
    const [terminalSize, setTerminalSize] = useState({
        columns: stdout?.columns || 80,
        rows: stdout?.rows || 24
    });

    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isFilePickerDismissed, setIsFilePickerDismissed] = useState(false);
    const [showBridgePromo, setShowBridgePromo] = useState(false);
    const [promoSelectedIndex, setPromoSelectedIndex] = useState(0);
    const suggestionOffsetRef = useRef(0);
    const maxScrollRef = useRef(0);
    const persistedModelRef = useRef(null);
    const activeStreamingMsgRef = useRef(null);
    const tabDebounceRef = useRef(0);
    const [renderTick, setRenderTick] = useState(0);
    const forceRender = () => setRenderTick(t => t + 1);

    // Typewriter effect refs
    const typewriterQueueRef = useRef([]);
    const typewriterTickRef = useRef(null);

    const flushTypewriterNow = () => {
        const queue = typewriterQueueRef.current;
        if (queue.length > 0 && activeStreamingMsgRef.current) {
            const remaining = queue.join('');
            queue.length = 0;
            activeStreamingMsgRef.current.text = flattenString(activeStreamingMsgRef.current.text + remaining);
            forceRender();
        }
    };

    const commitActiveStreamingMessage = () => {
        flushTypewriterNow();
        if (activeStreamingMsgRef.current) {
            let msgText = flattenString(activeStreamingMsgRef.current.text);
            if (activeStreamingMsgRef.current.role === 'think') {
                msgText = msgText.replace(/^\r?\n+/, '').replace(/\r?\n+$/, '');
            }
            const msg = {
                ...activeStreamingMsgRef.current,
                text: msgText,
                isStreaming: false
            };
            setMessages(prev => {
                const next = [...prev, msg];
                setCompletedIndex(next.length);
                return next;
            });
            activeStreamingMsgRef.current = null;
        }
        chunkWordCountRef.current = 0;
        streamingWordStatsRef.current = { totalWords: 0, startTime: 0, wps: 0, chunks: [] };
    };

    // ── Typewriter Effect ─────────────────────────────────────────────
    // When progressiveRendering is ON, text chunks are queued and rendered gradually
    // via a tick interval instead of appearing instantly.

    const startTypewriter = () => {
        if (typewriterTickRef.current) {
            clearInterval(typewriterTickRef.current);
        }
        typewriterQueueRef.current = [];
        typewriterTickRef.current = setInterval(() => {
            try {
                const queue = typewriterQueueRef.current;
                if (queue.length > 0 && activeStreamingMsgRef.current) {
                    // Adaptive batch size: catch up faster when queue grows deep
                    let batchSize = 1;
                    if (queue.length > 85) batchSize = 30;
                    else if (queue.length > 80) batchSize = 25;
                    else if (queue.length > 75) batchSize = 20;
                    else if (queue.length > 65) batchSize = 16;
                    else if (queue.length > 50) batchSize = 12;
                    else if (queue.length > 35) batchSize = 8;
                    else if (queue.length > 15) batchSize = 6;
                    else if (queue.length > 5) batchSize = 4;
                    else if (queue.length > 3) batchSize = 2;

                    let batchedText = '';
                    for (let i = 0; i < batchSize && queue.length > 0; i++) {
                        batchedText += queue.shift();
                    }
                    activeStreamingMsgRef.current.text = flattenString(activeStreamingMsgRef.current.text + batchedText);
                    forceRender();
                }
            } catch (e) { }
        }, 80); // [ANIMATION TICK]
    };

    const awaitTypewriter = async () => {
        while (systemSettings.progressiveRendering && typewriterQueueRef.current.length > 0) {
            await new Promise(resolve => setTimeout(resolve, 10));
        }
    };

    // Queue text for typewriter or append directly when OFF
    const appendStreamText = (chunkText) => {
        if (systemSettings.progressiveRendering && typewriterTickRef.current) {
            // Split into word tokens for smooth progressive appearance
            const tokens = chunkText.split(/(\s+)/).filter(Boolean);
            for (const tok of tokens) {
                typewriterQueueRef.current.push(tok);
            }
        } else {
            // Direct append (instant render)
            if (!activeStreamingMsgRef.current) {
                activeStreamingMsgRef.current = { id: 'agent-' + Date.now(), role: 'agent', text: flattenString(chunkText), isStreaming: true };
            } else {
                activeStreamingMsgRef.current.text = flattenString(activeStreamingMsgRef.current.text + chunkText);
            }
            forceRender();
        }
    };
    // ──────────────────────────────────────────────────────────────────

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

        // If there is no GC in last 30s invoke a GC
        lastGCTimeRef.current = Date.now();
        const memInterval = setInterval(() => {
            // console.log("[GC] Memory check");
            if (lastGCTimeRef.current) {
                const diff = Date.now() - lastGCTimeRef.current || 0;
                if (diff > 30000) {
                    if (global.gc) {
                        const gCAsync = async () => {
                            for (let i = 0; i < 1; i++) {
                                global.gc();
                                // Wait for the next tick of the event loop
                                await new Promise(resolve => setImmediate(resolve));
                            }
                            lastGCTimeRef.current = Date.now();
                        }
                        gCAsync();
                    }
                }
                // else console.log(lastGCTimeRef.current, diff);
            }
        }, 3000);
        // console.log(lastGCTimeRef.current, memInterval);

        return () => {
            clearTimeout(graceTimer);
            clearInterval(interval);
            clearInterval(memInterval);
        };
    }, []);

    // [SUB-AGENT MODEL STARTUP CHECK] Validate configured sub-agent model against current provider / saved keys / ENV
    useEffect(() => {
        const checkSubAgentModelOnStartup = async () => {
            try {
                const settings = await loadSettings();
                const sysSettings = settings?.systemSettings || {};
                const customSubAgent = sysSettings.CustomSubAgent;
                const configuredModel = sysSettings.SubAgentModel;

                if (!customSubAgent || !configuredModel || configuredModel === 'Default') {
                    return;
                }

                const envModel = process.env.SUBAGENT_MODEL ? process.env.SUBAGENT_MODEL.trim() : null;
                const envProviderRaw = process.env.SUBAGENT_PROVIDER ? process.env.SUBAGENT_PROVIDER.trim() : null;

                const ALL_PROVIDERS = ['Google', 'DeepSeek', 'OpenRouter', 'NVIDIA', 'Mistral', 'Ollama', 'CrofAI', 'InferX', 'SenseNova'];
                const normalizeProvider = (pStr) => {
                    if (!pStr) return null;
                    const lower = pStr.toLowerCase();
                    if (lower === 'google') return 'Google';
                    if (lower === 'deepseek') return 'DeepSeek';
                    if (lower === 'openrouter') return 'OpenRouter';
                    if (lower === 'nvidia') return 'NVIDIA';
                    if (lower === 'mistral') return 'Mistral';
                    if (lower === 'ollama') return 'Ollama';
                    if (lower === 'crofai' || lower === 'crof') return 'CrofAI';
                    if (lower === 'inferx') return 'InferX';
                    if (lower === 'sensenova') return 'SenseNova';
                    return null;
                };

                const envProvider = normalizeProvider(envProviderRaw);

                if (envModel && !envProvider) {
                    const currentActiveProv = settings.aiProvider || aiProvider || 'Google';
                    setMessages(prev => {
                        setCompletedIndex(prev.length + 1);
                        return [...prev, {
                            id: 'subagent-env-noprov-' + Date.now(),
                            role: 'system',
                            text: `[SUBAGENT CONFIG] SUBAGENT_MODEL found in ENV but SUBAGENT_PROVIDER is missing/invalid. Active provider (${currentActiveProv}) will be used.`,
                            isMeta: true
                        }];
                    });
                }

                if (configuredModel === 'ENV') {
                    if (!envModel) {
                        setMessages(prev => {
                            setCompletedIndex(prev.length + 1);
                            return [...prev, {
                                id: 'subagent-model-noenv-' + Date.now(),
                                role: 'system',
                                text: 'No SubAgent model is found in ENV, Using Deafult until changed',
                                isMeta: true
                            }];
                        });
                    }
                    return;
                }

                const currentProvider = settings.aiProvider || aiProvider || 'Google';
                const currentTier = settings.apiTier || apiTier || 'Free';
                const quotasObj = settings.quotas || quotas || {};

                const availableModelNamesSet = new Set();

                // Add current provider models
                const currentModelsRaw = getModels(currentProvider, currentTier) || [];
                currentModelsRaw.forEach(m => {
                    const name = typeof m === 'string' ? m : (m.cmd || m.name || m.id || String(m));
                    if (name) availableModelNamesSet.add(name);
                });

                // Add models from other providers that have saved keys
                for (const p of ALL_PROVIDERS) {
                    try {
                        const key = await getProviderAPIKey(p);
                        if (key) {
                            const tier = quotasObj?.providerTiers?.[p] || 'Free';
                            const pModels = getModels(p, tier) || [];
                            pModels.forEach(m => {
                                const name = typeof m === 'string' ? m : (m.cmd || m.name || m.id || String(m));
                                if (name) availableModelNamesSet.add(name);
                            });
                        }
                    } catch (e) { }
                }

                const isModelAvailable = availableModelNamesSet.has(configuredModel);

                if (envModel) {
                    if (envModel !== configuredModel) {
                        setMessages(prev => {
                            setCompletedIndex(prev.length + 1);
                            return [...prev, {
                                id: 'subagent-model-env-' + Date.now(),
                                role: 'system',
                                text: 'Current Seleted Sub-Agent model is not available in this provider. Using model from ENV unless changed.',
                                isMeta: true
                            }];
                        });
                    }
                } else if (!isModelAvailable) {
                    setMessages(prev => {
                        setCompletedIndex(prev.length + 1);
                        return [...prev, {
                            id: 'subagent-model-err-' + Date.now(),
                            role: 'system',
                            text: 'Current Seleted Sub-Agent model is not available in this provider. Using Default until changed',
                            isMeta: true
                        }];
                    });
                }
            } catch (err) {
                // Silently ignore load errors
            }
        };

        checkSubAgentModelOnStartup();
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
                    if (['google', 'deepseek', 'openrouter', 'nvidia', 'mistral', 'ollama', 'crof', 'crofai', 'inferx', 'sensenova'].includes(provPart)) {
                        let mapped = 'Google';
                        if (provPart === 'google') mapped = 'Google';
                        else if (provPart === 'deepseek') mapped = 'DeepSeek';
                        else if (provPart === 'openrouter') mapped = 'OpenRouter';
                        else if (provPart === 'nvidia') mapped = 'NVIDIA';
                        else if (provPart === 'mistral') mapped = 'Mistral';
                        else if (provPart === 'ollama') mapped = 'Ollama';
                        else if (provPart === 'crof' || provPart === 'crofai') mapped = 'CrofAI';
                        else if (provPart === 'inferx') mapped = 'InferX';
                        else if (provPart === 'sensenova') mapped = 'SenseNova';
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
                if (['flux', 'flow', 'icu', 'computer', 'fluxcu'].includes(lower)) {
                    let mapped = 'Flux';
                    if (lower === 'flux') mapped = 'Flux';
                    else if (lower === 'flow') mapped = 'Flow';
                    else if (lower === 'icu' || lower === 'computer') mapped = 'ICU';
                    else if (lower === 'fluxcu') mapped = 'FluxCU';
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
                if (['google', 'deepseek', 'openrouter', 'nvidia', 'mistral', 'ollama', 'crof', 'crofai', 'inferx', 'sensenova'].includes(val)) {
                    let mapped = 'Google';
                    if (val === 'google') mapped = 'Google';
                    else if (val === 'deepseek') mapped = 'DeepSeek';
                    else if (val === 'openrouter') mapped = 'OpenRouter';
                    else if (val === 'nvidia') mapped = 'NVIDIA';
                    else if (val === 'mistral') mapped = 'Mistral';
                    else if (val === 'ollama') mapped = 'Ollama';
                    else if (val === 'crof' || val === 'crofai') mapped = 'CrofAI';
                    else if (val === 'inferx') mapped = 'InferX';
                    else if (val === 'sensenova') mapped = 'SenseNova';
                    parsed.provider = mapped;
                }
                i++;
            } else if ((arg === '--resume' || arg === '-r') && args[i + 1]) {
                parsed.resume = args[i + 1];
                i++;
            } else if (arg === '--playground') {
                parsed.playground = true;
            } else if ((arg === '--original-cwd' || arg === '--orginal-cwd') && args[i + 1]) {
                parsed.originalCwd = args[i + 1];
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
                return [...prev, { id: 'check-' + Date.now(), role: 'system', text: '✦ Checking for updates...', isMeta: true }];
            });
        }
        try {
            const response = await fetch('https://registry.npmjs.org/fluxflow-cli', { cache: 'no-store' });
            const data = await response.json();
            const latestVersion = data['dist-tags']?.latest;
            const stableVersion = data['dist-tags']?.stable;
            if (latestVersion) setLatestVer(latestVersion);

            if (latestVersion && latestVersion !== versionFluxflow) {
                const versionDisplay = latestVersion === stableVersion ? `v${latestVersion}` : `v${latestVersion}`;

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
                    const displayVer = latestVersion && latestVersion === stableVersion ? `${versionFluxflow}` : versionFluxflow;
                    return [...prev, { id: 'uptodate-' + Date.now(), role: 'system', text: `⠀⠀└─ Already up to date (${displayVer}).\n⠀`, isMeta: true }];
                });
            }
        } catch (err) {
            if (manual) {
                setMessages(prev => {
                    setCompletedIndex(prev.length + 1);
                    return [...prev, { id: 'check-err-' + Date.now(), role: 'system', text: `⠀⠀└─ Failed to check for updates: ${err.message}.\n⠀`, isMeta: true }];
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
    const [activeModel, setActiveModel] = useState(getDefaultModel('Google', 'Free') || 'gemma-4-31b-it');
    const [wildcardTooling, setWildcardTooling] = useState(false);
    const [janitorModel, setJanitorModel] = useState(getFallbackValue('gemma_janitor_fallback_google') || 'gemma-4-26b-a4b-it');
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
                    text: `✦ Successfully configured Shift+Enter in your ${ideName} keybindings!\n`,
                    isMeta: true
                }];
            });
        } catch (err) {
            setMessages(prev => {
                setCompletedIndex(prev.length + 1);
                return [...prev, {
                    id: 'kb-error-' + Date.now(),
                    role: 'system',
                    text: `✦ Failed to update keybindings: ${err.message}.\n⠀`,
                    isMeta: true
                }];
            });
        }
    };

    const [activeView, setActiveView] = useState('chat'); // chat, mode, thinking, model, settings, profile
    const [apiTier, setApiTier] = useState('Free');
    const [quotas, setQuotas] = useState({ limitMode: 'Daily', agentLimit: 99999999, tokenLimit: 99999999999999, backgroundLimit: 999999, searchLimit: 100, customModelId: '', customLimit: 0, providerBudgets: {} });
    const [inputConfig, setInputConfig] = useState(null); // { label, key, subKey, value, next }
    const [budgetReturnView, setBudgetReturnView] = useState('chat');
    const [providerReturnView, setProviderReturnView] = useState('settings');
    const [providerBudgetQueue, setProviderBudgetQueue] = useState([]); // ordered list of providers to configure
    const [providerBudgetCursor, setProviderBudgetCursor] = useState(0); // which provider in the queue we're on
    const [pbsCursor, setPbsCursor] = useState(0); // providerBudgetSelect list cursor
    const [pbsSelected, setPbsSelected] = useState({}); // providerBudgetSelect checkbox state
    const [pbfFormState, setPbfFormState] = useState({}); // providerBudgetFlow form values
    const [pbfFieldIndex, setPbfFieldIndex] = useState(0); // providerBudgetFlow active field cursor
    const [systemSettings, setSystemSettings] = useState({ memory: true, theme: 'Dark', compression: 0.0, autoExec: false, autoDeleteHistory: '7d', autoUpdate: false, updateManager: 'npm', customUpdateCommand: '' });
    const colors = useMemo(() => getThemeColors(systemSettings.theme), [systemSettings.theme]);
    const [profileData, setProfileData] = useState({ name: null, nickname: null, instructions: null });
    const [imageSettings, setImageSettings] = useState({ keyType: 'Default', quality: 'Low-High', apiKey: '' });
    const [sessionStats, setSessionStats] = useState({ tokens: 0 });
    const [lastChunkTime, setLastChunkTime] = useState(0);
    const chunkWordCountRef = useRef(0);
    const streamingWordStatsRef = useRef({ totalWords: 0, startTime: 0, wps: 0, chunks: [] });
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
    const [statsScrollOffset, setStatsScrollOffset] = useState(0);
    const PLAYGROUND_CHAT_ID = 'flow-playground';
    const [chatId, setChatId] = useState(args.includes('--playground') ? PLAYGROUND_CHAT_ID : generateChatId());

    useEffect(() => {
        if (chatLoadingRef.current) return;
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
    const [activeSubagents, setActiveSubagents] = useState([]);

    const [tick, setTick] = useState(0); // Only used for SPINNER_FRAMES reference if needed elsewhere, but mainly tick is gone now
    const isFirstRender = useRef(true);
    const isSecondRender = useRef(true);
    const isThirdRender = useRef(true);
    const prevProviderRef = useRef(aiProvider);
    const originalAllowExternalAccessRef = useRef(false);
    const originalMemoryRef = useRef(true);

    useEffect(() => {
        if (wildcardTooling) {
            setWildcardTooling(false);
            setMessages(m => { setCompletedIndex(m.length + 1); return [...m, { id: Date.now(), role: 'system', text: `✦ Wildcard Tooling:\n⠀⠀└─ Status: Disabled.\n⠀`, isMeta: true }]; });
        }
    }, [activeModel]);

    // [THINKING DEPTH AWARENESS] Auto-switch reasoning depth based on model and provider capabilities
    useEffect(() => {
        if (prevProviderRef.current !== aiProvider) {
            prevProviderRef.current = aiProvider;
            if (aiProvider === 'Mistral') {
                setThinkingLevel('Fast');
            } else {
                const hasStandard = aiProvider === 'DeepSeek' || aiProvider === 'NVIDIA' || aiProvider === 'CrofAI' || aiProvider === 'InferX';
                setThinkingLevel(hasStandard ? 'Standard' : 'Medium');
            }
        } else {
            if ((aiProvider === 'Google' || aiProvider === 'CrofAI' || aiProvider === 'InferX' || aiProvider === 'SenseNova') && thinkingLevel === 'xHigh') {
                if ((activeModel && activeModel.toLowerCase().startsWith('gemini-3')) || aiProvider === 'CrofAI' || aiProvider === 'InferX' || aiProvider === 'SenseNova') {
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

        const defaultModel = getDefaultModel(aiProvider, apiTier);
        let modelDisplayName = defaultModel;
        if (defaultModel.includes('gemma')) {
            modelDisplayName = 'Gemma';
        } else if (defaultModel.includes('deepseek')) {
            modelDisplayName = 'DeepSeek Flash';
        } else if (defaultModel.includes('devstral')) {
            modelDisplayName = 'Devstral';
        } else if (defaultModel.includes('mistral')) {
            modelDisplayName = 'Mistral';
        } else if (defaultModel.includes('gemini')) {
            modelDisplayName = 'Gemini Flash';
        }

        setActiveModel(defaultModel);
        saveSettings({ apiTier, activeModel: defaultModel });
        if (modelDisplayName && false) {
            setMessages(prev => {
                setCompletedIndex(prev.length + 1);
                return [...prev, {
                    id: 'tier-switch-' + Date.now(),
                    role: 'system',
                    text: `**Switched to ${modelDisplayName}.`,
                    isMeta: true
                }];
            });
        }
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
    const [hasPasteBlock, setHasPasteBlock] = useState(false);
    const [activeTime, setActiveTime] = useState(0);
    let interval_for_timer;

    useEffect(() => {
        let interval;

        if (statusText && systemSettings.loadingPhrases !== false) {
            const updatePhrase = () => {
                const randomPhrase = WITTY_LOADING_PHRASES[Math.floor(Math.random() * WITTY_LOADING_PHRASES.length)];
                setWittyPhrase(randomPhrase);
            };
            if (!wittyPhrase) updatePhrase(); // Initial pick
            interval = setInterval(updatePhrase, 10000);
        } else {
            setWittyPhrase('');
        }

        return () => {
            clearInterval(interval);
        }
    }, [statusText, systemSettings]);

    const [isSpinnerActive, setIsSpinnerActive] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isCompressing, setIsCompressing] = useState(false);
    const [escPressed, setEscPressed] = useState(false);
    const [escTimer, setEscTimer] = useState(null);
    const [escPressCount, setEscPressCount] = useState(0);
    const [recentPrompts, setRecentPrompts] = useState([]);
    const escDoubleTimerRef = useRef(null);
    const chatLoadingRef = useRef(false);

    useEffect(() => {
        return () => {
            if (escDoubleTimerRef.current) {
                clearTimeout(escDoubleTimerRef.current);
            }
        };
    }, []);

    const didSignalTerminationRef = useRef(false);
    const [queuedPrompt, setQueuedPrompt] = useState(null);
    const [resolutionData, setResolutionData] = useState(null);
    const [tempModelOverride, setTempModelOverride] = useState(null);

    useEffect(() => setEscPressCount(0), [input]);

    const [messages, rawSetMessages] = useState(() => {
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

    const setMessages = (value) => {
        rawSetMessages(prev => {
            const next = typeof value === 'function' ? value(prev) : value;

            // FAST PATH: Optimized O(1) deduplication without looping
            if (next.length > 1) {
                const last = next[next.length - 1];
                const secondLast = next[next.length - 2];
                if (last?.text?.includes('Request Cancelled') &&
                    secondLast?.text?.includes('Request Cancelled')) {
                    return next.slice(0, -1);
                }
            }
            return next;
        });
    };

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
    const [clearKey, setClearKey] = useState(0);

    const lastCompletedBlocksRef = useRef([]);

    // Put this near your hooks
    const cachedHistoryRef = useRef({
        completedIndex: 0,
        columns: 0,
        historicalBlocks: [],
        seenSelections: new Set(),
        chatId: '',
        clearKey: 0,
        theme: ''
    });

    const parsedBlocks = useMemo(() => {
        const columns = terminalSize.columns || 80;
        const SELECTION_REGEX = /Selection: (.*)/;

        let historicalBlocks = [];
        let seenAskSelections = new Set();

        // Check if terminal resized, chat was cleared, session switched, theme changed, or cleared manually
        const isResize = cachedHistoryRef.current.columns !== columns;
        const isClear = completedIndex < cachedHistoryRef.current.completedIndex;
        const isChatChanged = cachedHistoryRef.current.chatId !== chatId;
        const isClearKeyChanged = cachedHistoryRef.current.clearKey !== clearKey;
        const isThemeChanged = cachedHistoryRef.current.theme !== systemSettings.theme;

        if (isResize || isClear || isChatChanged || isClearKeyChanged || isThemeChanged) {
            // SLOW PATH: User resized terminal, cleared chat, reverted, switched sessions or theme. Re-parse history once.
            const completedMsgs = messages.slice(0, completedIndex);
            for (let i = 0; i < completedMsgs.length; i++) {
                const msg = completedMsgs[i];
                if (msg.isAskRecord && msg.text) {
                    const match = msg.text.match(SELECTION_REGEX);
                    if (match && match[1].trim()) {
                        const selection = match[1].trim();
                        if (seenAskSelections.has(selection)) continue;
                        seenAskSelections.add(selection);
                    }
                }
                const parsed = parseMessageToBlocks(msg, columns);
                for (let j = 0; j < parsed.completed.length; j++) historicalBlocks.push(parsed.completed[j]);
                for (let j = 0; j < parsed.active.length; j++) historicalBlocks.push(parsed.active[j]);
            }

            // Save to cache
            cachedHistoryRef.current = {
                completedIndex,
                columns,
                historicalBlocks,
                seenSelections: new Set(seenAskSelections),
                chatId,
                clearKey,
                theme: systemSettings.theme
            };
        } else {
            // FAST PATH: We are chatting or streaming.
            // Grab the EXACT reference from cache (no memory copying!)
            historicalBlocks = cachedHistoryRef.current.historicalBlocks;
            seenAskSelections = cachedHistoryRef.current.seenSelections;

            // If a message just finished streaming, append it to our historical cache
            if (completedIndex > cachedHistoryRef.current.completedIndex) {
                // Clone the array ONLY when a message finishes (rare), not during streaming
                historicalBlocks = [...historicalBlocks];
                seenAskSelections = new Set(seenAskSelections);

                const newMsgs = messages.slice(cachedHistoryRef.current.completedIndex, completedIndex);
                for (let i = 0; i < newMsgs.length; i++) {
                    const msg = newMsgs[i];
                    if (msg.isAskRecord && msg.text) {
                        const match = msg.text.match(SELECTION_REGEX);
                        if (match && match[1].trim()) {
                            const selection = match[1].trim();
                            if (seenAskSelections.has(selection)) continue;
                            seenAskSelections.add(selection);
                        }
                    }
                    const parsed = parseMessageToBlocks(msg, columns);
                    for (let j = 0; j < parsed.completed.length; j++) historicalBlocks.push(parsed.completed[j]);
                    for (let j = 0; j < parsed.active.length; j++) historicalBlocks.push(parsed.active[j]);
                }

                // Update cache
                cachedHistoryRef.current = {
                    completedIndex,
                    columns,
                    historicalBlocks,
                    seenSelections: seenAskSelections,
                    chatId,
                    clearKey
                };
            }
        }

        const activeMsgs = messages.slice(completedIndex);
        const streamingCompletedBlocks = [];
        const activeBlocks = [];

        for (let i = 0; i < activeMsgs.length; i++) {
            const msg = activeMsgs[i];
            if (msg.isAskRecord && msg.text) {
                const match = msg.text.match(SELECTION_REGEX);
                if (match && match[1].trim()) {
                    const selection = match[1].trim();
                    if (seenAskSelections.has(selection)) continue;
                    // Note: We don't add to the Set here, because active blocks might be re-parsed
                }
            }
            const parsed = parseMessageToBlocks(msg, columns);
            for (let j = 0; j < parsed.completed.length; j++) streamingCompletedBlocks.push(parsed.completed[j]);
            for (let j = 0; j < parsed.active.length; j++) activeBlocks.push(parsed.active[j]);
        }

        // Integrate our ref-based active streaming message so lines can commit to Static scrollback immediately
        if (activeStreamingMsgRef.current) {
            const parsed = parseMessageToBlocks(activeStreamingMsgRef.current, columns);
            for (let j = 0; j < parsed.completed.length; j++) streamingCompletedBlocks.push(parsed.completed[j]);
            for (let j = 0; j < parsed.active.length; j++) activeBlocks.push(parsed.active[j]);
        }

        // Combine history cache + newly completed lines from the active stream
        // OPT: Reuse cached reference when nothing new committed (avoids 50k+ item spread on every streaming tick)
        let finalCompleted = streamingCompletedBlocks.length === 0
            ? historicalBlocks
            : historicalBlocks.concat(streamingCompletedBlocks);

        // Give warning so the user can manually clear, preventing real OOM
        if (finalCompleted.length >= 75000) {
            // Clone before mutating — finalCompleted may be the cached historicalBlocks reference
            finalCompleted = [...finalCompleted];
            finalCompleted.push({
                key: `memory-warning-block-${finalCompleted.length}`,
                msg: {
                    role: 'system',
                    text: `⚠️ MEMORY WARNING: CHAT IS GETTING VERY LONG`,
                    subText: `This session has reached ${finalCompleted.length} blocks. To maintain optimal performance and prevent high memory usage, it is highly recommended to save and start a clean chat with /clear.`,
                    isHomeWarning: true
                },
                type: 'full-message'
            });
        }

        return {
            completed: finalCompleted,
            active: activeBlocks
        };

    }, [messages, completedIndex, terminalSize.columns, clearKey, chatId, renderTick]);

    // useEffect(() => {
    //     fs.writeFileSync('DEBUG.json', JSON.stringify(parsedBlocks.completed, null, 4));
    // }, [parsedBlocks])


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

        // ctrl+r triggers memory info refresh
        if (key.ctrl && (inputText.toLowerCase() === 'r' || inputText === '\x12' || inputText === '\u0012')) {
            getMemoryInfo();
            return;
        }

        if (activeView === 'stats') {
            if (key.tab && !key.shift) {
                setStatsMode(prev => {
                    if (prev === 'modelBreakdown') return 'daily';
                    return prev === 'daily' ? 'monthly' : 'daily';
                });
                setStatsScrollOffset(0);
                return;
            }
            if (key.space || inputText === ' ') {
                setStatsMode(prev => prev === 'modelBreakdown' ? 'daily' : 'modelBreakdown');
                setStatsScrollOffset(0);
                return;
            }
            if (key.upArrow) {
                setStatsScrollOffset(prev => Math.max(0, prev - 1));
                return;
            }
            if (key.downArrow) {
                setStatsScrollOffset(prev => Math.min(maxScrollRef.current, prev + 1));
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
                if (isActiveCommandPty) {
                    // PTY processes (conpty/winpty on Windows, pty on Linux/Mac) expect bare \r for Enter
                    writeToActiveCommand('\r');
                } else {
                    // Non-PTY stdin: \r\n on Windows, \n on Unix
                    const isWin = process.platform === 'win32';
                    writeToActiveCommand(isWin ? '\r\n' : '\n');
                    setExecOutput(prev => prev + '\n');
                }
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

        // Provider Budget Select keyboard handling
        if (activeView === 'providerBudgetSelect') {
            const PBS_PROVIDERS = ['Google', 'DeepSeek', 'Mistral', 'NVIDIA', 'OpenRouter', 'Ollama', 'CrofAI', 'InferX', 'SenseNova'];
            if (key.upArrow) {
                setPbsCursor(c => (c - 1 + PBS_PROVIDERS.length) % PBS_PROVIDERS.length);
                return;
            } else if (key.downArrow) {
                setPbsCursor(c => (c + 1) % PBS_PROVIDERS.length);
                return;
            } else if (inputText === ' ') {
                const prov = PBS_PROVIDERS[pbsCursor];
                setPbsSelected(s => ({ ...s, [prov]: !s[prov] }));
                return;
            } else if (key.return) {
                const chosenProviders = PBS_PROVIDERS.filter(p => pbsSelected[p]);
                if (chosenProviders.length === 0) return;
                const updatedQuotas = { ...quotas, providerBudgets: { ...(quotas.providerBudgets || {}), __useProvider: true } };
                setQuotas(updatedQuotas);
                setProviderBudgetQueue(chosenProviders);
                setProviderBudgetCursor(0);
                setPbsCursor(0);
                setActiveView('providerBudgetFlow');
                return;
            } else if (key.escape) {
                setActiveView('budgetTypeSelect');
                return;
            }
            return;
        }

        // Provider Budget Form keyboard handling
        if (activeView === 'providerBudgetFlow') {
            const totalRows = providerBudgetQueue.length;
            const totalFields = totalRows * 2 + 1;
            if (key.upArrow) {
                setPbfFieldIndex(i => {
                    if (i === totalFields - 1) {
                        return Math.max(0, (totalRows - 1) * 2);
                    }
                    if (i >= 2) return i - 2;
                    return i;
                });
                return;
            } else if (key.downArrow) {
                setPbfFieldIndex(i => {
                    if (i === totalFields - 1) return i;
                    if (i + 2 < totalFields - 1) return i + 2;
                    return totalFields - 1;
                });
                return;
            } else if (key.leftArrow) {
                setPbfFieldIndex(i => {
                    if (i === totalFields - 1) return i;
                    if (i % 2 === 1) return i - 1;
                    return i;
                });
                return;
            } else if (key.rightArrow || key.tab) {
                setPbfFieldIndex(i => {
                    if (i === totalFields - 1) return i;
                    if (i % 2 === 0) return i + 1;
                    if (i + 1 < totalFields) return i + 1;
                    return i;
                });
                return;
            } else if (key.return) {
                if (pbfFieldIndex === totalFields - 1) {
                    const rawPB = quotas.providerBudgets || {};
                    const cleaned = { __useProvider: true };
                    for (const prov of providerBudgetQueue) {
                        const formProv = pbfFormState[prov] || {};
                        cleaned[prov] = {
                            agentLimit: 9999999999,
                            tokenLimit: parseInt(formProv.tokenLimit, 10) || 0,
                            monthlyTokenLimit: parseInt(formProv.monthlyTokenLimit, 10) || 0
                        };
                    }
                    const finalCleanedQuotas = { ...quotas, providerBudgets: cleaned };
                    setQuotas(finalCleanedQuotas);
                    saveSettings({ apiTier, quotas: finalCleanedQuotas });
                    const returnMode = budgetReturnView === 'settings' ? 'resetMode' : 'budgetResetMode';
                    setActiveView(returnMode);
                } else {
                    setPbfFieldIndex(i => Math.min(totalFields - 1, i + 1));
                }
                return;
            } else if (key.escape) {
                setActiveView('providerBudgetSelect');
                return;
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
            if (isProcessing || activeCommand || pendingApproval || pendingAsk) {
                didSignalTerminationRef.current = true;
                signalTermination();
                terminateActiveCommand();
                if (pendingApproval) {
                    pendingApproval.resolve('deny');
                    setPendingApproval(null);
                }
                if (pendingAsk) {
                    pendingAsk.resolve(null);
                    setPendingAsk(null);
                }
                setEscPressed(false);
                if (escTimer) clearTimeout(escTimer);
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
                                            return [...prev, { id: 'revert-empty-' + Date.now(), role: 'system', text: '✦ Nothing to revert to.\n⠀', isMeta: true }];
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
                setSelectedIndex(prev => {
                    let nextIdx = prev > 0 ? prev - 1 : suggestions.length - 1;
                    let loops = 0;
                    while (nextIdx !== prev && loops < suggestions.length) {
                        const sug = suggestions[nextIdx];
                        const cmdName = sug?.cmd || sug || '';
                        if (typeof cmdName === 'string' && cmdName.trimStart().startsWith('---')) {
                            nextIdx = nextIdx > 0 ? nextIdx - 1 : suggestions.length - 1;
                            loops++;
                        } else {
                            break;
                        }
                    }
                    return nextIdx;
                });
                return;
            }
            if (key.downArrow) {
                setSelectedIndex(prev => {
                    let nextIdx = prev < suggestions.length - 1 ? prev + 1 : 0;
                    let loops = 0;
                    while (nextIdx !== prev && loops < suggestions.length) {
                        const sug = suggestions[nextIdx];
                        const cmdName = sug?.cmd || sug || '';
                        if (typeof cmdName === 'string' && cmdName.trimStart().startsWith('---')) {
                            nextIdx = nextIdx < suggestions.length - 1 ? nextIdx + 1 : 0;
                            loops++;
                        } else {
                            break;
                        }
                    }
                    return nextIdx;
                });
                return;
            }
            if (key.return) {
                // Return handling is now coordinated with TextInput onSubmit for stability
                return;
            }
        }

        // 3. Tab Completion — Accept suggestion like Enter does
        if (key.tab && activeView === 'chat') {
            if (suggestions.length > 0) {
                const nextMatch = suggestions[selectedIndex] || suggestions[0];
                const parts = input.split(' ');
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
            } else if (input.trim() === '') {
                // Switch modes when input is empty and TAB is pressed (with 1s debounce)
                const now = Date.now();
                if (now - tabDebounceRef.current < 500) {
                    return;
                }
                tabDebounceRef.current = now;
                const modes = ['Flux', 'Flow', 'ICU', 'FluxCU'];
                const nextIdx = (modes.indexOf(mode) + 1) % modes.length;
                const newMode = modes[nextIdx >= 0 ? nextIdx : 0];
                setMode(newMode);
                if (newMode === 'Flow') {
                    setThinkingLevel('Fast');
                } else if (newMode === 'Flux' || newMode === 'ICU' || newMode === 'FluxCU') {
                    setThinkingLevel('High');
                }
                setMessages(prev => [...prev, { id: Date.now(), role: 'system', text: `✦ Mode switched to ${getModeDisplayName(newMode)}\n⠀`, isMeta: true }]);
                return;
            }
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

    const prevThemeRef = useRef(systemSettings.theme);
    useEffect(() => {
        if (prevThemeRef.current && prevThemeRef.current !== systemSettings.theme) {
            prevThemeRef.current = systemSettings.theme;
            if (stdout) {
                stdout.write('\x1b[2J\x1b[3J\x1b[H');
                if (stdout.isTTY) {
                    stdout.write('\x1b[?2004h');
                }
            }
            setClearKey(prev => prev + 1);
            clearBlocksCache();
        } else {
            prevThemeRef.current = systemSettings.theme;
        }
    }, [systemSettings.theme, stdout]);

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
                    return [...prev, { id: 'setup-' + Date.now(), role: 'system', text: '✦ Installing Required dependencies... (One-time setup)', isMeta: true }];
                });
                await installPuppeteerBrowser();
                setMessages(prev => {
                    setCompletedIndex(prev.length + 1);
                    return [...prev, { id: 'setup-done-' + Date.now(), role: 'system', text: '⠀⠀└─ All dependencies installed successfully.\n⠀', isMeta: true }];
                });
            }

            // 1. Load remote model config
            await loadRemoteModelConfig();

            // 2. Load persisted settings
            const saved = await loadSettings();
            originalAllowExternalAccessRef.current = saved.systemSettings?.allowExternalAccess ?? false;
            originalMemoryRef.current = saved.systemSettings?.memory ?? true;
            if (parsedArgs.mode) {
                setMode(parsedArgs.mode);
            } else {
                setMode(saved.mode);
            }
            setActiveDisplay(saved.display ?? 0);
            if (parsedArgs.thinking) {
                setThinkingLevel(parsedArgs.thinking);
            } else {
                setThinkingLevel(saved.thinkingLevel);
            }

            const startupProvider = parsedArgs.provider || saved.aiProvider || 'Google';
            setAiProvider(startupProvider);

            const providerTiers = saved.quotas?.providerTiers || {};
            const currentTier = providerTiers[startupProvider] || saved.apiTier || 'Free';

            persistedModelRef.current = saved.activeModel;
            if (parsedArgs.model) {
                setActiveModel(parsedArgs.model);
            } else if (parsedArgs.provider) {
                const defaultModel = getDefaultModel(startupProvider, currentTier);
                setActiveModel(defaultModel);
            } else {
                setActiveModel(saved.activeModel);
            }

            setShowFullThinking(saved.showFullThinking);
            setApiTier(currentTier);
            setQuotas(saved.quotas || { limitMode: 'Daily', agentLimit: 99999999, tokenLimit: 99999999999999, backgroundLimit: 999999, searchLimit: 100, customModelId: '', customLimit: 0, providerBudgets: {} });
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

            if (startupProvider === 'NVIDIA' && process.env.NVIDIA_BASE_URL) {
                freshSettings.memory = false;
                setMessages(prev => [
                    ...prev,
                    {
                        role: 'system',
                        text: '✦ MEMORY\n⠀⠀└─ Currently not available.\n⠀',
                        isMeta: true
                    }
                ]);
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

            if (parsedArgs.playground) {
                freshSettings.allowExternalAccess = false;
                freshSettings.memory = false;
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

            // Purge playground session + folder when starting in normal mode
            if (!parsedArgs.playground) {
                deleteChat(PLAYGROUND_CHAT_ID).catch(() => { });
                fs.remove(path.join(DATA_DIR, 'playground')).catch(() => { });
            }

            // 4. Check for updates
            performVersionCheck(false, freshSettings);

            // 5. Prime usage cache and handle resume flag concurrently
            await Promise.all([
                initUsage(),
                RevertManager.recoverCrashedTransaction()
            ]);

            if (parsedArgs.resume) {
                const h = await loadHistory();
                const id = parsedArgs.resume;
                if (h[id]) {
                    chatLoadingRef.current = true;
                    setChatId(id);
                    const savedData = await loadChatContext(id);
                    chatTokenStartRef.current = sessionTotalTokens - savedData.total;
                    chatLoadingRef.current = false;
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
                        const newMsgs = [...prev, { id: 'sys-' + Date.now(), role: 'system', text: `✦ SESSION RESUMED\n⠀⠀└─ '${id}'.\n⠀`, isMeta: true }];
                        setCompletedIndex(newMsgs.length);
                        return newMsgs;
                    });
                } else {
                    setMessages(prev => [...prev, { id: 'sys-err-' + Date.now(), role: 'system', text: `✦ Chat session [${id}] not found. Started new session.\n⠀`, isMeta: true }]);
                }
            }

            if (parsedArgs.playground) {
                // Lock CWD to DATA_DIR/playground for the entire playground session
                const playgroundDir = path.join(DATA_DIR, 'playground');
                try { fs.ensureDirSync(playgroundDir); process.chdir(playgroundDir); } catch (e) { /* ignore */ }

                // Auto-restore playground session history if it exists
                const playgroundHistory = await loadHistory();
                if (playgroundHistory[PLAYGROUND_CHAT_ID]) {
                    const resumedMsgs = [...playgroundHistory[PLAYGROUND_CHAT_ID].messages];
                    if (!resumedMsgs[0]?.isLogo) {
                        resumedMsgs.unshift({ id: 'logo-' + Date.now(), role: 'system', isLogo: true, isMeta: true });
                    }
                    setMessages(resumedMsgs);
                    setMessages(prev => {
                        const newMsgs = [...prev, {
                            id: 'playground-' + Date.now(), role: 'system',
                            text: `✦ PLAYGROUND Session restored\n⠀⠀└─ CWD locked to: '${playgroundDir}'.\n⠀`,
                            isMeta: true
                        }];
                        setCompletedIndex(newMsgs.length);
                        return newMsgs;
                    });
                } else {
                    // First-ever playground launch
                    setMessages(prev => {
                        const newMsgs = [...prev, {
                            id: 'playground-' + Date.now(), role: 'system',
                            text: `✦ PLAYGROUND Mode active\n⠀⠀└─ CWD locked to: 'FluxFlow/playground'.\n⠀`,
                            isMeta: true
                        }];
                        setCompletedIndex(newMsgs.length);
                        return newMsgs;
                    });
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
            let settingsToSave = systemSettings;
            if (parsedArgs.playground) {
                settingsToSave = {
                    ...systemSettings,
                    allowExternalAccess: originalAllowExternalAccessRef.current,
                    memory: originalMemoryRef.current
                };
            }
            saveSettings({
                mode,
                thinkingLevel,
                aiProvider,
                activeModel: modelToSave || activeModel,
                showFullThinking,
                systemSettings: settingsToSave,
                profileData,
                imageSettings,
                apiTier
            });
        }
    }, [mode, thinkingLevel, aiProvider, activeModel, showFullThinking, systemSettings, profileData, imageSettings, isInitializing, parsedArgs, apiTier]);

    const handleSetup = async (val) => {
        const key = val.trim();

        const validators = {
            Google: {
                prefix: 'AIzaSy',
                minLength: 39,
            },
            OpenRouter: {
                prefix: 'sk-or-v1-',
                minLength: 73,
            },
            DeepSeek: {
                prefix: 'sk-',
                minLength: 35,
            },
            Mistral: {
                prefix: '',
                minLength: 32,
            },
            NVIDIA: {
                prefix: 'nvapi-',
                minLength: 70,
            },
            Ollama: {
                prefix: '',
                minLength: 0,
            },
            CrofAI: {
                prefix: '',
                minLength: 0,
            },
            InferX: {
                prefix: '',
                minLength: 0,
            },
            SenseNova: {
                prefix: '',
                minLength: 0,
            },
        };

        const { prefix, minLength } = validators[aiProvider] ?? {
            prefix: '',
            minLength: 0,
        };

        const isOllamaLocalEscape = aiProvider === 'Ollama' && (key.trim() === 'LOCAL' || key.trim() === '');
        const effectiveKey = isOllamaLocalEscape ? 'LOCAL' : key;

        if (isOllamaLocalEscape || (key.startsWith(prefix) && key.length >= minLength)) {
            await saveProviderAPIKey(aiProvider, effectiveKey);
            setApiKey(effectiveKey);
            initAI(effectiveKey, { aiProvider, onIDEApproval: resetPendingApproval }); // Initialize SDK

            let defaultModel = 'gemma-4-31b-it';
            if (aiProvider === 'OpenRouter') {
                defaultModel = 'google/gemma-4-31b-it:free';
            } else if (aiProvider === 'DeepSeek') {
                defaultModel = 'deepseek-v4-flash';
            } else if (aiProvider === 'NVIDIA') {
                defaultModel = 'deepseek-ai/deepseek-v4-flash';
            } else if (aiProvider === 'Ollama') {
                defaultModel = activeModel || '';
            } else if (aiProvider === 'CrofAI' || aiProvider === 'InferX' || aiProvider === 'SenseNova') {
                defaultModel = getDefaultModel(aiProvider, apiTier) || '';
            }
            setActiveModel(defaultModel);

            let newSys = { ...systemSettings };
            if (isOllamaLocalEscape) {
                newSys = { ...newSys, ollamaEndpoint: 'Local' };
                setSystemSettings(newSys);
            }
            if (aiProvider === 'Ollama' || aiProvider === 'CrofAI' || aiProvider === 'InferX' || aiProvider === 'SenseNova') {
                newSys = { ...newSys, memory: false };
                setSystemSettings(newSys);
            }
            saveSettings({ aiProvider, activeModel: defaultModel, systemSettings: newSys });

            setMessages(prev => [...prev, { role: 'system', text: `✦ ${aiProvider} API Key saved successfully! ${defaultModel ? `\n⠀⠀└─ Model set to ${defaultModel}.` : ''}${isOllamaLocalEscape ? '\n✦ Ollama Endpoint switched to Local.\n  └─⠀' : '\n\n✦⠀'}${aiProvider === 'Ollama' || aiProvider === 'CrofAI' || aiProvider === 'InferX' || aiProvider === 'SenseNova' ? `Memory is not available with ${aiProvider}.\n  └─⠀` : ''}Initialization complete.\n⠀`, isMeta: true }]);
        } else {
            setMessages(prev => [
                ...prev,
                {
                    role: 'system',
                    text: `✦ INVALID KEY\n⠀⠀└─ ${aiProvider} API key must start with "${prefix}" and be at least ${minLength} characters long.`,
                    isMeta: true
                }
            ]);
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
                // saveChat(chatId, null, messages);
            };
            flush();

            const timer = setTimeout(() => {
                process.exit(0);
            }, 200); // Give user 0.2s to see the final stats dashboard [SAMLL ENOUGH]
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
        }, 5000); // 5s "vibe" interval
        return () => clearInterval(interval);
    }, [isInitializing]);

    const COMMANDS = [
        { cmd: '/quit', desc: 'Exit and shutdown Flux' },
        { cmd: '/help', desc: 'Show all available commands' },
        ...(parsedArgs.playground ? [{ cmd: '/move', desc: 'Move playground directory to original CWD/playground-export' }] : []),
        { cmd: '/resume', desc: 'Load previous session' },
        { cmd: '/clear', desc: 'Clear terminal screen' },
        { cmd: '/compress', desc: 'Summarize and compress chat history' },
        { cmd: '/truncate', desc: 'Truncate tool results in chat history' },
        { cmd: '/revert', desc: 'Revert codebase back to a checkpoint' },
        { cmd: '/gemini', desc: 'Get a happy message from Gemini CLI' },
        { cmd: '/save', desc: 'Force save current chat' },
        {
            cmd: '/export',
            desc: 'Export current chat or error logs',
            subs: [
                { cmd: 'chat', desc: 'Export current active chat' },
                { cmd: 'logs', desc: 'Export error logs' }
            ]
        },
        { cmd: '/chats', desc: 'List all chat sessions' },
        { cmd: '/btw', desc: 'Ask a question without intefering with ongoing tasks' },
        {
            cmd: '/thinking', desc: 'Set AI reasoning depth', subs: aiProvider === 'Ollama' || aiProvider === 'DeepSeek'
                ? [
                    { cmd: 'Fast', desc: 'Reasoning Disabled' },
                    { cmd: 'Standard', desc: 'Standard Reasoning' },
                    { cmd: 'High', desc: 'Extended Reasoning' }
                ]
                : aiProvider === 'NVIDIA'
                    ? [
                        { cmd: 'Fast', desc: 'Reasoning Disabled' },
                        { cmd: 'Standard', desc: 'Balanced Reasoning' },
                        { cmd: 'High', desc: 'Extended Reasoning' }
                    ]
                    : aiProvider === 'OpenRouter'
                        ? [
                            { cmd: 'Fast', desc: 'Fastest' },
                            { cmd: 'Low', desc: 'Quick Reasoning' },
                            { cmd: 'Standard', desc: 'Balanced Reasoning' },
                            { cmd: 'High', desc: 'Deep Reasoning' },
                            { cmd: 'xHigh', desc: 'Extended Reasoning' }
                        ]
                        : aiProvider === 'Mistral'
                            ? [
                                { cmd: 'Fast', desc: 'Reasoning Disabled' },
                                { cmd: 'xHigh', desc: 'Deep Reasoning' }
                            ]
                            : activeModel && (activeModel.toLowerCase().startsWith('gemini-3') || aiProvider === 'CrofAI' || aiProvider === 'InferX' || aiProvider === 'SenseNova')
                                ? [
                                    { cmd: 'Fast', desc: 'Fastest' },
                                    { cmd: 'Low', desc: 'Quick Reasoning' },
                                    { cmd: 'Standard', desc: 'Balanced Reasoning' },
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
            desc: 'Select Agent Model',
            subs: (aiProvider === 'Ollama' && (apiKey === 'LOCAL' || !apiKey))
                ? []
                : (mode === 'ICU' || mode.toLowerCase() === 'fluxcu'
                    ? getModels(aiProvider, apiTier).filter(m => isModelMultimodal(m.cmd || m))
                    : getModels(aiProvider, apiTier))
        },
        {
            cmd: '/wildcard-tooling',
            desc: 'Use if the model lacks Tooling Capability'
        },
        {
            cmd: '/provider',
            desc: 'Select AI Provider'
        },
        {
            cmd: '/mode', desc: 'Switch execution mode', subs: [
                { cmd: 'flux', display: 'workspace', desc: 'Workspace, files & terminal tools' },
                { cmd: 'flow', display: 'studio', desc: 'Creative studio, documents, PDF & conversation' },
                { cmd: 'icu', display: 'computer use', desc: 'Interactive desktop & OS automation' },
                { cmd: 'fluxcu', display: 'omni', desc: 'Autonomous tools & desktop execution' }
            ]
        },
        {
            cmd: '/display', desc: 'Select Active Display (Computer Use)', subs: [
                { cmd: 'primary', desc: 'Primary Display (Display 1)' },
                { cmd: 'secondary', desc: 'Secondary Display (Display 2)' }
            ]
        },
        { cmd: '/settings', desc: 'Configure system prefs' },
        { cmd: '/theme', desc: 'Customize UI color theme' },
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
                { cmd: 'init', desc: 'Create empty FluxFlow.md template' }
            ]
        },
        {
            cmd: '/budget', desc: 'Set or View budget limits', subs: [
                { cmd: 'view', desc: 'View current usage budget bars' },
                { cmd: 'set', desc: 'Configure budgets (Daily/Monthly limits)' },
                { cmd: 'reset', desc: 'Reset budgets to default limits' }
            ]
        },
        {
            cmd: '/update', desc: 'Check/Install updates', subs: [
                { cmd: 'latest', desc: 'Install latest release' },
                { cmd: 'check', desc: 'Check for new version' },
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

        didSignalTerminationRef.current = false;

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
                        return [...prev, { id: 'hint-err-' + Date.now(), role: 'system', text: '✦ RESTRICTED\n⠀⠀└─ Inquiry question must be more than 3 characters.\n⠀', isMeta: true }];
                    });
                    setInput('');
                    return;
                }
            } else if (hintText.startsWith('/')) {
                setMessages(prev => {
                    setCompletedIndex(prev.length + 1);
                    return [...prev, { id: 'hint-err-' + Date.now(), role: 'system', text: '✦ RESTRICTED\n⠀⠀└─ Steering Hints cannot start with \'/\'.\n⠀', isMeta: true }];
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
                const prefix = isBtw ? '[QUESTION]' : '[STEERING HINT]';
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
            setInput('');
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
                                if (process.stdout.isTTY) {
                                    const chatName = target?.name || '';
                                    const title = (chatName && !chatName.startsWith('flow-') && !chatName.startsWith('Session ')) ? chatName : 'FluxFlow | Resumed';
                                    process.stdout.write(`\x1b]0;${title}\x07`);
                                    process.stdout.write(`\x1b]633;P;TerminalTitle=${title}\x07`);
                                }
                                clearBlocksCache();
                                chatLoadingRef.current = true;
                                setChatId(targetId);

                                const savedData = await loadChatContext(targetId);
                                chatTokenStartRef.current = sessionTotalTokens - savedData.total;
                                chatLoadingRef.current = false;
                                setChatTokens(savedData.total);
                                setSessionStats({ tokens: savedData.context });

                                // Ensure logo is present at the start of resumed history
                                const resumedMsgs = [...target.messages];
                                const hasLogo = resumedMsgs[0]?.text?.includes('░░░███');
                                if (!hasLogo) {
                                    resumedMsgs.unshift({ id: 'logo-' + Date.now(), role: 'system', isLogo: true, isMeta: true });
                                }

                                setMessages(resumedMsgs);
                                setMessages(prev => [...prev, { id: 'sys-' + Date.now(), role: 'system', text: `✦ SESSION RESUMED\n⠀⠀└─ ${targetId}.\n⠀`, isMeta: true }]);
                                setCompletedIndex(0);
                            } else {
                                setMessages(prev => [...prev, { id: 'err-' + Date.now(), role: 'system', text: `✦ ERROR: Session [${targetId}] not found.\n⠀`, isMeta: true }]);
                            }
                        };
                        resumeSession();
                    } else {
                        setActiveView('resume');
                    }
                    break;
                }

                case '/move': {
                    if (!parsedArgs.playground) {
                        setMessages(prev => {
                            setCompletedIndex(prev.length + 1);
                            return [...prev, { id: Date.now(), role: 'system', text: `✦ RESTRICTED\n⠀⠀└─ '/move' is only available in playground mode.\n⠀`, isMeta: true }];
                        });
                        break;
                    }
                    if (!parsedArgs.originalCwd) {
                        setMessages(prev => {
                            setCompletedIndex(prev.length + 1);
                            return [...prev, { id: Date.now(), role: 'system', text: `✦ RESTRICTED\n⠀⠀└─ Original CWD not found.\n⠀`, isMeta: true }];
                        });
                        break;
                    }

                    const src = path.join(DATA_DIR, 'playground');
                    const dest = path.join(parsedArgs.originalCwd, 'playground-export');

                    const moveFiles = async () => {
                        try {
                            setMessages(prev => {
                                setCompletedIndex(prev.length + 1);
                                return [...prev, { id: Date.now(), role: 'system', text: `✦ EXPORTING PLAYGROUND CONTENT\n⠀⠀└─ ${dest}\n`, isMeta: true }];
                            });
                            await fs.ensureDir(dest);
                            const excludeDirs = ['node_modules', '.git', '.venv', 'venv', 'env', '.next', 'dist', 'build', '.cache'];
                            await fs.copy(src, dest, {
                                overwrite: true,
                                filter: (srcPath) => {
                                    const relative = path.relative(src, srcPath);
                                    if (!relative) return true;
                                    const parts = relative.split(path.sep);
                                    return !parts.some(part => excludeDirs.includes(part));
                                }
                            });

                            setMessages(prev => {
                                setCompletedIndex(prev.length + 1);
                                return [...prev, { id: Date.now(), role: 'system', text: `✦ SUCCESS\n⠀⠀└─ playground content copied to ${dest}\n`, isMeta: true }];
                            });
                        } catch (err) {
                            setMessages(prev => {
                                setCompletedIndex(prev.length + 1);
                                return [...prev, { id: Date.now(), role: 'system', text: `✦ FAILED TO MOVE CONTENT\n⠀⠀└─ ${err.message}\n`, isMeta: true }];
                            });
                        }
                    };

                    moveFiles();
                    break;
                }

                case '/clear': {
                    if (stdout) {
                        stdout.write('\x1b[2J\x1b[3J\x1b[H');
                        if (stdout.isTTY) {
                            stdout.write('\x1b[?2004h');
                            process.stdout.write(`\x1b]0;FluxFlow\x07`);
                            process.stdout.write(`\x1b]633;P;TerminalTitle=FluxFlow\x07`);
                        }
                    }
                    // Soft clear by resetting message state (Ink handles the visual refresh)
                    setMessages([
                        { id: 'logo-' + Date.now(), role: 'system', isLogo: true, isMeta: true }
                    ]);
                    setCompletedIndex(1);
                    setClearKey(prev => prev + 1);
                    clearBlocksCache();
                    cachedHistoryRef.current = {
                        completedIndex: 0,
                        columns: terminalSize.columns,
                        historicalBlocks: [],
                        seenSelections: new Set(),
                        chatId: chatId,
                        clearKey: clearKey + 1
                    };
                    // /clear always exits playground mode by resetting to a fresh session
                    if (parsedArgs.playground) {
                        parsedArgs.playground = false;
                        deleteChat(PLAYGROUND_CHAT_ID).catch(() => { });
                        if (parsedArgs.originalCwd) {
                            try {
                                process.chdir(parsedArgs.originalCwd);
                                setMessages(prev => {
                                    const newMsgs = [...prev, {
                                        id: 'playground-' + Date.now(), role: 'system',
                                        text: `✦ PLAYGROUND\n⠀⠀└─ Restored Working Directory to ${parsedArgs.originalCwd}\n⠀`,
                                        isMeta: true
                                    }];
                                    setCompletedIndex(newMsgs.length);
                                    return newMsgs;
                                });
                            } catch (e) {
                                // ignore
                            }
                        }
                        setTimeout(() => {
                            fs.emptyDir(path.join(DATA_DIR, 'playground')).catch((err) => {
                                setMessages(prev => {
                                    const newMsgs = [...prev, {
                                        id: 'playground-' + Date.now(), role: 'system',
                                        text: `✦ PLAYGROUND\n⠀⠀└─ Failed to clear session: ${DATA_DIR + '/playground'}`,
                                        isMeta: true
                                    }];
                                    setCompletedIndex(newMsgs.length);
                                    return newMsgs;
                                });
                            });
                        }, 500);
                        setSystemSettings(s => ({
                            ...s,
                            allowExternalAccess: originalAllowExternalAccessRef.current,
                            memory: originalMemoryRef.current
                        }));
                    }
                    setChatId(generateChatId());
                    setSessionStats({ tokens: 0 });
                    setIsExpanded(false);
                    setChatTokens(0);
                    chatTokenStartRef.current = sessionTotalTokens;
                    setTimeout(() => {
                        if (global.gc) {
                            const gCAsync = async () => {
                                for (let i = 0; i < 3; i++) {
                                    global.gc();
                                    await new Promise(resolve => setImmediate(resolve));
                                }
                                lastGCTimeRef.current = Date.now();
                            }
                            gCAsync();
                        }
                    }, 500);
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
                                return [...prev, { id: 'revert-empty-' + Date.now(), role: 'system', text: `✦ Nothing to revert to.\n⠀`, isMeta: true }];
                            });
                        }
                    });
                    setTimeout(() => {
                        if (global.gc) {
                            const gCAsync = async () => {
                                for (let i = 0; i < 3; i++) {
                                    global.gc();
                                    await new Promise(resolve => setImmediate(resolve));
                                }
                                lastGCTimeRef.current = Date.now();
                            }
                            gCAsync();
                        }
                    }, 500);
                    break;
                }
                case '/mode': {
                    if (parts[1]) {
                        const targetParam = parts[1].toLowerCase();
                        let newMode = 'Flux';
                        if (targetParam === 'flow') newMode = 'Flow';
                        else if (targetParam === 'icu') newMode = 'ICU';
                        else if (targetParam === 'fluxcu') newMode = 'FluxCU';
                        else if (targetParam === 'flux') newMode = 'Flux';

                        setMode(newMode);
                        if (newMode === 'Flow') {
                            setThinkingLevel('Fast');
                        }
                        const s = emojiSpace(2);
                        setMessages(prev => { setCompletedIndex(prev.length + 1); return [...prev, { id: Date.now(), role: 'system', text: `✦ Mode switched to ${getModeDisplayName(newMode)}.\n⠀`, isMeta: true }]; });
                    } else {
                        setActiveView('mode');
                    }
                    break;
                }
                case '/display': {
                    if (parts[1]) {
                        const targetParam = parts[1].toLowerCase();
                        let newDisplay = 0;
                        if (targetParam === 'secondary' || targetParam === '1' || targetParam === '2') {
                            newDisplay = 1;
                        } else {
                            newDisplay = 0;
                        }

                        setActiveDisplay(newDisplay);
                        saveSettings({ display: newDisplay }).catch(() => {});
                        const displayName = newDisplay === 0 ? 'Primary (Display 1)' : 'Secondary (Display 2)';
                        setMessages(prev => { setCompletedIndex(prev.length + 1); return [...prev, { id: Date.now(), role: 'system', text: `✦ Active Computer Use display set to: ${displayName}.\n⠀`, isMeta: true }]; });
                    } else {
                        setActiveView('display');
                    }
                    break;
                }
                case '/image_deprecated': {
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
                        const isForce = parts.includes('--force');
                        formattedLevel = val.charAt(0).toUpperCase() + val.slice(1);
                        if (val === 'xhigh') {
                            formattedLevel = 'xHigh';
                        }

                        let forceMsg = '';
                        if (isForce) {
                            if (process.env.NVIDIA_BASE_URL) {
                                forceMsg = '⠀⠀└─ Enabled Forced Reasoning.\n⠀';
                            } else {
                                forceMsg = '⠀⠀└─ --force is not supported in this context.\n⠀';
                            }
                            process.env.forcedReasoning = 'true';
                        }

                        // Strict Mode Validation
                        if (!isBypass && mode === 'Flow' && formattedLevel === 'xHigh') {
                            setMessages(prev => {
                                setCompletedIndex(prev.length + 1);
                                return [...prev, { id: Date.now(), role: 'system', text: `✦ RESTRICTED\n⠀⠀└─"${formattedLevel}" is restricted in Flow mode. Switch to Flux to enable Higher Thinking Levels.\n⠀${forceMsg}.`, isMeta: true }];
                            });
                        } else {
                            setThinkingLevel(formattedLevel);
                            const s = emojiSpace(1);
                            setMessages(prev => { setCompletedIndex(prev.length + 1); return [...prev, { id: Date.now(), role: 'system', text: `✦ ${aiProvider}\n⠀⠀└─ ${activeModel}.\n⠀⠀└─ Thinking Level: ${formattedLevel}.\n${forceMsg} ⠀`, isMeta: true }]; }); // isBypass ? `⠀⠀⠀⠀└─ bypassed.\n⠀` : ''
                        }
                    } else {
                        setActiveView('thinking');
                    }
                    break;
                }
                case '/model': {
                    if (parts[1]) {
                        const rawArgs = parts.slice(1);
                        let isMultimodalFlag = false;
                        let invalidFlagError = false;

                        const filteredParts = [];
                        for (const arg of rawArgs) {
                            if (arg === '--multimodal' || arg === '-m') {
                                if (aiProvider === 'Ollama') {
                                    isMultimodalFlag = true;
                                } else {
                                    invalidFlagError = true;
                                }
                            } else {
                                filteredParts.push(arg);
                            }
                        }

                        const mod = filteredParts.join(' ');

                        if (aiProvider === 'Ollama') {
                            setOllamaMultimodal(isMultimodalFlag);
                        }

                        if (invalidFlagError) {
                            setMessages(prev => {
                                setCompletedIndex(prev.length + 1);
                                return [...prev, {
                                    id: Date.now(),
                                    role: 'system',
                                    text: `✦ ERROR\n⠀⠀└─ Flag --multimodal / -m is unavailable for provider "${aiProvider}". Flag ignored.\n⠀`,
                                    isMeta: true
                                }];
                            });
                        }

                        if (mod) {
                            const freeDefault = getDefaultModel('Google', 'Free');
                            const paidDefault = getDefaultModel('Google', 'Paid');
                            if (mod === freeDefault && apiTier !== 'Free' && aiProvider === 'Google' && false) {
                                setMessages(prev => {
                                    setCompletedIndex(prev.length + 1);
                                    return [...prev, {
                                        id: Date.now(),
                                        role: 'system',
                                        text: `**[ACCESS DENIED]** ${freeDefault} is restricted to the Free API tier. Automatically switching you to **${paidDefault}** for optimal performance.`,
                                        isMeta: true
                                    }];
                                });
                                setActiveModel(paidDefault);
                            } else {
                                setActiveModel(mod);
                                setMessages(prev => { setCompletedIndex(prev.length + 1); return [...prev, { id: Date.now(), role: 'system', text: `✦ ${aiProvider}\n⠀⠀└─ ${mod}\n⠀⠀└─ Thinking Level: ${thinkingLevel}${aiProvider === 'Ollama' ? `\n⠀⠀└─ Multimodal: ${isMultimodalFlag ? 'ON' : 'OFF'}` : ''}\n⠀`, isMeta: true }]; });
                            }
                        }
                    } else {
                        setActiveView('model');
                    }
                    break;
                }
                case '/wildcard-tooling': {
                    setWildcardTooling(prev => {
                        const next = !prev;
                        setMessages(m => { setCompletedIndex(m.length + 1); return [...m, { id: Date.now(), role: 'system', text: `✦ Wildcard Tooling:\n⠀⠀└─ Status: ${next ? 'Enabled' : 'Disabled'}\n⠀`, isMeta: true }]; });
                        return next;
                    });
                    break;
                }
                case '/settings': {
                    setActiveView('settings');
                    break;
                }
                case '/provider':
                case '/providers': {
                    setProviderReturnView('chat');
                    setActiveView('selectProvider');
                    break;
                }
                case '/theme': {
                    setActiveView('theme');
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
                    // Use first user prompt as default title instead of time-based session name
                    let promptDefault = undefined;
                    const firstUserMsg = messages.find(m => m.role === 'user');
                    if (firstUserMsg && firstUserMsg.text) {
                        const text = firstUserMsg.text.replace(/\s*\n+\s*\[Prompted on:.*?\]/g, '').trim();
                        const words = text.split(/\s+/);
                        let truncatedPrompt = undefined;
                        if (words.length > 7) {
                            truncatedPrompt = words.slice(0, 7).join(' ') + '...';
                        } else if (text.length > 45) {
                            truncatedPrompt = text.substring(0, 45).trimEnd() + '...';
                        } else {
                            truncatedPrompt = text;
                        }
                        promptDefault = truncatedPrompt;
                    }
                    const name = parts.slice(1).join(' ') || promptDefault || `Session ${new Date().toLocaleTimeString()}`;
                    saveChat(chatId, name, messages);
                    setMessages(prev => { setCompletedIndex(prev.length + 1); return [...prev, { id: Date.now(), role: 'system', text: `✦ Saved\n⠀⠀└─ "${name}" (ID: ${chatId})\n⠀`, isMeta: true }]; });
                    break;
                }
                case '/export': {
                    const runExport = async () => {
                        try {
                            const result = await handleExport(parts, { chatId, messages });
                            setMessages(prev => {
                                setCompletedIndex(prev.length + 1);
                                return [...prev, {
                                    id: Date.now(),
                                    role: 'system',
                                    text: result.message,
                                    isMeta: true
                                }];
                            });
                        } catch (err) {
                            setMessages(prev => {
                                setCompletedIndex(prev.length + 1);
                                return [...prev, {
                                    id: Date.now(),
                                    role: 'system',
                                    text: `[EXPORT ERROR] Failed to export: ${err.message}`,
                                    isMeta: true
                                }];
                            });
                        }
                    };
                    runExport();
                    break;
                }
                case '/chats': {
                    const run = async () => {
                        const history = await loadHistory();
                        const list = Object.entries(history)
                            .sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0))
                            .map(([id, info]) => `⠀⠀└─ ${id}: ${info.name}${id === chatId ? ' (current)' : ''}`)
                            .join('\n');
                        setMessages(prev => {
                            setCompletedIndex(prev.length + 1);
                            return [...prev, { id: Date.now(), role: 'system', text: `✦ Saved Chats:\n${list || '⠀⠀└─ No saved chats found.'}\n⠀`, isMeta: true }];
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
                                return [...prev, { id: Date.now(), role: 'system', text: '✦ Initiating reset...\n⠀⠀└─ Clearing logs, secrets, and settings.\n⠀', isMeta: true }];
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
                                return [...prev, { id: Date.now(), role: 'system', text: `✦ ERROR\n⠀⠀└─ Failed to clear data: ${err.message}.\n⠀` }];
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
                        return [...prev, { id: Date.now(), role: 'system', text: `✦ Opening Changelog\n⠀⠀└─ ${CHANGELOG_URL}.`, isMeta: true }];
                    });
                    break;
                }
                case '/docs': {
                    if (!DOCS_URL) {
                        setMessages(prev => {
                            setCompletedIndex(prev.length + 1);
                            return [...prev, { id: Date.now(), role: 'system', text: `✦ ERROR\n⠀⠀└─ Documentation URL is not configured.`, isMeta: true }];
                        });
                        break;
                    }
                    const platform = process.platform;
                    const command = platform === 'win32' ? 'start' : platform === 'darwin' ? 'open' : 'xdg-open';
                    exec(`${command} ${DOCS_URL}`);
                    setMessages(prev => {
                        setCompletedIndex(prev.length + 1);
                        return [...prev, { id: Date.now(), role: 'system', text: `✦ Opening Documentation\n⠀⠀└─ ${DOCS_URL}.\n⠀`, isMeta: true }];
                    });
                    break;
                }
                case '/budget': {
                    const sub = parts[1]?.toLowerCase();
                    if (sub === 'set') {
                        setBudgetReturnView('chat');
                        setActiveView('budgetTypeSelect');
                    } else if (sub === 'view') {
                        const run = async () => {
                            const usage = await getDailyUsage();
                            const mUsage = await getMonthlyUsage();
                            const cUsage = await getCustomPeriodUsage(quotas.resetDay || 1);
                            setDailyUsage(usage);
                            setMonthlyUsage(mUsage);
                            setCustomPeriodUsage(cUsage);
                            setActiveView('budgetView');
                        };
                        run();
                    } else if (sub === 'reset') {
                        const defaultQuotas = {
                            limitMode: 'Daily',
                            agentLimit: 99999999,
                            tokenLimit: 99999999999999,
                            backgroundLimit: 999999,
                            searchLimit: 100,
                            customModelId: '',
                            customLimit: 0,
                            providerBudgets: {},
                            providerTiers: {
                                Google: 'Free',
                                DeepSeek: 'Free',
                                NVIDIA: 'Free',
                                OpenRouter: 'Free',
                                CrofAI: 'Free',
                                InferX: 'Free',
                                SenseNova: 'Free'
                            }
                        };
                        setQuotas(defaultQuotas);
                        setApiTier('Free');
                        saveSettings({ apiTier: 'Free', quotas: defaultQuotas });
                        setMessages(prev => {
                            setCompletedIndex(prev.length + 1);
                            return [...prev, { id: Date.now(), role: 'system', text: `✦ Budgets reset successfully.\n⠀`, isMeta: true }];
                        });
                    } else {
                        setMessages(prev => {
                            setCompletedIndex(prev.length + 1);
                            return [...prev, { id: Date.now(), role: 'system', text: `✦ ERROR\n⠀⠀└─ Usage: /budget <Set|View|Reset>.\n⠀`, isMeta: true }];
                        });
                    }
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
                        return [...prev, { id: Date.now(), role: 'system', text: `✨ GEMINI CLI\n⠀⠀└─ ${randomQuote}\n⠀` }];
                    });
                    setInput('');
                    break;
                }
                case '/compress': {
                    setInput('');
                    const cleanCount = messages.filter(m => (m.role === 'user' || m.role === 'agent' || m.role === 'system') && !String(m.id).startsWith('welcome') && !m.isMeta).length;
                    const tokens = sessionStats?.tokens || 0;
                    if (cleanCount < 64 || tokens < 16384) {
                        const s = emojiSpace(2);
                        setMessages(prev => {
                            setCompletedIndex(prev.length + 1);
                            return [...prev, {
                                id: Date.now(),
                                role: 'system',
                                text: `✦ Compression skipped\n⠀⠀└─ History requires at least 64 messages and 16k tokens\n⠀⠀  └─ Current: ${cleanCount}/64 msgs, ${tokens}/16384 tokens.\n⠀`,
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
                            return [...prev, { id: Date.now(), role: 'system', text: `✦ Compacting session history...`, isMeta: true }];
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
                                        text: `⠀⠀└─ Chat History compacted saving tokens.\n⠀`,
                                        isMeta: true
                                    }];
                                    setCompletedIndex(finalMsgs.length);
                                    return finalMsgs;
                                });
                            } else {
                                setMessages(prev => {
                                    setCompletedIndex(prev.length + 1);
                                    return [...prev, { id: Date.now(), role: 'system', text: '⠀⠀└─ Compaction failed.\n⠀', isMeta: true }];
                                });
                            }
                        } catch (err) {
                            setMessages(prev => {
                                setCompletedIndex(prev.length + 1);
                                return [...prev, { id: Date.now(), role: 'system', text: `⠀⠀└─ Error during compaction: ${err.message}\n⠀`, isMeta: true }];
                            });
                        } finally {
                            setIsCompressing(false);
                        }
                    };
                    runCompress();
                    break;
                }
                case '/truncate': {
                    setInput('');
                    let truncatedCount = 0;
                    setMessages(prev => {
                        const updatedMessages = prev.map(m => {
                            const fullTextStr = m.fullText || m.text || '';
                            if (!fullTextStr.startsWith('[TOOL RESULT]:')) {
                                return m;
                            }
                            if (fullTextStr.startsWith('[TOOL RESULT]: ERROR') || fullTextStr.startsWith('[TOOL RESULT]: DENIED') || fullTextStr.includes('...SUCCESS Results Truncated by System on User Command')) {
                                return m;
                            }
                            truncatedCount++;
                            if (fullTextStr.startsWith('[TOOL RESULT]: SUCCESS')) {
                                return {
                                    ...m,
                                    fullText: '[TOOL RESULT]: SUCCESS: ...SUCCESS Results Truncated by System on User Command'
                                };
                            }
                            return {
                                ...m,
                                fullText: '[TOOL RESULT]: ...SUCCESS Results Truncated by System on User Command'
                            };
                        });

                        const finalMsgs = [...updatedMessages, {
                            id: Date.now(),
                            role: 'system',
                            text: `✦ Tool Truncation...\n⠀⠀└─ Truncated ${truncatedCount} tool result(s).\n⠀`,
                            isMeta: true
                        }];
                        saveChat(chatId, null, finalMsgs);
                        setCompletedIndex(finalMsgs.length);
                        return finalMsgs;
                    });
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
                    setMessages(prev => { setCompletedIndex(prev.length + 1); return [...prev, { id: Date.now(), role: 'system', text: `✦ RESTRICTED\n⠀⠀└─ '/btw' only available when agent is working\n⠀`, isMeta: true }]; });
                    break;
                }
                default:
                    setMessages(prev => { setCompletedIndex(prev.length + 1); return [...prev, { id: Date.now(), role: 'system', text: `✦ ERROR\n⠀⠀└─ Unknown command: '${cmd}'\n⠀`, isMeta: true }]; });
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
                let didAppendCancel = false;
                const appendCancelMessage = () => {
                    if (didAppendCancel) return;
                    didAppendCancel = true;
                    setMessages(prev => {
                        const lastMsg = prev[prev.length - 1];
                        if (lastMsg && lastMsg.text && lastMsg.text.includes('Request Cancelled')) {
                            return prev;
                        }
                        const updatedPrev = prev.map(m => m.isStreaming ? { ...m, isStreaming: false } : m);
                        const newMsgs = [...updatedPrev, {
                            id: 'cancel-' + Date.now(),
                            role: 'agent',
                            text: '\n\n\u001b[33mⓘ Request Cancelled\u001b[0m',
                            isMeta: false
                        }];
                        setCompletedIndex(newMsgs.length);
                        return newMsgs;
                    });
                };

                let hasFiredJanitor = false;
                setIsProcessing(true);
                setLastChunkTime(Date.now());
                setIsExpanded(false);
                let apiStart = Date.now();
                let isFirstPacket = true;
                try {
                    const rawHistory = [...messages, userMessage]
                        .filter(m =>
                            m.role !== 'think' &&
                            !m.isVisualFeedback &&
                            !m.isMeta &&
                            !m.isTerminalRecord &&
                            !(m.text && m.text.includes('[TERMINAL_RECORD]')) &&
                            !String(m.id).startsWith('welcome')
                        );

                    const cleanHistoryForAI = [];
                    const preprocessed = rawHistory.map((m, idx) => {
                        let text = m.fullText || m.text || '';
                        if (m.role === 'user' && idx < rawHistory.length - 1) {
                            if (text.includes('**CONTEXT SUMMARY OF PREVIOUS TURNS')) {
                                const summaryIndex = text.indexOf('**CONTEXT SUMMARY OF PREVIOUS TURNS');
                                if (summaryIndex !== -1) {
                                    const prefix = text.substring(0, summaryIndex);
                                    const metadataIndex = prefix.lastIndexOf('[SYSTEM METADATA]');
                                    if (metadataIndex !== -1) {
                                        text = text.substring(metadataIndex).trim();
                                    } else {
                                        text = text.substring(summaryIndex).trim();
                                    }
                                }
                            } else {
                                const userIndex = text.lastIndexOf('[USER]');
                                const userPromptIndex = text.lastIndexOf('[USER PROMPT]');
                                if (userIndex !== -1) {
                                    text = text.substring(userIndex + 6).trim();
                                } else if (userPromptIndex !== -1) {
                                    text = text.substring(userPromptIndex).trim();
                                }
                            }
                        }
                        return { ...m, text };
                    });

                    let i = 0;
                    while (i < preprocessed.length) {
                        const msg = preprocessed[i];
                        if (msg.role === 'user') {
                            cleanHistoryForAI.push(msg);
                            i++;
                        } else {
                            const turnMessages = [];
                            while (i < preprocessed.length && preprocessed[i].role !== 'user') {
                                turnMessages.push(preprocessed[i]);
                                i++;
                            }

                            let turnAgentParts = [];
                            let turnSystemResults = [];
                            let turnBinaryPart = null;
                            let isContinuingModelTurn = false;

                            const flushTurn = () => {
                                if (turnAgentParts.length > 0) {
                                    cleanHistoryForAI.push({
                                        role: 'agent',
                                        text: turnAgentParts.join('\n').trim()
                                    });
                                    turnAgentParts = [];
                                }
                                if (turnSystemResults.length > 0) {
                                    cleanHistoryForAI.push({
                                        role: 'system',
                                        text: turnSystemResults.join('\n\n'),
                                        ...(turnBinaryPart ? { binaryPart: turnBinaryPart } : {})
                                    });
                                    turnSystemResults = [];
                                    turnBinaryPart = null;
                                }
                                isContinuingModelTurn = false;
                            };

                            turnMessages.forEach(tm => {
                                const isResult = tm.role === 'system' && (
                                    tm.text?.startsWith('[TOOL RESULT]') ||
                                    tm.text?.startsWith('SUCCESS:') ||
                                    tm.text?.startsWith('ERROR:') ||
                                    tm.fullText?.startsWith('[TOOL RESULT]') ||
                                    tm.fullText?.startsWith('SUCCESS:') ||
                                    tm.fullText?.startsWith('ERROR:')
                                );
                                const rawOriginalText = tm.fullText || tm.text || '';
                                const rawTrimmedText = rawOriginalText.trim();
                                if (!rawTrimmedText && !tm.binaryPart) return;

                                if (isResult) {
                                    const emitText = !rawTrimmedText.startsWith('[TOOL RESULT]') ? `[TOOL RESULT]: ${rawTrimmedText}` : rawTrimmedText;
                                    turnSystemResults.push(emitText);
                                    if (tm.binaryPart) {
                                        turnBinaryPart = tm.binaryPart;
                                    }
                                } else if (tm.role === 'agent') {
                                    if (!isContinuingModelTurn && turnSystemResults.length > 0) {
                                        flushTurn();
                                    }

                                    const endsWithNewline = rawOriginalText.endsWith('\n');
                                    const hasToolCall = rawTrimmedText.toLowerCase().includes('tool:functions.') || rawTrimmedText.toLowerCase().includes('agent:generalist.');

                                    turnAgentParts.push(rawTrimmedText);
                                    if (hasToolCall && endsWithNewline) {
                                        isContinuingModelTurn = true;
                                    } else {
                                        isContinuingModelTurn = false;
                                    }
                                }
                            });

                            flushTurn();
                        }
                    }
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
                            isPlayground: !!parsedArgs.playground,
                            aiProvider,
                            apiKey,
                            apiTier,
                            wildcardTooling,
                            cols: terminalSize.columns - 6,
                            rows: 30,
                            onTokenChunk: (chunkText, wordCount) => {
                                const now = Date.now();
                                setLastChunkTime(now);
                                if (typeof wordCount === 'number') {
                                    chunkWordCountRef.current = wordCount;
                                    const stats = streamingWordStatsRef.current;
                                    if (!stats.startTime) {
                                        stats.startTime = now;
                                        stats.totalWords = 0;
                                        stats.chunks = [];
                                    }
                                    stats.totalWords += wordCount;
                                    if (!stats.chunks) stats.chunks = [];
                                    stats.chunks.push({ time: now, words: wordCount });

                                    // Retain only chunks from the last ~400ms (matches 350ms API flush window)
                                    const windowMs = 400;
                                    const cutoff = now - windowMs;
                                    stats.chunks = stats.chunks.filter(c => c.time >= cutoff);

                                    if (stats.chunks.length > 0) {
                                        const windowWords = stats.chunks.reduce((acc, c) => acc + c.words, 0);
                                        const oldestTime = stats.chunks[0].time;
                                        const timeSpanSec = Math.max(0.4, (now - oldestTime) / 1000);
                                        stats.wps = Math.round((windowWords / timeSpanSec) * 10) / 10;
                                    }
                                }
                            },
                            onVisualFeedback: (content) => {
                                setMessages(prev => {
                                    const updatedPrev = prev.map(m => m.isStreaming ? { ...m, isStreaming: false } : m);
                                    return [...updatedPrev, { id: 'visual-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9), role: 'system', text: content, isVisualFeedback: true }];
                                });
                            },
                            onSubagentUpdate: () => {
                                setActiveSubagents(subagentProgress.map(sa => ({ ...sa })));
                            },
                            onExecStart: (cmd) => {
                                flushTypewriterNow();
                                commitActiveStreamingMessage();
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
                                    const updatedPrev = prev.map(m => m.isStreaming ? { ...m, isStreaming: false } : m);
                                    const newMsgs = [...updatedPrev, { id: 'term-' + Date.now(), role: 'system', text: finalStatus, isTerminalRecord: true }];
                                    setCompletedIndex(newMsgs.length);
                                    return newMsgs;
                                });
                                setActiveCommand(null);
                                setIsTerminalFocused(false);
                                setExecOutput('');
                                // Explicitly nullify refs immediately (not relying on useEffect mirroring)
                                activeCommandRef.current = null;
                                execOutputRef.current = '';
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
                                flushTypewriterNow();
                                commitActiveStreamingMessage();
                                return new Promise((resolve) => {
                                    let resolvedFlag = false;
                                    setPendingAsk({
                                        question,
                                        options,
                                        resolve: (val) => {
                                            if (resolvedFlag) return;
                                            resolvedFlag = true;
                                            setMessages(prev => {
                                                const hasAskRecord = prev.some(m => m.isAskRecord && m.text?.includes(`Selection: ${val}`));
                                                if (hasAskRecord) return prev;
                                                const newMsgs = [
                                                    ...prev,
                                                    {
                                                        id: 'ask-' + Date.now(),
                                                        role: 'system',
                                                        text: `💬 **Ask User**\nQuestion: ${question}\nSelection: ${val}`,
                                                        isAskRecord: true
                                                    }
                                                ];
                                                setCompletedIndex(newMsgs.length);
                                                return newMsgs;
                                            });
                                            resolve(val);
                                        }
                                    });
                                    setActiveView('ask');
                                });
                            },
                            onUsage: (usage) => {
                                const total = usage.totalTokenCount || 0;
                                const cached = usage.cachedContentTokenCount || 0;
                                const candidates = usage.candidatesTokenCount || 0;
                                setSessionStats({ tokens: total });
                                setSessionTotalTokens(prev => prev + total);
                                if (cached > 0) {
                                    setSessionTotalCachedTokens(prev => prev + cached);
                                }
                                if (candidates > 0) {
                                    setSessionTotalCandidateTokens(prev => prev + candidates);
                                }
                                setSessionAgentCalls(prev => prev + 1);
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
                        // fs.appendFileSync("DEBUG.txt", `${JSON.stringify(packet)}\n\n`);
                        await new Promise(resolve => setTimeout(resolve, 3));

                        if (packet.type === 'text') {
                            setLastChunkTime(Date.now());
                        }

                        if (isFirstPacket && packet.type === 'text') {
                            apiStart = Date.now();
                            isFirstPacket = false;
                            if (systemSettings.progressiveRendering) {
                                startTypewriter();
                            }
                        }
                        if (packet.type === 'status') {

                            if (!packet.content?.includes('[start]')) {
                                setStatusText(packet.content);
                            }

                            if (packet.content?.includes('[start]')) {
                                clearInterval(interval_for_timer);
                                setActiveTime(0);
                                interval_for_timer = setInterval(() => {
                                    setActiveTime(prev => prev + 1);
                                }, 1000);
                            } else if (packet.content?.includes('[end]')) {
                                setActiveTime(0);
                                clearInterval(interval_for_timer);
                            }

                            if (isBridgeConnected()) {
                                sendStatus(packet.content);
                            }
                            if (packet.content === 'Request Cancelled') {
                                // Drain queued tokens into the current message so partial response is preserved
                                flushTypewriterNow();
                                commitActiveStreamingMessage();
                                appendCancelMessage();
                            }
                            continue;
                        }
                        if (packet.type === 'status_history') {
                            setStatusText(packet.content);
                            if (isBridgeConnected()) {
                                sendStatus(packet.content);
                            }
                            setMessages(prev => [...prev, { id: 'condense-' + Date.now(), role: 'system', text: `✦ ${packet.content}\n⠀`, isMeta: true }]);
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
                            // Flush any queued typewriter text before resetting
                            flushTypewriterNow();
                            // Keep the tick alive — it will resume automatically when a new message ref is set

                            currentThinkId = null;
                            currentAgentId = null;
                            inThinkMode = false;
                            inCodeBlock = false;
                            inToolCall = false;
                            toolCallEncounteredInTurn = false;
                            thinkConsumedInTurn = false;
                            setMessages(prev => {
                                const newMsgs = prev.map(m => {
                                    if (m.isStreaming) {
                                        // V8 ConsString memory flush: Sever fragmented string trees immediately mid-stream
                                        const flatText = m.text ? flattenString(m.text) : m.text;
                                        const flatFullText = m.fullText ? flattenString(m.fullText) : m.fullText;
                                        return { ...m, isStreaming: false, text: flatText, fullText: flatFullText };
                                    }
                                    return m;
                                });
                                setCompletedIndex(newMsgs.length);
                                return newMsgs;
                            });

                            clearBlocksCache();

                            if (global.gc) {
                                for (let i = 0; i < 2; i++) {
                                    global.gc();
                                    // Wait for the next tick of the event loop
                                    await new Promise(resolve => setImmediate(resolve));
                                }
                                lastGCTimeRef.current = Date.now();
                            }

                            continue;
                        }
                        if (packet.type === 'interactive_turn_finished') {
                            setIsProcessing(false);
                            setActiveTime(0);
                            clearInterval(interval_for_timer);
                            if (isBridgeConnected()) {
                                sendStatus(null);
                            }
                            hasFiredJanitor = true;

                            clearBlocksCache();

                            if (systemSettings?.autoTruncateResults) {
                                setMessages(prev => {
                                    const updatedMessages = prev.map(m => {
                                        const fullTextStr = m.fullText || m.text || '';
                                        if (!fullTextStr.startsWith('[TOOL RESULT]:')) {
                                            return m;
                                        }
                                        if (fullTextStr.startsWith('[TOOL RESULT]: ERROR') || fullTextStr.startsWith('[TOOL RESULT]: DENIED') || fullTextStr.includes('...SUCCESS Results Truncated by System on User Command')) {
                                            return m;
                                        }
                                        if (fullTextStr.startsWith('[TOOL RESULT]: SUCCESS')) {
                                            return {
                                                ...m,
                                                fullText: '[TOOL RESULT]: SUCCESS: ...SUCCESS Results Truncated by System on User Command'
                                            };
                                        }
                                        return {
                                            ...m,
                                            fullText: '[TOOL RESULT]: ...SUCCESS Results Truncated by System on User Command'
                                        };
                                    });
                                    saveChat(chatId, null, updatedMessages);
                                    setCompletedIndex(updatedMessages.length);
                                    return updatedMessages;
                                });
                            }

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

                            // if (global.gc) {
                            //     try {
                            //         for (let i = 0; i < 5; i++) {
                            //             global.gc();
                            //             // Wait for the next tick of the event loop
                            //             await new Promise(resolve => setImmediate(resolve));
                            //         }
                            //         lastGCTime = Date.now();
                            //     } catch (e) { }
                            // }

                            continue;
                        }
                        if (packet.type === 'visual_feedback') {
                            // Flush typewriter queue so queued text appears before the feedback
                            flushTypewriterNow();
                            commitActiveStreamingMessage();
                            setMessages(prev => {
                                const newMsgs = [...prev, {
                                    id: 'feedback-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9),
                                    role: 'system',
                                    text: flattenString(packet.content),
                                    isVisualFeedback: true
                                }];
                                setCompletedIndex(newMsgs.length);
                                return newMsgs;
                            });
                            continue;
                        }
                        if (packet.type === 'exec_start') {
                            flushTypewriterNow();
                            commitActiveStreamingMessage();
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
                            commitActiveStreamingMessage();
                            setMessages(prev => {
                                const newMsgs = [...prev, {
                                    id: 'tool-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
                                    role: 'system',
                                    text: flattenString(packet.content),
                                    fullText: flattenString(packet.aiContent), // Preserve raw data for next turn
                                    binaryPart: packet.binaryPart, // v1.5.0 Multimodal Support
                                    toolName: packet.toolName
                                }];
                                setCompletedIndex(newMsgs.length);
                                return newMsgs;
                            });

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
                                addToUsage('linesAdded', verifiedLinesCount);
                                addToUsage('linesRemoved', oldLinesCount);
                            }

                            continue;
                        }

                        let chunkText = packet.content;
                        if (packet.type === 'text' && chunkText.includes('Request Cancelled')) {
                            if (global.gc) {
                                for (let i = 0; i < 3; i++) {
                                    global.gc();
                                    // Wait for the next tick of the event loop
                                    await new Promise(resolve => setImmediate(resolve));
                                }
                                lastGCTimeRef.current = Date.now();
                            }
                            continue;
                        }
                        const chunkLower = chunkText.toLowerCase();

                        // [CONTEXT TRACKING] Update state based on chunk content
                        if (chunkText.includes('```')) inCodeBlock = !inCodeBlock;

                        if (chunkLower.includes('tool:functions.') || chunkLower.includes('agent:generalist.')) {
                            inToolCall = true;
                            // [HARDENING] Reset balance and look for outer bracket in context
                            toolCallBalance = 0;
                            inToolCallString = null;
                            if (chunkText.includes('[tool:functions.') || chunkText.includes('[agent:generalist.')) toolCallBalance = 0; // The '[' will be counted in the loop
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

                        // 1. Detect transition to THINK mode (Handles <think>, <thought>, <|channel>thought, etc.)
                        const RE_STREAM_THINK_OPEN = /(?:<(think|thought|thoughts)[^>]*>|<\|channel>thought|\[(think|thought|thoughts)\])/i;
                        const RE_STREAM_THINK_CLOSE = /(?:<\/(think|thought|thoughts)>|<channel\|>|\[\/(think|thought|thoughts)\])/i;
                        const RE_STREAM_ALL_THINK_TAGS = /(?:<\/?(think|thought|thoughts)[^>]*>|<\|channel>thought|<channel\|>|\[\/?(think|thought|thoughts)\])/gi;

                        const canThink = !inThinkMode && !inCodeBlock && !inToolCall && !thinkConsumedInTurn;
                        const curAgentText = (activeStreamingMsgRef.current?.role === 'agent') ? (activeStreamingMsgRef.current.text || '') : '';
                        const combinedText = curAgentText + chunkText;

                        if (canThink && (RE_STREAM_THINK_OPEN.test(chunkText) || RE_STREAM_THINK_OPEN.test(combinedText))) {
                            const fullTextToProcess = RE_STREAM_THINK_OPEN.test(chunkText) ? chunkText : combinedText;
                            const isCombined = (fullTextToProcess === combinedText && curAgentText.length > 0);
                            const match = fullTextToProcess.match(RE_STREAM_THINK_OPEN);
                            const tagIndex = match.index;
                            const tagLen = match[0].length;
                            const beforeText = fullTextToProcess.substring(0, tagIndex);
                            const afterText = fullTextToProcess.substring(tagIndex + tagLen);

                            if (beforeText && beforeText.trim()) {
                                if (isCombined && activeStreamingMsgRef.current) {
                                    activeStreamingMsgRef.current.text = flattenString(beforeText);
                                } else {
                                    if (!activeStreamingMsgRef.current || activeStreamingMsgRef.current.role !== 'agent') {
                                        activeStreamingMsgRef.current = { id: 'agent-' + Date.now(), role: 'agent', text: flattenString(beforeText), isStreaming: true };
                                    } else {
                                        activeStreamingMsgRef.current.text = flattenString(activeStreamingMsgRef.current.text + beforeText);
                                    }
                                }
                                flushTypewriterNow();
                                commitActiveStreamingMessage();
                            } else {
                                flushTypewriterNow();
                                activeStreamingMsgRef.current = null;
                            }

                            inThinkMode = true;
                            thinkConsumedInTurn = true;
                            currentThinkId = 'think-' + Date.now();
                            activeStreamingMsgRef.current = { id: currentThinkId, role: 'think', text: '', isStreaming: true, startTime: Date.now() };

                            // If this chunk also contains the closing tag
                            if (RE_STREAM_THINK_CLOSE.test(afterText)) {
                                const closeMatch = afterText.match(RE_STREAM_THINK_CLOSE);
                                const closeTagIndex = closeMatch.index;
                                const closeTagLen = closeMatch[0].length;
                                const rawThinkContent = afterText.substring(0, closeTagIndex);
                                const thinkContent = rawThinkContent.replace(RE_STREAM_ALL_THINK_TAGS, '').replace(/^\r?\n+/, '').replace(/\r?\n+$/, '');
                                const agentContent = afterText.substring(closeTagIndex + closeTagLen).replace(RE_STREAM_ALL_THINK_TAGS, '');

                                activeStreamingMsgRef.current.text = flattenString(thinkContent);
                                const startTime = activeStreamingMsgRef.current.startTime || Date.now();
                                activeStreamingMsgRef.current.duration = Date.now() - startTime;
                                commitActiveStreamingMessage();

                                inThinkMode = false;
                                currentAgentId = 'agent-' + Date.now();
                                activeStreamingMsgRef.current = { id: currentAgentId, role: 'agent', text: '', isStreaming: true };
                                if (agentContent) {
                                    appendStreamText(agentContent);
                                }
                            } else {
                                let thinkStartText = afterText.replace(RE_STREAM_ALL_THINK_TAGS, '').replace(/^\r?\n+/, '');
                                if (thinkStartText) {
                                    appendStreamText(thinkStartText);
                                }
                            }
                            continue;
                        }

                        // 2. Aggressive Transition Analysis (Handles closing think tags)
                        if (RE_STREAM_THINK_CLOSE.test(chunkText) && activeStreamingMsgRef.current?.role === 'think') {
                            const closeMatch = chunkText.match(RE_STREAM_THINK_CLOSE);
                            const closeTagIndex = closeMatch.index;
                            const closeTagLen = closeMatch[0].length;
                            const thinkPart = chunkText.substring(0, closeTagIndex).replace(RE_STREAM_ALL_THINK_TAGS, '');
                            const agentPart = chunkText.substring(closeTagIndex + closeTagLen).replace(RE_STREAM_ALL_THINK_TAGS, '');

                            // Flush queue FIRST so queued tokens appear before this chunk's tail text
                            flushTypewriterNow();
                            activeStreamingMsgRef.current.text = flattenString(activeStreamingMsgRef.current.text + thinkPart);
                            const startTime = activeStreamingMsgRef.current.startTime || Date.now();
                            activeStreamingMsgRef.current.duration = Date.now() - startTime;

                            commitActiveStreamingMessage();

                            inThinkMode = false;
                            currentAgentId = 'agent-' + Date.now();
                            activeStreamingMsgRef.current = { id: currentAgentId, role: 'agent', text: '', isStreaming: true };
                            if (agentPart) {
                                appendStreamText(agentPart);
                            }
                            continue;
                        }

                        // 3. Append to target role with Leak Protection
                        if (inThinkMode && activeStreamingMsgRef.current?.role === 'think') {
                            // Flush queue FIRST so ref.text is complete before deriving thinkPart
                            flushTypewriterNow();
                            const newText = activeStreamingMsgRef.current.text + chunkText;
                            if (RE_STREAM_THINK_CLOSE.test(newText)) {
                                const closeMatch = newText.match(RE_STREAM_THINK_CLOSE);
                                const closeTagIndex = closeMatch.index;
                                const closeTagLen = closeMatch[0].length;
                                const thinkPart = newText.substring(0, closeTagIndex).replace(RE_STREAM_ALL_THINK_TAGS, '');
                                const agentPart = newText.substring(closeTagIndex + closeTagLen).replace(RE_STREAM_ALL_THINK_TAGS, '');

                                activeStreamingMsgRef.current.text = flattenString(thinkPart);
                                const startTime = activeStreamingMsgRef.current.startTime || Date.now();
                                activeStreamingMsgRef.current.duration = Date.now() - startTime;

                                commitActiveStreamingMessage();

                                inThinkMode = false;
                                currentAgentId = 'agent-' + Date.now();
                                activeStreamingMsgRef.current = { id: currentAgentId, role: 'agent', text: '', isStreaming: true };
                                if (agentPart) {
                                    appendStreamText(agentPart);
                                }
                            } else {
                                appendStreamText(chunkText);
                            }
                        } else if (!inThinkMode) {
                            // [SIGNAL MONITOR] Mark turn state if tool call encountered
                            const chunkLower = chunkText.toLowerCase();
                            if (!toolCallEncounteredInTurn && (chunkLower.includes('tool:functions.') || chunkLower.includes('agent:generalist.'))) {
                                toolCallEncounteredInTurn = true;
                            }

                            if (!activeStreamingMsgRef.current || activeStreamingMsgRef.current.role !== 'agent') {
                                currentAgentId = 'agent-' + Date.now();
                                // Set initial text directly (first chunk should always appear instantly)
                                activeStreamingMsgRef.current = { id: currentAgentId, role: 'agent', text: flattenString(chunkText), isStreaming: true };
                                forceRender();
                            } else {
                                // Queue subsequent chunks (instant when OFF, progressive when ON)
                                appendStreamText(chunkText);
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
                    // Inject workedDuration BEFORE commit so it's parsed from the very first render
                    const totalDuration = Date.now() - apiStart;
                    if (activeStreamingMsgRef.current) {
                        activeStreamingMsgRef.current.workedDuration = totalDuration;
                    }

                    // Let typewriter finish naturally — no rush, nothing else needs to render
                    if (typewriterTickRef.current) {
                        await awaitTypewriter();
                        clearInterval(typewriterTickRef.current);
                        typewriterTickRef.current = null;
                    }

                    setIsProcessing(false);
                    setStatusText(null);
                    setActiveTime(0);
                    clearInterval(interval_for_timer);

                    commitActiveStreamingMessage();

                    if (didSignalTerminationRef.current) {
                        appendCancelMessage();
                    }

                    clearBlocksCache();

                    // Add this aggressive double-GC cleanup specifically for end-of-stream
                    if (global.gc) {
                        try {
                            for (let i = 0; i < 3; i++) {
                                global.gc();
                                // Wait for the next tick of the event loop
                                await new Promise(resolve => setImmediate(resolve));
                            }
                            lastGCTimeRef.current = Date.now();
                        } catch (e) { }
                    }

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

                            // Flatten final strings to free V8 ConsString memory permanently
                            if (updated.text) {
                                updated.text = (' ' + updated.text).slice(1);
                            }

                            if (!foundLastAgent && updated.role === 'agent') {
                                foundLastAgent = true;
                                updated = { ...updated, workedDuration: totalDuration };
                            }
                            return updated;
                        }).reverse();

                        // Fallback safety: If no agent message was created during turn but a think message has content,
                        // ensure an agent message exists with the response content so saveChat preserves it across turns.
                        const hasAgentMsg = newMsgs.some(m => m.role === 'agent' && m.text?.trim().length > 0);
                        if (!hasAgentMsg) {
                            const lastThinkMsg = [...newMsgs].reverse().find(m => m.role === 'think' && m.text?.trim().length > 0);
                            if (lastThinkMsg) {
                                newMsgs.push({
                                    id: 'agent-fallback-' + Date.now(),
                                    role: 'agent',
                                    text: lastThinkMsg.text,
                                    isStreaming: false,
                                    workedDuration: totalDuration
                                });
                            }
                        }

                        const historyToSave = newMsgs.filter(m => !String(m.id).startsWith('welcome') && (!m.isMeta || (m.text && m.text.includes('Request Cancelled'))));
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
        // Also trigger on escaped @ (\@) while keeping the escape character preserved
        const isEscapedAt = lastPart && lastPart.startsWith('\\@');
        const isPlainAt = lastPart && lastPart.startsWith('@');
        if ((isPlainAt || isEscapedAt) && !isFilePickerDismissed) {
            const hashIndex = lastPart.indexOf('#');
            const hasHash = hashIndex !== -1;
            // Determine prefix length: 2 for escaped (\@), 1 for plain (@)
            const prefixLen = isEscapedAt ? 2 : 1;
            const query = hasHash ? lastPart.substring(prefixLen, hashIndex).toLowerCase() : lastPart.slice(prefixLen).toLowerCase();
            const suffix = hasHash ? lastPart.substring(hashIndex) : '';
            const projectFiles = getProjectFiles(process.cwd());

            const matches = projectFiles.filter(f => f.name.toLowerCase().includes(query));
            return matches.map(f => {
                const relPath = f.relativePath.replace(/\\/g, '/');
                const formattedPath = relPath.startsWith('.') ? relPath : './' + relPath;
                return {
                    cmd: (isEscapedAt ? '\\@' : '@') + '[' + formattedPath + suffix + ']',
                    desc: f.relativePath
                };
            });
        }

        return [];
    }, [input, isFilePickerDismissed]);

    // Reset selected index when input changes to avoid OOB, skipping dividers
    useEffect(() => {
        let startIdx = 0;
        while (startIdx < suggestions.length) {
            const sug = suggestions[startIdx];
            const cmdName = sug?.cmd || sug || '';
            if (typeof cmdName === 'string' && cmdName.trimStart().startsWith('---')) {
                startIdx++;
            } else {
                break;
            }
        }
        setSelectedIndex(startIdx < suggestions.length ? startIdx : 0);
    }, [suggestions]);

    // Slide-down animation for suggestion box 🎞️
    const [suggestionVisibleCount, setSuggestionVisibleCount] = useState(0);
    const prevSuggestionsLenRef = useRef(0);
    useEffect(() => {
        const wasOpen = prevSuggestionsLenRef.current > 0;
        const isOpen = suggestions.length > 0;
        prevSuggestionsLenRef.current = suggestions.length;

        if (!isOpen) {
            setSuggestionVisibleCount(0);
            return;
        }

        // On fresh open (was closed), animate from 1 row down
        if (!wasOpen) {
            setSuggestionVisibleCount(1);
            return;
        }

        // Already open — jump straight to full count
        setSuggestionVisibleCount(suggestions.length);
    }, [suggestions]);

    useEffect(() => {
        if (suggestionVisibleCount > 0 && suggestionVisibleCount < suggestions.length) {
            const t = setTimeout(() => {
                setSuggestionVisibleCount(prev => Math.min(prev + 1, suggestions.length));
            }, 5);
            return () => clearTimeout(t);
        }
    }, [suggestionVisibleCount, suggestions.length]);

    // Effect: initialize pbsSelected when entering providerBudgetSelect, pre-checking already-configured providers
    useEffect(() => {
        if (activeView !== 'providerBudgetSelect') return;
        const PBS_PROVIDERS = ['Google', 'DeepSeek', 'Mistral', 'NVIDIA', 'OpenRouter', 'Ollama', 'CrofAI', 'InferX', 'SenseNova'];
        const existingBudgets = quotas.providerBudgets || {};
        const initialSelected = PBS_PROVIDERS.reduce((acc, p) => {
            acc[p] = !!(existingBudgets[p] && (existingBudgets[p].agentLimit || existingBudgets[p].tokenLimit));
            return acc;
        }, {});
        setPbsSelected(initialSelected);
        setPbsCursor(0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeView]);

    // Effect: initialize pbfFormState when entering providerBudgetFlow
    useEffect(() => {
        if (activeView !== 'providerBudgetFlow') return;

        const initialForm = {};
        const existingPBs = quotas.providerBudgets || {};
        for (const prov of providerBudgetQueue) {
            const pb = existingPBs[prov] || {};
            initialForm[prov] = {
                agentLimit: getPrefilledValue(pb.agentLimit),
                tokenLimit: getPrefilledValue(pb.tokenLimit),
                monthlyTokenLimit: getPrefilledValue(pb.monthlyTokenLimit)
            };
        }
        setPbfFormState(initialForm);
        setPbfFieldIndex(0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeView, providerBudgetQueue]);

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

    const renderProgressBar = (label, current, limit, barWidth = 10, paddingLeft = 2, labelWidth = 9) => {
        const actualPercent = limit > 0 ? Math.min(100, (current / limit) * 100) : 0;
        const percent = Math.round(actualPercent);
        const filledCount = Math.round((percent / 100) * barWidth);
        const barStr = '█'.repeat(filledCount) + '░'.repeat(Math.max(0, barWidth - filledCount));

        let barColor = colors.success || 'green';
        if (percent >= 40 && percent <= 80) {
            barColor = colors.warning || 'yellow';
        } else if (percent > 80) {
            barColor = colors.danger || 'red';
        }

        const isTokens = label.toLowerCase().includes('token') || label.toLowerCase().includes('daily') || label.toLowerCase().includes('monthly');
        const displayLimit = shouldClearValue(limit) ? '∞' : (isTokens ? formatTokens(limit) : limit);
        const displayCurrent = isTokens ? formatTokens(current) : current;

        let displayPercent;
        if (actualPercent === 0) {
            displayPercent = '0%';
        } else if (actualPercent > 0 && actualPercent < 1) {
            displayPercent = '<1%';
        } else {
            displayPercent = `${percent}%`;
        }

        return (
            <Box flexDirection="row" paddingLeft={paddingLeft} key={label}>
                <Box width={labelWidth}>
                    <Text color={colors.textMuted}>{label}: </Text>
                </Box>
                <Text color={barColor}>{barStr}</Text>
                <Text color={colors.textMuted}> {displayPercent} ({displayCurrent}/{displayLimit})</Text>
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
                        setProviderReturnView={setProviderReturnView}
                    />
                );

            case 'theme':
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
                        initialSelectingTheme={true}
                        onCloseTheme={() => setActiveView('chat')}
                        setProviderReturnView={setProviderReturnView}
                    />
                );

            case 'selectProvider':
                return (
                    <CommandMenu
                        title="SELECT AI PROVIDER"
                        searchable={true}
                        items={[
                            { label: 'Google', value: 'Google' },
                            { label: 'Nvidia', value: 'NVIDIA' },
                            { label: 'DeepSeek', value: 'DeepSeek' },
                            { label: 'InferX', value: 'InferX' },
                            { label: 'SenseNova', value: 'SenseNova' },
                            { label: 'CrofAI', value: 'CrofAI' },
                            { label: 'Ollama', value: 'Ollama' },
                            { label: 'Mistral [EXPERIMENTAL]', value: 'Mistral' },
                            { label: 'OpenRouter [EXPERIMENTAL]', value: 'OpenRouter' },
                            { label: 'Back', value: providerReturnView }
                        ]}
                        theme={systemSettings.theme}
                        onSelect={async (item) => {
                            if (item.value === providerReturnView || item.value === 'settings' || item.value === 'Back') {
                                setActiveView(providerReturnView);
                                return;
                            }

                            const selectedProvider = item.value;
                            const key = await getProviderAPIKey(selectedProvider);

                            if (key) {
                                setAiProvider(selectedProvider);
                                setApiKey(key);
                                initAI(key, { aiProvider: selectedProvider, onIDEApproval: resetPendingApproval });
                                const targetTier = (quotas.providerTiers || {})[selectedProvider] || 'Free';
                                const defaultModel = getDefaultModel(selectedProvider, targetTier);
                                setActiveModel(defaultModel);
                                setApiTier(targetTier);
                                if ((selectedProvider === 'NVIDIA' && process.env.NVIDIA_BASE_URL) || selectedProvider === 'Ollama' || selectedProvider === 'CrofAI' || selectedProvider === 'InferX' || selectedProvider === 'SenseNova') {
                                    setSystemSettings(s => ({ ...s, memory: false }));
                                    saveSettings({ aiProvider: selectedProvider, activeModel: defaultModel, apiTier: targetTier, quotas, systemSettings: { ...systemSettings, memory: false } });
                                } else {
                                    saveSettings({ aiProvider: selectedProvider, activeModel: defaultModel, apiTier: targetTier, quotas });
                                }
                                setMessages(prev => [
                                    ...prev,
                                    {
                                        role: 'system',
                                        text: `✦ Switched to ${selectedProvider} (cached)!${defaultModel ? `\n⠀⠀└─ Model: ${defaultModel}.` : ''}${(selectedProvider === 'Ollama' || selectedProvider === 'CrofAI' || selectedProvider === 'InferX' || selectedProvider === 'SenseNova') && systemSettings.memory ? `\n⠀⠀└─ Memory is not available with ${selectedProvider}.` : ''}${selectedProvider === 'NVIDIA' && process.env.NVIDIA_BASE_URL && systemSettings.memory ? '\n⠀⠀└─ Memory is not available with Custom Endpoints.' : ''}\n⠀`,
                                        isMeta: true
                                    }
                                ]);
                                setActiveView(providerReturnView);
                            } else {
                                setInputConfig({
                                    label: `Enter ${selectedProvider} API Key:`,
                                    key: 'providerKey',
                                    provider: selectedProvider,
                                    value: '',
                                    returnView: providerReturnView
                                });
                                setActiveView('input');
                            }
                        }}
                        onClose={() => setActiveView(providerReturnView)}
                    />
                );

            case 'apiTier': {
                return (
                    <CommandMenu
                        title={`Show Paid models from ${aiProvider.toUpperCase()}?`}
                        subtitle="Curated model list. Can use anything if typed manually."
                        items={[
                            { label: 'No  (For Free APIs)    [Shows Free model list]', value: 'Free' },
                            { label: `Yes (For Billing APIs) [Shows Paid model list] ${apiTier === 'Paid' ? '●' : ''}`, value: 'Paid' },
                            { label: 'Back', value: 'settings' }
                        ]}
                        theme={systemSettings.theme}
                        onSelect={(item) => {
                            if (item.value === 'settings' || item.value === 'Back') {
                                setActiveView('settings');
                                return;
                            }

                            const newTier = item.value;
                            setApiTier(newTier);

                            const updatedProviderTiers = {
                                ...(quotas.providerTiers || {}),
                                [aiProvider]: newTier
                            };
                            const newQuotas = {
                                ...quotas,
                                providerTiers: updatedProviderTiers
                            };
                            setQuotas(newQuotas);
                            saveSettings({ apiTier: newTier, quotas: newQuotas });
                            setActiveView('settings');
                        }}
                    />
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
                        theme={systemSettings.theme}
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

            case 'budgetTypeSelect':
                return (
                    <CommandMenu
                        title="SELECT BUDGET TYPE"
                        items={[
                            { label: `Global Budget  (single limit for all providers) ${apiTier === 'Paid' && !quotas.providerBudgets?.['__useProvider'] ? '●' : ''}`, value: 'global' },
                            { label: `Provider Budgets  (set limits per provider individually) ${quotas.providerBudgets?.['__useProvider'] ? '●' : ''}`, value: 'provider' },
                            { label: 'Back', value: budgetReturnView }
                        ]}
                        theme={systemSettings.theme}
                        onSelect={(item) => {
                            if (item.value === budgetReturnView || item.value === 'Back') {
                                setActiveView(budgetReturnView);
                                return;
                            }

                            if (item.value === 'global') {
                                // Clear providerBudgets and reset to default global budget values before set
                                const updatedQuotas = {
                                    ...quotas,
                                    agentLimit: 99999999,
                                    tokenLimit: 99999999999999,
                                    monthlyTokenLimit: 99999999999999,
                                    providerBudgets: { __useProvider: false }
                                };
                                setQuotas(updatedQuotas);
                                const returnMode = budgetReturnView === 'settings' ? 'resetMode' : 'budgetResetMode';
                                setInputConfig({
                                    label: "Enter Agent daily budget (requests made):",
                                    key: 'quotas',
                                    subKey: 'agentLimit',
                                    value: getPrefilledValue(updatedQuotas.agentLimit),
                                    returnView: budgetReturnView,
                                    next: (newQuotas) => ({
                                        label: "Enter Agent daily budget (tokens used):",
                                        key: 'quotas',
                                        subKey: 'tokenLimit',
                                        value: getPrefilledValue(newQuotas.tokenLimit),
                                        returnView: budgetReturnView,
                                        next: (q2) => ({
                                            label: "Enter Agent monthly budget (tokens used):",
                                            key: 'quotas',
                                            subKey: 'monthlyTokenLimit',
                                            value: getPrefilledValue(q2.monthlyTokenLimit),
                                            returnView: returnMode
                                        })
                                    })
                                });
                                setActiveView('input');
                            } else if (item.value === 'provider') {
                                const updatedQuotas = {
                                    ...quotas,
                                    agentLimit: 99999999,
                                    tokenLimit: 99999999999999,
                                    monthlyTokenLimit: 99999999999999,
                                    providerBudgets: {
                                        ...(quotas.providerBudgets || {}),
                                        __useProvider: true
                                    }
                                };
                                setQuotas(updatedQuotas);
                                setActiveView('providerBudgetSelect');
                            }
                        }}
                        onClose={() => setActiveView(budgetReturnView)}
                    />
                );

            case 'providerBudgetSelect': {
                const PROVIDERS_LIST = ['Google', 'DeepSeek', 'Mistral', 'NVIDIA', 'OpenRouter', 'Ollama', 'CrofAI', 'InferX', 'SenseNova'];
                const anySelected = PROVIDERS_LIST.some(p => pbsSelected[p]);
                return (
                    <Box flexDirection="column" borderStyle="round" borderColor={colors.borderMuted} padding={0} width="100%">
                        <Box paddingX={1} marginBottom={1}>
                            <Text color={colors.text} bold>SELECT PROVIDERS TO SET LIMMITS FOR</Text>
                        </Box>
                        {PROVIDERS_LIST.map((prov, i) => {
                            const isActive = i === pbsCursor;
                            const isChecked = !!pbsSelected[prov];
                            return (
                                <Box key={prov} backgroundColor={isActive ? (colors.highlightBg || "#2a2a2a") : undefined} paddingX={1} width="100%" flexDirection="row">
                                    <Text color={isActive ? colors.text : colors.textMuted} bold={isActive}>
                                        {isActive ? '❯ ' : '  '}
                                    </Text>
                                    <Text color={isChecked ? (colors.success || 'green') : colors.textMuted}>
                                        {isChecked ? '☑' : '☐'}
                                    </Text>
                                    <Text color={isActive ? colors.text : colors.textMuted} bold={isActive}>
                                        {'  '}{prov}
                                    </Text>
                                    {isChecked && quotas.providerBudgets?.[prov]?.agentLimit ? (
                                        <Text color={colors.primary || "cyan"}> (budget set)</Text>
                                    ) : null}
                                </Box>
                            );
                        })}
                        <Box paddingX={1} marginTop={1} flexDirection="column">
                            <Text color={colors.textMuted} italic>↑↓ Navigate  •  Space to toggle  •  Enter to confirm  •  ESC to go back</Text>
                            {!anySelected && <Text color={colors.warning || "yellow"} italic>  Select at least one provider to continue</Text>}
                        </Box>
                    </Box>
                );
            }

            case 'providerBudgetFlow': {
                const totalRows = providerBudgetQueue.length;
                const saveButtonIndex = totalRows * 2;

                return (
                    <Box flexDirection="column" borderStyle="round" borderColor={colors.borderMuted} padding={0} width="100%">
                        <Box paddingX={1} marginBottom={0} justifyContent="space-between" flexDirection="row">
                            <Text color={colors.text} bold>PROVIDER BUDGET CONFIGURATION</Text>
                            <Text color={colors.textMuted} italic>(0 or blank = unlimited)</Text>
                        </Box>

                        <Box paddingX={1} marginTop={1} flexDirection="row">
                            <Box width={14}>
                                <Text color={colors.textMuted} bold>PROVIDER</Text>
                            </Box>
                            <Box width={30} paddingLeft={1}>
                                <Text color={colors.textMuted} bold>DAILY TOKENS (/day)</Text>
                            </Box>
                            <Box width={30} paddingLeft={1}>
                                <Text color={colors.textMuted} bold>MONTHLY TOKENS (/month)</Text>
                            </Box>
                        </Box>

                        <Box paddingX={1}>
                            <Text color={colors.borderMuted}>{'─'.repeat(74)}</Text>
                        </Box>

                        {providerBudgetQueue.map((prov, rowIndex) => {
                            const dailyIdx = rowIndex * 2;
                            const monthlyIdx = rowIndex * 2 + 1;
                            const isDailyFocused = pbfFieldIndex === dailyIdx;
                            const isMonthlyFocused = pbfFieldIndex === monthlyIdx;
                            const isRowActive = isDailyFocused || isMonthlyFocused;

                            const dailyVal = pbfFormState[prov]?.tokenLimit ?? '';
                            const monthlyVal = pbfFormState[prov]?.monthlyTokenLimit ?? '';

                            return (
                                <Box key={prov} flexDirection="row" paddingX={1} marginY={0} backgroundColor={isRowActive ? (colors.highlightBg || "#2a2a2a") : undefined}>
                                    <Box width={14} flexDirection="row">
                                        <Text color={isRowActive ? (colors.primary || "cyan") : colors.text} bold={isRowActive}>
                                            {isRowActive ? '❯ ' : '  '}{prov}
                                        </Text>
                                    </Box>
                                    <Box width={30} paddingLeft={1} flexDirection="row">
                                        {isDailyFocused ? (
                                            <Box flexDirection="row">
                                                <Text color={colors.primary || "cyan"} bold>[ </Text>
                                                <TextInput
                                                    value={dailyVal}
                                                    onChange={(val) => {
                                                        setPbfFormState(prev => ({
                                                            ...prev,
                                                            [prov]: {
                                                                ...(prev[prov] || {}),
                                                                tokenLimit: val
                                                            }
                                                        }));
                                                    }}
                                                    onSubmit={() => {
                                                        setPbfFieldIndex(monthlyIdx);
                                                    }}
                                                />
                                                <Text color={colors.primary || "cyan"} bold> ]</Text>
                                            </Box>
                                        ) : (
                                            <Text color={dailyVal ? colors.text : colors.textMuted}>
                                                [ {dailyVal ? dailyVal : '0 (Unlimited)'} ]
                                            </Text>
                                        )}
                                    </Box>
                                    <Box width={30} paddingLeft={1} flexDirection="row">
                                        {isMonthlyFocused ? (
                                            <Box flexDirection="row">
                                                <Text color={colors.primary || "cyan"} bold>[ </Text>
                                                <TextInput
                                                    value={monthlyVal}
                                                    onChange={(val) => {
                                                        setPbfFormState(prev => ({
                                                            ...prev,
                                                            [prov]: {
                                                                ...(prev[prov] || {}),
                                                                monthlyTokenLimit: val
                                                            }
                                                        }));
                                                    }}
                                                    onSubmit={() => {
                                                        if (rowIndex + 1 < totalRows) {
                                                            setPbfFieldIndex((rowIndex + 1) * 2);
                                                        } else {
                                                            setPbfFieldIndex(saveButtonIndex);
                                                        }
                                                    }}
                                                />
                                                <Text color={colors.primary || "cyan"} bold> ]</Text>
                                            </Box>
                                        ) : (
                                            <Text color={monthlyVal ? colors.text : colors.textMuted}>
                                                [ {monthlyVal ? monthlyVal : '0 (Unlimited)'} ]
                                            </Text>
                                        )}
                                    </Box>
                                </Box>
                            );
                        })}

                        <Box paddingX={1} marginTop={1}>
                            {pbfFieldIndex === saveButtonIndex ? (
                                <Box backgroundColor={colors.highlightBg || "#2a2a2a"} paddingX={1}>
                                    <Text color={colors.success || "green"} bold>❯ [ Save & Apply Budgets ]</Text>
                                </Box>
                            ) : (
                                <Text color={colors.textMuted}>   [ Save & Apply Budgets ]</Text>
                            )}
                        </Box>

                        <Box paddingX={1} marginTop={1} flexDirection="column">
                            <Text color={colors.textMuted} italic>↑↓/←→ Navigate  •  Enter next / save  •  ESC to go back</Text>
                        </Box>
                    </Box>
                );
            }

            case 'budgetResetMode':

                return (
                    <CommandMenu
                        title="SELECT MONTHLY RESET MODE"
                        items={[
                            { label: 'Default (Rolling 30-Day Window)', value: 'Rolling' },
                            { label: 'Custom (Set reset day of month)', value: 'Custom' },
                            { label: 'Back', value: 'chat' }
                        ]}
                        theme={systemSettings.theme}
                        onSelect={(item) => {
                            if (item.value === 'chat' || item.value === 'Back') {
                                setActiveView('chat');
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
                                    returnView: 'chat'
                                });
                                setActiveView('input');
                            } else {
                                saveSettings({ apiTier, quotas: updatedQuotas });
                                setActiveView('chat');
                            }
                        }}
                        onClose={() => setActiveView('chat')}
                    />
                );

            case 'budgetView': {
                const reqCurrent = dailyUsage?.agent || 0;
                const reqLimit = quotas.agentLimit || 99999999;
                const tokenCurrent = dailyUsage?.tokens || 0;
                const tokenLimit = quotas.tokenLimit || 99999999999999;
                const monthlyCurrent = quotas.resetMode === 'Custom' ? (customPeriodUsage?.tokens || 0) : (monthlyUsage?.tokens || 0);
                const monthlyLimit = quotas.monthlyTokenLimit || 99999999999999;

                const isFreeTier = apiTier !== 'Paid';
                const usingProviderBudgets = !!(quotas.providerBudgets?.__useProvider);
                const providerBudgetsMap = quotas.providerBudgets || {};
                const configuredProviders = ['Google', 'DeepSeek', 'Mistral', 'NVIDIA', 'OpenRouter', 'Ollama', 'CrofAI', 'InferX', 'SenseNova'].filter(
                    p => providerBudgetsMap[p] && (providerBudgetsMap[p].agentLimit || providerBudgetsMap[p].tokenLimit || providerBudgetsMap[p].monthlyTokenLimit)
                );
                const limitsNotSet = !usingProviderBudgets && (shouldClearValue(reqLimit) || shouldClearValue(tokenLimit) || shouldClearValue(monthlyLimit));

                let resetInfo = '';
                let resetCountdown = '';
                if (quotas.resetMode === 'Custom') {
                    const today = new Date();
                    const resetDay = quotas.resetDay || 1;
                    let resetYear = today.getFullYear();
                    let resetMonth = today.getMonth();
                    if (today.getDate() >= resetDay) {
                        resetMonth += 1;
                        if (resetMonth > 11) {
                            resetMonth = 0;
                            resetYear += 1;
                        }
                    }
                    const targetResetDate = new Date(resetYear, resetMonth, resetDay, 0, 0, 0);
                    const monthName = targetResetDate.toLocaleString('default', { month: 'short' }).toUpperCase();
                    resetInfo = `${monthName}-${resetDay}`;

                    const diffMs = Math.max(0, targetResetDate.getTime() - today.getTime());
                    const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
                    const daysLeft = Math.floor(totalHours / 24);
                    const hoursLeft = totalHours % 24;

                    resetCountdown = `(${daysLeft} days: ${hoursLeft} hrs left)`;
                }

                return (
                    <Box flexDirection="column" borderStyle="round" borderColor={colors.borderMuted} padding={1} paddingBottom={0} paddingTop={0} width="100%">
                        <Box marginBottom={1} justifyContent="space-between" width="100%">
                            <Text color={colors.text} bold underline>USAGE LIMITS</Text>
                            <Text color={colors.textMuted}>[ ESC to Close ]</Text>
                        </Box>
                        {limitsNotSet ? (
                            <Box padding={1} justifyContent="center" alignItems="center" width="100%">
                                <Text color={colors.text} bold>LIMITS NOT SET</Text>
                            </Box>
                        ) : usingProviderBudgets && configuredProviders.length > 0 ? (
                            <Box flexDirection="column" gap={0} width="100%">
                                {(() => {
                                    const cols = stdout?.columns || terminalSize?.columns || 80;
                                    const isNarrow = cols < 115;

                                    if (isNarrow) {
                                        // 1-column layout for narrow screens: barW dynamically shrinks with terminal width
                                        const barW = Math.max(5, Math.min(30, cols - 50));
                                        return configuredProviders.map((prov) => {
                                            const pb = providerBudgetsMap[prov];
                                            let provTokenCurrent = 0;
                                            const dailyModels = dailyUsage?.models?.[prov] || {};
                                            for (const m in dailyModels) {
                                                provTokenCurrent += dailyModels[m]?.tokens || 0;
                                            }

                                            let provMonthlyCurrent = 0;
                                            const monthlySource = quotas.resetMode === 'Custom' ? customPeriodUsage : monthlyUsage;
                                            const monthlyModels = monthlySource?.models?.[prov] || {};
                                            for (const m in monthlyModels) {
                                                provMonthlyCurrent += monthlyModels[m]?.tokens || 0;
                                            }

                                            return (
                                                <Box key={prov} flexDirection="column" borderStyle="single" borderColor={colors.borderMuted} paddingX={1} width="100%">
                                                    <Box marginBottom={0}>
                                                        <Text color={colors.primary} bold>◆ {prov}</Text>
                                                    </Box>
                                                    {renderProgressBar('Daily', provTokenCurrent, pb.tokenLimit || 99999999999999, barW, 2, 9)}
                                                    {renderProgressBar('Monthly', provMonthlyCurrent, pb.monthlyTokenLimit || 99999999999999, barW, 2, 9)}
                                                </Box>
                                            );
                                        });
                                    }

                                    // 2-column grid layout for wide screens
                                    const rows = [];
                                    for (let i = 0; i < configuredProviders.length; i += 2) {
                                        rows.push(configuredProviders.slice(i, i + 2));
                                    }
                                    return rows.map((row, rIdx) => (
                                        <Box key={rIdx} flexDirection="row" width="100%">
                                            {row.map((prov) => {
                                                const pb = providerBudgetsMap[prov];
                                                let provTokenCurrent = 0;
                                                const dailyModels = dailyUsage?.models?.[prov] || {};
                                                for (const m in dailyModels) {
                                                    provTokenCurrent += dailyModels[m]?.tokens || 0;
                                                }

                                                let provMonthlyCurrent = 0;
                                                const monthlySource = quotas.resetMode === 'Custom' ? customPeriodUsage : monthlyUsage;
                                                const monthlyModels = monthlySource?.models?.[prov] || {};
                                                for (const m in monthlyModels) {
                                                    provMonthlyCurrent += monthlyModels[m]?.tokens || 0;
                                                }

                                                const isFullWidth = row.length === 1;
                                                const targetCardCols = isFullWidth ? cols : Math.floor(cols / 2);
                                                const barW = Math.max(5, Math.min(25, targetCardCols - 36));

                                                return (
                                                    <Box key={prov} flexDirection="column" borderStyle="single" borderColor={colors.borderMuted} paddingX={1} width={isFullWidth ? "100%" : "50%"}>
                                                        <Box marginBottom={0}>
                                                            <Text color={colors.primary} bold>◆ {prov}</Text>
                                                        </Box>
                                                        {renderProgressBar('Daily', provTokenCurrent, pb.tokenLimit || 99999999999999, barW, 2, 9)}
                                                        {renderProgressBar('Monthly', provMonthlyCurrent, pb.monthlyTokenLimit || 99999999999999, barW, 2, 9)}
                                                    </Box>
                                                );
                                            })}
                                        </Box>
                                    ));
                                })()}
                                {resetInfo ? (
                                    <Box marginLeft={2} marginTop={1}>
                                        <Text color={colors.textMuted}>Monthly Reset: </Text>
                                        <Text color={colors.accent || "magenta"} bold>{resetInfo}</Text>
                                        {resetCountdown ? <Text color={colors.textMuted}>{` ${resetCountdown}`}</Text> : null}
                                    </Box>
                                ) : (
                                    <Box marginLeft={2} marginTop={1}>
                                        <Text color={colors.textMuted}>Monthly Reset: </Text>
                                        <Text color={colors.secondary || "blue"} bold>Rolling 30-Day Window</Text>
                                    </Box>
                                )}
                            </Box>
                        ) : (
                            <Box flexDirection="column" borderStyle="single" borderColor={colors.borderMuted} paddingX={1} width="100%">
                                {renderProgressBar('Daily Tokens', tokenCurrent, tokenLimit, 'green')}
                                {renderProgressBar('Monthly Tokens', monthlyCurrent, monthlyLimit, 'yellow')}
                                {resetInfo ? (
                                    <Box marginLeft={4} marginTop={1}>
                                        <Text color={colors.textMuted}>Monthly Reset: </Text>
                                        <Text color={colors.accent || "magenta"} bold>{resetInfo}</Text>
                                        {resetCountdown ? <Text color={colors.textMuted}>{` ${resetCountdown}`}</Text> : null}
                                    </Box>
                                ) : (
                                    <Box marginLeft={4} marginTop={1}>
                                        <Text color={colors.textMuted}>Monthly Reset: </Text>
                                        <Text color={colors.secondary || "blue"} bold>Rolling 30-Day Window</Text>
                                    </Box>
                                )}
                            </Box>
                        )}
                    </Box>
                );
            }

            case 'input':
                return (
                    <Box flexDirection="column" borderStyle="round" borderColor={colors.borderMuted} padding={0} width="100%">
                        <Box paddingX={1}>
                            <Text color={colors.text} bold>DATA CONFIGURATION</Text>
                        </Box>

                        {inputConfig?.note && (
                            <Box paddingX={1} marginBottom={1}>
                                <Text color={colors.textMuted} italic>
                                    {inputConfig.note}
                                </Text>
                            </Box>
                        )}

                        <Box paddingX={1} flexDirection="row">
                            <Text color={colors.text} bold>{inputConfig?.label} </Text>
                            <TextInput
                                value={inputConfig?.value || ''}
                                onChange={(val) => setInputConfig(prev => ({ ...prev, value: val }))}
                                onSubmit={async (val) => {
                                    const { key, subKey, next, onDone } = inputConfig;

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
                                    } else if (key === 'providerBudgets') {
                                        const prov = inputConfig.providerKey;
                                        const parsedValue = subKey.toLowerCase().includes('limit') ? parseInt(val) || 0 : val;
                                        const existingPBudgets = newQuotas.providerBudgets || {};
                                        newQuotas.providerBudgets = {
                                            ...existingPBudgets,
                                            [prov]: {
                                                ...(existingPBudgets[prov] || {}),
                                                [subKey]: parsedValue
                                            }
                                        };
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
                                        }
                                    } else if (key === 'providerKey') {
                                        let keyInput = val.trim();
                                        const prov = inputConfig.provider;
                                        if (prov === 'Ollama' && (keyInput === 'LOCAL' || keyInput === '')) {
                                            keyInput = 'LOCAL';
                                            setSystemSettings(s => ({ ...s, ollamaEndpoint: 'Local' }));
                                            newSettings.systemSettings = { ...systemSettings, ollamaEndpoint: 'Local' };
                                        }
                                        await saveProviderAPIKey(prov, keyInput);
                                        setAiProvider(prov);
                                        setApiKey(keyInput);
                                        initAI(keyInput, { aiProvider: prov, onIDEApproval: resetPendingApproval });
                                        const targetTier = (quotas.providerTiers || {})[prov] || 'Free';
                                        const defaultModel = getDefaultModel(prov, targetTier);
                                        setActiveModel(defaultModel);
                                        setApiTier(targetTier);
                                        newSettings.aiProvider = prov;
                                        newSettings.activeModel = defaultModel;
                                        newSettings.apiTier = targetTier;

                                        if ((prov === 'NVIDIA' && process.env.NVIDIA_BASE_URL) || prov === 'Ollama' || prov === 'CrofAI' || prov === 'InferX' || prov === 'SenseNova') {
                                            setSystemSettings(s => ({ ...s, memory: false }));
                                            newSettings.systemSettings = { ...systemSettings, memory: false };
                                        }

                                        setMessages(prev => {
                                            setCompletedIndex(prev.length + 1);
                                            return [...prev, { id: Date.now(), role: 'system', text: `✦ ${prov} API Key saved successfully! ${defaultModel ? `\n⠀⠀└─ Model: ${defaultModel}` : ''}${prov === 'Ollama' && keyInput === 'LOCAL' ? '\n⠀⠀└─ Ollama Endpoint automatically switched to Local' : ''}${prov === 'Ollama' || prov === 'CrofAI' || prov === 'InferX' || prov === 'SenseNova' ? `\n⠀⠀└─ Memory is not available with ${prov}` : ''}${(prov === 'NVIDIA' && process.env.NVIDIA_BASE_URL) ? '\n⠀⠀└─ Memory is not available' : ''}\n⠀⠀`, isMeta: true }];
                                        });
                                    }

                                    if (next) {
                                        const nextConfig = next(key === 'quotas' || key === 'providerBudgets' ? newQuotas : val);
                                        setInputConfig(nextConfig);
                                    } else if (onDone) {
                                        saveSettings({ ...newSettings, apiTier, quotas: newQuotas, imageSettings: newSettings.imageSettings || imageSettings });
                                        setInputConfig(null);
                                        onDone(newQuotas);
                                    } else {
                                        saveSettings({ ...newSettings, apiTier, quotas: newQuotas, imageSettings: newSettings.imageSettings || imageSettings });
                                        setInputConfig(null);
                                        setActiveView(inputConfig?.returnView || 'settings');
                                    }
                                }}
                            />
                        </Box>

                        <Box paddingX={1} marginTop={1}>
                            <Text color={colors.textMuted} dimColor italic>(Press Enter to confirm selection)</Text>
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

                const maxRows = Math.max(4, (stdout?.rows || terminalSize?.rows || 24) - 15); // [MAX ROWS FOR 30 DAY MODEL BREAKDOWN]
                const renderLeaderRow = (key, leftText, rightText, leftColor, rightColor, indent = 0, isBold = false) => {
                    const cols = stdout?.columns || terminalSize?.columns || 80;
                    const boxWidth = Math.min(125, cols - 2);
                    const lineWidth = Math.max(20, boxWidth - 6);

                    const maxLeftLen = Math.max(5, lineWidth - indent - rightText.length - 5);
                    let cleanLeftText = leftText;
                    if (cleanLeftText.length > maxLeftLen) {
                        cleanLeftText = cleanLeftText.substring(0, maxLeftLen - 1) + '…';
                    }

                    const dotsCount = Math.max(2, lineWidth - indent - cleanLeftText.length - rightText.length - 2);
                    const dotsStr = ' ' + '.'.repeat(dotsCount) + ' ';
                    const indentStr = ' '.repeat(indent);

                    return (
                        <Box key={key} width={lineWidth}>
                            <Text wrap="truncate">
                                <Text>{indentStr}</Text>
                                <Text color={leftColor} bold={isBold}>{cleanLeftText}</Text>
                                <Text color={colors.textMuted} dimColor>{dotsStr}</Text>
                                <Text color={rightColor} bold={isBold}>{rightText}</Text>
                            </Text>
                        </Box>
                    );
                };

                const breakdownRows = [];
                if (!monthlyUsage?.models || Object.keys(monthlyUsage.models).length === 0) {
                    breakdownRows.push(
                        <Box key="empty" marginTop={1}>
                            <Text color={colors.textMuted} italic>No model token usage recorded in the last 30 days.</Text>
                        </Box>
                    );
                } else {
                    Object.entries(monthlyUsage.models).forEach(([provider, models], pIdx) => {
                        const providerTotalTokens = Object.values(models).reduce((sum, m) => sum + (m.tokens || 0), 0);
                        if (pIdx > 0) {
                            breakdownRows.push(<Box key={`space-prov-${provider}`}><Text>{' '}</Text></Box>);
                        }
                        breakdownRows.push(
                            renderLeaderRow(`prov-${provider}`, `${provider}:`, formatTokens(providerTotalTokens), colors.primary, colors.text, 0, true)
                        );
                        Object.entries(models).forEach(([modelName, stats], mIdx) => {
                            if (mIdx > 0) {
                                breakdownRows.push(<Box key={`space-mod-${provider}-${modelName}`}><Text>{' '}</Text></Box>);
                            }
                            breakdownRows.push(
                                renderLeaderRow(`mod-${provider}-${modelName}`, `» ${modelName}:`, formatTokens(stats.tokens || 0), colors.secondary, colors.text, 2, true)
                            );
                            breakdownRows.push(
                                renderLeaderRow(`in-${provider}-${modelName}`, '» Input Tokens:', formatTokens((stats.tokens || 0) - (stats.candidateTokens || 0)), colors.textMuted, colors.text, 5, false)
                            );
                            if ((stats.cachedTokens || 0) > 0) {
                                breakdownRows.push(
                                    renderLeaderRow(`cache-${provider}-${modelName}`, '» Cached:', formatTokens(stats.cachedTokens), colors.textMuted, colors.text, 7, false)
                                );
                            }
                            breakdownRows.push(
                                renderLeaderRow(`out-${provider}-${modelName}`, '» Output Tokens:', formatTokens(stats.candidateTokens || 0), colors.textMuted, colors.text, 5, false)
                            );
                        });
                    });
                }

                const totalRows = breakdownRows.length;
                const maxScroll = Math.max(0, totalRows - maxRows);
                maxScrollRef.current = maxScroll;
                const effectiveScroll = Math.min(statsScrollOffset, maxScroll);
                const visibleRows = breakdownRows.slice(effectiveScroll, effectiveScroll + maxRows);

                return (
                    <Box flexDirection="column" borderStyle="round" borderColor={colors.borderMuted} paddingX={3} paddingY={1} paddingBottom={0} width={Math.min(125, (stdout?.columns || 100) - 2)}>
                        {statsMode === 'modelBreakdown' ? (
                            <Box flexDirection="column">
                                <Box justifyContent="space-between">
                                    <Text color={colors.text} bold underline>30-DAY MODEL TOKEN BREAKDOWN</Text>
                                    {totalRows > maxRows && (
                                        <Text color={colors.textMuted} dimColor>
                                            [{effectiveScroll + 1}-{Math.min(totalRows, effectiveScroll + maxRows)} of {totalRows}] ▲▼
                                        </Text>
                                    )}
                                </Box>
                                <Box flexDirection="column" height={maxRows} marginTop={1}>
                                    {visibleRows}
                                </Box>
                            </Box>
                        ) : (
                            <>
                                <Box marginBottom={1}>
                                    <Text color={colors.text} bold underline>SESSION TELEMETRY</Text>
                                </Box>

                                <Box flexDirection="column">
                                    <Box>
                                        <Box width={25}><Text color={colors.secondary}>Session Duration:</Text></Box>
                                        <Text color={colors.text}>{formatMsDuration(Date.now() - SESSION_START_TIME)}</Text>
                                    </Box>
                                    {sessionAgentCalls > 0 && (
                                        <>
                                            <Box>
                                                <Box width={25}><Text color={colors.secondary}>Model Requests:</Text></Box>
                                                <Text color={colors.text}>{sessionAgentCalls}</Text>
                                            </Box>
                                            <Box marginLeft={2}>
                                                <Box width={23}><Text color={colors.textMuted}>» API Time:</Text></Box>
                                                <Text color={colors.text}>{formatMsDuration(sessionApiTime)}</Text>
                                            </Box>
                                            <Box marginLeft={2}>
                                                <Box width={23}><Text color={colors.textMuted}>» Tool Time:</Text></Box>
                                                <Text color={colors.text}>{formatMsDuration(sessionToolTime)}</Text>
                                            </Box>
                                        </>
                                    )}
                                    {sessionBackgroundCalls > 0 && (
                                        <Box>
                                            <Box width={25}><Text color={colors.secondary}>Memory Agent:</Text></Box>
                                            <Text color={colors.text}>{sessionBackgroundCalls}</Text>
                                        </Box>
                                    )}
                                    {sessionTotalTokens > 0 && (
                                        <>
                                            <Box>
                                                <Box width={25}><Text color={colors.secondary}>Tokens Consumed:</Text></Box>
                                                <Text color={colors.text}>{formatTokens(sessionTotalTokens)}</Text>
                                            </Box>
                                            <Box marginLeft={2}>
                                                <Box width={23}><Text color={colors.textMuted}>» Input Tokens:</Text></Box>
                                                <Text color={colors.text}>{formatTokens(sessionTotalTokens - sessionTotalCandidateTokens)}</Text>
                                            </Box>
                                            {sessionTotalCachedTokens > 0 && (
                                                <Box marginLeft={4}>
                                                    <Box width={21}><Text color={colors.textMuted}>» Cached:</Text></Box>
                                                    <Text color={colors.text}>{formatTokens(sessionTotalCachedTokens)}</Text>
                                                </Box>
                                            )}
                                            {sessionTotalCandidateTokens > 0 && (
                                                <Box marginLeft={2}>
                                                    <Box width={23}><Text color={colors.textMuted}>» Output Tokens:</Text></Box>
                                                    <Text color={colors.text}>{formatTokens(sessionTotalCandidateTokens)}</Text>
                                                </Box>
                                            )}
                                        </>
                                    )}
                                    {sessionStats?.tokens > 0 && (
                                        <Box>
                                            <Box width={25}><Text color={colors.secondary}>Active Context:</Text></Box>
                                            <Text color={colors.text}>{formatTokens(sessionStats.tokens)}</Text>
                                        </Box>
                                    )}
                                    {sessionImageCount > 0 && (
                                        <>
                                            <Box>
                                                <Box width={25}><Text color={colors.secondary}>Images Made:</Text></Box>
                                                <Text color={colors.text}>{sessionImageCount}</Text>
                                            </Box>
                                            <Box>
                                                <Box width={25}><Text color={colors.secondary}>Image Credits:</Text></Box>
                                                <Text color={colors.text}>{Number(((sessionImageCredits || 0) * 1000).toFixed(0))} credits</Text>
                                            </Box>
                                        </>
                                    )}
                                    <Box>
                                        <Box width={25}><Text color={colors.secondary}>Code Changes (Sess):</Text></Box>
                                        <Text color={colors.text}><Text color={colors.success || "green"}>+{runtimeSession.linesAdded}</Text> <Text color={colors.danger || "red"}>-{runtimeSession.linesRemoved}</Text></Text>
                                    </Box>
                                    <Box>
                                        <Box width={25}><Text color={colors.secondary}>Tool Calls (Sess):</Text></Box>
                                        <Text color={colors.text}>{runtimeSession.toolSuccess + runtimeSession.toolFailure + runtimeSession.toolDenied} ( </Text>
                                        <Text color={colors.success || "green"}>✔ {runtimeSession.toolSuccess}</Text>
                                        <Text color={colors.text}> </Text>
                                        <Text color={colors.warning || "yellow"}>🛇 {runtimeSession.toolDenied}</Text>
                                        <Text color={colors.text}> </Text>
                                        <Text color={colors.danger || "red"}>✘ {runtimeSession.toolFailure}</Text>
                                        <Text color={colors.text}> )</Text>
                                    </Box>
                                </Box>

                                <Box flexDirection="column" marginTop={1}>
                                    <Text color={colors.text} bold underline>{trackerTitle}</Text>
                                    <Box marginTop={1}>
                                        <Box width={25}><Text color={colors.secondary}>{timeLabel}</Text></Box>
                                        <Text color={colors.text}>{formatDuration(u?.duration || 0)}</Text>
                                    </Box>
                                    {(u?.agent || 0) > 0 && (
                                        <Box>
                                            <Box width={25}><Text color={colors.secondary}>Model Requests:</Text></Box>
                                            <Text color={colors.text}>{u?.agent || 0}</Text>
                                        </Box>
                                    )}
                                    {(u?.background || 0) > 0 && (
                                        <Box>
                                            <Box width={25}><Text color={colors.secondary}>Memory Agent:</Text></Box>
                                            <Text color={colors.text}>{u?.background || 0}</Text>
                                        </Box>
                                    )}
                                    {(u?.tokens || 0) > 0 && (
                                        <>
                                            <Box>
                                                <Box width={25}><Text color={colors.secondary}>{tokensLabel}</Text></Box>
                                                <Text color={colors.text}>{formatTokens(u?.tokens || 0)}</Text>
                                            </Box>
                                            <Box marginLeft={2}>
                                                <Box width={23}><Text color={colors.textMuted}>» Input Tokens:</Text></Box>
                                                <Text color={colors.text}>{formatTokens((u?.tokens || 0) - (u?.candidateTokens || 0))}</Text>
                                            </Box>
                                            {(u?.cachedTokens || 0) > 0 && (
                                                <Box marginLeft={4}>
                                                    <Box width={21}><Text color={colors.textMuted}>» Cached:</Text></Box>
                                                    <Text color={colors.text}>{formatTokens(u.cachedTokens)}</Text>
                                                </Box>
                                            )}
                                            {(u?.candidateTokens || 0) > 0 && (
                                                <Box marginLeft={2}>
                                                    <Box width={23}><Text color={colors.textMuted}>» Output Tokens:</Text></Box>
                                                    <Text color={colors.text}>{formatTokens(u.candidateTokens)}</Text>
                                                </Box>
                                            )}
                                        </>
                                    )}
                                    {(u?.imageCalls?.length || 0) > 0 && (
                                        <>
                                            <Box>
                                                <Box width={25}><Text color={colors.secondary}>{imagesLabel}</Text></Box>
                                                <Text color={colors.text}>{u.imageCalls.length}</Text>
                                            </Box>
                                            <Box>
                                                <Box width={25}><Text color={colors.secondary}>{imageCreditsLabel}</Text></Box>
                                                <Text color={colors.text}>{Number(((u.imageCalls.reduce((sum, c) => sum + c.cost, 0) || 0) * 1000).toFixed(0))} credits</Text>
                                            </Box>
                                        </>
                                    )}
                                    <Box>
                                        <Box width={25}><Text color={colors.secondary}>{codeChangesLabel}</Text></Box>
                                        <Text color={colors.text}><Text color={colors.success || "green"}>+{u?.linesAdded || 0}</Text> <Text color={colors.danger || "red"}>-{u?.linesRemoved || 0}</Text></Text>
                                    </Box>
                                    <Box>
                                        <Box width={25}><Text color={colors.secondary}>{toolCallsLabel}</Text></Box>
                                        <Text color={colors.text}>{(u?.toolSuccess || 0) + (u?.toolFailure || 0) + (u?.toolDenied || 0)} ( </Text>
                                        <Text color={colors.success || "green"}>✔ {u?.toolSuccess || 0}</Text>
                                        <Text color={colors.text}> </Text>
                                        <Text color={colors.warning || "yellow"}>🛇 {u?.toolDenied || 0}</Text>
                                        <Text color={colors.text}> </Text>
                                        <Text color={colors.danger || "red"}>✘ {u?.toolFailure || 0}</Text>
                                        <Text color={colors.text}> )</Text>
                                    </Box>
                                </Box>
                            </>
                        )}

                        <Text color={colors.textMuted} dimColor italic>{'\n'}(Press TAB to toggle Daily/Monthly views, SPACE for Model Breakdown, ESC to return)</Text>
                    </Box>
                );
            }
            case 'dynamicDirDanger':
                return (
                    <Box flexDirection="column" borderStyle="round" borderColor={colors.borderMuted} paddingX={2} paddingY={1} width="100%">
                        <Text color={colors.warning || "yellow"} bold underline>DYNAMIC DIRECTORY AWARENESS</Text>
                        <Text marginTop={1} color={colors.text}>Enabling this keeps the agent aware of filesystem state in real time, but may reduce prompt cache efficiency.</Text>
                        <Text color={colors.text}>{'\n'}RECOMMENDED SCENARIOS TO TURN ON:</Text>
                        <Text color={colors.textMuted}>• Repo is small.</Text>
                        <Text color={colors.textMuted}>• The task benefits from real-time filesystem awareness.</Text>
                        <Text color={colors.textMuted}>• Files are often created, renamed, or deleted.</Text>
                        <Text color={colors.textMuted}>• You know exactly what you're signing up for.</Text>
                        <Text color={colors.textMuted}>• You don't have conflicting decisions regarding token bills.</Text>
                        <Text color={colors.textMuted}>• You want to see your wallet crying at 3am.</Text>
                        <Box marginTop={1}>
                            <CommandMenu
                                title="Confirm Intent"
                                theme={systemSettings.theme}
                                items={[
                                    { label: 'Turn On Dynamic Directory Awareness', value: 'on' },
                                    { label: 'Keep Off (Recommended)', value: 'off' }
                                ]}
                                onSelect={(item) => {
                                    if (item.value === 'on') {
                                        setSystemSettings(s => {
                                            const updated = { ...s, dynamicDirAwareness: true };
                                            saveSettings({ systemSettings: updated, apiTier, quotas });
                                            return updated;
                                        });
                                    }
                                    setActiveView('settings');
                                }}
                            />
                        </Box>
                    </Box>
                );
            case 'dynamicDirHelp':
                return (
                    <Box flexDirection="column" borderStyle="round" borderColor={colors.borderMuted} paddingX={2} paddingY={1} width="100%">
                        <Text color={colors.text} bold underline>DYNAMIC DIRECTORY AWARENESS — HELP & EXPLANATION</Text>
                        <Text color={colors.text} bold>{'\n'}OFF (Default):</Text>
                        <Text color={colors.textMuted}>• Takes a static directory snapshot at conversation/session start and places it in System Context.</Text>
                        <Text color={colors.textMuted}>• Prompt cache remains stable across user turns, saving tokens and money.</Text>
                        <Text color={colors.text} bold>{'\n'}ON:</Text>
                        <Text color={colors.textMuted}>• Rescans and updates the directory's state dynamically on every single user turn.</Text>
                        <Text color={colors.textMuted}>• Provides real-time filesystem awareness if files are continuously created, renamed, or removed.</Text>
                        <Text color={colors.textMuted}>• Changes Prompt Context on each turn, invalidating part of prompt caches and increasing token usage.</Text>
                        <Box marginTop={1}>
                            <CommandMenu
                                title="Actions"
                                theme={systemSettings.theme}
                                items={[
                                    { label: 'Back to Settings', value: 'back' }
                                ]}
                                onSelect={() => setActiveView('settings')}
                            />
                        </Box>
                    </Box>
                );
            case 'autoExecDanger':
                return (
                    <Box flexDirection="column" borderStyle="round" borderColor={colors.borderMuted} paddingX={2} paddingY={1} width="100%">
                        <Text color={colors.warning || "yellow"} bold underline>SECURITY WARNING: YOLO MODE</Text>
                        <Text marginTop={1} color={colors.text}>Turning this ON allows the agent to execute terminal commands automatically without requiring your approval for each step.</Text>
                        <Text marginTop={1} color={colors.text} bold>RISKS INVOLVED:</Text>
                        <Text color={colors.textMuted}>• The agent may execute destructive commands (rm -rf, etc.) by mistake unless specified in sandbox rules.</Text>
                        <Text color={colors.textMuted}>• Unintended system changes if the agent hallucinates a path or command.</Text>
                        <Text color={colors.textMuted}>• Reduced control over the agent's step-by-step decision making.</Text>
                        <Box marginTop={1}>
                            <CommandMenu
                                title="Confirm Intent"
                                theme={systemSettings.theme}
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
            case 'advanceRollbackDanger':
                return (
                    <Box flexDirection="column" borderStyle="round" borderColor={colors.borderMuted} paddingX={2} paddingY={1} paddingTop={0} width="100%">
                        <Text color={colors.warning || "yellow"} bold>⚠ Emergency Rollback Notice</Text>
                        <Text marginTop={1} color={colors.text}>When enabled, full repo snapshots exist only during active AI turns.</Text>
                        <Text marginTop={1} color={colors.text}>If catastrophic changes occur during a turn, avoid abruptly stopping the agent unless absolutely necessary (external damages out of codebase).</Text>
                        <Text color={colors.textMuted}>The agent may be able to automatically restore the repo to a safe state.</Text>
                        <Text marginTop={1} color={colors.textMuted}>Once the turn ends, emergency snapshots are deleted and standard /revert takes over which may not retain full repo content.</Text>
                        <Text marginTop={1} color={colors.textMuted}>(Requires Restart to take effect)</Text>
                        <Box marginTop={1}>
                            <CommandMenu
                                title="Confirm"
                                theme={systemSettings.theme}
                                items={[
                                    { label: 'I understand and wish to enable', value: 'on' },
                                    { label: 'Keep Off', value: 'off' }
                                ]}
                                onSelect={(item) => {
                                    if (item.value === 'on') {
                                        setSystemSettings(s => ({ ...s, advanceRollback: true }));
                                    }
                                    setActiveView('settings');
                                }}
                            />
                        </Box>
                    </Box>
                );
            case 'externalDanger':
                return (
                    <Box flexDirection="column" borderStyle="round" borderColor={colors.borderMuted} paddingX={2} paddingY={1} width="100%">
                        <Text color={colors.warning || "yellow"} bold underline>SECURITY WARNING: EXTERNAL WORKSPACE ACCESS</Text>
                        <Text marginTop={1} color={colors.text}>Turning this ON allows the agent to execute tools (Read/Write/Exec) outside of the current active workspace directory.</Text>
                        <Text marginTop={1} color={colors.text} bold>RISKS INVOLVED:</Text>
                        <Text color={colors.textMuted}>• Access to sensitive system files (SSH keys, Browser data, etc.)</Text>
                        <Text color={colors.textMuted}>• Potential for accidental or malicious deletion of OS-critical files.</Text>
                        <Text color={colors.textMuted}>• Unauthorized script execution across your entire file system.</Text>
                        <Box marginTop={1}>
                            <CommandMenu
                                title="Confirm Intent"
                                theme={systemSettings.theme}
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
                    <Box flexDirection="column" borderStyle="round" borderColor={colors.borderMuted} paddingX={2} paddingY={1} width="100%">
                        <Text color={colors.danger || "red"} bold underline>CRITICAL SECURITY WARNING: COMBINED SYSTEM RISK</Text>
                        <Text marginTop={1} color={colors.text}>You are attempting to enable BOTH [YOLO Mode] and [External Workspace Access] simultaneously.</Text>
                        <Text marginTop={1} color={colors.danger || "red"} bold>THIS IS NOT RECOMMENDED.</Text>
                        <Text marginTop={1} color={colors.text} bold>THE CRITICAL RISK:</Text>
                        <Text color={colors.textMuted}>The agent will have the power to execute any command across your entire system WITHOUT your approval or supervision.</Text>
                        <Text color={colors.danger || "red"} italic marginTop={1}>A single hallucination or error could result in full system wipe or data theft.</Text>
                        <Box marginTop={1}>
                            <CommandMenu
                                title="Final Confirmation"
                                theme={systemSettings.theme}
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
                                setMessages(prev => [...prev, { id: Date.now(), role: 'system', text: `✦ Flux waiting for new API Key...\n⠀` }]);
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
                                theme={systemSettings.theme}
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
                            theme={systemSettings.theme}
                        />
                    </Box>
                );
            case 'revert':
                return (
                    <Box width="100%" alignItems="center" justifyContent="center">
                        <RevertModal
                            prompts={recentPrompts}
                            onSelect={async (txId) => {
                                if (stdout) {
                                    stdout.write('\x1b[2J\x1b[3J\x1b[H');
                                    if (stdout.isTTY) {
                                        stdout.write('\x1b[?2004h');
                                    }
                                }
                                try {
                                    const result = await RevertManager.rollbackToBefore(txId);
                                    if (result.success) {
                                        const { targetPrompt } = result;
                                        deleteChatSummary(chatId);

                                        setClearKey(prev => prev + 1);
                                        clearBlocksCache();
                                        cachedHistoryRef.current = {
                                            completedIndex: 0,
                                            columns: terminalSize.columns,
                                            historicalBlocks: [],
                                            seenSelections: new Set(),
                                            chatId: chatId,
                                            clearKey: clearKey + 1
                                        };

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
                                        const historyToSave = newMsgs.filter(m => !String(m.id).startsWith('welcome') && (!m.isMeta || (m.text && m.text.includes('Request Cancelled'))));
                                        await saveChat(chatId, null, historyToSave);

                                        const s = emojiSpace(2);
                                        setMessages(prev => {
                                            const finalMsgs = [...prev, {
                                                id: 'revert-ok-' + Date.now(),
                                                role: 'system',
                                                text: `✦ Rollback Successful\n⠀⠀└─ Reverted prompt loaded to input box.\n⠀`,
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
                                            text: `✦ ERROR\n⠀⠀└─ ${err.message}\n⠀`,
                                            isMeta: true
                                        }];
                                        setCompletedIndex(finalMsgs.length);
                                        return finalMsgs;
                                    });
                                    setActiveView('chat');
                                }
                            }}
                            onClose={() => setActiveView('chat')}
                            theme={systemSettings.theme}
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
                                    if (process.stdout.isTTY) {
                                        const chatName = h[id]?.name || '';
                                        const title = (chatName && !chatName.startsWith('flow-') && !chatName.startsWith('Session ')) ? chatName : 'FluxFlow | Resumed';
                                        process.stdout.write(`\x1b]0;${title}\x07`);
                                        process.stdout.write(`\x1b]633;P;TerminalTitle=${title}\x07`);
                                    }
                                    clearBlocksCache();
                                    chatLoadingRef.current = true;
                                    setChatId(id);

                                    const savedData = await loadChatContext(id);
                                    chatTokenStartRef.current = sessionTotalTokens - savedData.total;
                                    chatLoadingRef.current = false;
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
                                        const newMsgs = [...prev, { id: 'sys-' + Date.now(), role: 'system', text: `✦ SESSION RESUMED\n⠀⠀└─ ${id}\n⠀`, isMeta: true }];
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
                            theme={systemSettings.theme}
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
                                theme={systemSettings.theme}
                            />
                        </Box>
                    </Box>
                );
            case 'memory':
                return (
                    <Box width="100%" alignItems="center" justifyContent="center">
                        <MemoryModal onClose={() => setActiveView('chat')} theme={systemSettings.theme} />
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
                            setMessages(prev => [...prev, { id: Date.now(), role: 'system', text: `${profile.name.length > 0 || profile.nickname.length > 0 ? `✦ Profile Updated${profile.name.length > 0 ? `\n⠀⠀└─ Name: ${profile.name} ` : ''}${profile.nickname.length > 0 ? `\n⠀⠀└─ Nickname: ${profile.nickname}` : ''}` : '✦ Profile\n⠀⠀└─ Nothing to Update'}\n\n✦ Custom Instructions\n${profile.instructions.length > 0 ? `⠀⠀└─ ${profile.instructions.substring(0, 30)}${profile.instructions.length > 30 ? '...' : ''}` : '⠀⠀└─ No Instructions Provided.'}\n⠀`, isMeta: true }]);
                            setActiveView('chat');
                        }}
                        onCancel={() => setActiveView('chat')}
                        theme={systemSettings.theme}
                    />
                );
            case 'resolution':
                return (
                    <Box width="100%" alignItems="center" justifyContent="center">
                        <ResolutionModal
                            data={resolutionData}
                            theme={systemSettings.theme}
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
                                        const m = key.match(/^(searchContent|replaceContent|newContent|content_to_replace|content_to_add|TargetContent|ReplacementContent|replacementContent)(\d+)?$/);
                                        if (m) {
                                            const index = m[2] ? parseInt(m[2]) : 1;
                                            indices.add(index);
                                        }
                                    });

                                    const sortedIndices = Array.from(indices).sort((a, b) => a - b);
                                    sortedIndices.forEach(i => {
                                        let r, n;
                                        if (i === 1) {
                                            r = args.searchContent1 ?? args.searchContent ?? args.replaceContent1 ?? args.content_to_replace1 ?? args.replaceContent ?? args.content_to_replace ?? args.TargetContent ?? null;
                                            n = args.newContent1 ?? args.content_to_add1 ?? args.newContent ?? args.content_to_add ?? args.ReplacementContent ?? args.replacementContent ?? null;
                                        } else {
                                            r = args[`searchContent${i}`] ?? args[`replaceContent${i}`] ?? args[`content_to_replace${i}`] ?? null;
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
                                <Text color="cyan" italic>FluxFlow Companion is active. Review the changes in your editor.</Text>
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
                                theme={systemSettings.theme}
                            />
                        </Box>
                    </Box>
                );
            case 'mode':
                return (
                    <CommandMenu
                        title="SELECT EXECUTION MODE"
                        items={[
                            { label: `Flux     (Dev Toolset Mode) ${mode === 'Flux' ? '●' : ''}`, value: 'Flux' },
                            { label: `Flow     (Chat / Conversation Mode) ${mode === 'Flow' ? '●' : ''}`, value: 'Flow' },
                            { label: `ICU      (Interactive Computer Use) ${mode === 'ICU' ? '●' : ''}`, value: 'ICU' },
                            { label: `FluxCU   (Autonomous Flux Computer Use) ${mode === 'FluxCU' ? '●' : ''}`, value: 'FluxCU' },
                            { label: 'Back', value: 'chat' }
                        ]}
                        theme={systemSettings.theme}
                        onSelect={(item) => {
                            if (item.value === 'chat' || item.value === 'Back') {
                                setActiveView('chat');
                                return;
                            }
                            const newMode = item.value;
                            setMode(newMode);
                            if (newMode === 'Flow') {
                                setThinkingLevel('Fast');
                            } else {
                                setThinkingLevel('High');
                            }
                            setMessages(prev => {
                                setCompletedIndex(prev.length + 1);
                                return [...prev, { id: Date.now(), role: 'system', text: `✦ Mode switched to ${getModeDisplayName(newMode)}\n⠀`, isMeta: true }];
                            });
                            setActiveView('chat');
                        }}
                        onClose={() => setActiveView('chat')}
                    />
                );
            case 'display':
                return (
                    <CommandMenu
                        title="SELECT ACTIVE DISPLAY FOR COMPUTER USE"
                        items={[
                            { label: `Primary Display (Display 1) ${activeDisplay === 0 ? '●' : ''}`, value: 0 },
                            { label: `Secondary Display (Display 2) ${activeDisplay === 1 ? '●' : ''}`, value: 1 },
                            { label: 'Back', value: 'chat' }
                        ]}
                        theme={systemSettings.theme}
                        onSelect={(item) => {
                            if (item.value === 'chat' || item.value === 'Back') {
                                setActiveView('chat');
                                return;
                            }
                            const newDisplay = Number(item.value);
                            setActiveDisplay(newDisplay);
                            saveSettings({ display: newDisplay }).catch(() => {});
                            const displayName = newDisplay === 0 ? 'Primary (Display 1)' : 'Secondary (Display 2)';
                            setMessages(prev => {
                                setCompletedIndex(prev.length + 1);
                                return [...prev, { id: Date.now(), role: 'system', text: `✦ Active Computer Use display set to: ${displayName}`, isMeta: true }];
                            });
                            setActiveView('chat');
                        }}
                        onClose={() => setActiveView('chat')}
                    />
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
                        theme={systemSettings.theme}
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
                                theme={systemSettings.theme}
                            />
                        </Box>
                    </Box>
                );
            default:
                return (
                    <Box flexDirection="column" marginTop={1} flexShrink={0} width="100%">
                        {showBtwBox && btwResponse && (
                            <Box flexDirection="column" borderStyle="round" borderColor={colors.borderMuted} paddingX={2} paddingY={1} width="100%" marginBottom={1}>
                                <Box justifyContent="space-between" width="100%">
                                    <Text color={colors.text} bold underline>INQUIRY RESPONSE</Text>
                                    <Text color={colors.textMuted}>[ ESC to Close ]</Text>
                                </Box>
                                <Box marginTop={1} width="100%">
                                    <CodeRenderer text={btwResponse} columns={terminalSize.columns - 6} theme={systemSettings.theme} />
                                </Box>
                            </Box>
                        )}
                        {/* 🤖 ACTIVE SUBAGENTS BOX */}
                        {activeSubagents.filter(sa => sa.status === 'running').length > 0 && (
                            <Box flexDirection="column" borderStyle="round" borderColor={colors.borderMuted} paddingX={2} paddingY={0} width="100%" marginBottom={1}>
                                <Box justifyContent="space-between" width="100%">
                                    <Text color={colors.text} bold>ACTIVE SUBAGENTS</Text>
                                </Box>
                                <Box flexDirection="column" marginTop={1} width="100%">
                                    {activeSubagents.filter(sa => sa.status === 'running').map(sa => (
                                        <SubagentRow key={sa.id} sa={sa} showTPMEstimate={systemSettings.showTPMEstimate} />
                                    ))}
                                </Box>
                            </Box>
                        )}
                        {/* 🏗️ INPUT HEADER BAR */}
                        <Box paddingX={1} marginBottom={0} justifyContent="space-between" width="100%">
                            <Box>
                                {statusText ? (
                                    <Box gap={1}>
                                        <Spinner />

                                        {/* Look at the shine! (≧∇≦)/ */}
                                        <GlintText
                                            text={statusText.trimEnd()}
                                            baseColor={colors.textExclusive || colors.text}
                                            glintColor={colors.textMutedExclusive || colors.textMuted}
                                            // baseColor="#B5B8D9"
                                            // glintColor="#D4DEE7"
                                            speed={60}
                                            italic={true}
                                            glintWidth={2}
                                            typeSpeed={10}
                                        />

                                        <Text color={colors.textMuted}>
                                            {activeTime > 0 ? `(${activeTime.toFixed(0)}s)` : ""}
                                        </Text>
                                    </Box>
                                ) : (
                                    <Text color={colors.textMuted} italic>{input.length > 0 && escPressCount ? "Press ESC again to clear input" : hasPasteBlock ? 'Press CTRL + O to expand' : "Waiting for input..."}</Text>
                                )}
                            </Box>
                            <Box>
                                {(() => {
                                    const status = statusText?.toLowerCase() ?? "";
                                    const showWaiting =
                                        isProcessing &&
                                        Date.now() - lastChunkTime > 15000 &&
                                        activeSubagents.length === 0 &&
                                        (status.includes("connecting") || status.includes("working") || status.includes("queue"));

                                    if (showWaiting) {
                                        return (
                                            <Box>
                                                <GlintText
                                                    text="Waiting for API"
                                                    baseColor={colors.text}
                                                    glintColor={colors.textMuted}
                                                    glintWidth={4}
                                                    speed={80}
                                                />
                                                <Text color={colors.textMuted} dimColor> ┃ </Text>
                                            </Box>
                                        );
                                    }

                                    if (wittyPhrase) {
                                        return (
                                            <Box>
                                                <GlintText
                                                    text={wittyPhrase}
                                                    baseColor={colors.text}
                                                    glintColor={colors.textMuted}
                                                    italic
                                                    speed={80}
                                                    typeSpeed={15}
                                                />
                                                <Text color={colors.textMuted} dimColor> ┃ </Text>
                                            </Box>
                                        );
                                    }

                                    return null;
                                })()}

                                <GlintText
                                    text={activeModel.split('/')[1] || (activeModel.length > 1 ? activeModel : 'Use \'/model model-id\' to select model')}
                                    baseColor={colors.text}
                                    glintColor={colors.textMuted}
                                    glintWidth={3}
                                />
                                <Text color={colors.textMuted}> {activeModel.length > 0 ? `(${thinkingLevel})` : ''}</Text>
                            </Box>
                        </Box>

                        {/* 🌊 MAIN COMMAND CONSOLE */}
                        <Box flexDirection="column" width="100%">
                            <Box width="100%" height={1} overflow="hidden">
                                <Text color={colors.inputBorder}>{'▄'.repeat(Math.max(1, terminalSize.columns))}</Text>
                            </Box>
                            <Box
                                backgroundColor={colors.inputBg}
                                paddingX={1}
                                paddingY={0}
                                width="100%"
                                flexDirection="column"
                            >
                                <Box flexDirection="column" width="100%">
                                    <Box flexDirection="row" width="100%" paddingY={0}>
                                        <Box flexShrink={0} width={4}>
                                            <Text color={colors.inputPrompt} bold>{(isProcessing || isCompressing) ? "✦  " : " ❯  "}</Text>
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
                                                            <Text color={colors.inputPrompt} bold>  Press ESC again to {input.length > 0 ? 'clear input' : 'revert codebase to checkpoint'}...</Text>
                                                        ) : (
                                                            <Text color={colors.inputPlaceholder}>{escPressed ? "  Press ESC again to cancel the request." : isCompressing ? "  Compacting session history, please wait..." : !isProcessing ? `  Send message, @file or /cmd ... (${terminalEnv.shortcut} for newline)` : "  Enter a prompt to steer the agent."}</Text>
                                                        )}
                                                    </Box>
                                                )}
                                                <MultilineInput
                                                    key={`input-${inputKey}`}
                                                    onPasteStateChange={setHasPasteBlock}
                                                    focus={!isTerminalFocused && !isCompressing}
                                                    showCursor={isAppFocused && !isCompressing}
                                                    cursorColor={colors.inputText}
                                                    lastFocusEventTime={lastFocusEventTime.current}
                                                    value={input}
                                                    textStyle={{ bold: true, color: colors.inputText }}
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
                                <Text color={colors.inputBorder}>{'▀'.repeat(Math.max(1, terminalSize.columns))}</Text>
                            </Box>
                        </Box>
                    </Box>
                );
        }
    };

    return (
        <Box flexDirection="column" width="100%">
            {isInitializing ? null : showBridgePromo ? (
                <BridgePromo width={stdout?.columns || 80} height={stdout?.rows || 24} selectedIndex={promoSelectedIndex} aiProvider={aiProvider} theme={systemSettings.theme} />
            ) : (
                <>
                    <Box paddingX={1} flexDirection="column" width="100%">
                        <Static key={`static-${clearKey}-${chatId}-${terminalSize.columns}-${terminalSize.rows}-${systemSettings.theme}`} items={parsedBlocks.completed}>
                            {(block) => (
                                <BlockItem
                                    key={block.key}
                                    block={block}
                                    columns={(stdout?.columns || 80) - 2}
                                    showFullThinking={showFullThinking}
                                    aiProvider={aiProvider}
                                    version={versionFluxflow}
                                    theme={systemSettings.theme}
                                />
                            )}
                        </Static>
                    </Box>

                    <Box flexDirection="column" paddingX={1} paddingBottom={0} width="100%">
                        {(activeView === 'chat' || ['ask', 'approval', 'terminalApproval'].includes(activeView)) && (
                            <Box flexDirection="column" width="100%">
                                {parsedBlocks.active.map((block) => (
                                    <BlockItem
                                        key={block.key}
                                        block={block}
                                        columns={Math.max(20, (stdout?.columns || 80) - 2)}
                                        showFullThinking={showFullThinking}
                                        aiProvider={aiProvider}
                                        version={versionFluxflow}
                                        theme={systemSettings.theme}
                                    />
                                ))}
                                {activeCommand && (
                                    <Box marginTop={1}>
                                        <TerminalBox command={activeCommand} output={execOutput} isFocused={isTerminalFocused} isPty={isActiveCommandPty} terminalHeight={terminalSize.rows} columns={terminalSize.columns} />
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
                                                    searchable={true}
                                                    items={[
                                                        { label: 'Google', value: 'Google' },
                                                        { label: 'Nvidia', value: 'NVIDIA' },
                                                        { label: 'DeepSeek', value: 'DeepSeek' },
                                                        { label: 'InferX', value: 'InferX' },
                                                        { label: 'SenseNova', value: 'SenseNova' },
                                                        { label: 'CrofAI', value: 'CrofAI' },
                                                        { label: 'Ollama', value: 'Ollama' },
                                                        { label: 'Mistral [EXPERIMENTAL]', value: 'Mistral' },
                                                        { label: 'OpenRouter [EXPERIMENTAL]', value: 'OpenRouter' },
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
                                            <Text color="white">
                                                {aiProvider === 'Ollama'
                                                    ? 'Enter Ollama API Key (or type LOCAL to use local host):'
                                                    : `Enter your ${aiProvider} API Key:`}
                                            </Text>
                                            <Box marginTop={1}>
                                                <Text color="gray" bold> {'>'} </Text>
                                                <TextInput
                                                    value={tempKey}
                                                    onChange={setTempKey}
                                                    onSubmit={handleSetup}
                                                    mask="*"
                                                />
                                            </Box>
                                        </>
                                    )}
                                </Box>

                                <Box paddingX={1} marginTop={1}>
                                    <Text color="gray" italic>{setupStep === 0 ? '(Use arrows to select and Enter to confirm, ESC to go back)' : '(Press Enter to confirm and initialize, ESC to go back)'}</Text>
                                </Box>
                            </Box>
                        ) : (
                            renderActiveView()
                        )}

                        {confirmExit && (
                            <Box borderStyle="round" borderColor={colors.borderMuted} paddingX={1} marginY={0} width="100%">
                                <Text>
                                    <Text color="red" bold>🔴 EXIT: </Text>
                                    <Text color={colors.text}>Press </Text>
                                    <Text color={colors.text} bold>CTRL+C</Text>
                                    <Text color={colors.text}> again to exit ({exitCountdown}s) • Press </Text>
                                    <Text color={colors.textMuted} bold>ESC</Text>
                                    <Text color={colors.text}> to cancel</Text>
                                </Text>
                            </Box>
                        )}

                        {/* 💡 Modernized Suggestion Box - Sleek, structured, and premium */}
                        {suggestions.length > 0 && (() => {
                            const windowSize = 5;
                            let startIdx = suggestionOffsetRef.current;

                            // Find the first selectable index
                            let firstSelectableIndex = 0;
                            while (firstSelectableIndex < suggestions.length) {
                                const sug = suggestions[firstSelectableIndex];
                                const cmdName = sug?.cmd || sug || '';
                                if (typeof cmdName === 'string' && cmdName.trimStart().startsWith('---')) {
                                    firstSelectableIndex++;
                                } else {
                                    break;
                                }
                            }

                            // Adjust offset based on selectedIndex to scroll only at edges
                            if (selectedIndex <= firstSelectableIndex) {
                                startIdx = 0;
                            } else if (selectedIndex < startIdx) {
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
                                        <Text color={colors.text} bold>
                                            {suggestions[0]?.cmd?.startsWith('@') || suggestions[0]?.cmd?.startsWith('\\@') ? "FILE SUGGESTIONS" : "COMMAND SUGGESTIONS"}
                                        </Text>
                                        {suggestions[0]?.cmd?.startsWith('@') || suggestions[0]?.cmd?.startsWith('\\@') ? (
                                            <Text color={colors.textMuted} italic>
                                                (Use #Lstart-Lend to specify line numbers)
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
                                            } else if (aiProvider === 'CrofAI') {
                                                url = "https://crof.ai";
                                                label = "account";
                                            }
                                            // return (
                                            //     <Text color={colors.textMuted} italic>
                                            //         Paid API Strategy has more models. Configure <Text color={colors.secondary} underline>{`\u001b]8;;${url}\u0007${label}\u001b]8;;\u0007`}</Text> & /settings
                                            //     </Text>
                                            // );
                                        })() : null}
                                    </Box>

                                    {visible.slice(0, suggestionVisibleCount).map((s, i) => {
                                        const actualIdx = startIdx + i;
                                        const isActive = actualIdx === selectedIndex;
                                        const isDivider = typeof s.cmd === 'string' && s.cmd.trimStart().startsWith('---');
                                        const isGemmaDisabled = s.cmd === getDefaultModel('Google', 'Free') && apiTier !== 'Free';

                                        return (
                                            <Box
                                                key={s.cmd}
                                                flexDirection="row"
                                                backgroundColor={isActive ? colors.highlightBg : undefined}
                                                paddingX={1}
                                            >
                                                <Box width={3}>
                                                    <Text color={isActive ? colors.text : colors.textMuted} bold={isActive}>{isActive ? " ❯" : "  "}</Text>
                                                </Box>
                                                <Box width={55}>
                                                    <Text
                                                        color={isDivider ? colors.textDim : (isGemmaDisabled ? colors.textMuted : (isActive ? colors.text : colors.textDim))}
                                                        bold={false}
                                                    >
                                                        {s.display || (s.cmd && (s.cmd.startsWith('@[') || s.cmd.startsWith('\\@[')) && s.cmd.endsWith(']') ? (() => {
                                                            // Handle both @[...] and \@[...]
                                                            const pathPart = s.cmd.startsWith('\\@[') ? s.cmd.slice(3, -1) : s.cmd.slice(2, -1);
                                                            const parts = pathPart.split(/[/\\]/);
                                                            return parts[parts.length - 1];
                                                        })() : (s.cmd && s.cmd.includes('/') ? s.cmd.split('/').pop() : s.cmd))}
                                                    </Text>
                                                </Box>
                                                <Box flexGrow={1}>
                                                    <Text color={!isActive ? colors.textMuted : colors.text} italic>{s.desc}</Text>
                                                </Box>
                                            </Box>
                                        );
                                    })}

                                    {/* ⚓ Height Anchor: More indicators for long lists */}
                                    {suggestions.length > 5 && (
                                        <Box paddingX={1} height={1}>
                                            {remaining > 0 ? (
                                                <Text color={colors.textMuted} dimColor italic>   ... ({remaining} more commands available)</Text>
                                            ) : (
                                                <Text color={colors.textMuted} dimColor italic>   (End of list)</Text>
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
                                activeModel={activeModel}
                                isProcessing={isProcessing}
                                lastChunkTime={lastChunkTime}
                                theme={systemSettings.theme}
                                wps={streamingWordStatsRef.current.wps}
                                showTPMEstimate={systemSettings.showTPMEstimate}
                            />
                        </Box>

                        {activeView === 'exit' && (() => {
                            const wallTimeMs = Date.now() - SESSION_START_TIME;

                            const totalTools = runtimeSession.toolSuccess + runtimeSession.toolFailure;
                            const successRate = totalTools > 0 ? ((runtimeSession.toolSuccess / totalTools) * 100).toFixed(1) : '0.0';

                            const agentActiveMs = sessionApiTime + sessionToolTime;
                            const apiPercent = agentActiveMs > 0 ? ((sessionApiTime / agentActiveMs) * 100).toFixed(1) : '0.0';
                            const toolPercent = agentActiveMs > 0 ? ((sessionToolTime / agentActiveMs) * 100).toFixed(1) : '0.0';

                            return (
                                <Box flexDirection="column" borderStyle="round" paddingX={3} paddingY={1} borderColor={colors.borderMuted} width={Math.min(100, (stdout?.columns || 100) - 2)} marginTop={0} marginBottom={0}>
                                    <Box marginBottom={1}>
                                        <Text bold>{gradient(colors.logoGradient || ['blue', 'purple'])('Agent powering down. Goodbye!')}</Text>
                                    </Box>
                                    <Box flexDirection="column">
                                        <Text color={colors.text} bold underline>Interaction Summary</Text>
                                        <Box marginTop={1}>
                                            <Box width={20}><Text color={colors.secondary}>Session ID:</Text></Box>
                                            <Text color={colors.text}>{chatId}</Text>
                                        </Box>
                                        <Box>
                                            <Box width={20}><Text color={colors.secondary}>Tool Calls:</Text></Box>
                                            <Text color={colors.text}>{runtimeSession.toolSuccess + runtimeSession.toolFailure + runtimeSession.toolDenied} ( <Text color="green">✔ {runtimeSession.toolSuccess}</Text> <Text color="yellow">🛇 {runtimeSession.toolDenied}</Text> <Text color="red">✘ {runtimeSession.toolFailure}</Text> )</Text>
                                        </Box>
                                        <Box>
                                            <Box width={20}><Text color={colors.secondary}>Success Rate:</Text></Box>
                                            <Text color={colors.text}>{successRate}%</Text>
                                        </Box>
                                        <Box>
                                            <Box width={20}><Text color={colors.secondary}>Code Changes:</Text></Box>
                                            <Text color={colors.text}><Text color="green">+{runtimeSession.linesAdded}</Text> <Text color="red">-{runtimeSession.linesRemoved}</Text></Text>
                                        </Box>
                                        {sessionTotalTokens > 0 && (
                                            <>
                                                <Box>
                                                    <Box width={20}><Text color={colors.secondary}>Tokens Consumed:</Text></Box>
                                                    <Text color={colors.text}>{formatTokens(sessionTotalTokens)}</Text>
                                                </Box>
                                                <Box marginLeft={2}>
                                                    <Box width={18}><Text color={colors.textMuted}>» Input Tokens:</Text></Box>
                                                    <Text color={colors.text}>{formatTokens(sessionTotalTokens - sessionTotalCandidateTokens)}</Text>
                                                </Box>
                                                {sessionTotalCachedTokens > 0 && (
                                                    <Box marginLeft={4}>
                                                        <Box width={16}><Text color={colors.textMuted}>» Cached:</Text></Box>
                                                        <Text color={colors.text}>{formatTokens(sessionTotalCachedTokens)}</Text>
                                                    </Box>
                                                )}
                                                {sessionTotalCandidateTokens > 0 && (
                                                    <Box marginLeft={2}>
                                                        <Box width={18}><Text color={colors.textMuted}>» Output Tokens:</Text></Box>
                                                        <Text color={colors.text}>{formatTokens(sessionTotalCandidateTokens)}</Text>
                                                    </Box>
                                                )}
                                            </>
                                        )}
                                        {sessionImageCount > 0 && (
                                            <>
                                                <Box>
                                                    <Box width={20}><Text color={colors.secondary}>Images Made:</Text></Box>
                                                    <Text color={colors.text}>{sessionImageCount}</Text>
                                                </Box>
                                                <Box>
                                                    <Box width={20}><Text color={colors.secondary}>Image Credits:</Text></Box>
                                                    <Text color={colors.text}>{Number(((sessionImageCredits || 0) * 1000).toFixed(0))} credits</Text>
                                                </Box>
                                            </>
                                        )}
                                    </Box>

                                    <Box flexDirection="column" marginTop={1}>
                                        <Text color={colors.text} bold underline>Performance</Text>
                                        <Box marginTop={1}>
                                            <Box width={20}><Text color={colors.secondary}>Wall Time:</Text></Box>
                                            <Text color={colors.text}>{formatMsDuration(wallTimeMs)}</Text>
                                        </Box>
                                        <Box>
                                            <Box width={20}><Text color={colors.secondary}>Agent Active:</Text></Box>
                                            <Text color={colors.text}>{formatMsDuration(agentActiveMs)}</Text>
                                        </Box>
                                        <Box marginLeft={2}>
                                            <Box width={18}><Text color={colors.textMuted}>» API Time:</Text></Box>
                                            <Text color={colors.text}>{formatMsDuration(sessionApiTime)} ({apiPercent}%)</Text>
                                        </Box>
                                        <Box marginLeft={2}>
                                            <Box width={18}><Text color={colors.textMuted}>» Tool Time:</Text></Box>
                                            <Text color={colors.text}>{formatMsDuration(sessionToolTime)} ({toolPercent}%)</Text>
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
