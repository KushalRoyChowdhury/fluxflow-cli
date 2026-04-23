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
6. **Loop Limits & Resilience**: To prevent infinite loops or excessive API usage, **Flux mode** is capped at 50 iterations per user prompt, while **Flow mode** is capped at 5. The loop also features built-in retry logic (with exponential backoff) for handling transient API errors like 429s or 503s.

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