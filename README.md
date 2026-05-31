# 🌌 Flux Flow (`fluxflow-cli`)
![Flux Flow Logo](https://github.com/KushalRoyChowdhury/fluxflow-cli/blob/main/fluxflow.png)

<p align="left">
  <a href="https://github.com/KushalRoyChowdhury/fluxflow-cli"><img src="https://img.shields.io/badge/FluxFlow-v1.10.0-blue?style=plastic" alt="FluxFlow Version"></a>
  <a href="https://deepmind.google"><img src="https://img.shields.io/badge/Engine-Gemma%204-red?style=plastic" alt="Engine Gemma 4"></a>
  <a href="https://pollinations.ai"><img src="https://img.shields.io/badge/Built%20With-pollinations.ai-cyan?style=plastic" alt="Built With pollinations.ai"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg?style=plastic" alt="License MIT"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node-%3E%3D20-green?style=plastic" alt="Node Compatibility"></a>
</p>

### *The High-Fidelity Agentic Terminal for the Flux Era.*

**Flux Flow** is not just another CLI—it's a high-speed, sassy, and goal-oriented CLI AI Agent powered by the latest Gemini/Gemma frontier models. Designed for developers who demand a premium UI/UX while managing complex file-system tasks, web research, and autonomous workflows.

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

*The agent will prompt you for your Gemini API Key on the first run and store it securely in an XOR-encrypted vault.* Free API Key recomemded to use Gemma 4 (Default Model).

---

## ✨ Why Flux Flow?

### 🎨 **Premium Visual Sovereignty**
Experience a terminal UI that feels alive. Built with **Ink** and **React**, Flux Flow features:
- **Dynamic Status Bar**: Real-time telemetry showing your "Neural Headroom" (token usage), Thinking Level, and Session ID.

### 🎨 **Creative & Visual Sovereignty**
Generate gorgeous, high-fidelity images directly from the command line using [Pollinations AI](https://pollinations.ai). Use the `/image` command or ask the agent to create visuals. Features:
- **Customizable Presets**: Supports models like Flux, ZImage, Qwen, and Nanobanana-Pro, custom aspect ratios, and randomized seeds.
- **Budget Telemetry**: Real-time credits tracker displayed in sleek high-contrast Ink terminal boxes.
- **PNG Metadata Embedding**: Autonomously injects custom `tEXt` metadata chunks (Title, Software, Author, Seed, Model, and exact Prompt details) straight into the output image headers.

### 👁️ **Native Multimodality**
Flux Flow can now see! Use the `view_file` tool to analyze images (JPG, PNG) or deep-dive into PDF technical papers. The agent extracts high-fidelity visual context natively, making it a true multimodal companion.

### 📑 **Document Engineering Suite**
Need a report or a presentation? Just ask. Flux Flow features a high-fidelity "Printing Press" that generates professional, branded documents natively:
- **PDF**: Branded documents from HTML/CSS with automatic watermarking.
- **DOCX**: Native Word documents with multi-page support and automatic numbering.
- **PPTX**: High-fidelity PowerPoint presentations using native elements (selectable text, shapes) translated directly from HTML.

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
- **Flux Mode (Dev)**: High-speed, agentic problem solving with a 50-turn persistent loop for massive coding tasks.
- **Flow Mode (Chat)**: Optimized for deep research, high-quality conversation, and web-assisted reasoning.

### 🛡️ **Digital Fortress Governance**
Security isn't an afterthought; it's a boundary.
- **Sandbox Presets**: Choose from **Strict**, **Balanced**, **Autonomous**, or **Custom** security profiles to control agent autonomy.
- **Granular Command Policies**: Configure Auto-Approve (`Auto` / `Read-Only` / `None`), Auto-Disallow (`Auto` / `Destructive` / `None`), Network Access toggle, and Auto-Approve Git Commits independently.
- **External Path Hardlock**: Restricts the agent to your Current Working Directory (CWD) unless you explicitly unlock it.
- **Human-in-the-Loop (HITL)**: Every file write and terminal command requires your high-fidelity approval.
- **XOR Vaulting**: All local session histories, memories, and API keys are obfuscated and encrypted at rest.
- **Adaptive Failover**: Automatic multi-stage retry logic with high-concurrency fallback model switching (Gemini 3.1 Flash Lite) during peak API congestion.

### 🧹 **The Background Janitor**
While you move at high speed, the Janitor follows behind—refining session titles, compressing data, and ensuring your context window remains at absolute peak performance.

---

## 🛠️ Key Capabilities
- **Deep File-System Interaction**: Edit, move, and refactor code across multiple files with atomic precision.
- **Real-Time Web Intelligence**: Autonomous web-searching via DuckDuckGo for live news and technical research.
- **Autonomous Project Alignment**: Automatically detects and adheres to project-specific instructions in `Agent.md`, `Skills.md`, and `Fluxflow.md` for high-fidelity alignment with your coding standards and custom workflows.
- **High-Reliability Fallback**: Automatic failover to a lighter, high-concurrency model during peak traffic to ensure zero session loss.
- **Persistent Memory**: The agent learns from your preferences and project requirements across sessions.

---

## 💻 CLI Startup Arguments
Customize your session parameters directly from your console launch command:

```bash
fluxflow [options]
```

### Supported Flags:
- `--model <model-name>`: Temporary override for the active AI model (e.g., `gemini-2.5-pro`). Keeps settings file untouched.
- `--memory <on|off>`: Toggle persistent long-term agent memory for the session.
- `--resume <session-id>`: Resume a previous chat session programmatically.
- `--update <check|latest>`: Manually run an update check (`check`) or execute latest update setup (`latest`).
- `--package <npm|pnpm|yarn|bun>`: Override default package manager to run core application updates.
- `--auto-del <1d|7d|30d>`: Set automated chat log deletion schedule.
- `--auto-exec <on|off>`: Toggle autonomous command execution permission.
- `--external-access <on|off>`: Toggle permission to let agent read files outside CWD.
- `--thinking <Fast|Medium|High|xHigh>`: Override default thinking level.

---

## ⚙️ Configuration
Type `/settings` in-app to live-configure:
- **Thinking Level**: Fast (No Reasoning), Low, Medium, High, xHigh (Extended Reasoning).
- **Sandbox Preset**: Strict, Balanced, Autonomous, or Custom security profiles.
- **Security Perimeter**: Toggle External Workspace access, Network Access, and Git Commit auto-approval.

---

## 🏁 License
MIT © 2026 Flux Flow.

---
*Forged with ⚡ and 🧬. Welcome to the FluxFlow.*
