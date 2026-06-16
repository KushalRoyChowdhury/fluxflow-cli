import DocPage from '../components/DocPage'

const headings = [
    { id: 'protocol', text: 'Tool Protocol', level: 2 },
    { id: 'availability', text: 'Availability by Mode', level: 2 },
    { id: 'workspace-tools', text: 'Workspace Tools', level: 2 },
    { id: 'web-tools', text: 'Web & Research Tools', level: 2 },
    { id: 'creative-tools', text: 'Creative Tools', level: 2 },
]

export default function Tools() {
    return (
        <DocPage headings={headings}>
            <h1 id="tools-capabilities">Tools & Capabilities</h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed mb-10">
                FluxFlow provides a robust set of tools that allow the AI agent to interact
                with your file system, execute code, and research the web autonomously.
            </p>

            <h2 id="protocol">Tool Protocol</h2>
            <p>
                FluxFlow uses a transparent, string-based protocol for tool dispatching.
                When the agent needs to perform an action, it emits a specifically
                formatted string in its response:
            </p>
            <pre><code>[[tool:functions.ToolName(arg1="value", arg2=123)]]</code></pre>
            <p>
                The agent core utilizes a custom bracket-balancing parser to detect these
                calls, pauses the reasoning loop, executes the tool, and returns the
                result to the model as a <code>[TOOL RESULT]</code> block.
            </p>

            <h2 id="availability">Availability by Mode</h2>
            <p>
                To ensure safety and performance, tool availability is strictly enforced
                based on the active operating mode:
            </p>
            <table>
                <thead>
                    <tr>
                        <th>Tool Category</th>
                        <th>Flux (Dev)</th>
                        <th>Flow (Chat)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Communication (Ask)</td>
                        <td>✅ Available</td>
                        <td>✅ Available</td>
                    </tr>
                    <tr>
                        <td>Web Search & Scrape</td>
                        <td>✅ Available</td>
                        <td>✅ Available</td>
                    </tr>
                    <tr>
                        <td>File System (Workspace)</td>
                        <td>✅ Available</td>
                        <td>❌ Restricted</td>
                    </tr>
                    <tr>
                        <td>Terminal Execution</td>
                        <td>✅ Available</td>
                        <td>❌ Restricted</td>
                    </tr>
                    <tr>
                        <td>Todo (Planning)</td>
                        <td>✅ Available</td>
                        <td>❌ Restricted</td>
                    </tr>
                    <tr>
                        <td>Creative (PDF/DOCX)</td>
                        <td>❌ Restricted</td>
                        <td>✅ Available</td>
                    </tr>
                </tbody>
            </table>

            <h2 id="workspace-tools">Workspace Tools</h2>
            <p>Available exclusively in <strong>Flux mode</strong> for local development tasks.</p>
            <ul>
                <li><strong><code>ReadFile</code></strong> — Reads file content with support for line ranges and native multimodality.</li>
                <li><strong><code>PatchFile</code></strong> — Surgically patches code blocks and generates high-fidelity visual diffs.</li>
                <li><strong><code>WriteFile</code></strong> — Creates new files or overwrites existing ones with atomic precision.</li>
                <li><strong><code>FileMap</code></strong> — Generates structural maps of code (classes, functions, dependencies).</li>
                <li><strong><code>ReadFolder</code></strong> — Lists directory contents with detailed statistics and metadata.</li>
                <li><strong><code>SearchKeyword</code></strong> — Performs global project search with line-number precision.</li>
                <li><strong><code>Run</code></strong> — Executes shell commands directly in the terminal (PowerShell/Bash).</li>
                <li><strong><code>Todo</code></strong> — Manages a persistent <code>todo.md</code> plan for the session. Supports <code>create</code>, <code>append</code>, and <code>read</code>.</li>
            </ul>

            <h2 id="web-tools">Web & Research Tools</h2>
            <p>Available in both modes for information gathering.</p>
            <ul>
                <li><strong><code>WebSearch</code></strong> — Uses DuckDuckGo to find up-to-date information and documentation.</li>
                <li><strong><code>WebScrape</code></strong> — Extracts clean text content from any URL for deep-dive research.</li>
            </ul>

            <h2 id="creative-tools">Creative Tools</h2>
            <p>Available exclusively in <strong>Flow mode</strong> for generating documents and assets.</p>
            <ul>
                <li><strong><code>WritePDF</code></strong> — Generates professional, branded PDF documents from HTML/CSS.</li>
                <li><strong><code>WriteDoc</code></strong> — Creates native Word documents with multi-page and styling support.</li>
                <li><strong><code>GenerateImage</code></strong> — Creates high-fidelity images via AI models.</li>
            </ul>
        </DocPage>
    )
}
