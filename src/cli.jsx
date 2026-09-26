#!/usr/bin/env node
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import os from 'os';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { FLUXFLOW_DIR } from './utils/paths.js';

// Ensure AGENTS.md and FLUXFLOW.md exist in FLUXFLOW_DIR
try {
    const agentsMdPath = path.join(FLUXFLOW_DIR, 'AGENTS.md');
    const fluxflowMdPath = path.join(FLUXFLOW_DIR, 'FLUXFLOW.md');

    if (!fs.existsSync(FLUXFLOW_DIR)) {
        fs.mkdirSync(FLUXFLOW_DIR, { recursive: true });
    }

    if (!fs.existsSync(agentsMdPath)) {
        fs.writeFileSync(agentsMdPath, '', 'utf8');
    }

    if (!fs.existsSync(fluxflowMdPath)) {
        fs.writeFileSync(fluxflowMdPath, '', 'utf8');
    }
} catch (e) {
    // Ignore error if directory or file initialization fails
}

// Base generic envs
dotenv.config({ path: './.env', override: true, quiet: true });
dotenv.config({ path: `${FLUXFLOW_DIR}/.env`, override: true, quiet: true });

// Legacy custom envs (for backward compatibility)
// dotenv.config({ path: './agents.env', override: true, quiet: true });
// dotenv.config({ path: './.agents.env', override: true, quiet: true });
// dotenv.config({ path: `${FLUXFLOW_DIR}/agents.env`, override: true, quiet: true });
// dotenv.config({ path: `${FLUXFLOW_DIR}/.agents.env`, override: true, quiet: true });
// dotenv.config({ path: './fluxflow.env', override: true, quiet: true });
// dotenv.config({ path: './.fluxflow.env', override: true, quiet: true });
// dotenv.config({ path: `${FLUXFLOW_DIR}/fluxflow.env`, override: true, quiet: true });
// dotenv.config({ path: `${FLUXFLOW_DIR}/.fluxflow.env`, override: true, quiet: true });

// Conventional custom envs (.env.<name>)
dotenv.config({ path: `${FLUXFLOW_DIR}/.env.agents`, override: true, quiet: true });
dotenv.config({ path: `${FLUXFLOW_DIR}/.env.fluxflow`, override: true, quiet: true });
dotenv.config({ path: './.env.agents', override: true, quiet: true });
dotenv.config({ path: './.env.fluxflow', override: true, quiet: true });
process.env.NO_INS = false;

/**
 * AUTO-HEAP SCALER
 * This ensures the agent can handle massive sessions and large project scans
 * without hitting Node's default memory limits.
 */
const totalSystemRamBytes = os.totalmem();
const totalSystemRamMB = totalSystemRamBytes / (1024 * 1024);
const SAFETY_MARGIN = 0.50;
const calculatedLimit = Math.floor(totalSystemRamMB * SAFETY_MARGIN);

// Allow --allocation <mb> to override the auto-calculated heap limit
const _rawArgs = process.argv.slice(2);
const _allocIdx = _rawArgs.indexOf('--allocation');
const _allocValue = _allocIdx !== -1 ? parseInt(_rawArgs[_allocIdx + 1], 10) : NaN;
const experimentalMemory = process.env.EXPERIMENTAL_MEMORY_MANAGER === 'true' || process.env.EXPERIMENTAL_MEMORY_MANAGER === '1' || process.env.EXPERIMENTAL_MEMORY_MANAGER === true || process.env.EXPERIMENTAL_MEMORY_MANAGER === 1 || false;
const shouldRespawn = !isNaN(_allocValue) || experimentalMemory || false;

if (!isNaN(_allocValue) && _allocValue < 64) {
    console.error(`\n[ERROR] Allocation value '${_allocValue} MB' is too low. Minimum: 64 MB, Recommended: 4096 MB.\n`);
    process.exit(1);
}

const _maxAllowed = Math.floor(totalSystemRamMB * 0.75);
const HEAP_LIMIT = (!isNaN(_allocValue) && _allocValue > 0)
    ? Math.min(_allocValue, _maxAllowed)
    : Math.max(1536, Math.min(32768, calculatedLimit));

const isBundled = fileURLToPath(import.meta.url).endsWith('.js');

if (isBundled && !process.execArgv.some(arg => arg.includes('max-old-space-size')) && shouldRespawn) {
    if (!Number.isNaN(_allocValue)) {
        console.log(`\n[MEMORY] Starting with: '${_allocValue > _maxAllowed ? _maxAllowed : _allocValue} MB' Allocation${_allocValue > _maxAllowed ? " (Max allowed: '" + _maxAllowed + " MB')" : ""}. Please Wait...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
    }
    // else {
    //     console.log(`\n[MEMORY] Allocated '${HEAP_LIMIT} MB'.`);
    // }

    const cp = spawn(process.execPath, [
        `--max-old-space-size=${HEAP_LIMIT}`, `--expose-gc`, `--max-semi-space-size=1`,
        fileURLToPath(import.meta.url),
        ...process.argv.slice(2)
    ], { stdio: 'inherit' });
    cp.on('exit', (code) => process.exit(code || 0));
} else {
    // Check CLI-only commands before starting application
    const args = process.argv.slice(2);

    const isHelpCommands = args.includes('--help') && args[args.indexOf('--help') + 1] === 'commands';
    const isHelp = args.includes('--help') && !isHelpCommands;
    const isVersion = args.includes('--version') || args.includes('-v');
    const isUpdate = args[0] === '--update';
    const isExport = args[0] === '--export';
    const isUsage = args[0] === '--usage' || args.includes('--usage') || args[0] === '--budget' || args.includes('--budget');

    if (isUsage) {
        const { openUsageDashboard } = await import('./utils/usageServer.js');
        const { url } = await openUsageDashboard();
        console.log(`\n✦ FluxFlow Token Usage & Analytics Dashboard\n⠀⠀└─ Serving at: ${url}\n⠀⠀└─ Opened in default browser. Press Ctrl+C to stop.\n`);
        // Keep server process running
        await new Promise(() => { });
    }

    if (isVersion || isHelp || isHelpCommands || isUpdate || isExport) {
        const fs = await import('fs');
        const path = await import('path');
        const { fileURLToPath } = await import('url');

        const packageJsonPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../package.json');
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const versionFluxflow = packageJson.version;

        if (isExport) {
            const subArg = (args[1] || '').toLowerCase();
            if (subArg === 'error' || subArg === 'logs') {
                try {
                    const { exportErrorLogs } = await import('./utils/export.js');
                    const result = await exportErrorLogs();
                    console.log(`[EXPORT LOGS] Exported ${result.entryCount} error log entries (FluxFlow: ${result.fluxflowCount}, Memory: ${result.memoryCount}, Usage: ${result.usageCount}) to "${result.exportFile}"`);
                    process.exit(0);
                } catch (err) {
                    console.error(`[EXPORT ERROR] Failed to export error logs: ${err.message}`);
                    process.exit(1);
                }
            } else {
                console.error(`[EXPORT ERROR] Invalid export target "${args[1] || ''}". --export only supports 'error'.\nUsage: fluxflow --export error`);
                process.exit(1);
            }
        }

        if (isVersion) {
            console.log(`v${versionFluxflow}`);
            process.exit(0);
        }

        if (isHelp) {
            console.log(`FluxFlow CLI Arguments:
  --mode <flux|flow|icu|omni>              Set startup mode (Agent / Chat / Computer Use / Sentient being)
  --model <model_name>                     Set startup AI model
  --key <key@provider>                     Set API key and provider
  --provider                               Override default provider
  --thinking <Fast|Low|Medium|High|xHigh>  Set startup thinking level
  --memory <on|off>                        Toggle memory system
  --resume <session_id>                    Resume a previous session
  --allocation <mb>                        Override Node.js max-old-space-size in MB (default: auto)
  --package <npm|pnpm|yarn|bun>            Set package manager for updates
  --auto-del <1d|7d|30d>                   Set history auto-deletion timeframe
  --auto-exec <on|off>                     Toggle permission for autonomous command execution
  --yolo <on|off>                          Same as --auto-exec
  --external-access <on|off>               Toggle permission for file reads outside CWD
  -p, --prompt <text> [-n|--new]           One-shot non-TUI answer (-n to start fresh conversation)
  -v, --version                            Show installed version
  --help                                   Show this help menu
  --help commands                          Show available /commands
  --playground                             Launch in Playground mode (fixed session, CWD: DATA_DIR/playground)
  --cwd <path>                             Set working directory to path
  --path <path>                            Same as --cwd, set working directory
  --usage                                  Open token usage analytics dashboard in browser
  --export error                           Export system error logs to fluxflow-error-<timestamp>.txt
  --update check                           Check for new updates
  --update check latest                    Show the latest version available on npm
  --update [latest]                        Update the app to the latest version (latest is default)`);
            process.exit(0);
        }

        if (isHelpCommands) {
            console.log(`FluxFlow Chat /Commands:
  /quit                                    Exit and shutdown Flux
  /help                                    Show help menu
  /clear                                   Clear terminal screen
  /resume                                  Load previous session
  /compress                                Summarize and compress chat history
  /truncate                                Truncate tool results in chat history
  /revert                                  Revert codebase back to a checkpoint
  /save                                    Force save current chat
  /export [chat|logs]                      Export chat session or system error logs
  /chats                                   List all chat sessions
  /btw <question>                          Send raw inquiry to the agent mid-turn
  /image setup key <default|custom>        Configure image API key strategy
  /budget                                  Set or View budget limits
  /mode <flux|flow>                        Toggle Flux/Flow modes
  /thinking <level> [--map <target>]       Set AI reasoning depth or map thinking levels
  /model <model_id> [-sv|-rm|-rn|-df]      Switch or manage models for active provider
  /wildcard-tooling                        Use if the model lacks Tooling Capability
  /provider                                Select AI Provider
  /settings                                Configure system preferences
  /theme                                   Customize UI color theme
  /key                                     Manage API keys
  /profile                                 Edit developer persona
  /memory <view|migrate>                   Manage agent memory or migrate to AGENTS.md
  /stats                                   Show session usage
  /usage                                   Open graphical token analytics dashboard in browser
  /reset                                   Wipe all project data
  /about                                   Project info & credits
  /changelog                               View latest updates
  /docs                                    View documentation
  /fluxflow init                           Create FluxFlow.md template
  /update check                            Check for new version
  /update latest                           Install latest release`);
            process.exit(0);
        }

        if (isUpdate) {
            const subArg = args[1] || 'latest';
            if (subArg === 'check') {
                const checkLatest = args[2] === 'latest';
                try {
                    const response = await fetch('https://registry.npmjs.org/fluxflow-cli', { cache: 'no-store' });
                    const data = await response.json();
                    const latestVersion = data['dist-tags']?.latest;
                    if (!latestVersion) {
                        console.error('Error: Could not retrieve latest version.');
                        process.exit(1);
                    }
                    if (checkLatest) {
                        console.log(`Latest version: v${latestVersion}`);
                    } else {
                        if (latestVersion !== versionFluxflow) {
                            console.log(`A new version of FluxFlow is available: v${latestVersion} (current: v${versionFluxflow}). Run "fluxflow --update latest" to upgrade.`);
                        } else {
                            console.log(`FluxFlow is up to date (v${versionFluxflow}).`);
                        }
                    }
                } catch (err) {
                    console.error('Error checking for updates:', err.message);
                    process.exit(1);
                }
                process.exit(0);
            } else if (subArg === 'latest') {
                console.log('Checking latest version and settings...');
                try {
                    const response = await fetch('https://registry.npmjs.org/fluxflow-cli', { cache: 'no-store' });
                    const data = await response.json();
                    const latestVersion = data['dist-tags']?.latest;
                    if (!latestVersion) {
                        console.error('Error: Could not retrieve latest version.');
                        process.exit(1);
                    }
                    if (latestVersion === versionFluxflow) {
                        console.log(`FluxFlow is already up to date (v${versionFluxflow}).`);
                        process.exit(0);
                    }

                    const promptPackageManager = async () => {
                        const React = (await import('react')).default;
                        const { useState } = React;
                        const { render, Box, Text } = await import('ink');
                        const SelectInput = (await import('ink-select-input')).default;
                        const TextInput = (await import('ink-text-input')).default;

                        return new Promise((resolve) => {
                            const items = [
                                { label: 'NPM', value: 'npm' },
                                { label: 'PNPM', value: 'pnpm' },
                                { label: 'Yarn', value: 'yarn' },
                                { label: 'Bun', value: 'bun' },
                                { label: 'Custom Command', value: 'custom' }
                            ];

                            const CustomItem = ({ label, isSelected }) => {
                                return (
                                    <Box width="100%">
                                        <Text bold={isSelected}>
                                            └─ {isSelected ? '\x1b[32m●\x1b[0m' : '○'} {label}
                                        </Text>
                                    </Box>
                                );
                            };

                            let unmountFn;

                            const PromptComponent = () => {
                                const [step, setStep] = useState('select'); // 'select' | 'custom'
                                const [customCommand, setCustomCommand] = useState('');

                                const handleSelect = (item) => {
                                    if (item.value === 'custom') {
                                        setStep('custom');
                                    } else {
                                        cleanupAndResolve({ manager: item.value });
                                    }
                                };

                                const handleCustomSubmit = (value) => {
                                    cleanupAndResolve({ manager: 'custom', customCommand: value });
                                };

                                if (step === 'custom') {
                                    return (
                                        <Box flexDirection="column" marginY={1}>
                                            <Box marginBottom={1}>
                                                <Text color="magenta" bold>🔧 Enter custom update command:</Text>
                                            </Box>
                                            <Box flexDirection="row">
                                                <Text color="cyan" bold>   ❯ </Text>
                                                <TextInput
                                                    value={customCommand}
                                                    onChange={setCustomCommand}
                                                    onSubmit={handleCustomSubmit}
                                                />
                                            </Box>
                                            <Box marginTop={1}>
                                                <Text color="gray" dimColor italic>   (Press Enter to confirm)</Text>
                                            </Box>
                                        </Box>
                                    );
                                }

                                return (
                                    <Box flexDirection="column" marginY={1}>
                                        <Box marginBottom={1}>
                                            <Text color="magenta" bold>📦 Select a package manager for the update:</Text>
                                        </Box>
                                        <SelectInput
                                            items={items}
                                            onSelect={handleSelect}
                                            itemComponent={CustomItem}
                                            indicatorComponent={() => null}
                                        />
                                    </Box>
                                );
                            };

                            const cleanupAndResolve = (val) => {
                                if (unmountFn) unmountFn();
                                resolve(val);
                            };

                            const { unmount } = render(<PromptComponent />);
                            unmountFn = unmount;
                        });
                    };

                    let manager;
                    let customCommand = '';
                    let settings;
                    try {
                        const { loadSettings } = await import('./utils/settings.js');
                        settings = await loadSettings();
                        manager = settings?.systemSettings?.updateManager || settings?.updateManager;
                    } catch (e) {
                        // settings.js not found or failed to load
                    }

                    if (!manager) {
                        const result = await promptPackageManager();
                        manager = result.manager;
                        customCommand = result.customCommand;
                    }

                    let command = '';
                    if (manager === 'pnpm') command = `pnpm add -g fluxflow-cli@${latestVersion}`;
                    else if (manager === 'bun') command = `bun add -g fluxflow-cli@${latestVersion}`;
                    else if (manager === 'yarn') command = `yarn global add fluxflow-cli@${latestVersion}`;
                    else if (manager === 'custom') command = customCommand || settings?.customUpdateCommand || `npm install -g fluxflow-cli@${latestVersion}`;
                    else command = `npm install -g fluxflow-cli@${latestVersion}`;

                    console.log(`Updating FluxFlow to v${latestVersion} using ${manager}...`);
                    console.log(`Running: ${command}`);

                    const { execSync } = await import('child_process');
                    execSync(command, { stdio: 'inherit' });
                    console.log(`\x1b[32m✅ Update successful! FluxFlow updated to v${latestVersion}.\x1b[0m`);
                } catch (err) {
                    console.error('\x1b[31m❌ Update failed:\x1b[0m', err.message);
                    process.exit(1);
                }
                process.exit(0);
            } else {
                console.error('Unknown update command. Available options: --update, --update check, --update check latest, --update latest');
                process.exit(1);
            }
        }
    }

    // START APPLICATION
    const { default: React } = await import('react');
    const { render } = await import('ink');
    const { default: App } = await import('./app.jsx');

    // 1. SUPPRESS NOISE
    process.env.NODE_NO_WARNINGS = '1';

    // 2. LOG HIJACKER
    const silentPatterns = [
        'cuimp', 'Found existing binary', 'Binary verified',
        'curl.exe not found', 'Falling back to .bat file', 'DeprecationWarning'
    ];

    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    const isNoise = (args) => {
        const msg = args.map(String).join(' ');
        return silentPatterns.some(p => msg.includes(p));
    };

    console.log = (...args) => !isNoise(args) && originalLog(...args);
    console.warn = (...args) => !isNoise(args) && originalWarn(...args);
    console.error = (...args) => !isNoise(args) && originalError(...args);

    // 3. CWD/PATH: Allow setting working directory via --cwd or --path
    const cwdIndex = args.findIndex(arg => arg === '--cwd' || arg === '--path');
    if (cwdIndex !== -1 && cwdIndex + 1 < args.length) {
        const targetCwd = args[cwdIndex + 1];
        const pathMod = await import('path');
        const fsMod = await import('fs-extra');
        const resolvedPath = pathMod.default.resolve(targetCwd);
        try {
            if (fsMod.default.existsSync(resolvedPath) && fsMod.default.statSync(resolvedPath).isDirectory()) {
                process.chdir(resolvedPath);
            } else {
                console.error(`[ERROR] Directory not found: "${targetCwd}"`);
                process.exit(0);
            }
        } catch (e) {
            console.error(`[ERROR] Failed to change directory to "${targetCwd}": ${e.message}`);
            process.exit(0);
        }
    }

    // 3.5 ONE-SHOT PROMPT: -p/--prompt -> non-TUI, custom system instruction, no loop
    const promptIdx = args.findIndex(a => a === '-p' || a === '--prompt');
    if (promptIdx !== -1) {
        const isNewChat = args.includes('--new') || args.includes('-n');
        // Find the prompt text (the first non-flag argument after -p/--prompt)
        const postPromptArgs = args.slice(promptIdx + 1).filter(a => a !== '-n' && a !== '--new');
        const promptText = postPromptArgs[0];

        if (!promptText) {
            console.error('[ERROR] -p/--prompt requires a prompt string.');
            process.exit(1);
        }
        const { loadSettings } = await import('./utils/settings.js');
        const { getProviderAPIKey } = await import('./utils/secrets.js');
        const { getDefaultModel } = await import('./data/model_config.js');
        const { generateSimpleContent } = await import('./utils/ai.js');
        const { checkQuotaDetailed } = await import('./utils/usage.js');

        const baseSettings = await loadSettings();
        const scanArgs = args.filter(a => a !== '-p' && a !== '--prompt' && a !== promptText && a !== '-n' && a !== '--new');
        const getFlag = (names) => {
            for (const n of names) {
                const i = scanArgs.indexOf(n);
                if (i !== -1 && i + 1 < scanArgs.length) return scanArgs[i + 1];
            }
            return null;
        };
        const provider = getFlag(['--provider']) || baseSettings.aiProvider || 'Google';
        const model = getFlag(['--model']) || baseSettings.activeModel || getDefaultModel(provider, baseSettings.apiTier) || getDefaultModel(provider, 'paid');
        const apiKey = getFlag(['--key']) || await getProviderAPIKey(provider);

        if (!apiKey) {
            console.error(`[ERROR] No API key resolved for provider "${provider}".`);
            process.exit(1);
        }

        const quotaCheck = await checkQuotaDetailed('agent', { aiProvider: provider });
        if (!quotaCheck.allowed) {
            console.error(`[ERROR] ${quotaCheck.reason || 'Budget Exhausted'} - adjust with /budget set.`);
            process.exit(1);
        }

        const oneShotSettings = {
            aiProvider: provider,
            apiKey,
            model,
            mode: 'flow',
            thinkingLevel: getFlag(['--thinking']) || 'Fast',
            systemSettings: baseSettings.systemSettings || {},
        };

        const osDetected = process.platform === 'win32' ? 'Windows' : process.platform === 'darwin' ? 'macOS' : 'Linux';
        const now = new Date();
        const year = now.getFullYear();
        const month = now.toLocaleString('en-US', { month: 'short' }).toUpperCase();
        const day = String(now.getDate()).padStart(2, '0');
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', hour12: true });
        const dateTimeStr = `${year}-${month}-${day}, ${timeStr}`;

        const oneShotInstruction = `Identity: FluxFlow. Sassy, CLI Assistant
Use NO markdown, only plain text
Additional Context:
- OS: ${osDetected}
- Model: ${path.basename(oneShotSettings.model).trim().replace(':free', '').replace('-free', '').replace('/free', '').replaceAll('-', ' ').replace(/\b\w/g, char => char.toUpperCase().trim())}
- Approx time: ${dateTimeStr}
- Non interactive CLI, no tools
- \`fluxflow\` TUI for full capability`.trim();

        const { getPromptSessionHistory, savePromptSessionHistory, clearPromptSessionHistory } = await import('./utils/sessionDaemon.js');

        let sessionHistory = [];
        if (isNewChat) {
            await clearPromptSessionHistory();
        } else {
            sessionHistory = await getPromptSessionHistory();
        }

        const formattedContents = [];
        if (Array.isArray(sessionHistory) && sessionHistory.length > 0) {
            for (const item of sessionHistory) {
                if (item.text) {
                    formattedContents.push({
                        role: item.role === 'model' ? 'model' : 'user',
                        parts: [{ text: item.text }]
                    });
                }
            }
        }
        formattedContents.push({
            role: 'user',
            parts: [{ text: promptText }]
        });

        try {
            // ANSI colour codes:
            // \x1b[36m = Cyan, \x1b[35m = Magenta, \x1b[0m = Reset
            const cyan = '\x1b[36m';
            const magenta = '\x1b[35m';
            const reset = '\x1b[0m';

            const modelName = path.basename(oneShotSettings.model)
                .trim()
                .replace(':free', '')
                .replace('-free', '')
                .replace('free/', '')
                .replaceAll('-', ' ')
                .replace(/\b\w/g, char => char.toUpperCase().trim());

            process.stdout.write(`Responding with ${cyan}${modelName}${reset} from ${magenta}${oneShotSettings.aiProvider}${reset}:\n`);
            const { text } = await generateSimpleContent(oneShotSettings, model, formattedContents, oneShotInstruction, oneShotSettings.thinkingLevel);
            const responseText = (text || '').trim();
            process.stdout.write(responseText + '\n\n');

            // Persist conversation temporarily into memory daemon (with 10 min idle auto-shutdown)
            if (responseText) {
                await savePromptSessionHistory(promptText, responseText);
            }
        } catch (err) {
            console.error(`[ERROR] Prompt request failed: ${err.message.trim()}\n\n`);
            process.exit(1);
        }
        process.exit(0);
    }

    // 4. CLEAN SLATE (Non-destructive clear to preserve scrollback and title)
    process.stdout.write('\x1b[2J\x1b[3J\x1b[H');

    // 5. SET TERMINAL TITLE AND BRACKETED PASTE
    if (process.stdout.isTTY) {
        process.stdout.write('\x1b]0;FluxFlow\x07');
        process.stdout.write('\x1b]633;P;TerminalTitle=FluxFlow\x07');
        process.stdout.write('\x1b[?2004h'); // Enable bracketed paste mode
    }

    const disableBracketedPaste = () => {
        if (process.stdout.isTTY) {
            process.stdout.write('\x1b[?2004l'); // Disable bracketed paste mode
        }
    };

    process.on('exit', disableBracketedPaste);
    ['SIGINT', 'SIGTERM', 'SIGHUP'].forEach(sig => {
        process.once(sig, () => {
            disableBracketedPaste();
            process.exit(0);
        });
    });

    // 6. PLAYGROUND: pin CWD before first render so StatusBar shows the right path immediately
    if (args.includes('--playground')) {
        const originalCwd = process.cwd();
        process.argv.push('--original-cwd', originalCwd);
        const { DATA_DIR } = await import('./utils/paths.js');
        const pathMod = await import('path');
        const fsMod = await import('fs-extra');
        const playgroundDir = pathMod.default.join(DATA_DIR, 'playground');
        try { fsMod.default.ensureDirSync(playgroundDir); process.chdir(playgroundDir); } catch (e) { /* ignore */ }
    }

    render(<App args={process.argv.slice(2)} />, { exitOnCtrlC: false });
}
