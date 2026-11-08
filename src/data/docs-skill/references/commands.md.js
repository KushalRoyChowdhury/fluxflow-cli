// Export commands.md content to string
export const COMMANDS_MD = `# Fluxflow in-app /commands

Trigger in chat via /command

## Session & Navigation
* /quit → Exit and shutdown FluxFlow
* /kill pid → Kill a process by PID or show active process tree under current session
* /help → Show help menu & actions
* /clear → Clear terminal viewport
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
* /model model-id --flags → Flags optional to customize list (--save, --remove, --default, /model old-model new-model --rename, --price/-p "IN price, OUT price, CR price, CW price"). Price lets user enter API prices for use/budget in fluxflow. --price 0 to reset, --price "metric price" to update
* /provider → Switch AI provider
* /thinking effort → Set reasoning effort. Can be mapped based on provider & model support. --map /thinking effort --map provider-effort-value/'rm' to unmap. Changes the Translation Table only for the currently selected provider and model, --force (Uses CoT system prompt on non reasoning models), --raw (Strips harness reasoning guidance)
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
