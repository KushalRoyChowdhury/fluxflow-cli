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
            <h1 id="app-commands">App Commands</h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed mb-10">
                FluxFlow features a rich set of in-app slash commands to control the agent,
                manage your session, and configure settings on the fly without leaving the terminal.
            </p>

            <h2 id="session-management">Session Management</h2>
            <ul>
                <li><strong><code>/clear</code></strong> — Clears the terminal screen.</li>
                <li><strong><code>/save</code></strong> — Forces a manual save of the current chat session.</li>
                <li><strong><code>/resume</code></strong> — Opens a modal to load and resume a previous session.</li>
                <li><strong><code>/chats</code></strong> — Lists all saved chat sessions.</li>
                <li><strong><code>/export</code></strong> — Exports the current chat transcript to a <code>.txt</code> file in your workspace.</li>
                <li><strong><code>/compress</code></strong> — Summarizes and compresses the active chat history to free up context tokens.</li>
                <li><strong><code>/revert</code></strong> — Opens the high-fidelity checkpoint viewer to rollback codebase changes to a previous state.</li>
                <li><strong><code>/quit</code></strong> — Safely exits and shuts down FluxFlow.</li>
            </ul>

            <h2 id="agent-controls">Agent Controls</h2>
            <ul>
                <li>
                    <strong><code>/mode</code></strong> — Toggles the operating mode:
                    <ul>
                        <li><code>flux</code>: Enables the autonomous Dev toolset (Workspace access).</li>
                        <li><code>flow</code>: Enables Chat mode (Web & Creative access only).</li>
                    </ul>
                </li>
                <li>
                    <strong><code>/model</code></strong> — Opens a menu to switch the active AI model (e.g., from Gemini Flash to Gemini Pro) based on your current provider.
                </li>
                <li>
                    <strong><code>/thinking</code></strong> — Adjusts the AI reasoning depth:
                    <ul>
                        <li><code>Fast</code>: Reasoning disabled (Fastest).</li>
                        <li><code>Low</code>: Quick reasoning.</li>
                        <li><code>Medium</code> / <code>Standard</code>: Balanced reasoning.</li>
                        <li><code>High</code>: Deep reasoning.</li>
                        <li><code>xHigh</code>: Extended reasoning for complex logic.</li>
                    </ul>
                </li>
            </ul>

            <h2 id="system-configuration">System & Configuration</h2>
            <ul>
                <li><strong><code>/settings</code></strong> — Opens the main configuration menu for system preferences and sandbox presets.</li>
                <li><strong><code>/key</code></strong> — Manage API keys for various providers securely.</li>
                <li><strong><code>/profile</code></strong> — Edit the developer persona and global instructions.</li>
                <li><strong><code>/memory</code></strong> — Manage, view, or delete long-term agent memories.</li>
            </ul>

            <h2 id="utility-commands">Utility Commands</h2>
            <ul>
                <li><strong><code>/help</code></strong> — Displays the command reference menu within the chat.</li>
                <li><strong><code>/stats</code></strong> — Shows session token usage and context limits.</li>
                <li><strong><code>/about</code></strong> — Displays project info, version, and credits.</li>
                <li><strong><code>/changelog</code></strong> — Opens the latest release notes in your default web browser.</li>
                <li><strong><code>/docs</code></strong> — Opens this documentation site in your default web browser.</li>
                <li><strong><code>/reset</code></strong> — Warning: Wipes all project-specific data (history, memories, checkpoints).</li>
                <li>
                    <strong><code>/fluxflow</code></strong> — Project management tools:
                    <ul>
                        <li><code>init</code>: Creates a local <code>FluxFlow.md</code> template for project-specific instructions.</li>
                    </ul>
                </li>
                <li>
                    <strong><code>/update</code></strong> — Updater tools:
                    <ul>
                        <li><code>check</code>: Checks the npm registry for a new version.</li>
                        <li><code>latest</code>: Initiates the auto-updater to install the latest release.</li>
                    </ul>
                </li>
            </ul>
        </DocPage>
    )
}
