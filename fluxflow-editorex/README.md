# FluxFlow CLI Companion

FluxFlow CLI Companion pairs perfectly with the **FluxFlow CLI**. It is designed for maximum compatibility across official VS Code and all major forks (Antigravity, VSCodium, Cursor).

## Features

### 📂 Workspace Context awareness
FluxFlow gains real-time awareness of the files you have open, providing a rich understanding of your project structure. It even monitors workspace-wide diagnostics to help you fix errors before you see them.

### 🪄 Surgical Diagnostic Sync
- **Magic Wand Fix**: A sparkle icon appears in the editor title bar when errors are detected. Click it to auto-send a fix command.
- **Quick Fix Lightbulb**: Access "Fix with FluxFlow" directly from the editor's native quick-fix menu.
- **Global Awareness**: The agent knows about errors even in files you don't have open.

### 💓 Live Status Heartbeat
The VS Code Status Bar shows the agent's real-time state: *Thinking*, *Searching*, *Reading*, *Patching*, or *Writing*.

### 🔗 Clickable Terminal Links
Jump straight from terminal logs to your code. File paths and line numbers in the integrated terminal become clickable links.

### 🎯 Selection & Cursor Context
FluxFlow can access your cursor position and selected text instantly when you right-click and choose "Chat with FluxFlow".

### 🌿 Native Diffing
Seamlessly view code changes suggested by FluxFlow. New lines are highlighted in green for immediate visual review.

### 🚀 Launch FluxFlow
Install FluxFlow CLI with `npm install -g fluxflow-cli`. Then, run `fluxflow` in the integrated terminal.

## Requirements

To use this extension, you'll need:
- **VS Code version 1.90.0** or newer (or a compatible fork).
- **FluxFlow CLI** (installed separately) running within the integrated terminal.
