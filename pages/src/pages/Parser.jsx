import DocPage from '../components/DocPage'

const headings = [
    { id: 'abstract', text: 'Abstract', level: 2 },
    { id: 'v1-regex', text: 'v1.0 — Regex-Based Matcher & JSON Unescape', level: 2 },
    { id: 'v2-grammar', text: 'v2.0 — Grammar-Based Separation', level: 2 },
    { id: 'v3-fidelity', text: 'v3.0 — The Fidelity Smart Heuristic Parser', level: 2 },
    { id: 'v35-streaming', text: 'v3.5 — Streaming & Strict-Quote Extraction (Current)', level: 2 },
    { id: 'conclusion', text: 'Conclusion', level: 2 },
]

export default function Parser() {
    return (
        <DocPage headings={headings}>
            <h1 id="fidelity-parser">Fidelity: The Tool Signal Argument Parser</h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed mb-10">
                FluxFlow employs a <strong>custom DSL-based tool-calling format</strong> — a
                lightweight, human-readable signal syntax (<code>toolName(key=value, ...)</code>)
                rather than conventional structured JSON tool payloads. <strong>Fidelity</strong>
                is the dedicated parser for this DSL: the internal engine responsible for
                transforming raw tool-call signal strings emitted by language models into
                structured, typed argument objects. This document traces its evolution from a
                brittle regex matcher to a streaming-aware heuristic parser.
            </p>

            <h2 id="abstract">Abstract</h2>
            <p>
                Tool-calling in agentic systems frequently produces argument payloads that
                deviate from strict JSON semantics — unescaped quotes, multi-line string
                bodies, and embedded code fragments are common. Fidelity is a tolerant,
                single-pass parser designed to extract arguments from such degraded signal
                text with high accuracy, without requiring the emitting model to produce
                well-formed serialization. It serves as the single ingestion point for all
                FluxFlow tool invocations expressed in the platform's custom DSL.
            </p>

            <h2 id="v1-regex">v1.0 — Regex-Based Matcher &amp; JSON Unescape <span className="ml-2 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">CLI v1.0</span></h2>
            <p><strong>Signature:</strong> <code>parseArgs(argsString)</code></p>
            <p>
                The initial implementation relied on a single comprehensive regular
                expression with inline type conversions.
            </p>
            <ul>
                <li><strong>Regex Matching</strong> — <code>(\w+)\s*=\s*(?:("')((?:\\.|(?!\2)[\s\S])*)\2|([^,\s\)]+))/g</code>, handling double-quoted, single-quoted, and unquoted literals (<code>key=123</code>, <code>key=true</code>).</li>
                <li><strong>Unescaping</strong> — Quoted contents were wrapped in <code>JSON.parse("...")</code> for escape handling (<code>\n</code>, <code>\t</code>, <code>\"</code>), with basic regex fallbacks such as <code>.replace(/\\"/g, '"')</code>.</li>
                <li><strong>Type Conversion</strong> — <code>'true'</code>/<code>'false'</code> were coerced to booleans and numeric strings to <code>Number</code>.</li>
            </ul>
            <p><strong>Limitations.</strong> This approach broke entirely on any unescaped quote inside string bodies (greedy/non-greedy matching cut off early), failed on multi-line text or raw code containing quotes and syntax characters, and offered no array-literal support or streaming awareness.</p>

            <h2 id="v2-grammar">v2.0 — Grammar-Based Separation <span className="ml-2 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">CLI v1.2</span></h2>
            <p><strong>Signature:</strong> <code>parseArgs(argsString)</code></p>
            <p>
                The second iteration replaced the monolithic regex with an iterative parser
                using grammar-based boundary detection to survive common unescaped quotes.
            </p>
            <ul>
                <li><strong>Boundary Detection</strong> — Strict grammar patterns (e.g. <code>", key=</code> or a trailing <code>)</code>) marked the boundaries between arguments.</li>
                <li><strong>Partial Tolerance</strong> — Common unescaped quotes within strings were handled by continuing until a separator strictly resembling <code>, nextKey=</code> was encountered.</li>
            </ul>
            <p><strong>Limitations.</strong> The parser did not count balanced quotes or inspect downstream tokens. It could not validate whether a candidate key was well-formed or dangling, and could prematurely slice or misinterpret content containing code snippets, commas, or words followed by <code>=</code>.</p>

            <h2 id="v3-fidelity">v3.0 — The Fidelity Smart Heuristic Parser <span className="ml-2 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">CLI v5.5</span></h2>
            <p><strong>Signature:</strong> <code>parseArgs(argsString, knownKeys = [])</code></p>
            <p>
                The major upgrade — and the point at which the parser earned its name —
                introduced heuristics capable of handling complex nested strings, unescaped
                quotes in code payloads, and multi-line script content.
            </p>
            <ul>
                <li><strong><code>knownKeys</code> Whitelisting</strong> — Argument keys are matched against expected names, prefixes (<code>prefix*</code>), or RegExps, discarding noise tokens.</li>
                <li><strong>Heuristic End-of-String Boundary</strong> — Candidate boundaries are validated against allowed and previously captured keys. Duplicate downstream occurrences of the candidate key (highest-index encounter) prevent early termination inside code bodies.</li>
                <li><strong>Candidate Argument Well-Formedness</strong> — Content following <code>, nextKey=</code> is inspected: quoted candidates require matching non-escaped closing quotes; array-literal candidates verify bracket balance (<code>[...]</code>); unquoted candidates are checked for dangling delimiters (<code>"</code>, <code>'</code>, backtick).</li>
                <li><strong>Multi-Line Awareness</strong> — Line-break checks prevent spurious splits across embedded multi-line payloads.</li>
                <li><strong>High-Fidelity Unescaping</strong> — Single-pass handling of <code>\n</code>, <code>\r</code>, <code>\t</code>, <code>\\</code>, and escaped quotes.</li>
                <li><strong>Array Literal Support</strong> — Nested quote and bracket-balance handling for array-valued arguments.</li>
            </ul>

            <h2 id="v35-streaming">v3.5 — Streaming &amp; Strict-Quote Extraction (Current) <span className="ml-2 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">CLI v5.6.3</span></h2>
            <p><strong>Signature:</strong> <code>parseArgs(argsString, knownKeys = [], strictQuoteKeys = [])</code></p>
            <p>
                The current revision adds selective, deterministic quote-to-quote parsing for
                streaming and peek scenarios in which later parameters have not yet finished
                generating.
            </p>
            <ul>
                <li><strong><code>strictQuoteKeys</code> Parameter</strong> — Target keys (e.g. <code>path</code>, <code>basename</code>, <code>file</code>, <code>keyword</code>) strictly terminate at their first unescaped quote, bypassing multi-line and candidate lookahead heuristics for those keys only.</li>
                <li><strong>Streaming / Live Tool Sniffing</strong> — Resolves partial stream truncation, where unfinished subsequent values (e.g. an unclosed <code>content="..."</code>) previously caused earlier fields (<code>path="..."</code>) to fail lookahead validation and bleed into later content.</li>
                <li><strong>Backwards Compatibility</strong> — All v3.0 smart heuristic capabilities are retained.</li>
            </ul>

        </DocPage>
    )
}
