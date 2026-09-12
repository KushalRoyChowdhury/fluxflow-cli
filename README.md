# 🌌 Flux Flow (`fluxflow-cli`)
![Flux Flow Logo](https://github.com/KushalRoyChowdhury/fluxflow-cli/blob/main/fluxflow.png)

<p align="left">
  <a href="https://github.com/KushalRoyChowdhury/fluxflow-cli"><img src="https://img.shields.io/badge/FluxFlow-v4-blue?style=plastic" alt="FluxFlow Version"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg?style=plastic" alt="License MIT"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node-%3E%3D22-green?style=plastic" alt="Node Compatibility"></a>
</p>

### One of the lightest, fastest, high-fidelity agentic CLI with sub-agents & computer use.
#### *Only ~590 tokens total system prompt with tools.*

📖 **[Official Documentation](https://fluxflow-cli.onrender.com/)**

**Flux Flow** is not just another CLI—it's a high-speed, sassy, and goal-oriented CLI AI Agent powered by multi-provider frontier models (Google Gemini, DeepSeek, OpenRouter, and more). Designed for developers who demand a premium UI/UX while managing complex file-system tasks, web research, and autonomous workflows.

---

## 🚀 Instant Ignition (No Setup Required)
You don't even need to install it. Just fire up your terminal and run:

```bash
# Run instantly (Zero Setup)
npx fluxflow-cli

# OR Install Globally
npm install -g fluxflow-cli
fluxflow-cli
```

*The agent will prompt you for your API Key on the first run and store it securely in an encrypted vault.*

- **Multi-Provider Support**: Choose your preferred engine!
  - **Google GenAI**
  - **DeepSeek**
  - **NVIDIA**
  - **Ollama**
  - **Mistral**
  - **CrofAI**
  - **InferX**
  - **SenseNovaAI**
  - **Poolside**
  - **Experimental Labs** (*Experimental*)
  - **9Router** (*Experimental*)
  - **AIHubMix** (*Experimental*)
  - **OpenRouter** (*Experimental*)

---

## ✨ Why Flux Flow?

### 🎨 **Premium Visual Sovereignty**
Experience a terminal UI that feels alive. Built with **Ink** and **React**, Flux Flow features:
- **Dynamic Status Bar**: Real-time telemetry showing your "Neural Headroom" (token usage), Thinking Level, and Session ID.

### 🔌 **High-Fidelity IDE Companion**
Flux Flow now pairs with a dedicated VS Code extension to bridge the gap between terminal and editor:
- **Surgical Diagnostic Sync**: Proactive background scanning for errors. If your project breaks, a "Magic Wand" icon $(\text{sparkle})$ appears in your editor title bar for an instant AI fix.
- **Live Status Heartbeat**: The VS Code Status Bar acts as a live feed, showing the agent's current task (*Thinking*, *Web Searching*, *Patching*, etc.).
- **Clickable Terminal Links**: Jump from the terminal output straight to your code with clickable file:line links.
- **Right-Click Integration**: "FluxFlow > Chat" is available in the editor, explorer, and tab bars, even when no files are open.
- **Selection-Driven Reasoning**: Select a block of code and ask "What does this do?"—the agent receives your selection instantly.
- **Universal Compatibility**: Works flawlessly with VS Code, Cursor, VSCodium, Trae, and Antigravity.

### 👁️ **Native Multimodality**
Flux Flow can now see (supported models only)! Use the `view_file` tool to analyze images (JPG, PNG) or deep-dive into PDF technical papers. The agent extracts high-fidelity visual context natively, making it a true multimodal companion.

### 📑 **Document Engineering Suite**
Need a report or a presentation? Just ask. Flux Flow features a high-fidelity "Printing Press" that generates professional, branded documents natively:
- **PDF**: Branded documents from HTML/CSS with automatic watermarking.
- **DOCX**: Native Word documents with multi-page support and automatic numbering.

### ⏱️ **Codebase Time Travel (Git-less Reversion)**
Refactor and build with absolute fearlessness. Flux Flow maintains transaction-based secure snapshots of files before they are generated or edited:
- **Instant Rollback**: Revert your workspace files (source code, generated documents, images) to their exact state prior to any selected prompt in the history.
- **Double-ESC Shortcut**: Press `ESC` twice while idle to pop open a sleek selection modal.
- **`/revert` Command**: Run the `/revert` command directly in the chat to open the checkpoint viewer.

### 🚑 **Self-Healing Infrastructure**
Zero setup means zero setup. On first run, Flux Flow performs an integrity check and autonomously installs its own Chromium engine if needed, ensuring features like PDF generation work 100% of the time without manual intervention.

- **Archived Terminal Flow**: See execution outputs transform from live elements into permanent conversation records.
- **Rich Aesthetics**: High-contrast, sleek design with smooth transitions and micro-animations.

### 🧠 **The Dual-Intelligence System**
- **Flux Mode (Workspace)**: High-speed, agentic problem solving for massive coding tasks.
- **Flow Mode (Creative Studio)**: Optimized for high-quality conversation and web-assisted reasoning.
- **Computer Use (GUI Automation)**: Agents can control computer GUI, with mouse and keyboard.
- **FluxCU/Omni (Autonomous Workflow Engine)**: Agents can control computer GUI for automated workflows and tasks, with mouse and keyboard.

### 🛡️ **Digital Fortress Governance**
Security isn't an afterthought; it's a boundary.
- **Sandbox Presets**: Choose from **Strict**, **Balanced**, **Autonomous**, or **Custom** security profiles to control agent autonomy.
- **Granular Command Policies**: Configure Auto-Approve (`Auto` / `Read-Only` / `None`), Auto-Disallow (`Auto` / `Destructive` / `None`), Network Access toggle, and Auto-Approve Git Commits independently.
- **External Path Hardlock**: Restricts the agent to your Current Working Directory (CWD) unless you explicitly unlock it.
- **Human-in-the-Loop (HITL)**: Every file write and terminal command requires your high-fidelity approval.

### 🧹 **The Background Janitor**
While you move at high speed, the Janitor follows behind—refining session titles, compressing data, and ensuring your context window remains at absolute peak performance.

### 🤖 **Autonomous Subagent System**
Delegate complex tasks to subagents. Spawns blocking subagents (`invokeSync`) or asynchronous background subagents (`invoke`) with distinct telemetry and silent background logging. Built-in transaction-safe reversion logs all subagent changes under the active turn, preserving rollback security.

---

## 🛠️ Key Capabilities
- **Deep File-System Interaction**: Edit, move, and refactor code across multiple files with atomic precision.
- **Real-Time Web Intelligence**: Autonomous web-searching via DuckDuckGo for live news and technical research.
- **Autonomous Project Alignment**: Automatically detects and adheres to project-specific instructions in `Agent.md`, `Skills.md`, and `Fluxflow.md` for high-fidelity alignment with your coding standards and custom workflows.

- **Persistent Memory**: The agent learns from your preferences and project requirements across sessions.

---

## 💻 CLI Startup Arguments
Customize your session parameters directly from your console launch command:

```bash
fluxflow [options]
```

### Supported Flags:
 - `--model <model-name>`: Temporary override for the active AI model (e.g., `gemini-3.7-flash`). Keeps settings file untouched.
 - `--cwd <path>`: Set the working directory for the session (relative or absolute path).
 - `--path <path>`: Alias for `--cwd`. Set the working directory for the session.
 - `--memory <on | off>`: Toggle persistent long-term agent memory for the session.
 - `--resume <session-id>`: Resume a previous chat session programmatically.
 - `--update <check | latest>`: Manually run an update check (`check`) or execute latest update setup (`latest`).
 - `--package <npm | pnpm | yarn | bun>`: Override default package manager to run core application updates.
 - `--auto-del <1d | 7d | 30d>`: Set automated chat log deletion schedule.
 - `--yolo <on | off>`: Toggle autonomous execution permission.
 - `--external-access <on | off>`: Toggle permission to let agent read files outside CWD.
 - `--thinking <Fast | Low | Medium/Standard | High | xHigh>`: Override thinking level for reasoning depth. `Medium` and `Standard` is the same (Deepseek compatibility).
 - `--key <key@google | key@deepseek | key@openrouter>`: Set API key and provider.
 - `--provider <google | deepseek | openrouter>`: Override default provider.
 - `--usage`: Launches the usage dashboard in your browser.

----

## ⚙️ Configuration
Type `/settings` in-app to live-configure:
- **Thinking Level**: Fast (No Reasoning), Low, Medium, High, xHigh (Extended Reasoning).
- **Sandbox Preset**: Strict, Balanced, Autonomous, or Custom security profiles.
- **Security Perimeter**: Toggle External Workspace access, Network Access, and Git Commit auto-approval.

---

## 🔧 Configurable Environment Variables
Set these in your shell/session to override defaults:
- `SUBAGENT_MODEL` — Subagent model override (e.g., `gemini-2.5-pro`)
- `SUBAGENT_PROVIDER` — Subagent provider override (e.g., `google`, `deepseek`)
- `NVIDIA_BASE_URL` — Custom NVIDIA endpoint URL
- `NVIDIA_API_KEY` — NVIDIA API key (used when `NVIDIA_BASE_URL` is set)
- `OLLAMA_HOST` — Ollama endpoint (default: `http://127.0.0.1:11434`)
- `SHELL` — Preferred shell for command execution (default: `bash`)
- `HIGH_CONTEXT` — Context window override (`false` or integer `32000` to `1000000`)
- `SHOW_DEBUG_GRID` - true|false, default: false
- `DEBUG_OCR` - true|false, default: false
- `NO_DEV` - true|false, default: false
- `EXPERIMENTAL_MEMORY_MANAGER` - true|false, default: false
- `I_HAVE_TOO_MUCH_MONEY` - true|false, default: false, F's up the cache-hit ratio
- `GOOGLE_GEMMA_NONSENSE` - true|false, default: false, for the 16k TPM limit in gemma models on gemini API. False defaults to 256k
- `ENABLE_9ROUTER` - true|false, default: false
- `9ROUTER_BASE_URL` - 9Router base URL

---

## 🏁 License
MIT © 2026 Flux Flow.

---
*Forged with ⚡ and 🧬. Welcome to the FluxFlow.*
