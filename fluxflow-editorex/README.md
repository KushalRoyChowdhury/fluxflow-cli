# FluxFlow CLI Companion

FluxFlow CLI Companion pairs perfectly with the **FluxFlow CLI**. It is designed for maximum compatibility across official VS Code and all major forks (Antigravity, VSCodium, Cursor).

## Features

### 💬 In-Editor File Comments & Thread Instructions
- **Gutter Comments**: Hover on any line number and click the `+` icon to leave inline comments and targeted instructions.
- **Add to Chat**: Leave feedback directly on specific code lines — when you prompt the agent, FluxFlow automatically collects all active comments, line numbers, and snippets, grouped by file, and clears them once consumed.
- **Always Available**: Create and manage comment threads even when the CLI is currently offline.

### ✨ AI Auto-Completion
- **Inline Ghost Text**: Intelligent code suggestions appear as you type.
- **Fast & Responsive**: Powered by local caching and direct CLI bridge integration with automated fallbacks.
- **One-Click Toggle**: Toggle auto-completion on or off anytime directly from the status bar menu.

### 📂 Workspace Context Awareness
- **Real-Time Insight**: FluxFlow gains real-time awareness of active files, opened tabs, cursor line, and active selections.
- **Manual Edit Tracking**: Captures manual edits made in the editor to keep the agent in sync without losing user modifications.
- **Workspace Diagnostics**: Automatically monitors workspace-wide errors and lint warnings so the agent can self-correct and verify solutions.

### 🪄 Surgical Diagnostic Sync & Quick Fixes
- **Magic Wand Fix**: A sparkle icon appears in the editor title bar when errors are detected. Click it to auto-send a fix command.
- **Lint & Warning Resolution**: Targeted fixes for active file warnings and linting notices.
- **Quick Fix Integration**: Access "Fix with FluxFlow" directly from the editor's native quick-fix menu.

### 🌿 Interactive Diff Review & Title Bar Oversight
- **Visual Diff Review**: Seamlessly review proposed file changes and patches side-by-side in your editor.
- **Accept / Deny Controls**: Dedicated title bar buttons allow you to quickly accept or deny proposed changes.
- **Granular Auto-Approval**: Granular session acceptance ensures approvals stay scoped to exact files, extensions, or terminal commands.

### 📦 Git Commit Message Generation
- **Source Control Integration**: A dedicated FluxFlow action icon in the Source Control (SCM) title bar.
- **One-Click Generation**: Automatically analyzes staged git diffs and drafts clean, conventional commit messages.

### 💓 Live Status Heartbeat & Controls
- **Status Bar Indicator**: Real-time status shows what the agent is currently doing: *Thinking*, *Searching*, *Reading*, *Patching*, or *Writing*.
- **Quick Status Menu**: Click the status item to toggle auto-completion or start FluxFlow in an integrated terminal.

### 🔗 Clickable Terminal Links
Jump straight from terminal logs to your code. File paths and line numbers in the integrated terminal become clickable links.

## Requirements

To use this extension:
- **VS Code version 1.90.0** or newer (or a compatible fork: Cursor, Antigravity, VSCodium).
- **FluxFlow CLI** running in the integrated terminal:
  ```bash
  npm install -g fluxflow-cli
  fluxflow
  ```
