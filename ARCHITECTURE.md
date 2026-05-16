# 🏛️ Architecture & Design

Flux Flow is built on a modern, reactive stack that brings web-like development paradigms to the terminal. It utilizes a custom agentic loop for reasoning and a unique dual-model system for background processing.

## UI Layer: React & Ink

The entire terminal interface is built using **React** via the [Ink](https://github.com/vadimdemedes/ink) renderer.
- **Component-Based**: The UI is composed of isolated, reusable React components (`ChatLayout`, `StatusBar`, `CommandMenu`, `TerminalBox`, `ProfileForm`).
- **Reactive State**: The application uses React hooks (`useState`, `useEffect`) to manage user input, application mode, model selection, and the terminal's resizing events.
- **Zero-Render Overheads**: Critical performance trackers, like the session start time, are kept outside the React render cycle to maintain terminal responsiveness during high-speed AI text streaming.

## The Agentic Loop

The core intelligence of Flux Flow resides in `src/utils/ai.js`. It does not rely on opaque third-party agent frameworks; instead, it uses a custom, highly transparent string-based protocol powered by an asynchronous generator (`async function*`). This approach allows for real-time UI updates while managing complex multi-step reasoning.

The execution flow of a single user prompt follows this loop:

1. **Context Assembly**: The user's prompt is combined with the system instructions, temporary session context, persistent user memories, and the current chat history. If the history gets too large (e.g., >128k tokens) and compression is disabled, it is gracefully truncated.
2. **Stream Processing**: The main loop initiates a streaming request to the Gemini API (`client.models.generateContentStream`). It yields chunks of text and status updates directly back to the React UI as they arrive.
3. **Detection & Tool Execution**: Once the stream completes for a given turn, the entire response is scanned for tool calls using a custom regex and bracket-balancing parser (looking for `tool:functions.tool_name(args...)`).
   - If tools are found, the loop pauses.
   - Each tool is dispatched to its respective handler in `src/tools/`.
   - Tool outputs are collected and appended to the context as `[TOOL_RESULT]: ...`.
4. **Security Governance**: During tool execution, the loop enforces security checks (e.g., blocking `exec_command` from accessing system root drives if "External Workspace Access" is off) and pauses for Human-in-the-Loop (HITL) approval if necessary.
5. **Turn Management & Continuation**: The model is instructed to append `[turn: finish]` if its goal is complete, or `[turn: continue]` if it expects tool results.
   - If tools were called or `[turn: continue]` is present, the loop increments and re-prompts the model with the newly gathered `[TOOL_RESULT]` data.
   - If `[turn: finish]` is detected and no further tools were called, the main loop terminates, passing the final synthesized context to the background Janitor process.
6. **Loop Limits & Resilience**: To prevent infinite loops or excessive API usage, **Flux mode** is capped at 50 iterations per user prompt, while **Flow mode** is capped at 5.
   - **Multi-Stage Failover**: The loop features a sophisticated 8-attempt retry engine with random backoff (800ms - 2s).
   - **Critical Fallback Pivot**: If the primary model fails 5 consecutive times, the agent surgically pivots to a lighter, high-concurrency fallback model (`gemini-3.1-flash-lite`) for the final 3 attempts to ensure session navigation through API congestion.

## Multimodal Pipeline

Flux Flow implements a native multimodal processing engine in `src/tools/view_file.js`. This allows the agent to move beyond text-based reasoning and analyze visual assets directly.

- **Binary Detection**: The pipeline uses `is-binary-path` to distinguish between text and binary files.
- **Visual Encoding**: If an image or PDF is detected, the engine reads the raw bytes and converts them into base64-encoded `InlineData` objects.
- **PDF Extraction**: For PDF documents, the engine extracts visual representation of pages to provide the model with high-fidelity spatial and textual context simultaneously.
- **Context Injection**: These multimodal assets are injected directly into the Gemini model's multimodal part array, allowing the model to "see" the file as if it were looking at a screenshot.

## The Dual-Model System

To maintain a fast, snappy UI while still performing complex data management, Flux Flow employs two separate AI models for every interaction:

### 1. The Main Agent
- **Responsibility**: Direct user interaction, reasoning, and tool execution.
- **Behavior**: Streams text directly to the UI. It focuses entirely on solving the user's immediate problem or answering their question.

### 2. The Janitor (Background Process)
- **Responsibility**: System maintenance, long-term memory extraction, and chat summarization.
- **Behavior**: After the Main Agent finishes its loop, the entire context (User Prompt + Agent Raws) is sent to the Janitor model.
- **Headless Operation**: The Janitor is explicitly instructed to be a "silent background system process" with "no mouth." It *only* outputs valid tool calls (e.g., updating the chat title or saving a new user preference to the persistent memory vault).

## Data Persistence & Safety

- **High-Fidelity Lock**: Because both the UI and the Janitor model may attempt to write to the `history.json` file simultaneously, a Promise-based `WRITE_LOCK` (`src/utils/history.js`) is utilized. This prevents race conditions and ensures data integrity.
- **Encryption**: User secrets and persistent memories (`secret/memories.json`) are handled by `src/utils/crypto.js` to ensure local privacy.

## Redirection & The Anchor Strategy

To support data portability (e.g., storing all app data on an external encrypted drive), Flux Flow utilizes a synchronous "Anchor" strategy in `src/utils/paths.js`.

- **Synchronous Pivot**: Because many core modules (History, Secrets, Usage) initialize their file paths as constants during module loading, the application must determine the "Actual" data root before anything else.
- **Boot-Sequence Priority**: On every launch, `paths.js` performs a synchronous file system check for `~/.fluxflow/settings.json`. If a redirection path is found (`useExternalData: true`), it immediately overrides the global `DATA_DIR` constant for the entire process.
- **Sub-Coordinate Resolution**: All secondary directories (`LOGS_DIR`, `SECRET_DIR`) are derived dynamically from the redirected `DATA_DIR`, ensuring that all session data flows to the external sanctuary without requiring individual configuration updates across the codebase.
