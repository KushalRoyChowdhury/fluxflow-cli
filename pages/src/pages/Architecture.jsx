import DocPage from '../components/DocPage'

const headings = [
    { id: 'ui-layer', text: 'UI Layer: React & Ink', level: 2 },
    { id: 'agentic-loop', text: 'The Agentic Loop', level: 2 },
    { id: 'dual-model-system', text: 'Dual-Model System', level: 2 },
    { id: 'subagent-system', text: 'The Subagent System', level: 2 },
    { id: 'emergency-rollback', text: 'Emergency Rollback System', level: 2 },
    { id: 'ide-bridge', text: 'IDE Bridge (Companion)', level: 2 },
    { id: 'multimodal-pipeline', text: 'Multimodal Pipeline', level: 2 },
    { id: 'persistence-safety', text: 'Persistence & Safety', level: 2 },
]

export default function Architecture() {
    return (
        <DocPage headings={headings}>
            <h1 id="architecture-design">Architecture & Design</h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed mb-10">
                FluxFlow is built on a modern, reactive stack that brings web-like development
                paradigms to the terminal. It utilizes a custom agentic loop for reasoning and
                a unique dual-model system for background processing.
            </p>

            <h2 id="ui-layer">UI Layer: React & Ink</h2>
            <p>
                The entire terminal interface is built using <strong>React</strong> via the
                <strong> Ink</strong> renderer. This allows for a component-based UI in the terminal
                that remains highly responsive.
            </p>
            <ul>
                <li><strong>Component-Based</strong> — Composition of isolated, reusable React components like <code>ChatLayout</code> and <code>StatusBar</code>.</li>
                <li><strong>Reactive State</strong> — Uses standard React hooks (<code>useState</code>, <code>useEffect</code>) for managing inputs and terminal events.</li>
            </ul>

            <h2 id="agentic-loop">The Agentic Loop</h2>
            <p>
                The core intelligence resides in a custom, highly transparent string-based protocol
                powered by an asynchronous generator. It manages context assembly, stream processing,
                and tool execution in a continuous cycle:
            </p>
            <ol>
                <li><strong>Context Assembly</strong> — Combines prompts with system instructions, session context, and encrypted user memories.</li>
                <li><strong>Stream Processing</strong> — Initiates streaming requests to selected provider, yielding chunks directly to the UI.</li>
                <li><strong>Detection & Execution</strong> — Scans responses for tool calls using a custom bracket-balancing parser.</li>
                <li><strong>Security Governance</strong> — Enforces security checks and Human-in-the-Loop (HITL) approvals.</li>
            </ol>

            <h2 id="dual-model-system">Dual-Model System</h2>
            <p>
                To maintain a snappy UI while performing complex management, FluxFlow employs
                two separate AI models:
            </p>
            <ul>
                <li><strong>The Main Agent</strong> — Handles direct interaction, reasoning, and tool execution. It focuses on the user's immediate problem.</li>
                <li><strong>The Memory Agent</strong> — A silent background process responsible for system maintenance, memory extraction, and chat summarization without blocking the main UI.</li>
            </ul>

            <h2 id="subagent-system">The Subagent System</h2>
            <p>
                FluxFlow provides a robust, multi-agent execution system to delegate sub-tasks and
                run parallel operations without blocking the main workflow:
            </p>
            <ul>
                <li><strong>Sync/Async Execution Modes</strong> — Spawns blocking subagents (<code>invokeSync</code>) or asynchronous background subagents (<code>invoke</code>) with distinct telemetry tracking. Supports up to 7 concurrent background subagents.</li>
                <li><strong>Isolated Context & Tooling</strong> — Subagents run independently without conversation clutter. They receive a dedicated suite of 10 system tools (including <code>ReadFile</code>, <code>PatchFile</code>, <code>WriteFile</code>, <code>SearchKeyword</code>, <code>WebSearch</code>), while unsafe commands (<code>Run</code>) are strictly disabled.</li>
                <li><strong>Event-Driven Orchestration</strong> — Main agent manages subagents via <code>Await</code>, <code>GetProgress</code>, and <code>Cancel</code> tools to monitor status or abort stalled background workers.</li>
                <li><strong>Reversion Security</strong> — All file mutations made by subagents are tracked chronologically under the session's active transaction for total Git-less rollback safety.</li>
            </ul>

            <h2 id="emergency-rollback">Emergency Rollback System</h2>
            <p>
                When <strong>Advance Rollback</strong> is enabled, FluxFlow maintains an automated turn-level checkpointing mechanism that allows the agent to self-heal and revert workspace states:
            </p>
            <ul>
                <li><strong>Turn Checkpointing</strong> — Before executing prompt turns, FluxFlow scans workspace manifests and takes snapshots of changed files into an encrypted local ledger sanctuary.</li>
                <li><strong><code>EmergencyRollback</code> Tool</strong> — Exposes <code>getCheckpoint</code> (to inspect past turn states and file diffs) and <code>forceRevert</code> (to roll back workspace files to a clean turn state).</li>
                <li><strong>Self-Healing Recovery</strong> — If a tool call causes catastrophic corruption or broken builds, the agent can inspect turn history and autonomously execute a force rollback to restore a known working state.</li>
            </ul>

            <h2 id="ide-bridge">IDE Bridge (Companion Extension)</h2>
            <p>
                FluxFlow establishes a real-time link between your code editor (VS Code and forks)
                and the CLI agent via a local WebSocket server.
            </p>
            <ul>
                <li><strong>Bi-Directional Context</strong> — The CLI knows your cursor position and active selection; the IDE automatically opens and highlights files modified by the agent.</li>
                <li><strong>State Persistence</strong> — The extension tracks manual human edits to prevent redundant context loops.</li>
            </ul>

            <h2 id="multimodal-pipeline">Multimodal Pipeline</h2>
            <p>
                A native engine that allows the agent to analyze visual assets directly. It reads
                raw bytes, encodes them, and injects them into the model's multimodal array.
            </p>
            <ul>
                <li><strong>Image Analysis</strong> — Full support for JPG and PNG files.</li>
                <li><strong>PDF Extraction</strong> — Extracts visual representations of pages for high-fidelity spatial context.</li>
            </ul>

            <h2 id="persistence-safety">Persistence & Safety</h2>
            <ul>
                <li><strong>High-Fidelity Lock</strong> — A Promise-based <code>WRITE_LOCK</code> prevents race conditions between the UI and Memory processes.</li>
                <li><strong>Encryption</strong> — Secrets and user memories are encrypted at rest locally on your machine.</li>
                <li><strong>Anchor Strategy</strong> — Supports full data redirection to external paths for maximum portability and privacy.</li>
            </ul>
        </DocPage>
    )
}
