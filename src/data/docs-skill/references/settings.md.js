// Export settings.md content to string
export const SETTINGS_MD = `# FluxFlow In-App Settings Reference

Open in chat via /settings

## Settings Categories & Options

### 1. Providers & Tips → references/PROVIDERS.md

### 2. Appearance
* Theme → UI theme (Dark | Light | Cyberpunk | Forest | Sunset | Matrix | Dracula | Nord | Monokai | Mystery/Chaos)
* Loading Phrases → Humorous status phrases during thinking
* Progressive Rendering [Experimental] → Smooth streaming token rendering. May have few glitches
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
* Verbose Thinking → Show reasoning blocks in the UI. Keeps UI clean when disabled. And reasoning transparent when enabled
* Dynamic Directory Awareness → Dynamic tracking of workspace directory tree
* Directory Tree Design → Directory visual styling. Modern (Saves Tokens) | Classic (More Tokens, No extra benefit)
* Compact Large Tool Results → Compress large tool outputs to save tokens (model might miss subtle indentation/syntax errors)
* Context Length → Set usable context window size in FluxFlow. 16k, 32k, 64k, 128k, 256k, 512k, 1M. After Limit reached: Start new chat
* Auto Truncate Results → Auto-truncate tool results after task finished to save token and improve caching
* Image History for CU → Number of images to keep in context for Computer Use. Low (1 image, Low Context Accuracy, Token Efficient) / Standard (3 images, Better Accuracy, Higher Token Usage) / Extended (5 images, Better for complex tasks, Highest Token Usage)
* Keep Reasoning Content → Keeps the exact reasoning of model in context for next turns. Uses more tokens. Might improve planning accuracy for very few models
* Auto Exclude Metadata → Removes Metadata Block when no external Metadata is needed. Will effect agent's Temporal Reasoning Capabilities. Might save Cache Hit & Tokens in specific cases

-- Recomended Settings Preset --
- Best for Cost Saving: Subagents (off), dynamic directory awareness (off), directory tree design (modern), compact large results (on), auto exclue metadata (on), Image History (Low), Keep reasoning content (off), Emergency Recovery (off), Auto truncate results (on), Memory (off), No FluxFlow IDE Companion

- Best for General Use: Subagents (on), dynamic directory awareness (off), compact large results (off), auto exclue metadata (off), Image History (Standard), Keep reasoning content (off), Emergency Recovery (off), Auto truncate results (on), Memory (off), FluxFlow IDE Companion

- Best for Luxurious Experience: Subagents (on), dynamic directory awareness (on), compact large results (off), auto exclue metadata (off), Image History (Extended), Keep reasoning content (on), Emergency Recovery (on), Auto truncate results (off), Memory (on), Security Preset (Autonomous), FluxFlow IDE Companion

- Max Cache Hit: Subagents (off), dynamic directory awareness (off), compact large results (on), auto exclue metadata (on), Image History (Low), Keep reasoning content (off), Emergency Recovery (off), Auto truncate results (off), Memory (off), No FluxFlow IDE Companion
`;
