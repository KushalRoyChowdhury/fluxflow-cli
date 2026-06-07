# 🌊 Flux Flow
![Flux Flow Hero](./fluxflow.png)

<p align="left">
  <a href="https://github.com/KushalRoyChowdhury/fluxflow-cli"><img src="https://img.shields.io/badge/FluxFlow-v2-blue?style=plastic" alt="FluxFlow Version"></a>
  <a href="https://deepmind.google"><img src="https://img.shields.io/badge/Engine-Gemma%204-red?style=plastic" alt="Engine Gemma 4"></a>
  <a href="https://pollinations.ai"><img src="https://img.shields.io/badge/Built%20With-pollinations.ai-cyan?style=plastic" alt="Built With pollinations.ai"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg?style=plastic" alt="License MIT"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node-%3E%3D20-green?style=plastic" alt="Node Compatibility"></a>
</p>

**A Beautiful, Autonomous Terminal AI Agent**

Flux Flow is an advanced, fully autonomous AI agent that lives directly in your terminal. Built with Node.js and [Ink](https://github.com/vadimdemedes/ink) (React for interactive command-line apps), it provides a highly responsive, component-based UI powered by a sophisticated dual-model AI architecture.

Whether you need a conversational partner or an autonomous developer that can write code, run shell commands, and read your project files, Flux Flow adapts to your needs.

---

## ✨ Features

- **Multi-Provider Support**: Choose your preferred engine! Supports **Google GenAI** (Gemini/Gemma models) natively, **DeepSeek API** natively, and **OpenRouter** (Experimental) to connect to hundreds of LLMs.

- **Creative & Visual Sovereignty**: Generate gorgeous, high-fidelity images directly from the command line using [Pollinations AI](https://pollinations.ai). Use the `/image` command or ask the agent to create visuals. Features:
  - **Customizable Presets**: Supports models like Flux, ZImage, Qwen, and Nanobanana-Pro, custom aspect ratios, and randomized seeds.
  - **Budget Telemetry**: Real-time credits tracker displayed in sleek high-contrast Ink terminal boxes.
  - **PNG Metadata Embedding**: Autonomously injects custom `tEXt` metadata chunks (Title, Software, Author, Seed, Model, and exact Prompt details) straight into the output image headers.

- **High-Fidelity IDE Companion**: Flux Flow now pairs with a dedicated VS Code extension to bridge the gap between terminal and editor:
  - **Surgical Diagnostic Sync**: The agent has "Red Squiggle Radar"—it proactively detects errors across your entire workspace and offers a "Magic Wand" fix button.
  - **Live Status Heartbeat**: Real-time telemetry in the VS Code Status Bar shows exactly what the agent is doing (e.g., *Thinking...*, *Reading file.js...*, *Patching app.jsx...*).
  - **Clickable Terminal Links**: All file paths and line numbers printed in the terminal are live links; click them to jump straight to that code in your IDE.
  - **Selection-Driven Reasoning**: Select code and right-click -> "Chat with FluxFlow" to instantly focus the agent with full context.
  - **Smart Context Awareness**: The agent knows your cursor position, active selection, and even errors in files you don't have open.
  - **Universal Compatibility**: Works flawlessly with VS Code, Cursor, VSCodium, Trae, and Antigravity.

- **Native Multimodality**: Flux Flow can now see! Analyze images (JPG, PNG) and PDF documents natively through the `ReadFile` tool with high-fidelity context retention (Only on supported models).
- **Document Engineering Suite**: Generate professional, branded PDF, DOCX documents on the fly. Features native HTML-to-Office translation for selectable text, high-performance rendering, and automatic watermarking.
- **Codebase Time Travel (Git-less Reversion)**: Refactor and build with absolute fearlessness. Flux Flow maintains transaction-based secure snapshots of files before they are generated or edited:
  - **Instant Rollback**: Revert your workspace files (source code, generated documents, images) to their exact state prior to any selected prompt in the history.
  - **Double-ESC Shortcut**: Press `ESC` twice while idle to pop open a sleek selection modal.
  - **`/revert` Command**: Run the `/revert` command directly in the chat to open the checkpoint viewer.
- **External Data Sanctuary**: Redirect your logs, history, and memories to any external path for maximum portability and privacy.
- **Responsive Terminal UI**: A gorgeous, reactive interface built with React and Ink, featuring multi-line input, status bars, modals, and diff views.
- **Dual-Model Architecture**: A primary agent interacts with you and executes tasks, while a silent background "Janitor" model handles chat summarization and long-term memory extraction without blocking the main UI.
- **Two Operating Modes**:
  - **Flux (Dev Mode)**: Full system access. The agent can read/write files, execute shell commands, and run autonomous agentic loops (up to 45 iterations) to solve complex coding tasks.
  - **Flow (Chat Mode)**: Focused on conversation and web research, with limited agentic loops for faster response times.
- **Advanced Memory System**: Features both temporary session context and persistent, cross-session user memories encrypted locally on your machine.
- **Agentic Tooling**: Built-in tools for smart file patching, web scraping, web searching, terminal execution and high-fidelity Office document generation (PDF/DOCX).
- **Autonomous Project Alignment**: Automatically detects and adheres to project-specific instructions in `Agent.md`, `Skills.md`, and `Fluxflow.md` for high-fidelity coding standards and complex workflows.
- **Customizable "Thinking" Levels**: Adjust the depth of the model's reasoning process (from Fast to xHigh).
- **High-Reliability Fallback**: Automatic failover to a lighter, high-concurrency model (Gemini 3.1 Flash Lite) during peak traffic to ensure 100% session persistence.

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- `npm`, `yarn`, or `pnpm`

### Via NPM (Global & Instant)
You can run the agent instantly or install it globally for high-speed access:

```bash
# Run instantly (Zero Setup)
npx fluxflow-cli

# OR Install Globally
npm install -g fluxflow-cli
fluxflow
```

### From Source (Local Development)
1. Clone the repository and install dependencies:
   ```bash
   git clone https://github.com/KushalRoyChowdhury/fluxflow-cli
   cd fluxflow-cli
   npm install
   ```

2. Start the agent:
   ```bash
   npm start
   ```

## 📖 Documentation

To keep this README concise, detailed information about specific components of Flux Flow has been split into separate documents:

- **[Architecture & Design](./ARCHITECTURE.md)**: Deep dive into the React/Ink rendering, the Agentic Loop, and the Janitor background process.
- **[Agent Tools & Capabilities](./TOOLS.md)**: A comprehensive list of the tools available to the agent (e.g., File I/O, Execution, Web tools).
- **[UI & Interaction Features](./UI_FEATURES.md)**: Details on commands, thinking levels, and human-in-the-loop verification.

## 💻 CLI Startup Arguments

Customize your session parameters directly from your console launch command:

```bash
fluxflow [options]
```

### Supported Flags:
- `--model <model-name>`: Temporary override for the active AI model (e.g., `gemini-3.1-pro-preview`). Keps settings file untouched.
- `--memory <on|off>`: Toggle persistent long-term agent memory for the session.
- `--resume <session-id>`: Resume a previous chat session programmatically.
- `--update <check|latest>`: Manually run an update check (`check`) or execute latest update setup (`latest`).
- `--package <npm|pnpm|yarn|bun>`: Override default package manager to run core application updates.
- `--auto-del <1d|7d|30d>`: Set automated chat log deletion schedule.
- `--yolo <on|off>`: Toggle autonomous command execution permission.
- `--external-access <on|off>`: Toggle permission to let agent read files outside CWD.
- `--thinking <Fast|Medium|High|xHigh>`: Override default thinking level.

---

## 🔒 Security & Privacy

Flux Flow runs entirely locally on your machine.
- **Sandbox Presets**: Choose from **Strict**, **Balanced**, **Autonomous**, or **Custom** profiles to fine-tune agent autonomy out of the box.
- **Granular Command Policies**: Configure Auto-Approve (`Auto` / `Read-Only` / `None`), Auto-Disallow (`Auto` / `Destructive` / `None`), Network Access toggle, and Auto-Approve Git Commits independently.
- **Global Storage**: All history, memories, and API keys are stored securely in your home directory at `~/.fluxflow`. Sensitive data is encrypted.
- **Nuclear Reset**: Use the `/reset` command to instantly purge all logs, secrets, and settings from the global storage directory.
- **Configurable Boundaries**: In Flux mode, file access can be strictly confined to the Current Working Directory, or expanded globally via settings.
- **API Keys**: You supply your own API keys for your preferred provider: Google GenAI, DeepSeek, or OpenRouter (Experimental).

## 🛠️ Built With

- **[React](https://react.dev/) & [Ink](https://github.com/vadimdemedes/ink)**: For the interactive CLI rendering.
- **[@google/genai](https://www.npmjs.com/package/@google/genai)**: The core AI SDK powering the agent's intelligence.
- **[chalk](https://www.npmjs.com/package/chalk) & [gradient-string](https://www.npmjs.com/package/gradient-string)**: For terminal styling and aesthetics.
- **[fs-extra](https://www.npmjs.com/package/fs-extra)**: For robust file system operations.

---
*Created as a demonstration of highly capable AI tooling.*