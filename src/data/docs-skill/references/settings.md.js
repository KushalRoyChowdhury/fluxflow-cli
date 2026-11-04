// Export settings.md content to string
export const SETTINGS_MD = `# FluxFlow In-App Settings Reference

Open in chat via /settings

### 1. Providers & Tips → references/PROVIDERS.md
- Custom OpenAI Endpoint?
    * Base URL: .../v1
    * API Key: optional → references/COMMANDS.md

### 2. Appearance
* Theme → UI theme
* Loading Phrases → Humorous status phrases during thinking
* Progressive Rendering [Experimental] → Smooth streaming token rendering. May have glitches
* Show TPM Estimate → Real-time Tokens Throughput speed estimate
* Verbose Thinking → Show reasoning blocks in the UI

### 3. Personalization
* Base Personality → Pick base personality for agent
* Nickname → What agent should call user
* Custom Instruction → Custom user preferences
* Toggle Memory, Depricated → Persistent cross-session memory learning

### 4. Security Sandbox
* Sandbox Preset: Strict | Balanced | Autonomous

* YOLO → Autonomous tool execution without confirmation
* External Workspace Access → Read/write access outside CWD
* Network Access (Internal Shell) → Outbound network access for shell commands
* Command Policies:
  * Always Ask Commands → Commands requiring explicit confirmation. Overrides YOLO
  * Auto Approve Commands → Safe commands allowed to execute automatically
  * Auto Disapprove Commands → Blacklisted commands automatically rejected
  * Always Ask File/Paths → System auto prompts user before resolving the read req to user specified files/paths in
* Auto Approve Git Commits → Auto-confirm git commit operations
* Overwrite Protection → Prompts user if agent tries to overwrite a file, and auto-backs up before writing. Manual truncation of tool results will lose protection

### 4.1. Other Security
* Advanced Recovery [EXPERIMENTAL] → Enhanced rollback if agent corrupt codebase
* Auto-Delete History → Chat log retention period
* Save AppData Externally → Saves chats/apikeys to user provided path
* Agent Clipboard Context → Opt-in setting. Shares latest copied clipboard entry with agent
* Loop Limits → Control safety loop limits before prompting user resolution. Default (50, 75 for Computer Use), Extended (3x of Default), ENV (int → references/ENV.md)

### 5. Updater
* Auto-Update → Check for new releases on boot
* Preferred Package Manager → npm | pnpm | yarn | bun | custom

### 6. Secondary Models
* Sub-Agents → Enable sub-agents
* Sub-Agent Model → Dedicated model/provider for sub-agents
* Auto Completion in IDE → Toggle
* Completion Model
* Commit Msg Model

### 7. Miscellaneous
* Directory Tree Design → Modern (Saves Tokens) | Legacy (More Tokens, No extra benefit)
* Compact Large Tool Results → Compress large tool outputs to save tokens (model might miss subtle indentation/syntax errors)
* Context Length → Set usable context window size in FluxFlow. 16k, 32k, 64k, 128k, 256k, 512k, 1M. After Limit reached: Start new chat
* Auto Truncate Results → Auto-truncate tool results after task finished to save token and improve caching
* Image History for CU → Number of images to keep in context for Computer Use. Low / Standard / Extended
* Keep Reasoning Content → Keeps the exact reasoning of model in context. More tokens. Might improve planning accuracy for few models
* Auto Exclude Metadata → Removes Metadata Block when no external Metadata is needed. Will effect agent's Temporal Reasoning Capabilities. Might save Cache Hit & Tokens in specific cases
* Disable Todo → Disables Todo/Goal tool for Agent. Doesnt necessarily affect modern models

-- Recomended Preset --
| Feature | Cost Saving | General Use |
| --- | --- | --- |
| Subagents | Off | On |
| Compact Large Results | On | Off |
| Auto Exclude Metadata | On | Off |
| Image History | Low | Standard |
| Keep Reasoning Content | Off | Off |
| Emergency Recovery | Off | Off |
| Auto Truncate Results | On | On |
| Memory | Off | Off |
`;
