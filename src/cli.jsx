#!/usr/bin/env node
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

/**
 * AUTO-HEAP SCALER (4GB)
 * This ensures the agent can handle massive sessions and large project scans
 * without hitting Node's default memory limits.
 */
const HEAP_LIMIT = 4096;
const isBundled = fileURLToPath(import.meta.url).endsWith('.js');

if (isBundled && !process.execArgv.some(arg => arg.includes('max-old-space-size'))) {
    const cp = spawn(process.execPath, [
        `--max-old-space-size=${HEAP_LIMIT}`,
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

    if (isVersion || isHelp || isHelpCommands || isUpdate) {
        const fs = await import('fs');
        const path = await import('path');
        const { fileURLToPath } = await import('url');

        const packageJsonPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../package.json');
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const versionFluxflow = packageJson.version;

        if (isVersion) {
            console.log(`v${versionFluxflow}`);
            process.exit(0);
        }

        if (isHelp) {
            console.log(`FluxFlow CLI Arguments:
  --mode <flux|flow>                   Set startup mode (flux: Agent / flow: Chat)
  --model <model_name>                 Set startup AI model
  --key <key@provider>                 Set API key and provider
  --provider <google|deepseek|openrouter> Override default provider
  --thinking <Fast|Low|Medium|High|xHigh> Set startup thinking level
  --memory <on|off>                    Toggle memory system
  --resume <session_id>                Resume a previous session
  --package <npm|pnpm|yarn|bun>        Set package manager for updates
  --auto-del <1d|7d|30d>               Set history auto-deletion timeframe
  --auto-exec <on|off>                 Toggle permission for autonomous command execution
  --yolo <on|off>                      Same as --auto-exec
  --external-access <on|off>           Toggle permission for file reads outside CWD
  -v, --version                        Show installed version
  --help                               Show this help menu
  --help commands                      Show available /commands
  --update check                       Check for new updates
  --update check latest                Show the latest version available on npm
  --update latest                      Update the app to the latest version`);
            process.exit(0);
        }

        if (isHelpCommands) {
            console.log(`FluxFlow Chat /Commands:
  /quit                                Exit and shutdown Flux
  /help                                Show help menu
  /clear                               Clear terminal screen
  /resume                              Load previous session
  /revert                              Revert codebase back to a checkpoint
  /save                                Force save current chat
  /export                              Export current chat in a .txt file
  /chats                               List all chat sessions
  /image setup key <default|custom>    Configure image API key strategy
  /image setup quality <low...premium> Configure default image generation quality
  /image stats                         Show image quota stats
  /mode <flux|flow>                    Toggle Flux/Flow modes
  /thinking <Fast|Low|Medium|High|xHigh> Set AI reasoning depth
  /model <model_name>                  Switch Model for Agent
  /settings                            Configure system preferences
  /key                                 Manage API keys
  /profile                             Edit developer persona
  /memory                              Manage agent memory
  /stats                               Show session usage
  /reset                               Wipe all project data
  /about                               Project info & credits
  /changelog                           View latest updates
  /fluxflow init                       Create FluxFlow.md template
  /update check                        Check for new version
  /update latest                       Install latest release`);
            process.exit(0);
        }

        if (isUpdate) {
            const subArg = args[1];
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

                    const { loadSettings } = await import('./utils/settings.js');
                    const settings = await loadSettings();
                    const manager = settings?.systemSettings?.updateManager || settings?.updateManager || 'npm';
                    let command = '';
                    if (manager === 'pnpm') command = `pnpm add -g fluxflow-cli@${latestVersion}`;
                    else if (manager === 'bun') command = `bun add -g fluxflow-cli@${latestVersion}`;
                    else if (manager === 'yarn') command = `yarn global add fluxflow-cli@${latestVersion}`;
                    else if (manager === 'custom') command = settings.customUpdateCommand || `npm install -g fluxflow-cli@${latestVersion}`;
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
                console.error('Unknown update command. Available options: --update check, --update check latest, --update latest');
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

    // 3. CLEAN SLATE (Non-destructive clear to preserve scrollback and title)
    process.stdout.write('\x1b[2J\x1b[3J\x1b[H');

    // 4. SET TERMINAL TITLE (Standard + VS Code/Antigravity specific)
    if (process.stdout.isTTY) {
        process.stdout.write('\x1b]0;FluxFlow\x07');
        process.stdout.write('\x1b]633;P;TerminalTitle=FluxFlow\x07');
    }

    render(<App args={process.argv.slice(2)} />, { exitOnCtrlC: false });
}
