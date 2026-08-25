import DocPage from '../components/DocPage'

const headings = [
    { id: 'ui-layer', text: 'UI Layer: React & Ink', level: 2 },
    { id: 'sub-terminal', text: 'Interactive Sub-Terminal', level: 2 },
    { id: 'hitl-verification', text: 'Human-in-the-Loop (HITL) & Security', level: 2 },
    { id: 'project-instructions-skills', text: 'Project Instructions & Skills System', level: 2 },
    { id: 'steering-resolution', text: 'Real-Time Steering & Resolution', level: 2 },
    { id: 'thinking-visualization', text: 'Thinking Levels & Reasoning', level: 2 },
    { id: 'agentic-loop', text: 'The Agentic Loop & Status Bar', level: 2 },
    { id: 'dual-model-system', text: 'Dual-Model System', level: 2 },
    { id: 'subagent-system', text: 'The Subagent System', level: 2 },
    { id: 'emergency-rollback', text: 'Emergency Rollback System', level: 2 },
    { id: 'self-healing', text: 'System Integrity & Self-Healing', level: 2 },
    { id: 'ide-bridge', text: 'IDE Bridge (Companion)', level: 2 },
    { id: 'multimodal-pipeline', text: 'Multimodal Pipeline', level: 2 },
    { id: 'computer-use', text: 'Computer Use & GUI Automation', level: 2 },
    { id: 'persistence-safety', text: 'Persistence, Data Sanctuary & Safety', level: 2 },
]

export default function Architecture() {
    return (
        <DocPage headings={headings}>
            <h1 id="architecture-design">Architecture & Design</h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed mb-10">
                FluxFlow is built on a modern, reactive stack that brings web-like development
                paradigms to the terminal. It utilizes a custom agentic loop for reasoning,
                human-in-the-loop controls, interactive sub-terminals, and a unique dual-model system.
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

            <h2 id="sub-terminal">Interactive Sub-Terminal</h2>
            <p>
                FluxFlow features a high-fidelity, interactive sub-terminal that allows you to engage with commands spawned by the agent in real-time.
            </p>
            <ul>
                <li><strong>Live Interaction</strong> — Output appears in a dedicated sub-terminal box when executing shell commands.</li>
                <li><strong>Focus Toggling (<code>TAB</code>)</strong> — Pressing <code>TAB</code> shifts keyboard focus directly into the active sub-terminal.</li>
                <li><strong>Visual Indicators</strong> — Borders glow yellow when focused and the footer status switches to <code>▶ TERMINAL FOCUSED</code>.</li>
                <li><strong>Cross-Platform Bridge</strong> — Detects host OS to normalize line endings (<code>\r\n</code> vs <code>\n</code>), supporting interactive prompts seamlessly.</li>
            </ul>

            <h2 id="hitl-verification">Human-in-the-Loop (HITL) & Security</h2>
            <p>
                Security governance guarantees dangerous file system or shell operations require explicit authorization:
            </p>
            <ul>
                <li><strong>Tool & Command Approval</strong> — Shell execution (<code>exec_command</code>) and file modifications prompt an interactive approval UI (Allow/Deny). Safe read-only commands (<code>ls</code>, <code>pwd</code>) execute automatically.</li>
                <li><strong>Auto-Execution & YOLO Mode</strong> — Advanced configuration in <code>/settings</code> allows power users to enable autonomous execution, adjust external directory access, or configure granular auto-approve/auto-deny rules and network sandboxing.</li>
            </ul>

            <h2 id="project-instructions-skills">Project Instructions &amp; Skills System</h2>
            <p>
                FluxFlow incorporates a modular, hierarchical context and skill execution architecture that supports both workspace-specific configurations and global machine-wide instructions:
            </p>
            <ul>
                <li>
                    <strong>Global Sanctuary &amp; Workspace Context (<code>fluxflow.md</code> / <code>agent.md</code>)</strong> — 
                    Instructions are discovered case-insensitively from both the global sanctuary directory (<code>FLUXFLOW_DIR</code>: <code>~/.fluxflow/fluxflow.md</code> located in the user's home directory) and the local workspace (<code>CWD/fluxflow.md</code>). <code>agent.md</code> is supported as a direct alias. Both instruction sets are merged automatically under <code>--- Additional Instructions ---</code> in the system prompt on startup.
                </li>
                <li>
                    <strong>Hierarchical Skill Discovery &amp; Folders</strong> — Skills are discovered and cached on startup from both global and local scopes:
                    <ul>
                        <li><em>Global Scope:</em> <code>~/.fluxflow/skill.md</code>, <code>~/.fluxflow/skills/**/skill.md</code>, <code>~/.fluxflow/.skills/**/skill.md</code></li>
                        <li><em>Local Scope:</em> <code>./skill.md</code>, <code>./skills/**/skill.md</code>, <code>./.skills/**/skill.md</code></li>
                    </ul>
                </li>
                <li>
                    <strong>Skill Manifest Structure</strong> — Each skill file declares structured YAML frontmatter:
                    <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-sm my-3 font-mono">
{`---
name: skill-name
description: Purpose and overview of the skill
---
# Instructions
...`}
                    </pre>
                </li>
                <li>
                    <strong>Prompt-Injected Skill Index</strong> — The system prompt indexes available skills under <code>-- Global Skills --</code> and <code>-- Local Skills --</code> with high-level descriptions.
                </li>
                <li>
                    <strong>Deterministic On-Demand Reading &amp; References</strong> — Models load full skill details and auxiliary documentation on demand via virtual path routing:
                    <ul>
                        <li><em>Primary Skill File:</em> <code>ReadFile(path=&quot;#skills/{'{global|local}'}/skillName&quot;)</code></li>
                        <li><em>Auxiliary References:</em> <code>ReadFile(path=&quot;#skills/{'{global|local}'}/skillName/reference/filename.md&quot;)</code></li>
                    </ul>
                </li>
                <li>
                    <strong>Modular References (<code>references/*.md</code>)</strong> — When to use and how they work:
                    <ul>
                        <li><em>Purpose:</em> Keep the primary <code>skill.md</code> concise and focused on high-level workflow steps. Move deep technical specifications, extensive API tables, multi-step deployment runbooks, or troubleshooting FAQs into a <code>references/</code> subfolder.</li>
                        <li><em>When to Use:</em> Use references whenever supplementary information exceeds 50–100 lines or is only needed conditionally (e.g., <code>references/troubleshooting.md</code>, <code>references/api-schema.md</code>, <code>references/migration-guide.md</code>).</li>
                        <li><em>Linking &amp; Discoverability:</em> Always list and link all reference files as markdown links inside the parent <code>skill.md</code> (e.g., <code>- **CLI Reference**: [references/cli.md](references/cli.md)</code>). Because only the parent <code>skill.md</code> is indexed by default, references must be referenced within the parent file or the agent will miss them.</li>
                    </ul>
                </li>
                <li>
                    <strong>Best Practices for Skills &amp; Instructions</strong>:
                    <ul>
                        <li><em>Concise Frontmatter:</em> Keep the <code>description</code> in frontmatter to 1–2 short, punchy sentences. This description is permanently visible in the system prompt index, so keeping it compact saves context tokens on every single turn.</li>
                        <li><em>Scope Segregation:</em> Use <strong>Global Scope</strong> (<code>~/.fluxflow/skills/</code>) for developer-wide universal tooling (Git workflows, Docker commands, release checklists) and <strong>Local Scope</strong> (<code>./.skills/</code> or <code>./skills/</code>) for repo-specific architecture, conventions, and design guidelines.</li>
                        <li><em>Zero Truncation &amp; Frontmatter Optimization:</em> When a skill is loaded into context, redundant descriptions are stripped to conserve tokens, line pagination limits are bypassed to ingest the full skill, and skill contents are protected from automated conversation truncation.</li>
                    </ul>
                </li>
            </ul>

            <h2 id="steering-resolution">Real-Time Steering & Resolution</h2>
            <ul>
                <li><strong>Steering Hints</strong> — Inject prompt feedback mid-loop to course-correct the agent while processing tasks.</li>
                <li><strong>Resolution Modal</strong> — Displays options (Send Anyway / Edit Prompt) if a task completes just as feedback is submitted.</li>
            </ul>

            <h2 id="thinking-visualization">Thinking Levels & Reasoning</h2>
            <p>
                Separates internal monologue reasoning from final answers using <code>&lt;think&gt;</code> tag parsers, offering levels: <strong>Fast</strong>, <strong>Low</strong>, <strong>Medium</strong>, <strong>High</strong>, and <strong>xHigh</strong>.
            </p>

            <h2 id="agentic-loop">The Agentic Loop & Status Bar</h2>
            <p>
                The core intelligence resides in a custom string-based protocol powered by an asynchronous generator. It manages context assembly, stream processing, and tool execution.
            </p>
            <p>
                The dynamic status bar presents real-time state: Active Mode (Flux/Flow), Thinking Level, Token Usage, Agentic Loop Counters, and API Execution status.
            </p>

            <h2 id="dual-model-system">Dual-Model System</h2>
            <p>
                To maintain a snappy UI while performing complex management, FluxFlow employs two separate AI models:
            </p>
            <ul>
                <li><strong>The Main Agent</strong> — Handles direct interaction, reasoning, and tool execution.</li>
                <li><strong>The Memory Agent</strong> — A silent background process responsible for system maintenance, memory extraction, and chat summarization.</li>
            </ul>

            <h2 id="subagent-system">The Subagent System</h2>
            <p>
                FluxFlow provides a robust, multi-agent execution system to delegate sub-tasks and run parallel operations without blocking the main workflow:
            </p>
            <ul>
                <li><strong>Sync/Async Execution Modes</strong> — Spawns blocking subagents (<code>invokeSync</code>) or asynchronous background subagents (<code>invoke</code>) supporting up to 7 concurrent workers.</li>
                <li><strong>Isolated Context & Tooling</strong> — Subagents run independently with a restricted system toolset (unsafe commands disabled).</li>
                <li><strong>Event-Driven Orchestration</strong> — Main agent manages subagents via <code>Await</code>, <code>GetProgress</code>, and <code>Cancel</code> tools.</li>
                <li><strong>Reversion Security</strong> — All file mutations made by subagents are tracked chronologically under active transactions.</li>
            </ul>

            <h2 id="emergency-rollback">Emergency Rollback System</h2>
            <p>
                When <strong>Advance Rollback</strong> is enabled, FluxFlow maintains an automated turn-level checkpointing mechanism:
            </p>
            <ul>
                <li><strong>Turn Checkpointing</strong> — Takes snapshots of changed files into an encrypted local ledger sanctuary before executing prompt turns.</li>
                <li><strong>Self-Healing Recovery</strong> — Uses <code>EmergencyRollback</code> to inspect turn history and autonomously execute forced rollbacks if broken builds or errors occur.</li>
            </ul>

            <h2 id="self-healing">System Integrity & Self-Healing</h2>
            <ul>
                <li><strong>Startup Heartbeat Check</strong> — On launch, Flux verifies internal binaries and complex dependencies.</li>
                <li><strong>Auto Dependency Recovery</strong> — Downloads and configures missing runtimes autonomously using <code>pnpm</code> or <code>npx</code> fallbacks.</li>
            </ul>

            <h2 id="ide-bridge">IDE Bridge (Companion Extension)</h2>
            <p>
                Establishes a real-time WebSocket link between code editors (VS Code) and the CLI agent for bi-directional cursor and context tracking.
            </p>

            <h2 id="multimodal-pipeline">Multimodal Pipeline</h2>
            <p>
                Native image and PDF processing pipeline that injects visual representations directly into multimodal models.
            </p>

            <h2 id="computer-use">Computer Use &amp; GUI Automation (ICU Mode)</h2>
            <p>
                FluxFlow features a zero-dependency, millisecond-latency <strong>Computer Use (Autonomous GUI Interaction)</strong> engine that enables multimodal frontier models to perceive, reason about, and interact with operating system desktop interfaces in real-time.
            </p>
            <ul>
                <li>
                    <strong>Viewport Stillness &amp; Stability Check</strong> — Before visual analysis, the screen capture engine captures two frames spaced <code>500ms</code> apart. If the binary buffers match, the viewport is confirmed stable. If dynamic animations or page loads are in progress, it applies a <code>3s</code> backoff before proceeding (max 2 cycles).
                </li>
                <li>
                    <strong>Native Pixel Variance &amp; Set-of-Marks (SoM) Grid Overlay</strong> — Instead of heavyweight neural object detection models, FluxFlow uses <code>sharp</code> to compute raw pixel grayscale variance across a 720p normalized canvas in ~4ms. High-variance regions (icons, buttons, text lines) are isolated and marked with high-contrast yellow numbering (<code>#FFFF00</code> with black stroke outline).
                </li>
                <li>
                    <strong>2-Pass Hybrid Visual Clustering</strong> —
                    <ul>
                        <li><em>Step 1 (2D Isolated Clustering):</em> Merges multi-cell icon/button elements (up to 4&times;4 cells, e.g., desktop shortcuts, taskbar tiles, setting controls) into single unified bounding boxes.</li>
                        <li><em>Step 2 (Seam-Aware Vertical Pair Merging):</em> Merges vertically adjacent active pairs. It samples pixel density across the center seam: if clean, badges sit centered directly on the seam line; if text crosses the seam, the badge automatically dodges into the clearer cell with strict 2px boundary clamping.</li>
                    </ul>
                </li>
                <li>
                    <strong>Dynamic Text-Avoidance Y-Shifting</strong> — For single-cell badges, a 3-band vertical variance check (top 33%, center 33%, bottom 33%) detects text baselines and shifts yellow marks UP (<code>-8px</code>) or DOWN into empty background gaps, ensuring text labels remain 100% legible.
                </li>
                <li>
                    <strong>Native Hardware Control (<code>@nut-tree-fork/nut-js</code>)</strong> — Automates mouse cursor movements, single/double clicks, drags, mouse-wheel scrolling, keyboard typing, and function key shortcuts (<code>F1</code>&ndash;<code>F12</code>, <code>Alt+F4</code>, <code>Ctrl+C</code>) mapped directly to native OS input events.
                </li>
                <li>
                    <strong>Full-Screen Nearest-Neighbor OCR Auto-Correction</strong> — When an action specifies an <code>intendedClickText</code>, the engine performs a full-screen Tesseract OCR scan, locates all matching lines/words, calculates the Euclidean distance to the vision model's target grid mark, and clicks the exact physical pixel center of the matched UI text.
                </li>
                <li>
                    <strong>2-Turn Memory Freshness &amp; Zero-Leak GC</strong> — Gridded screenshots are pruned to a strict 2-turn sliding window in LLM payloads, and image buffers are immediately nullified in memory for instant V8 garbage collection during long automation sessions.
                </li>
            </ul>

            <h2 id="persistence-safety">Persistence, Data Sanctuary &amp; Safety</h2>
            <ul>
                <li><strong>External Data Sanctuary (Redirection)</strong> — Allows anchoring session state, logs, and encrypted memories to an external drive or VeraCrypt volume via <code>externalDataPath</code>.</li>
                <li><strong>High-Fidelity Lock & Encryption</strong> — Promise-based <code>WRITE_LOCK</code> prevents state race conditions while secrets and memories remain encrypted at rest.</li>
            </ul>
        </DocPage>
    )
}
