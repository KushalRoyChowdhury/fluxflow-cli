import DocPage from '../components/DocPage'

const headings = [
    { id: 'protocol', text: 'Tool Protocol', level: 2 },
    { id: 'availability', text: 'Availability by Mode', level: 2 },
    { id: 'workspace-tools', text: 'Workspace Tools', level: 2 },
    { id: 'web-tools', text: 'Web & Research Tools', level: 2 },
    { id: 'subagent-tools', text: 'Sub-Agent Tools', level: 2 },
    { id: 'safety-tools', text: 'Safety & Emergency Tools', level: 2 },
    { id: 'creative-tools', text: 'Creative Tools', level: 2 },
    { id: 'computer-use-tools', text: 'Computer Use Tools (GUI Automation)', level: 2 },
]

export default function Tools() {
    return (
        <DocPage headings={headings}>
            <h1 id="tools-capabilities">Tools & Capabilities</h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed mb-10">
                FluxFlow provides a robust set of tools that allow the AI agent to interact
                with your file system, execute code, spawn background sub-agents, research the web,
                and automate GUI desktop tasks autonomously.
            </p>

            <h2 id="protocol">Tool Protocol</h2>
            <p>
                FluxFlow uses a transparent, string-based protocol for tool dispatching.
                When the agent needs to perform an action, it emits a specifically
                formatted string in its response:
            </p>
            <pre><code>[tool:functions.ToolName(arg1="value", arg2=123)]</code></pre>
            <p>
                The agent core utilizes a custom bracket-balancing parser to detect these
                calls, pauses the reasoning loop, executes the tool, and returns the
                result to the model as a <code>[[TOOL RESULT]]</code> block.
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
                        <th>FluxCU / ICU (Computer Use)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Communication (Ask)</td>
                        <td>✅ Available</td>
                        <td>✅ Available</td>
                        <td>✅ Available</td>
                    </tr>
                    <tr>
                        <td>Web Search & Scrape</td>
                        <td>✅ Available</td>
                        <td>✅ Available</td>
                        <td>✅ Available</td>
                    </tr>
                    <tr>
                        <td>File System (Workspace)</td>
                        <td>✅ Available</td>
                        <td>❌ Restricted</td>
                        <td>✅ FluxCU / ❌ ICU</td>
                    </tr>
                    <tr>
                        <td>Terminal Execution</td>
                        <td>✅ Available</td>
                        <td>❌ Restricted</td>
                        <td>✅ FluxCU / ❌ ICU</td>
                    </tr>
                    <tr>
                        <td>Todo (Planning)</td>
                        <td>✅ Available</td>
                        <td>❌ Restricted</td>
                        <td>✅ FluxCU / ❌ ICU</td>
                    </tr>
                    <tr>
                        <td>Sub-Agents (Invoke/InvokeSync)</td>
                        <td>✅ Available</td>
                        <td>❌ Restricted</td>
                        <td>✅ FluxCU / ❌ ICU</td>
                    </tr>
                    <tr>
                        <td>Safety & Emergency Rollback</td>
                        <td>✅ Available</td>
                        <td>❌ Restricted</td>
                        <td>✅ FluxCU / ❌ ICU</td>
                    </tr>
                    <tr>
                        <td>Creative (PDF/DOCX)</td>
                        <td>❌ Restricted</td>
                        <td>✅ Available</td>
                        <td>❌ Restricted</td>
                    </tr>
                    <tr>
                        <td>Computer Use (GUI Automation)</td>
                        <td>❌ Restricted</td>
                        <td>❌ Restricted</td>
                        <td>✅ Available</td>
                    </tr>
                </tbody>
            </table>

            <h2 id="workspace-tools">Workspace Tools</h2>
            <p>Available in <strong>Flux</strong> and <strong>FluxCU</strong> modes for local development and repository management.</p>
            <ul>
                <li>
                    <strong><code>ReadFile</code></strong> — Reads file content with support for line ranges and native multimodality (images, documents, and code).
                    <ul>
                        <li><code>path</code> <em>(string, required)</em>: Relative path to the file (uses <code>/</code> path separator).</li>
                        <li><code>startLine</code> <em>(integer, optional)</em>: Starting line number (1-indexed).</li>
                        <li><code>endLine</code> <em>(integer, optional)</em>: Ending line number (1-indexed).</li>
                    </ul>
                </li>
                <li>
                    <strong><code>PatchFile</code></strong> — Surgically patches code blocks with atomic precision and generates high-fidelity visual diffs.
                    <ul>
                        <li><code>path</code> <em>(string, required)</em>: Relative path to the target file.</li>
                        <li><code>allowMultiple</code> <em>(boolean, optional, default: <code>false</code>)</em>: Replace multiple occurrences of search content across the file.</li>
                        <li><code>searchContent1..15</code> <em>(string, required)</em>: Exact target code block or line range in format <code>^LINE:start..end$</code>.</li>
                        <li><code>newContent1..15</code> <em>(string, required)</em>: Drop-in replacement code for the corresponding search chunk (supports up to 15 chunks per call).</li>
                    </ul>
                </li>
                <li>
                    <strong><code>WriteFile</code></strong> — Creates new files or completely overwrites existing files.
                    <ul>
                        <li><code>path</code> <em>(string, required)</em>: Relative file path.</li>
                        <li><code>content</code> <em>(string, required)</em>: Full text content to write.</li>
                    </ul>
                </li>
                <li>
                    <strong><code>ReadFolder</code></strong> — Lists directory contents, metadata, and directory statistics.
                    <ul>
                        <li><code>path</code> <em>(string, required)</em>: Relative directory path.</li>
                        <li><code>recurse</code> <em>(integer, optional, <code>1-3</code>)</em>: Recursion depth limit.</li>
                    </ul>
                </li>
                <li>
                    <strong><code>CodeSearch</code></strong> <em>(or <code>SearchKeyword</code>)</em> — Performs fast project-wide code search with regex and fuzzy matching.
                    <ul>
                        <li><code>keyword</code> <em>(string, required)</em>: Search query, identifier, or regex pattern.</li>
                        <li><code>path</code> <em>(string, optional)</em>: Directory, file, glob pattern, or <code>;</code>-separated inclusions/exclusions.</li>
                        <li><code>fuzzy</code> <em>(boolean, optional, default: <code>false</code>)</em>: Enables approximate fuzzy search matching.</li>
                        <li><code>regex</code> <em>(boolean, optional, default: <code>auto</code>)</em>: Treats keyword as a regular expression.</li>
                    </ul>
                </li>
                <li>
                    <strong><code>Run</code></strong> — Executes shell commands directly in the interactive terminal.
                    <ul>
                        <li><code>command</code> <em>(string, required)</em>: Shell command string (PowerShell / CMD on Windows, Bash on Linux/macOS).</li>
                    </ul>
                </li>
                <li>
                    <strong><code>Todo</code></strong> — Manages a task list plan for complex multi-step sessions.
                    <ul>
                        <li><code>method</code> <em>(string, required)</em>: Action to perform — <code>"create"</code>, <code>"append"</code>, or <code>"get"</code>.</li>
                        <li><code>tasks</code> <em>(string array, optional)</em>: List of task descriptions to add when creating or appending.</li>
                        <li><code>markDone</code> <em>(string array, optional)</em>: List of completed task names/descriptions to mark as finished.</li>
                    </ul>
                </li>
            </ul>

            <h2 id="web-tools">Web & Research Tools</h2>
            <p>Available across all operating modes for real-time information gathering and user interaction.</p>
            <ul>
                <li>
                    <strong><code>WebSearch</code></strong> — Performs live internet search queries with optional AI summarization.
                    <ul>
                        <li><code>query</code> <em>(string, required)</em>: Search query or technical terms.</li>
                        <li><code>aiMode</code> <em>(boolean, optional)</em>: Enables AI-driven LLM search summarization.</li>
                        <li><code>limit</code> <em>(integer, optional, <code>3-10</code>)</em>: Number of search results to return when not in AI mode.</li>
                    </ul>
                </li>
                <li>
                    <strong><code>WebScrape</code></strong> — Fetches and extracts clean markdown/text content from any webpage or documentation URL.
                    <ul>
                        <li><code>url</code> <em>(string, required)</em>: Full URL to fetch and parse.</li>
                    </ul>
                </li>
                <li>
                    <strong><code>Ask</code></strong> — Prompts the user with structured multiple-choice options when faced with ambiguity, path divergence, or security decisions.
                    <ul>
                        <li><code>question</code> <em>(string, required)</em>: The clarifying inquiry or question presented to the user.</li>
                        <li><code>optionA..D</code> <em>(string, optional, max 4)</em>: Selectable options formatted as <code>"title::description"</code>.</li>
                    </ul>
                </li>
            </ul>

            <h2 id="subagent-tools">Sub-Agent Tools</h2>
            <p>Available in <strong>Flux</strong> and <strong>FluxCU</strong> modes for delegating tasks to autonomous sub-agents.</p>
            <ul>
                <li>
                    <strong><code>InvokeSync</code></strong> — Spawns a synchronous (blocking) sub-agent to execute isolated tasks sequentially.
                    <ul>
                        <li><code>title</code> <em>(string, required)</em>: Short descriptive title for the sub-agent task.</li>
                        <li><code>task</code> <em>(string, required)</em>: Detailed prompt specification including exact file paths, dependencies, imports/exports, and instructions.</li>
                    </ul>
                </li>
                <li>
                    <strong><code>Invoke</code></strong> — Spawns an asynchronous (background) sub-agent running in parallel (supports up to 7 concurrent workers).
                    <ul>
                        <li><code>title</code> <em>(string, required)</em>: Short descriptive title for the background task.</li>
                        <li><code>task</code> <em>(string, required)</em>: Detailed task instructions, file paths, and acceptance criteria.</li>
                    </ul>
                </li>
                <li>
                    <strong><code>Await</code></strong> — Event-driven wait for asynchronous sub-agent completion.
                    <ul>
                        <li><code>id</code> <em>(string, required)</em>: Sub-agent process ID to wait for.</li>
                        <li><code>timeout</code> <em>(integer, optional)</em>: Maximum duration to wait before returning.</li>
                    </ul>
                </li>
                <li>
                    <strong><code>GetProgress</code></strong> — Polls current status and output telemetry for running sub-agents.
                    <ul>
                        <li><code>id</code> <em>(string, required)</em>: Sub-agent process ID to query.</li>
                    </ul>
                </li>
                <li>
                    <strong><code>Steer</code></strong> — Injects real-time instructions or course correction into an active running sub-agent.
                    <ul>
                        <li><code>id</code> <em>(string, required)</em>: Active sub-agent process ID.</li>
                        <li><code>message</code> <em>(string, required)</em>: New instructions or redirection directive.</li>
                    </ul>
                </li>
                <li>
                    <strong><code>Cancel</code></strong> — Terminates a stalled or incorrect background sub-agent process.
                    <ul>
                        <li><code>id</code> <em>(string, required)</em>: Sub-agent process ID to cancel.</li>
                    </ul>
                </li>
            </ul>

            <h2 id="safety-tools">Safety & Emergency Tools</h2>
            <p>Available in <strong>Flux</strong> and <strong>FluxCU</strong> modes when advance rollback is enabled.</p>
            <ul>
                <li>
                    <strong><code>EmergencyRollback</code></strong> — Performs immediate workspace rollback to a specific turn checkpoint to recover from catastrophic code corruption.
                    <ul>
                        <li><code>method</code> <em>(string, required)</em>: <code>"getCheckpoint"</code> to list available turns or <code>"forceRevert"</code> to execute a rollback.</li>
                        <li><code>id</code> <em>(string, optional)</em>: Target turn checkpoint ID to restore (required when method is <code>"forceRevert"</code>).</li>
                    </ul>
                </li>
            </ul>

            <h2 id="creative-tools">Creative Tools</h2>
            <p>Available exclusively in <strong>Flow mode</strong> for generating documents and rich assets.</p>
            <ul>
                <li>
                    <strong><code>WritePDF</code></strong> — Generates professional, branded PDF documents from HTML/CSS with A4 pagination.
                    <ul>
                        <li><code>path</code> <em>(string, required)</em>: Relative output path for the <code>.pdf</code> file.</li>
                        <li><code>content</code> <em>(string, required)</em>: HTML/CSS markup with styling and explicit A4 page breaks.</li>
                        <li><code>orientation</code> <em>(string, optional)</em>: Page orientation (<code>"portrait"</code> or <code>"landscape"</code>).</li>
                    </ul>
                </li>
                <li>
                    <strong><code>WriteDoc</code></strong> — Creates native Word (<code>.docx</code>) documents with formatting and multi-page support.
                    <ul>
                        <li><code>path</code> <em>(string, required)</em>: Relative output path for the <code>.docx</code> file.</li>
                        <li><code>content</code> <em>(string, required)</em>: Structured document content.</li>
                    </ul>
                </li>
            </ul>

            <h2 id="computer-use-tools">Computer Use Tools (GUI Automation)</h2>
            <p>Available in <strong>ICU</strong> (dedicated Computer Use) and <strong>FluxCU</strong> (Workspace + Computer Use) modes for interacting with the desktop GUI via visual grid coordinates.</p>
            <ul>
                <li>
                    <strong><code>Click</code></strong> — Clicks on a specific coordinate grid cell on screen.
                    <ul>
                        <li><code>gridId</code> <em>(integer, required)</em>: Target coordinate grid number on the visual screenshot overlay.</li>
                        <li><code>type</code> <em>(string, optional, default: <code>"single"</code>)</em>: Click type — <code>"single"</code> or <code>"double"</code>.</li>
                        <li><code>button</code> <em>(string, optional, default: <code>"left"</code>)</em>: Mouse button — <code>"left"</code>, <code>"middle"</code>, or <code>"right"</code>.</li>
                        <li><code>intendedClickText</code> <em>(string, optional)</em>: Literal text or icon label on screen for OCR verification (up to 3 words).</li>
                    </ul>
                </li>
                <li>
                    <strong><code>Drag</code></strong> — Drags the mouse cursor from one grid coordinate cell to another.
                    <ul>
                        <li><code>fromGridId</code> <em>(integer, required)</em>: Starting grid cell number.</li>
                        <li><code>toGridId</code> <em>(integer, required)</em>: Destination grid cell number.</li>
                    </ul>
                </li>
                <li>
                    <strong><code>Scroll</code></strong> — Scrolls the active viewport vertically up or down.
                    <ul>
                        <li><code>direction</code> <em>(string, required)</em>: Scroll direction — <code>"up"</code> or <code>"down"</code>.</li>
                        <li><code>gridId</code> <em>(integer, optional)</em>: Target grid cell number to position the mouse cursor over before scrolling.</li>
                    </ul>
                </li>
                <li>
                    <strong><code>KeyboardTyping</code></strong> — Types a text string into the currently focused input element.
                    <ul>
                        <li><code>text</code> <em>(string, required)</em>: Text string to type (literal escape sequences must be JSON-escaped).</li>
                        <li><code>autoPressEnter</code> <em>(boolean, optional, default: <code>false</code>)</em>: Automatically presses the Enter key after typing the text.</li>
                    </ul>
                </li>
                <li>
                    <strong><code>KeyPress</code></strong> — Presses a specific key, function key, or keyboard shortcut combination.
                    <ul>
                        <li><code>key</code> <em>(string, required)</em>: Key name (e.g. <code>enter</code>, <code>backspace</code>, <code>clearInput</code>), function key (<code>f1</code>-<code>f12</code>), or semicolon-separated combo (e.g. <code>ctrl;c</code>, <code>alt;tab</code>, <code>f5</code>, <code>f11</code>, <code>alt;f4</code>).</li>
                    </ul>
                </li>
                <li>
                    <strong><code>RecaptureScreen</code></strong> — Requests an immediate fresh screenshot of the active desktop with coordinate grid overlay.
                    <ul>
                        <li><em>No parameters required.</em></li>
                    </ul>
                </li>
            </ul>
        </DocPage>
    )
}

