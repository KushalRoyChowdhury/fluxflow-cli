// Export Startup.md content to string
export const STARTUP_MD = `# FluxFlow CLI Startup & Flags Reference

Launch command syntax:
fluxflow [options]

## Supported CLI Flags
* --mode flux | flow | icu | fluxcu → Startup mode
* --model model-id → Session model override
* --provider google | deepseek | openrouter | nvidia | mistral | ollama | inferx | sensenova | aihubmix | poolside | 9router | explabs | tokenharbor | infron → Override default AI provider
* --key key@provider → Set new API key for provider
* --thinking Fast | Low | Medium | High | xHigh → Override reasoning depth
* --path project/path → Set working directory for session
* --memory on | off → Toggle persistent long-term agent memory
* --resume id → Resume previous chat session programmatically
* --allocation mb → Override Node.js --max-old-space-size in MB (Req env.EXPERIMENTAL_MEMORY_MANAGER enabled → Ref: references/ENV.md)
* --package npm | pnpm | yarn | bun → Override package manager for core updates
* --auto-del 1d | 7d | 30d → History auto-deletion retention timeframe
* --auto-exec on | off / --yolo on | off → Toggle autonomous command execution
* --external-access on | off → Toggle permission to read/write files outside CWD
* --usage / --budget → Launch browser token analytics dashboard
* --export error → Export system error logs to timestamped file
* --update check → Check latest version on npm
* --update check latest → Print latest version on npm
* --update [latest] → Upgrade app to latest release
* --version, -v → Show installed version
* --help → CLI help menu
* --help commands → In-chat slash commands list
* --playground → Launch Playground mode

## Headless Mode
* -p, --prompt text -n|--new → Non-interactive CLI chat, no tools. Holds conversation context up to 10m inactivity or 15 turns. Supports piping from shell
* -c, --commit → Generate conventional commit message from staged git diff
* -R, --review → Review staged changes (or unstaged git diff if none staged) for typos, bugs, or severe issues. Can be used standalone or combined with -c (-cR)
* -r, --run command → Execute shell command and pass output as context to -p/--prompt. Takes a command argument (not clustered). e.g. fluxflow -r "git diff" -p "summarize this" -n
* -C, --continue → Resume the last headless conversation in interactive TUI mode
* Unix-style clustering → Single-letter flags p, c, R, n can be combined: -pc, -cR, -cpnR
`;
