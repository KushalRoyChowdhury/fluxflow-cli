// Export commands.md content to string
export const COMMANDS_MD = `# FluxFlow In-Session Slash Commands

Trigger in chat via /command

## Session & Navigation
* /quit → Exit and shutdown FluxFlow
* /help → Show help menu & actions
* /clear → Clear terminal viewport
* /chats → List stored chat sessions
* /resume → Switch to previous session
* /save → Force-save current session state
* /reset → Wipe fluxflow appdata, sessions, and cache

## Context & History Management
* /compress → Summarize chat history to reclaim context headroom
* /truncate → Truncate large tool results in history
* /btw question → Send side-inquiry mid-turn without breaking active flow
* /export chat | logs → Export chat transcript or error logs

## Codebase Safety & Reversion
* /revert → Git-less checkpoint rollback viewer (Shortcut: double-ESC while idle)

## Configuration & Model Controls
* /settings → Full-screen interactive settings menu
* /mode → Toggle Operating Mode
* /model model-id → Switch active AI model
* /provider → Select/switch AI provider
* /thinking effort → Set reasoning effort
* /wildcard-tooling → Tool compatibility mode for non-tooling models
* /key → Manage saved API keys
* /profile → Edit user persona, nickname, and custom instructions
* /theme → Select UI color theme
* /memory → View/manage agent persistent memory
* /budget → Set/view token budget limits
* /stats → Session token usage telemetry
* /usage → Open graphical browser analytics dashboard

## Documentation & Updates
* /docs → Online documentation
* /about → App info & author credits
* /changelog → Release notes
* /update check → Check npm updates
* /update latest → Install latest release
`;
