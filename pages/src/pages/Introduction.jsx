import DocPage from '../components/DocPage'

const headings = [
    { id: 'introduction', text: 'The High-Fidelity Agentic Terminal', level: 2 },
    { id: 'why-fluxflow', text: 'Why FluxFlow?', level: 2 },
    { id: 'dual-intelligence', text: 'The Dual-Intelligence System', level: 2 },
    { id: 'security', text: 'Digital Fortress Governance', level: 2 },
]

export default function Introduction() {
    return (
        <DocPage headings={headings}>
            <h1 id="introduction-to-fluxflow">Introduction to FluxFlow</h1>

            <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed mb-10">
                FluxFlow is not just another CLI — it's a high-speed, and goal-oriented AI Agent
                designed for learning and experimenting. Built with Node.js and Ink, it brings a premium UI/UX
                to the terminal, handling complex file-system tasks, web research, and autonomous workflows.
            </p>

            <h2 id="introduction">The High-Fidelity Agentic Terminal</h2>
            <p>
                Experience a terminal UI that feels alive. Built with React components, Flux Flow
                provides a highly responsive interface featuring real-time telemetry, multi-line
                inputs, and sophisticated agentic loops. Whether you need a conversational partner
                or an autonomous developer, FluxFlow adapts to your needs.
            </p>

            <h2 id="why-fluxflow">Why FluxFlow?</h2>
            <ul>
                <li><strong>Multi-Provider Support</strong> — Choose between Google GenAI (Gemini/Gemma), DeepSeek, NVIDIA, or OpenRouter.</li>
                <li><strong>High-Fidelity IDE Companion</strong> — Pairs with a dedicated VS Code extension featuring proactive error detection & smarter context awareness.</li>
                <li><strong>Native Multimodality</strong> — The agent can "see"! Analyze images and PDF documents natively with high context retention *(Only on Supported models).</li>
                <li><strong>Document Engineering</strong> — Generate professional, branded PDF and DOCX documents on the fly.</li>
                <li><strong>Codebase Time Travel</strong> — Refactor with fearlessness using transaction-based secure snapshots for instant file reversion.</li>
            </ul>

            <h2 id="dual-intelligence">The Dual-Intelligence System</h2>
            <p>
                FluxFlow operates using two distinct modes of intelligence to optimize performance and responsiveness:
            </p>
            <ul>
                <li><strong>Flux Mode (Dev)</strong> — High-speed, agentic problem solving with persistent loops for massive coding tasks.</li>
                <li><strong>Flow Mode (Chat)</strong> — Optimized for high-quality conversation and web-assisted reasoning.</li>
            </ul>

            <h2 id="security">Digital Fortress Governance</h2>
            <p>
                Security isn't an afterthought; it's a core boundary. FluxFlow features granular command policies,
                sandbox presets (Strict, Balanced, Autonomous), and an External Path Hardlock that restricts the
                agent to your working directory unless explicitly unlocked.
            </p>
        </DocPage>
    )
}
