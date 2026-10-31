import DocPage from '../components/DocPage'

const headings = [
    { id: 'session-management', text: 'Session Management', level: 2 },
    { id: 'agent-controls', text: 'Agent Controls', level: 2 },
    { id: 'system-configuration', text: 'System & Configuration', level: 2 },
    { id: 'utility-commands', text: 'Utility Commands', level: 2 },
]

export default function AppCommands() {
    return (
        <DocPage headings={headings}>
            <h1 id="app-commands">App Commands & Slash System</h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed mb-10">
                FluxFlow features a rich set of in-app slash commands to control the agent,
                manage your session, and configure settings on the fly directly in the chat input.
            </p>

            <h2 id="session-management">Session Management</h2>
            <ul>
                <li><strong><code>/clear</code></strong> — Clears the terminal screen.</li>
                <li><strong><code>/save</code></strong> — Forces a manual save of the current chat session.</li>
                <li><strong><code>/resume &lt;chat-id&gt;</code></strong> — Opens a modal or switches back to a previous conversation.</li>
                <li><strong><code>/chats</code></strong> — Lists all saved chat sessions.</li>
                <li><strong><code>/export</code></strong> — Exports the current chat transcript to a <code>.txt</code> file in your workspace.</li>
                <li><strong><code>/compress</code></strong> — Summarizes and compresses the active chat history to free up context tokens.</li>
                <li><strong><code>/truncate</code></strong> — Replaces completed tool results in the active history with compact markers to reduce context usage.</li>
                <li><strong><code>/revert</code></strong> — Opens the high-fidelity checkpoint viewer to rollback codebase changes to a previous state.</li>
                <li><strong><code>/quit</code></strong> — Safely exits and shuts down FluxFlow.</li>
            </ul>

            <h2 id="agent-controls">Agent Controls</h2>
            <ul>
                <li>
                    <strong><code>/mode [flux|flow|icu|fluxcu]</code></strong> — Switch operating mode:
                    <ul>
                        <li><code>flux</code>: Enables Dev toolset and full workspace access.</li>
                        <li><code>flow</code>: Creative studio, document, PDF, web, and conversation tools.</li>
                        <li><code>icu</code>: Dedicated Computer Use mode for interactive desktop automation.</li>
                        <li><code>fluxcu</code>: Autonomous workspace and desktop execution.</li>
                    </ul>
                </li>
                <li><strong><code>/model [name]</code></strong> — Select a model. Supports <code>--multimodal</code>, <code>--save</code>, <code>--remove</code>, <code>--rename</code>, and <code>--default</code>.</li>
                <li><strong><code>/thinking [fast|low|medium|standard|high|xhigh|custom|max]</code></strong> — Adjust reasoning depth. Supports <code>--map</code>, <code>--bypass</code>, and <code>--force</code>.</li>
                <li><strong><code>/wildcard-tooling</code></strong> — Toggle compatibility mode for models without native tooling support.</li>
                <li>
                    <strong><code>/display [index]</code></strong> — Used for Computer Use mode to set which display screen the agent can see and operate on.
                </li>
                <li>
                    <strong><code>/btw &lt;question&gt;</code></strong> — Sends a raw inquiry to the agent mid-turn without interrupting the active loop.
                </li>
            </ul>

            <h2 id="system-configuration">System & Configuration</h2>
            <ul>
                <li><strong><code>/settings</code></strong> — Opens the main configuration menu for system preferences, external data, and sandbox presets.</li>
                <li><strong><code>/budget</code></strong> — Set or view request and token quota limits.</li>
                <li><strong><code>/provider</code> or <code>/providers</code></strong> — Switch the active AI provider.</li>
                <li>
                    <strong><code>/key</code></strong> — Manage API keys as a fixed 10-slot array per provider. Run bare <code>/key</code> to see subcommand suggestions, or use:
                    <ul>
                        <li><code>/key list [--provider &lt;name&gt;] [--unmask]</code> — Show all 10 slots (active marked, middle third masked). With no <code>--provider</code> value, lists every provider's key count.</li>
                        <li><code>/key add &lt;key&gt; [--index &lt;n&gt;]</code> or <code>/key new</code> — Add a key to the first empty slot, or a specific slot. Adding a provider's first key also makes it active.</li>
                        <li><code>/key remove [&lt;index&gt;|&lt;key&gt;|--all]</code> — Remove the active key, a specific slot, a matching key/substring (ambiguous matches error out), or all keys for the provider.</li>
                        <li><code>/key use &lt;index&gt;|&lt;key&gt;</code> — Set the active key for the provider (persisted).</li>
                        <li><code>/key use &lt;key&gt; --temp</code> — Use a session-only key held in memory, never saved to disk.</li>
                        <li><code>/key clean [--provider &lt;name&gt;]</code> — Compact gaps between slots (no deletions). With no <code>--provider</code>, cleans the entire key store.</li>
                    </ul>
                    Keys live in an encrypted <code>secrets_v2.json</code> vault; the active slot per provider is tracked in settings. <code>--provider</code> works with every subcommand and auto-resolves to the current provider when omitted (the <code>custom</code> provider maps to your Custom OpenAI endpoint and is listed separately with its saved base URL).</li>
                <li><strong><code>/profile</code></strong> — Update developer persona, nickname, and custom instructions.</li>
                <li><strong><code>/memory [view|migrate]</code></strong> — View persistent memories or migrate them to the global <code>AGENTS.md</code>.</li>
            </ul>

            <h2 id="utility-commands">Utility Commands</h2>
            <ul>
                <li><strong><code>/help</code></strong> — List all available commands in chat.</li>
                <li><strong><code>/theme</code></strong> — Select the UI color theme.</li>
                <li><strong><code>/usage</code></strong> — Opens the graphical token-usage analytics dashboard in the browser.</li>
                <li><strong><code>/stats</code></strong> — Shows session token usage and context limits.</li>
                <li><strong><code>/about</code></strong> — Displays project info, version, and credits.</li>
                <li><strong><code>/changelog</code></strong> — Opens the latest release notes in your default browser.</li>
                <li><strong><code>/docs</code></strong> — Opens documentation site in your default browser.</li>
                <li><strong><code>/reset</code></strong> — Warning: Wipes all project-specific data (history, memories, checkpoints).</li>
                <li><strong><code>/fluxflow</code></strong> — Project management tools:
                    <ul>
                        <li><code>global</code>: Opens the global FluxFlow directory.</li>
                        <li><code>saves</code>: Opens the FluxFlow AppData/saves directory.</li>
                    </ul>
                </li>
                <li>
                    <strong><code>/update</code></strong> — Update FluxFlow to the latest version:
                    <ul>
                        <li><code>check</code>: Checks npm registry for updates.</li>
                        <li><code>latest</code>: Initiates the auto-updater to install the latest release.</li>
                    </ul>
                </li>
                <li><strong><code>/move</code></strong> — In playground mode, copies the playground to <code>CWD/playground-export</code>.</li>
                <li><strong><code>/files</code></strong> — Lists loaded instruction and skill files.</li>
                <li><strong><code>/target</code></strong> — Shows the current provider and model as a unique target.</li>
                <li><strong><code>/gemini</code></strong> — Prints a Gemini CLI quote.</li>
            </ul>
        </DocPage>
    )
}
