import DocPage from '../components/DocPage'

const headings = [
    { id: 'prerequisites', text: 'Prerequisites', level: 2 },
    { id: 'installation', text: 'Installation Options', level: 2 },
    { id: 'instant-ignition', text: 'Instant Ignition', level: 3 },
    { id: 'global-install', text: 'Global Installation', level: 3 },
    { id: 'first-run', text: 'The First Run & Configuration', level: 2 },
    { id: 'first-session', text: 'Your First Session', level: 2 },
]

export default function GettingStarted() {
    return (
        <DocPage headings={headings}>
            <h1 id="getting-started">Getting Started</h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed mb-10">
                Get FluxFlow up and running in minutes. This guide covers installation,
                initial configuration, and starting your first interactive AI session.
            </p>

            <h2 id="prerequisites">Prerequisites</h2>
            <ul>
                <li><strong>Node.js</strong> — v18 or higher (v20+ recommended)</li>
                <li><strong>Package Manager</strong> — npm, yarn, or pnpm</li>
                <li><strong>AI API Key</strong> — Google Gemini, DeepSeek, NVIDIA, or OpenRouter</li>
            </ul>

            <h2 id="installation">Installation Options</h2>
            <p>
                FluxFlow is designed for zero-friction adoption. Choose the method that best
                fits your workflow.
            </p>

            <h3 id="instant-ignition">Instant Ignition (No Setup)</h3>
            <p>
                The fastest way to experience FluxFlow is via <code>npx</code>. Run it directly
                without any permanent installation:
            </p>
            <pre><code>npx fluxflow-cli</code></pre>

            <h3 id="global-install">Global Installation</h3>
            <p>
                For frequent use and high-speed access, install the CLI globally:
            </p>
            <pre><code>npm install -g fluxflow-cli</code></pre>

            <h2 id="first-run">The First Run & Configuration</h2>
            <p>
                On your first launch, FluxFlow performs an <strong>Integrity Check</strong>. It will
                prompt you for your preferred AI provider and API key.
            </p>
            <ul>
                <li><strong>Encrypted Vault</strong> — Your keys are stored securely and locally on your machine.</li>
                <li><strong>Self-Healing</strong> — The agent autonomously installs required engines (like Chromium for PDF exports) if they are missing.</li>
            </ul>
            <blockquote>
                You can always re-configure your settings by typing <code>/settings</code> inside the chat.
            </blockquote>

            <h2 id="first-session">Your First Session</h2>
            <p>
                Navigate to any project directory and run <code>fluxflow</code>. Try asking
                a natural question to start:
            </p>
            <pre><code>What does this project do?</code></pre>
            <p>
                FluxFlow will analyze your project structure, read relevant files, and provide
                high-fidelity insights or help you perform complex refactors instantly.
            </p>
        </DocPage>
    )
}
