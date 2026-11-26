// Export commands.md content to string
export const COMMANDS_MD = `# Fluxflow in-app /commands

Trigger in chat via /command

## Session & Navigation
* /quit → Exit and shutdown FluxFlow
* /kill pid → Kill a process by PID or show active process tree under current session
* /help → Show help menu & actions
* /new → Start a new chat for the current workspace (alias: /clear)
* /chats → List stored chat sessions
* /resume → Switch to previous session
* /save → Force-save current session state
* /reset → Wipe fluxflow appdata, sessions, and cache

## Context & History Management

* /truncate → Truncate large tool results in history
* /btw question → Send side-inquiry mid-turn without breaking active flow
* /export chat | logs → Export chat transcript or error logs

## Codebase Safety & Reversion
* /revert → Git-less checkpoint rollback viewer (Shortcut: double-ESC while idle)

## Configuration & Model Controls
* /settings → Full-screen interactive settings menu
* /mode → Toggle Operating Mode
* /display index → Select active screen for Computer Use mode
* /model id flags → Switch model, or manage provider model list when a flag is present
  Flags: --save/-s, --vision/-v, --default/-df, --remove/-rm, --rename/-mv old new, --price/-p, --help/-h
  Pricing syntax: -p "in $$, out $$, cr $$, cw $$". -p 0 = reset. -p with no value = show saved price
  UNIX Clustering: -sv = -s -v. -sv -p, -p needs separated

* /thinking effort flags → Reasoning depth: low, medium, high, custom
  Flags: --map/-m ... remap this level to a provider-specific value. --force/-f CoT system prompt on non-reasoning models, --raw/-r strip harness reasoning guidance
  Unmap a level: /thinking effort -m rm
  UNIX Clustering: -fr =-f -r. -frm, -m should be last

* /provider → Switch AI provider
* /wildcard-tooling → Tool compatibility mode for non-tooling models
* /wildercard-tooling → Extended version of /wildcard-tooling
* /key → Manage saved API keys (10-slot array per provider)
  - /key list --provider <name> → Show slots 1-10 (active marked); no --provider value = all-providers summary
  - /key add <key> --index <n> --url <endpoint> | /key new → Add a key (alias: new)
  - --url (custom provider only): endpoint ending in /v1 or /v1/chat/completions. Overrides the saved base URL for that slot
  - /key remove <index>|<key>|--all → Remove by index/key/substring, or all
  - /key use <index>|<key> → Set active key    |    /key use <key> --temp → Session-only key
  - /key clean --provider <name> → Remove gaps between slots (no --provider = whole DB)
* /theme → Select UI color theme
* /budget → Set/view token budget limits
* /stats → Session token usage telemetry
* /usage → Open graphical browser analytics dashboard
* /memory → View or Migrate old memories to new system

## Documentation & Updates
* /docs → Online documentation
* /about → App info & author credits
* /changelog → Release notes
* /update check → Check npm updates
* /update latest → Install latest release
* /fluxflow global/saves → Openes fluxflow storage paths in explorer
* /move → Transfer Playground session data to ./playground-export
`;
