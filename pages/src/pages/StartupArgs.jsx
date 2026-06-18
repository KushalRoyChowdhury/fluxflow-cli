import DocPage from '../components/DocPage'

const headings = [
    { id: 'overview', text: 'Overview', level: 2 },
    { id: 'core-settings', text: 'Core Settings', level: 2 },
    { id: 'ai-configuration', text: 'AI & Model Configuration', level: 2 },
    { id: 'security-permissions', text: 'Security & Permissions', level: 2 },
    { id: 'utility-flags', text: 'Utility Flags', level: 2 },
]

export default function StartupArgs() {
    return (
        <DocPage headings={headings}>
            <h1 id="startup-arguments">Startup Arguments</h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed mb-10">
                You can customize your FluxFlow session parameters directly from the terminal
                when launching the application. These flags temporarily override your saved
                settings for the duration of the session.
            </p>

            <pre><code>fluxflow [options]</code></pre>

            <h2 id="overview">Overview</h2>
            <p>
                Startup arguments are useful for quickly changing contexts, testing different
                models, or bypassing default security presets without navigating through the
                in-app <code>/settings</code> menu.
            </p>

            <h2 id="core-settings">Core Settings</h2>
            <ul>
                <li>
                    <strong><code>--mode &lt;flux|flow&gt;</code></strong><br />
                    Set the startup operating mode. <code>flux</code> activates the high-speed developer agent, while <code>flow</code> starts a standard chat session.
                </li>
                <li>
                    <strong><code>--resume &lt;session_id&gt;</code></strong><br />
                    Programmatically resume a previous chat session using its unique ID.
                </li>
                <li>
                    <strong><code>--memory &lt;on|off&gt;</code></strong><br />
                    Toggle persistent long-term agent memory for the current session.
                </li>
                <li>
                    <strong><code>--auto-del &lt;1d|7d|30d&gt;</code></strong><br />
                    Set the automated chat log deletion schedule.
                </li>
            </ul>

            <h2 id="ai-configuration">AI & Model Configuration</h2>
            <ul>
                <li>
                    <strong><code>--model &lt;model_name&gt;</code></strong><br />
                    Temporary override for the active AI model (e.g., <code>gemini-2.5-pro</code>). This keeps your global settings file untouched.
                </li>
                <li>
                    <strong><code>--provider &lt;google|deepseek|openrouter&gt;</code></strong><br />
                    Override the default AI provider for the session.
                </li>
                <li>
                    <strong><code>--key &lt;key@provider&gt;</code></strong><br />
                    Provide an API key and its associated provider inline (e.g., <code>--key AIzaSy...@google</code>).
                </li>
                <li>
                    <strong><code>--thinking &lt;Fast|Low|Medium|High|xHigh&gt;</code></strong><br />
                    Override the thinking level for reasoning depth. <em>Note: <code>Standard</code> is an alias for <code>Medium</code> to maintain DeepSeek compatibility.</em>
                </li>
            </ul>

            <h2 id="security-permissions">Security & Permissions</h2>
            <ul>
                <li>
                    <strong><code>--auto-exec &lt;on|off&gt;</code></strong><br />
                    Toggle permission for autonomous command execution without user confirmation.
                </li>
                <li>
                    <strong><code>--yolo &lt;on|off&gt;</code></strong><br />
                    An alias for <code>--auto-exec</code>.
                </li>
                <li>
                    <strong><code>--external-access &lt;on|off&gt;</code></strong><br />
                    Toggle permission to let the agent read files outside the Current Working Directory (CWD).
                </li>
            </ul>

            <h2 id="utility-flags">Utility Flags</h2>
            <ul>
                <li>
                    <strong><code>-v, --version</code></strong><br />
                    Print the currently installed version of FluxFlow and exit.
                </li>
                <li>
                    <strong><code>--help</code></strong><br />
                    Display the help menu listing all available startup arguments.
                </li>
                <li>
                    <strong><code>--help commands</code></strong><br />
                    Display a list of all available in-app <code>/commands</code>.
                </li>
                <li>
                    <strong><code>--update check</code></strong><br />
                    Check if a new version of FluxFlow is available.
                </li>
                <li>
                    <strong><code>--update check latest</code></strong><br />
                    Display the latest version available on npm.
                </li>
                <li>
                    <strong><code>--update latest</code></strong><br />
                    Automatically download and install the latest release.
                </li>
                <li>
                    <strong><code>--package &lt;npm|pnpm|yarn|bun&gt;</code></strong><br />
                    Set the package manager to be used when running core application updates (used in conjunction with <code>--update latest</code>).
                </li>
            </ul>
        </DocPage>
    )
}