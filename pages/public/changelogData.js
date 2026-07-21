// ==========================================
// DATABASE: Update this object for new versions
// Format: { "VERSION": { "note": "...", "added": [...], "changed": [...], "fixes": [...] } }
// ==========================================

export const stableVersions = ["3.7.0"]

export const changelogData = {
    "3.7.0": {
        "note": "JULY 22.",
        "added": [
            "Added Token Caching support for NVIDIA API",
            "Added support for custom endpoint for NVIDIA API (OpenAI Compatible) to host local models in NIM and use in FluxFlow. Use via ENV: `NVIDIA_BASE_URL`."
        ],
        "changed": [
            "**Note:**\nNo ThinkingMachine's or PoolSide's models will be added for now."
        ],
        "fixes": []
    },
    "3.6.1": {
        "note": "JULY 21.",
        "added": [],
        "changed": [],
        "fixes": [
            "Improved Tool Calling on Rubbish models."
        ]
    },
    "3.6.0": {
        "note": "JULY 21.",
        "added": [],
        "changed": [
            "Improvements in Advance Recovery & Change Context for faster auto-detection in case of Disaster Recovery."
        ],
        "fixes": [
            "Improved regex search in agent's grep tool."
        ]
    },
    "3.5.0": {
        "note": "JULY 20.",
        "added": [
            "Added internal support for ThinkingMachines & PoolSide models via NVIDIA API.",
            "Added escaping on file tagging. Normal @file, Escaped \\@file. System ingores to auto-read if the file tagged is escaped & let the Agent handle."
        ],
        "changed": [
            "Improved Context Stability with Tool Calls.",
            "Improved UX for few popups."

        ],
        "fixes": []
    },
    "3.4.6": {
        "note": "JULY 14.",
        "added": [
            "Added internal api schama support for bytedance models via NVIDIA API."
        ],
        "changed": [],
        "fixes": []
    },
    "3.4.5": {
        "note": "JULY 12.",
        "added": [],
        "changed": [
            "Improved Reliability for consistant memory.\n\n**Note:**\n　• To experience this advance reliability, you WILL need to set up a NVIDIA API Key in FluxFlow 　　(/settings → Others → Provider → NVIDIA).\n　• If using Billing API on Gemini or DeepSeek, setting up NVIDIA Key is highly recomended to save 　　token costs for memory features.",
            "More Polished & Finished UI."
        ],
        "fixes": [
            "Several Bug Fixes."
        ]
    },
    "3.4.0": {
        "note": "JULY 11.",
        "added": [
            "Server Side model config to get latest models without package updates.",
            "Newly Models in NVIDIA API: `meta/llama-3.3-70b-instruct` & `meta/llama-3.2-90b-vision-instruct`.",
            "New Models in OpenRouter: `anthropic/claude-fable-5`, `z-ai/glm-5.2`, `openai/gpt-5.6-terra`, `openai/gpt-5.6-luna`, `openai/gpt-5.6-sol`, `x-ai/grok-4.5`.",
            "Dynamic Tab Title"
        ],
        "changed": [
            "Categorization of models in UI."
        ],
        "fixes": [
            "Improved Stability"
        ]
    },
    "3.3.1": {
        "note": "JULY 9.",
        "added": [],
        "changed": [],
        "fixes": [
            "Minor improvements with SubAgents & Response Cancellations."
        ]
    },
    "3.3.0": {
        "note": "JULY 9.",
        "added": [
            "Progressive Rendering (typewriter effect) — smooth text animation. Toggle in Settings → Other. May use bit more memory."
        ],
        "changed": [
            "`Kimi k2.6` Deprecated. Looking forward with `Kimi k2.7` soon."
        ],
        "fixes": [
            "Fixed \"Memory Leak v3: Definitive Edition\". Enjoy your agent even with 1GB RAM."
        ]
    },
    "3.2.2": {
        "note": "JULY 8.",
        "added": [
            "UI Animations."
        ],
        "changed": [],
        "fixes": [
            "Minor Optimizations for UI Rendering.",
            "Improved Stability for NVIDIA API."
        ]
    },
    "3.2.0": {
        "note": "JULY 7.",
        "added": [
            "Added more info about API state/queue for NVIDIA API [EXPERIMENTAL].",
            "Added new option in /settings → Others → Preserve Thinking. Turning off will result in deletion of previous thought blocks from persisting in Chat. Will save disk space.",
            "cat.txt - A File Containing a lore. Can be found in the official [GitHub Repository](https://github.com/KushalRoyChowdhury/fluxflow-cli) & NPM Package installed in your device (just 237B)."
        ],
        "changed": [
            "Improved Emergency Recovery [EXPERIMENTAL].",
            "Improved Tracking with Sub-Agents."
        ],
        "fixes": [
            "UI Bug Fixes."
        ]
    },
    "3.1.0": {
        "note": "JULY 5.",
        "added": [
            "Added Emergency Recovery System for the Agent if something goes wrong inside codebase.\n\n**NOTE:**\n**AVOID STOPPING THE AGENT ABRUPTLY IN CASE OF DISASTERS, IF NEEDED STEER IT FOR DAMAGE RECOVERY WITHOUT FORCING TO END ITS TURN OR ABORTING THE RESPONSE.** This feature is currently *EXPERIMENTAL*, can be turned on in /settings → Security. Will use more disk space."
        ],
        "changed": [],
        "fixes": []
    },
    "3.0.19": {
        "note": "JULY 4.",
        "added": [],
        "changed": [],
        "fixes": [
            "Optional Stability Patch for Web Tools."
        ]
    },
    "3.0.18": {
        "note": "JULY 4.",
        "added": [],
        "changed": [],
        "fixes": [
            "Bug Fixes."
        ]
    },
    "3.0.14": {
        "note": "JULY 4.",
        "added": [
            "Added support for `GLM 5.2` in NVIDIA API."
        ],
        "changed": [
            "Improved authority of main agent over lifecycle of Sub-Agents.",
            "Improved Token Efficiency with Sub-Agents.",
            "Improved Sub-Agent experience."
        ],
        "fixes": [
            "Fixed token reporting bugs for other background API calls."
        ]
    },
    "3.0.10": {
        "note": "JULY 3 - Stability Patch for API Health Indicator & FluxFixer.",
        "added": [],
        "changed": [
            "Improved API Health Indicator to include SubAgents."
        ],
        "fixes": [
            "Fixed issue where API Health Indicator was missed during tool calls"
        ]
    },
    "3.0.8": {
        "note": "JULY 3.",
        "added": [
            "Added realtime API Health Indicator so you know who to blame: FluxFlow or your API provider?"
        ],
        "changed": [],
        "fixes": []
    },
    "3.0.5": {
        "note": "JULY 3.",
        "added": [
            "SubAgents can now ask the user directly to resolve ambiguity, similar to the Main Agent."
        ],
        "changed": [
            "Improved Reliability & Stability of SubAgents."
        ],
        "fixes": []
    },
    "3.0.0": {
        "note": "JULY 3 - MultiAgent Architecture.",
        "added": [
            "Added SubAgent & Multi-Agent Architecture. With 2 invocation methods when main agent decides, `invokeSync` & `invoke` based on task complexity and parallelism benefits. May consume additional tokens."
        ],
        "changed": [
            "Deprecated GLM 5.1 on NVIDIA API."
        ],
        "fixes": [
            "See you in v3.0.1 soon."
        ]
    },
    "2.16.9": {
        "note": "JULY 2.",
        "added": [
            "Added support for `NVIDIA NEMOTRON 3 Ultra 550B` in NVIDIA API."
        ],
        "changed": [
            "Increased Context Window by ~2% across all models & providers (OpenRouter EXTERIMENTAL)."
        ],
        "fixes": []
    },
    "2.16.7": {
        "note": "JULY 2 - Bug Fixes.",
        "added": [
            "Added support for PowerShell 7.6 in Windows with fallback to PowerShell 5.1.",
            "Added support for `QWEN 3.5 397B` in NVIDIA API."
        ],
        "changed": [
            "Better Tuning."
        ],
        "fixes": [
            "Fixed app crash on terminal execution.",
            "Fix few UI and chat persistance issues."
        ]
    },
    "2.16.0": {
        "note": "JULY 1.",
        "added": [
            "Code Highlighting for easier reading."
        ],
        "changed": [],
        "fixes": [
            "Defeated `Memory Leak v2: Final Boss Edition` (hopefully for good)."
        ]
    },
    "2.15.0": {
        "note": "JUNE 30 - Budgeting Overhaul.",
        "added": [
            "New command `/budgets reset` to reset existing budgets."
        ],
        "changed": [
            "Budgeting flow removed from `/settings`.",
            "Changed how budgets are set. Now set a 'Global Budget' to limit overall usage, OR set 'Provider Specific' budgets to limit each provider usage.",
            "All previously set budgets will be auto-migrated to 'Global Budgets' by default.\n\n**NOTE:**\n*Budgets are calculated as `\"Token Usage per Provider/Overall\"`. Using premium models on same provider & same limit will cost more \"per token\" than same token limit with cheaper models.*\n***FluxFlow ONLY tracks \"Token Usage\" NOT \"API Costs\".***"
        ],
        "fixes": []
    },
    "2.14.2": {
        "note": "JUNE 29.",
        "added": [],
        "changed": [
            "Improved & Stable reasoning configs across models/providers."
        ],
        "fixes": []
    },
    "2.14.0": {
        "note": "JUNE 29.",
        "added": [
            "Added Memory stats in status bar.",
            "Added GPT-OSS 20b & GPT-OSS 120B in NVIDIA API.",
            "Added `--allocation {MEMORY_IN_MB}` startup command to run the app with specific memory requirements."
        ],
        "changed": [
            "Improved dynamic Memory Allocation.",
            "Improved DIFF viewer in terminal UI.",
            "Improved Keyboard navigation support.",
            "New & Improved typing experience with Bracketed Pastes, Auto Collapsing etc.",
            "Improved Terminal rendering.",
            "Improved sub string keyword search for agent side tools.",
            "Improved Model descriptions.",
            "Improved Multimodal Support for NVIDIA API."
        ],
        "fixes": [
            "Resolved a bug where the rendering might glitch out on long chats.",
            "Better tool stability with Kimi models.",
            "Fixed critical memory leaks (~200MB/s 💀)."
        ]
    },
    "2.13.0": {
        "note": "JUNE 26 - Performance Improvements.",
        "added": [
            "New rendering engine with massive performance improvement and all time low rendering overhead giving upto 99% more smoothness and lower resource usage than prior versions."
        ],
        "changed": [
            "UI Component redesigns to support this new renderer efficiently without broken layout."
        ],
        "fixes": [
            "Resolved a bug where the screen jumps to start on middle scroll re-renders (from v1.0.0 btw)."
        ]
    },
    "2.12.3": {
        "note": "JUNE 25 - Upgrades to Playground.",
        "added": [
            "Added new command `/move` to copy playground codebase to original working directory under `playground-export/` (`/move` is only valid in playground mode)."
        ],
        "changed": [],
        "fixes": [
            "Patched auto-CWD restore on `/clear`.",
            "Stability & Efficiency patches to IDE Companion Extention. Update to v1.4.2 recomended. Download here, [VS Code](https://marketplace.visualstudio.com/items?itemName=fluxflow-cli.fluxflow-cli-companion), [VSIX](https://github.com/KushalRoyChowdhury/fluxflow-cli/releases/tag/1.4)"
        ]
    },
    "2.12.0": {
        "note": "JUNE 24 - Playground Mode.",
        "added": [
            "**Playground Mode:** Launch FluxFlow with `fluxflow --playground` to enter a persistent, isolated session. Chat ID is fixed to `flow-playground`, CWD is pinned to `FluxFlow/playground`, and history is automatically restored on every launch.",
            "Playground session is silently wiped on session end & Memory features are not available.",
            "`/clear` inside playground exits the mode and starts a fresh normal session."
        ],
        "changed": [],
        "fixes": []
    },
    "2.11.5": {
        "note": "JUNE 23 - Bug Fixes!",
        "added": [],
        "changed": [
            "Tuned parameters for more stable tool calling."
        ],
        "fixes": [
            "Fixed a bug where `/memory` command could occationally crash the app.",
            "Improved readability for dense memories.",
            "Resoleved a bug with array parsing inside tool calls."
        ]
    },
    "2.11.1": {
        "note": "JUNE 22 - Happy Coding!",
        "added": [
            "Added \"Budgets\" on Non-Billing API Keys, cuz numbers goo BRRR",
            "Added new command `/budgets` to set and view limits easily than checking from settings."
        ],
        "changed": [
            "Changed \"API Tier\" term to \"Budgets\" to reflect practical meaning of the feature."
        ],
        "fixes": []
    },
    "2.11.0": {
        "note": "JUNE 22",
        "added": [
            "New & Improved budgeting for Billing API Keys with Daily/Monthly token limits & visual usage trackers. Set /settings → Others → Budgets → Custom Budgets (Only token count limits, not per model/cost, Premium models cost more per token than lighter models, but token is token... Absolute cost handling is your duty, I'll handle token counts... \"efficiently\".. probably... maybe... 😜).",
            "Better Error Messages in UI for API failures."
        ],
        "changed": [
            "Improved network sandboxing for integrated terminal in linux/macos with kernel level isolation.",
            "Reduce false positives for other command executes when terminal network access is off.",
            "Improved IDE connection stability.",
            "Better 'Recent Manual Edits' context for Agent from IDE (requires IDE Companion v1.4.0+).",
            "Deprecated Image Generation for all previous versions.",
            "Updated IDE Companion to v1.4.0. Download for [VS Code](https://marketplace.visualstudio.com/items?itemName=fluxflow-cli.fluxflow-cli-companion), with [VSIX](https://github.com/KushalRoyChowdhury/fluxflow-cli/releases/tag/1.4)"
        ],
        "fixes": [
            "UI Refinement & Stability Improvements.",
            "More consistent UI theme.",
            "Better detection of Workspace Code errors (requires IDE Companion v1.2.1+)."
        ]
    },
    "2.10.0": {
        "note": "JUNE 20 - Inquiry support /btw command.",
        "added": [
            "Added /btw command to ask agent questions while working without interrupting."
        ],
        "changed": [
            "Improved & more contexual sandboxing."
        ],
        "fixes": [
            "Fixed scoped npm packages (like @types/inquirer) being parsed as Windows filesystem paths in Terminal Execution."
        ]
    },
    "2.9.0": {
        "note": "JUNE 19 -  Flux Flow CLI.",
        "added": [
            "Auto file read when tagged with `@file` to save re-read input tokens & extra reasoning tokens about tagged file reads."
        ],
        "changed": [],
        "fixes": []
    },
    "2.8.9": {
        "note": "JUNE 19 -  Flux Flow CLI.",
        "added": [
            "Added auto set keybinds for IDEs if SHIFT+ENTER is not binded for new line."
        ],
        "changed": [],
        "fixes": []
    },
    "2.8.6": {
        "note": "JUNE 18 - Improved Reasoning.",
        "added": [
            "Added Realtime error auto-steering if Agent write broken syntax (IDE Companion REQUIRED)."
        ],
        "changed": [
            "Huge improvement in Google Gemma-4 xHigh reasoning (may consume 30% more tokens & significantly longer reasoning times in xHigh)."
        ],
        "fixes": [
            "Standard Bug fixes and Stability improvements."
        ]
    },
    "2.8.0": {
        "note": "JUNE 18 - Improved Telemetry & Stability.",
        "added": [
            "Updated Telemetry to add monthly (last 30d) usage.",
            "Added a new Model Breakdown telemetry to track each model usage."
        ],
        "changed": [],
        "fixes": [
            "Improved stability during LOOONG file writes.",
            "Improved usage of Task List tool."
        ]
    },
    "2.7.2": {
        "note": "JUNE 17 - Critical Stability Patches.",
        "added": [],
        "changed": [
            "Improved Documentation Page."
        ],
        "fixes": [
            "Critical Bug fixes on Protocol v3 ensuring long term stability and least errors."
        ]
    },
    "2.7.1": {
        "note": "",
        "added": [
            "Added new tool for agent to stay consistent with planning across long multistep tasks.",
            "New command to view documentation `/docs`."
        ],
        "changed": [
            "Moved PDF/DOCx Generation tool to Flow Mode exclusive only."
        ],
        "fixes": []
    },
    "2.7.0": {
        "note": "System Protocol Upgrade.",
        "added": [],
        "changed": [
            "**FluxFlow Protocol v3:** Improved Tool Protocol to be more deterministic & resilient to edge cases.",
            "*this new protocol may consume ~10% more tokens for same context."
        ],
        "fixes": [
            "Bug Fixes & Improved Stability."
        ]
    },
    "2.6.4": {
        "note": "",
        "added": [
            "Added a counter in `/stats` to show active context loaded in model."
        ],
        "changed": [],
        "fixes": [
            "Bug Fixes."
        ]
    },
    "2.6.0": {
        "note": "Pro Edition Refresh & Stability",
        "added": [
            "Model support for NVIDIA Integration: Minimax M3, Diffusion Gemma (1000+ TPS performance, text → text model)."
        ],
        "changed": [
            "Full UI Overhaul: New professional monochrome aesthetic with improved readability.",
            "Modernized Logo: Dynamic header with real-time provider/version tracking and bold ASCII art.",
            "Persistent Token Metrics: Redesigned token calculation and segment-based tracking."
        ],
        "fixes": [
            "Global Error Mitigation: Hardened agent loop and file operation safety."
        ]
    },
    "2.5.0": {
        "note": "v2.5.1",
        "added": [
            "Added /compress command to let users manually compress chat history when needed instead of waiting for context limit."
        ],
        "changed": [
            "Added model support for NVIDIA integration: Gemma 4 31B, Mistral 3.5.",
            "Added model support for Gemini: Gemini 2.5 Pro, Gemini 2.5 Flash Lite.",
            "Removed [EXPRERIMENTAL] tag for NVIDIA.",
            "Updated GenAI SDK."
        ],
        "fixes": [
            "Resolved a bug where multi turn tool use could affect caching.",
            "Resolved thinking instability issues with NVIDIA API",
            "Improved memory stability with NVIDIA integration & Google.",
        ]
    },
    "2.4.0": {
        "note": "EXPERIMENTAL support for NVIDIA API. Thank You for supporting.",
        "added": [
            "Added support for NVIDIA API with limited models to harness the free unlimited AI.",
            "Stable-ish models: Kimi 2.6 Reasoning, Stepfun 3.7 Flash, GLM 5.1.",
            "Known issues with NVIDIA API integration: Some models might show unstable reasoning regardless of /thinking config. Permanent memory features might be unstable. Caching might not work depending on routing."
        ],
        "changed": [],
        "fixes": []
    },
    "2.3.0": {
        "note": "High-Fidelity Code Mapping",
        "added": [
            "**FileMap Tool:** Introduced a powerful AST based mapping engine that provides structural skeletons of code files (Classes, Functions, Imports) without reading the entire content (95% token efficient than reading full files).",
            "**Language Parser Manager:** New interactive UI in Settings > Other to download/delete language parsers (JS, TS, Python, C++, Java, HTML)."
        ],
        "changed": [
            "Upgraded structural analysis core for improved context efficiency."
        ],
        "fixes": []
    },
    "2.2.10": {
        "note": "Efficiency Improvements & Image Generation Deprecated",
        "added": [],
        "changed": [
            "Image Generation Deprecated. Image Gen in v1.11.0 - v2.2.9 will continue working until 2026-06-22."
        ],
        "fixes": [
            "Fixed terminal output bugs.",
            "Improve context efficiency for terminal outputs."
        ]
    },
    "2.2.8": {
        "note": "",
        "added": [
            "**Quick Patch Acceptance:** Added option to directly accept or reject the changes proposed by the agent in IDE.",
            "Added quick CLI argument for guide, --help (shows available arguments)"
        ],
        "changed": [
            "Improved IDE Connection Stability.",
            "Updated Documentation for recent changes."
        ],
        "fixes": [
            "UI Refinements."
        ]
    },
    "2.1.0": {
        "note": "Native IDE Depth Integration.",
        "added": [
            "**Surgical Diagnostic Sync:** Introduced background scanning for workspace errors. A 'Magic Wand' icon now appears in the IDE for instant AI fixes when code breaks.",
            "**Live Status Heartbeat:** The VS Code Status Bar now acts as a real-time telemetry feed, showing exactly what the agent is doing (*Thinking*, *Patching*, *Reading*, etc.).",
            "**Clickable Terminal Links:** All file paths and line numbers printed in the terminal are now live links that jump straight to your code.",
            "**Indentation Intelligence:** Upgraded the patching engine to handle proportional Tab/Space conversion and automatic style detection for minimal tool errors.",
            "**Right-Click UI Overhaul:** Consolidated all actions into a clean 'FluxFlow >' sub-menu available in the Editor, Explorer, and Tab contexts."
        ],
        "changed": [
            "Enhanced terminal focus logic in IDE.",
        ],
        "fixes": [
            "Resilved a bug where Agent would cut response pre-maturely."
        ]
    },
    "2.0.0": {
        "note": "🚀 [MAJOR] IDE Integration.",
        "added": [
            "**High-Fidelity IDE Connectivity:** Launched the `FluxFlow-CLI Companion` extension for VS Code and forks (Cursor, Antigravity, etc.).",
            "**Live Context Awareness:** The agent now tracks your active file, cursor position, and opened tabs in real-time.",
            "**Selection-Driven Reasoning:** Select code in your editor and ask the agent about it, it sees exactly what you see.",
            "**Native Edit Highlights:** AI code changes now appear as diff view directly inside your editor.",
            "**Command Palette Integration:** Launch Flux-Flow directly from the IDE using the `FluxFlow: Run` command."
        ],
        "changed": [
            "Renamed 'Auto Execute' to 'YOLO Mode'.",
            "Changed CLI startup argument for `--auto-exec` to `--yolo`."
        ],
        "fixes": []
    },
    "1.21.1": {
        "note": "⚙️ Settings flow refinement.",
        "added": [
            "**1-Click Provider Switching:** Instantly switch between AI providers in settings. Cached credentials are automatically vaulted in `secrets.json`, and pressing Enter on 'Current Provider' allows quick selection."
        ],
        "changed": [],
        "fixes": [
            "Experimental Fix for stream jittering and tool stability with OpenRouter."
        ]
    },
    "1.21.0": {
        "note": "⭐ [STABLE] DeepSeek Integration.",
        "added": [
            "**Native DeepSeek Integration:** Full support for DeepSeek API (including deepseek-v4-flash and deepseek-v4-pro models) with configurable reasoning/thinking parameters."
        ],
        "changed": [
            "Refined agent loop completion protocol to ensure cleaner finishes when no active tools are pending."
        ],
        "fixes": []
    },
    "1.20.0": {
        "note": "🚀 [EXPERIMENTAL] OpenRouter Integration & Multi-Provider Architecture.",
        "added": [
            "**OpenRouter Integration:** Connect to hundreds of models via OpenRouter SDK integration.",
            "**Multi-Provider Setup:** New 2-step initialization flow allowing users to choose between Google and OpenRouter as their primary AI provider.",
            "**Multimodal OpenRouter Support:** Native handling of Images and Documents (PDF) for OpenRouter models supporting multimodal input.",
        ],
        "changed": [
            "**[STABILITY WARNING]**: OpenRouter integration is currently **EXPERIMENTAL** and may exhibit [UNSTABLE] behavior, API timeouts, or unexpected formatting quirks depending on the chosen provider model.",
            "Updated the `/model` command to dynamically branch its list based on the active AI provider.",
        ],
        "fixes": []
    },
    "1.19.3": {
        "note": "Detailed Token stats",
        "added": [
            "Added Detailed Token Usage Stats in telemetry."
        ],
        "changed": [],
        "fixes": []
    },
    "1.19.0": {
        "note": "Multi Model support.",
        "added": [
            "Added native support for other Gemini 3 & 2.5 models (`Gemini 3.5 Flash` might face occational instablity with web tools).",
            "Prompt Caching to reduce cost (Paid API Only)[Experimental]."
        ],
        "changed": [
            "Rearchitected `SearchKeyword` tool for better reliability and performance."
        ],
        "fixes": [
            "Occasional failures of rendering LaTeX.",
            "Extended Markdown Support."
        ]
    },
    "1.18.16": {
        "note": "Critical Fix.",
        "added": [],
        "changed": [],
        "fixes": [
            "Fixed a issue where agent fail to complete a file with nested escape sequences."
        ]
    },
    "1.18.9": {
        "note": "Context Management.",
        "added": [],
        "changed": [
            "Changed to Dynamic Recursion Depth to better handle larger projects."
        ],
        "fixes": [
            "Fixed Context \"Vaporization\" issue with Iteractive Terminal."
        ]
    },
    "1.18.0": {
        "note": "Performance Tuning & Multi-Block Patching.",
        "added": [
            "Added recursion limit to project tree generation to prevent context bloat."
        ],
        "changed": [
            "Redesinged Input Cursor.",
            "Refined Diff UI.",
            "Advance Interactive Integrated Terminal on Supported Devices/Environments.",
            "Improved Accessibility.",
            "Upgraded the patching tool to support up to 8 simultaneous search-and-replace transactions in a single turn."
        ],
        "fixes": [
            "Resolved cursor visibility and spacing issues in the multiline input console."
        ]
    },
    "1.17.0": {
        "note": "Precision Grounding & Inline Reference Update.",
        "added": [
            "Inline File Completion Engine: Real-time autocomplete suggestions via '@filename' within the main chat console.",
            "Precise Line Ranges (#Lstart-Lend): Integrated interactive hash ranges inside file pickers, enabling users to isolate target lines directly during completion.",
            "Improved Directory Context nuance for better understanding of project structure to agent."
        ],
        "changed": [],
        "fixes": []
    },
    "1.16.2": {
        "note": "Session Stats Bug Fix.",
        "added": [],
        "changed": [],
        "fixes": [
            "Resolved a bug where session code changes stats (+X -Y) would incorrectly reset to 0 after executing the /clear command."
        ]
    },
    "1.16.1": {
        "note": "Improved User control on sandboxed commands and Telemetry Tracking.",
        "added": [
            "Always Ask Command List: Force prompt verification for specific sensitive commands regardless of general settings.",
            "Thinking Duration Visualizer: Displays a beautiful dimmed timer next to 'Thought' (e.g. 'for 5s') once reasoning completes.",
            "High-Fidelity Code Changes Tracker: Real-time telemetry monitoring of total lines added/removed (+X -Y) inside session summaries, the live /stats dashboard, and persistent daily usage logs."
        ],
        "changed": [
            "User-Typed Sandbox Overrides: Replaced fixed toggle presets with inline, comma-separated customizable text inputs for Auto Approve and Auto Disapprove."
        ],
        "fixes": []
    },
    "1.16.0": {
        "note": "Enhanced Sandboxing & Security Policies",
        "added": [
            "Granular Sandbox Presets: Added Strict, Balanced, Autonomous, and Custom sandboxes.",
            "Comprehensive Security Rules: Integrated Auto-Approve, Auto-Disallow, Git Commit approvals, and Network Access controls."
        ],
        "changed": [],
        "fixes": []
    },
    "1.15.0": {
        "note": "Enhanced Thinking Intelligence",
        "added": [
            "Integrated Advanced Decision Intelligence: Enhanced the core system with a more sophisticated decision-making architecture to improve reasoning quality."
        ],
        "changed": [
            "Advanced Reasoning Capabilities: Refined the reasoning engine to handle more complex queries and scenarios.",
            "Enhanced Natural Language Understanding"
        ],
        "fixes": []
    },
    "1.14.5": {
        "note": "General Improvements and Optimizations",
        "added": [],
        "changed": [
            "Optimized System Prompt Engineering to reduce token usage and improve performance."
        ],
        "fixes": [
            "Refined UI for more unified and clean experience."
        ]
    },
    "1.14.0": {
        "note": "Git-less Time Travel Reversion System.",
        "added": [
            "Introduced a Git-less codebase Time Travel Reversion system, enabling transaction-based rollbacks to any selected prompt in the conversation, reverting all modified, added, or deleted files back to their exact pre-prompt state.",
            "Added the `/revert` command and double-ESC shortcut to easily trigger the Time Travel flow."
        ],
        "changed": [],
        "fixes": []
    },
    "1.13.0": {
        "note": "Advanced Memory Architecture.",
        "added": [
            "Added 2 layered Memory System with Global & Session memory. With L1 & L2 caching.",
            "Designed biological **Ebbinghaus-style Geometric Memory Decay** logic to model natural forgetting curves.",
        ],
        "changed": [],
        "fixes": []
    },
    "1.12.8": {
        "note": "Chat Export & Cleanup Update.",
        "added": [
            "Introduced the `/export` command to export the active chat session logs in a clean, structured `.txt` format.",
        ],
        "changed": [],
        "fixes": []
    },
    "1.12.0": {
        "note": "Terminal Startup Arguments & UX Refinements.",
        "added": [
            "Introduced support for CLI startup arguments, enabling command line overrides for models, memory, session resuming, and core settings.",
            "Implemented smooth dynamic scrolling viewports for chat history and command selection menus."
        ],
        "changed": [],
        "fixes": [
            "Resolved profile data prefilling to automatically load and preserve existing configuration values."
        ]
    },
    "1.11.3": {
        "note": "PDF Image rendering, Pacing Delay & UI Layout Update.",
        "added": [
            "Integrated a powerful dynamic Base64 Image Resolution Engine in the PDF exporter, rendering local images perfectly.",
            "Introduced an adaptive, minimum 1-second pacing delay between consecutive tool executions to ensure a smooth, readable terminal execution rhythm.",
            "Added a sneaky `--bypass` override to the `/thinking` command, letting developers unlock higher reasoning levels in Flow mode."
        ],
        "changed": [],
        "fixes": [
            "Resolved a `/clear` and `/resume` layout bug that trapped the gradient logo inside the welcome message's border."
        ]
    },
    "1.11.1": {
        "note": "Image Generation will be depriciated on v1.10 after MAY-23. Update to v1.11 to continue using the feature.",
        "added": [],
        "changed": [
            "Improved predictiveness of Image gen Quota resets."
        ],
        "fixes": []
    },
    "1.11.0": {
        "note": "Secure Vault, Dynamic Quota & Logging Update.",
        "added": [
            "Integrated standard **AES-256-CBC Encryption** across all persistent files (`settings.json`, `usage.json`, `secrets.json`, `memories`, `history.json`), fully securing configuration data.",
            "Designed a highly advanced, chronological **Hour-by-Hour Dynamic Image Generation Quota** scaling engine with consecutive-hour usage suppression and an intelligent multi-tier credit recovery system (15 to 25 credits).",
            "Introduced a granular **Internal Log Janitor** that recursively prunes only expired log entries older than 7 days from inside log files, preserving recent stack traces while eliminating log bloat.",
            "Permanently relocated the persistent `usage.json` stats database coordinates to the home directory (`~/.fluxflow/usage.json`) for centralized configuration alignment."
        ],
        "changed": [
            "Phased out legacy XOR encryption, deploying a self-healing backwards-compatible parser that seamlessly auto-upgrades existing files on the first load.",
        ],
        "fixes": []
    },
    "1.10.0": {
        "note": "Creative, Web & Memory Update.",
        "added": [
            "Introduced fully-featured **Image Generation** with customizable models, aspect ratios, seeds, and real-time budget telemetry tracking.",
            "Get 20 generations per hour on Low preset. BYOK from `pollinations.ai` for higher quotas."
        ],
        "changed": [
            "Improved **Memory Reliability**.",
            "Updated patch for Web Tools."
        ],
        "fixes": []
    },
    "1.9.24": {
        "note": "Reasoning Speed & Platform Hardening Patch.",
        "added": [
            "Introduced **Fast (Thinking Off)** reasoning level for instantaneous responses. Recomended for Factual Tasks/RolePlays."
        ],
        "changed": [],
        "fixes": []
    },
    "1.9.21": {
        "note": "Stability Patch.",
        "added": [],
        "changed": [
            "Better path handling across OSs to reduce errors further."
        ],
        "fixes": []
    },
    "1.9.20": {
        "note": "Tool Removal",
        "added": [],
        "changed": [
            "Removed `PPTGeneration` tool due to unreliability & quality issues."
        ],
        "fixes": []
    },
    "1.9.16": {
        "note": "Updated models.",
        "added": [],
        "changed": [
            "Swapped `gemini-3.1-flash-lite-preview` with `gemini-3.1-flash-lite`."
        ],
        "fixes": []
    },
    "1.9.10": {
        "note": "Web Patch.",
        "added": [],
        "changed": [
            "Updated Patch for Web Tools."
        ],
        "fixes": []
    },
    "1.9.9": {
        "note": "Streamlining and Optimizing Flux Flow.",
        "added": [
            "File Snapshot UI for quick view of file written by Agent.",
            "Added command `/fluxflow init` to quickly create `fluxflow.md` template for customized agent behavior."
        ],
        "changed": [
            "Reduced system prompt's token overhead by ~60%.",
            "Improved & more AI friendly tool architecture for reduced errors.",
            "Removed Alternate Screen Buffer feature."
        ],
        "fixes": []
    },
    "1.9.2": {
        "note": "",
        "added": [],
        "changed": [
            "Extended the support of premium design in more components.",
            "Security Enhancements for Protected System folders."
        ],
        "fixes": []
    },
    "1.9.0": {
        "note": "High-Fidelity UI Modernization & Stability Hardening.",
        "added": [
            "Premium design system.",
        ],
        "changed": [
            "Improved Tools stability."
        ],
        "fixes": []
    },
    "1.8.32": {
        "note": "Stability & Quality Improvements.",
        "added": [],
        "changed": [
            "Improved prompting for better attention layering, cognitive depth, and lower token overhead"
        ],
        "fixes": [
            "Few UI Bug fixes."
        ]
    },
    "1.8.31": {
        "note": "Improved Tool Schema.",
        "added": [],
        "changed": [
            "Redesigned tools for more robust edge case handling with escape characters.",
            "Tuned Thinking for more accuracy and depth on evry task."
        ],
        "fixes": []
    },
    "1.8.26": {
        "note": "Improved API Error resilience",
        "added": [],
        "changed": [
            "Improve Recovery algorithms cuz Google is dying."
        ],
        "fixes": []
    },
    "1.8.12": {
        "note": "Performance Optimization & Cognitive Resilience.",
        "added": [
            "Implemented **Word-Level Stutter Detection** to catch and recover from character/word repetition loops.",
            "Added **Dynamic Component Unmounting** during tool execution to reduce CPU overhead.",
            "Extended tool timeouts to **3 minutes** for `WebSearch`, `WebScrape`, and `WritePdf`."
        ],
        "changed": [
            "Upgraded **Loop Detection** with a new 0.6 threshold for main response body analysis."
        ],
        "fixes": []
    },
    "1.8.10": {
        "note": "Hardened Reliability & Seamless Recovery.",
        "added": [
            "Implemented **Seamless Recovery Engine** for mid-response API failures (500/503 errors).",
            "Introduced **Cognitive Filtering** to prevent system keyword 'leakage' from reasoning process."
        ],
        "changed": [
            "Optimized **Instruction Hierarchy**.",
            "Improved **Termination Sync** across nested retry loops for zero-zombie shutdowns.",
        ],
        "fixes": [
            "Fixed 'Reasoning Leakage' where thought processes could accidentally trigger system commands."
        ]
    },
    "1.8.7": {
        "note": "Vision & Stability Patch.",
        "added": [
            "Implemented **Dynamic 800-line Viewport** for `ReadFile` with intelligent relative paging.",
            "Added **Read-Merge-Write** persistence safety to protect daily telemetry from zombie process resets."
        ],
        "changed": [
            "Modernized **Thought Rendering** UI — Shifted to a clean, fluid monologue style for better readability.",
            "Upgraded **Fuzzy Matcher v6** for `update_file` with significantly improved whitespace elasticity.",
            "Synced terminal status labels with the new 800-line viewing standard."
        ],
        "fixes": [
            "Fixed a background memory leak in the `UpdateProcessor`.",
            "Resolved a bug where telemetry stats would reset to zero during in-app updates."
        ]
    },
    "1.8.0": {
        "note": "The Reasoning Revolution.",
        "added": [
            "Implemented **Stable Monologue Architecture** for deeper, non-pattern-matched thinking.",
            "Dynamic **Context-Awareness** system that adapts instructions based on real-time token usage.",
            "Added `search_keyword` tool for high-speed project-wide discovery."
        ],
        "changed": [
            "Upgraded file tools to handle newlines via custom DSL protocol.",
            "Improved **Precision Delta-Shift** indentation engine for zero-drift code patching.",
            "Tuned generation penalties for better progress and less repetition in loops."
        ],
        "fixes": []
    },
    "1.7.20": {
        "note": "Improved Tools for less failures.",
        "added": [],
        "changed": [
            "Improved `update_file` tool focued on reduce patch failures due to indentation mismatches.",
            "Improved Loop detection algorithm."
        ],
        "fixes": []
    },
    "1.7.11": {
        "note": "Improved UX",
        "added": [],
        "changed": [
            "Added Loop Prevention."
        ],
        "fixes": []
    },
    "1.7.6": {
        "note": "Write Improvements",
        "added": [],
        "changed": [
            "More frequent & atomic saves of daily telemetry.",
            "Updated the `WriteFile` & `UpdateFile` tool to handle newlines contextually.",
        ],
        "fixes": []
    },
    "1.7.5": {
        "note": "Math Improvements",
        "added": [],
        "changed": [],
        "fixes": [
            "Improved Math Rendering with more LaTeX support."
        ]
    },
    "1.7.1": {
        "note": "The Telemetry Engine.",
        "added": [
            "Integrated High-Fidelity Performance Telemetry (Wall Time vs Agent Active Time).",
            "Precision Tool Tracking (Detailed Success/Failure rates with millisecond-accurate timing).",
            "Redesigned 'Instant-Exit' Dashboard with comprehensive session summaries."
        ],
        "changed": [
            "Swapped /quit confirmation for a data-driven shutdown dashboard.",
            "Unified telemetry aesthetics across `/stats` and `/quit` screens."
        ],
        "fixes": [
            "Improved terminal signal handling for Ctrl+C."
        ]
    },
    "1.7.0": {
        "note": "The Office Suite.",
        "added": [
            "Added `WriteDocX` tool for creating Word documents.",
            "Added `WritePPTX` tool for creating PowerPoint presentations."
        ],
        "changed": [],
        "fixes": []
    },
    "1.6.7": {
        "note": "UX Improvements.",
        "added": [],
        "changed": [],
        "fixes": [
            "Fixed the jitteryness in tables."
        ]
    },
    "1.6.6": {
        "note": "Bug fixes.",
        "added": [],
        "changed": [],
        "fixes": [
            "Occational quote escaping issues fixed."
        ]
    },
    "1.6.0": {
        "note": "Improved experience & reliability.",
        "added": [
            "Added client side streaming for more predictictable response generation speed."
        ],
        "changed": [
            "Files written/updated via FluxFlow will be normalized to LF line endings.",
            "Improved LaTeX support."
        ],
        "fixes": [
            "Fixed a bug where occationally `WriteFile` & `UpdateFile` tools get confused by certain keywords resulting in half corrupted file writes.",
            "More reliable file operations with CRLF or LF. Resulting in less update failures."
        ]
    },
    "1.5.4": {
        "note": "General Improvements.",
        "added": [],
        "changed": [
            "Generated PDFs will now include invisible 'AI Generated' watermark."
        ],
        "fixes": [
            "Fixed file path handling glitch in Windows."
        ]
    },
    "1.5.3": {
        "note": "Improved web scraping tool to understand pages.",
        "added": [],
        "changed": [
            "`web_scrape` now preserves more context depth."
        ],
        "fixes": []
    },
    "1.5.2": {
        "note": "New and Advanced Web tools.",
        "added": [],
        "changed": [
            "Re-written `WebSearch` and `WebScrape` tools to be the most reliable with JS hydration capabilities."
        ],
        "fixes": []
    },
    "1.5.1": {
        "note": "Optional update.",
        "added": [],
        "changed": [],
        "fixes": [
            "Updated patch for anti-bot systems."
        ]
    },
    "1.5.0": {
        "note": "The *Multimodal* Era.",
        "added": [
            "Native Multimodal Support (PDF, JPG, PNG, WEBP).",
            "High-Fidelity Context Retention for non-text assets.",
            "Added `WritePdf` tool to Generate Professional & Creative PDF Documents on the fly."
        ],
        "changed": [
            "Upgraded `ReadFile` tool to handle binary detection and base64 encoding."
        ],
        "fixes": []
    },
    "1.4.3": {
        "note": "Minor patch to ensure better reliability with `\\n` and '\\n' characters in `WriteFile` & `UpdateFile` operations.",
        "added": [],
        "changed": [],
        "fixes": []
    },
    "1.4.2": {
        "note": "CRITICAL PATCH FOR AGENT CONTEXT RETENTION. IMMEDIATE UPDATE STRONGLY RECOMMENDED!",
        "added": [],
        "changed": [],
        "fixes": [
            "Fixed a issue where the system was aggressively truncating `Tool Results` after the agent finish a turn."
        ]
    },
    "1.4.1": {
        "note": "This is a refinement patch to v1.4.0.",
        "added": [],
        "changed": [
            "Refined terminal interaction feedback and placeholders.",
            "Optimized Thinking budgets for better speed vs depth balance."
        ],
        "fixes": [
            "Implemented Emergency Brake (Double-ESC) to kill hanging interactive terminal processes if running program don't have exit state."
        ]
    },
    "1.4.0": {
        "added": [
            "Interactive Sub-Terminal when agent runs terminal commands."
        ],
        "changed": [
            "Improved Thinking style for Depth & Logic."
        ],
        "fixes": []
    },
    "1.3.5": {
        "added": [
            "Smart Word Wrap for better reading experience.",
            "Multiline Input support for native terminals (Windows, Linux, MacOS) with Ctrl+Enter. VS Code's Shift+Enter remains unchanged.",
            "Improved Suggestion accuracy with Fuzzy match",
            "Dual Layer suggestion for nested commands."
        ],
        "changed": [
            "Removed few modals and implemented their functionality directly in command shortcuts to reduce Context Switching during workflow."
        ],
        "fixes": [
            "Better `Table` markdown rendering.",
            "Input placeholder not visible in Windows Terminal (windows being windows)."
        ]
    },
    "1.3.4": {
        "added": [],
        "changed": [
            "Suggestion Modal UI, Now more stable and detailed."
        ],
        "fixes": [
            "Improved Overall Stability.",
            "Fixed the issue where Suggestion Modal was not showing on certain conditions."
        ]
    },
    "1.3.1": {
        "added": [
            "Improved Markdown compatibility."
        ],
        "changed": [
            "Completely redesigned few components for better UI/UX.",
            "Improved Keyboard Shortcuts & Accessibility."
        ],
        "fixes": [
            "Improved Token Efficiency by ~15%.",
            "Patched Impersonation Attacks on Agent via CoT Hijacking.",
        ]
    },
    "1.3.0": {
        "added":
            [
                "Added `Auto Updater` with user prefered package manager.",
                "Added `/update` & `/update check` commands.",
                "Added built-in app updater."
            ],
        "changed": [
            "Real-time context counter window update.",
            "Improved Session Dashboard."
        ],
        "fixes": [
            "Fixed the `read-folder` tool to get a detailed file structure",
            "Fixed the issue where `Agent Called` counter was higher than actual agent calls.",
            "Improved UI spacing."
        ]
    },
    "1.2.0": {
        "note": "MAJOR PATCH to Flux Flow.",
        "added": [
            "Added `STREERING HINT` to let users adjust agent's congitive path in real time. (Just send the prompt during agent is working)"
        ],
        "changed": [
            "Redesigned parser to better handle separation of reasoning & output during streaming.",
        ],
        "fixes": [
            "Improved memory Handling & Garbage Collection.",
            "Improved Long Context Handling & Large Codebase Stability.",
            "Fixed Accidental Termination of Agent by Extended reasoning."
        ]
    },
    "1.1.5": {
        "added": [
            "Added `Alternate Screen Buffer` support (Experimental)."
        ],
        "changed": [
            "Changed Source Code from `CRLF` to `LF`.",
            "Improved Minimalism in Status Bar."
        ],
        "fixes": [
            "Improved Tool Usage"
        ]
    },
    "1.1.2": {
        "added": [],
        "changed": [
            "More robust tool parsing to handle edge case model quirks."
        ],
        "fixes": [
            "Fixed the issue where agent might accidently get terminated after reading a file.",
            "Improved Ask User Tool for better real-world use.",
            "Reduced Token bloat from terminal context."
        ]
    },
    "1.1.1": {
        "added": [
            "Ask User feature where Agent can ask for User decision / confirmation directly during work.",
            "Support for /changelog to view release notes easily.",
            "'Update Available' modal to notify users of new versions."
        ],
        "changed": [
            "Improved `write_file` tool to increase reliability of reversals.",
            "Improved Context retention to 254k tokens."
        ],
        "fixes": [
            "Performance issues in LOOONG Chats.",
            "Improved Markdown rendering.",
            "Improved anti-flicker for long chats.",
            "Incomplete Tool calls.",
            "Reduced memory failures."
        ]
    },
    "1.0.13": {
        "added": [],
        "changed": [],
        "fixes": [
            "Infinite Loops in MAX thinking.",
            "UI Improvements."
        ]
    },
    "1.0.9": {
        "added": [
            "Improved Error handling.",
            "Retry Loops to increase reliability.",
            "Markdown support for chat messages."
        ],
        "changed": [
            "Improved Context retention to 196k tokens."
        ],
        "fixes": []
    },
    "1.0.0": {
        "note": "APRIL 24 - Initial Release.",
        "added": [
            "Initial release of **Flux Flow CLI**",
            "Agentic CLI with *Gemini* integration",
            "Human-in-the-loop security gates for terminal commands and file system writes",
            "Dual operation modes: **Flux** (Dev) and **Flow** (Chat)",
            "Background model for memory extraction process",
            "Personalized Memory"
        ],
        "changed": [],
        "fixes": []
    }
};
