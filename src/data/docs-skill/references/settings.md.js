// Export settings.md content to string
export const SETTINGS_MD = `# FluxFlow In-App Settings Reference

Open in chat via \`/settings\`

## Settings Categories & Options

### 1. Providers & Tips → \`references/PROVIDERS.md\`

### 2. Appearance
* Theme → UI theme (Dark | Light | Cyberpunk | Forest | Sunset | Matrix | Dracula | Nord | Monokai | Mystery/Chaos)
* Loading Phrases → Humorous status phrases during thinking
* Progressive Rendering → Smooth streaming token rendering
* Show TPM Estimate → Real-time Tokens Throughput speed estimate

### 3. Memory
* Toggle Memory → Persistent cross-session memory learning (Not available for some providers)

### 4. Security & Sandbox
* Sandbox Preset:
  * Strict → YOLO: OFF | External Access: OFF | Network Access: OFF | destructive commands blocked | strict HITL
  * Balanced → YOLO: ON (safe commands) | External Access: OFF | Network Access: ON | destructive commands blocked | manual git approval
  * Autonomous → YOLO: ON | External Access: ON | Network Access: ON | auto-approve git commits | prompt high-risk commands

* YOLO Mode → Autonomous command execution without confirmation
* External Workspace Access → Read/write access outside CWD
* Network Access (Internal Shell) → Outbound network access for shell commands
* Command Policies:
  * Always Ask Commands → Commands requiring explicit confirmation
  * Auto Approve Commands → Safe commands allowed to execute automatically
  * Auto Disapprove Commands → Blacklisted commands automatically rejected

* Auto Approve Git Commits → Auto-confirm git commit operations
* Advanced Recovery [EXPERIMENTAL] → Enhanced rollback if agent corrupt codebase
* Auto-Delete History → Chat log retention period
* Save AppData Externally → Saves chats/apikeys to user provided path

### 5. Updater
* Auto-Update → Check for new releases on boot
* Preferred Package Manager → npm | pnpm | yarn | bun | custom

### 6. Miscellaneous
* Sub-Agents → Enable sub-agent delegation
* Sub-Agent Model → Dedicated model/provider for sub-agents
* Preserve Thinking → Keep reasoning blocks in conversation context
* Dynamic Directory Awareness → Dynamic tracking of workspace directory tree
* Directory Tree Design → Directory visual styling. Modern (Saves Tokens) | Classic (More Tokens)
* Compact Large Tool Results → Compress large tool outputs to save tokens (model might miss subtle indentation/syntax errors)
* Auto Truncate Results → Auto-truncate tool results after task finished to save token and improve caching
`;
