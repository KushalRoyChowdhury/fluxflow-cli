import { Link } from 'react-router-dom'
import DocPage from '../components/DocPage'

const headings = [
    { id: 'key-vault', text: 'The Key Vault', level: 2 },
    { id: 'key-list', text: '/key list', level: 3 },
    { id: 'key-add', text: '/key add', level: 3 },
    { id: 'key-remove', text: '/key remove', level: 3 },
    { id: 'key-use', text: '/key use', level: 3 },
    { id: 'key-temp', text: '/key use --temp', level: 3 },
    { id: 'key-null', text: '/key use --null', level: 3 },
    { id: 'key-clean', text: '/key clean', level: 3 },
    { id: 'custom-endpoints', text: 'Custom Endpoints & --url', level: 2 },
    { id: 'no-key-mode', text: 'Sending No Key (Localhost)', level: 2 },
    { id: 'security', text: 'Storage & Security', level: 2 },
]

const pre = 'bg-slate-900 text-slate-100 p-4 rounded-lg text-sm my-3 font-mono overflow-x-auto'
const h2 = 'text-2xl font-bold text-slate-900 dark:text-white mt-10 mb-3 border-b border-slate-200 dark:border-slate-800 pb-2'
const h3 = 'text-xl font-semibold text-slate-900 dark:text-white mt-8 mb-2'
const p = 'text-slate-600 dark:text-slate-400 mb-4'

export default function ApiKeys() {
    return (
        <DocPage headings={headings}>
            <h1 id="api-keys">API Keys &amp; Providers</h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed mb-10">
                FluxFlow keeps a dedicated, multi-slot key vault for every provider, so you can juggle
                several API keys at once and switch between them instantly — or run keyless against a
                local endpoint. Everything is driven by the{' '}
                <code className="mx-1 text-blue-600 dark:text-blue-400 font-mono">/key</code> command.
            </p>

            {/* KEY VAULT */}
            <h2 id="key-vault" className={h2}>The Key Vault</h2>
            <p className={p}>
                Each provider gets a fixed array of <strong>10 slots</strong>. Keys never shift around on
                their own — they stay in the slot you put them in until you change it. One slot per provider
                is marked as the <strong>active</strong> key, and that is the key used for requests.
            </p>
            <p className={p}>
                Running bare <code>/key</code> prints the subcommand list. Every subcommand accepts a{' '}
                <code>--provider &lt;name&gt;</code> flag; when omitted it resolves to your current provider
                automatically. Valid subcommands:
            </p>
            <pre className={pre}>{`/key list
/key add <key>
/key remove [<index>|<key>|--all]
/key use <index>|<key>
/key use <key> --temp
/key use --null
/key clean`}</pre>

            <h3 id="key-list" className={h3}>/key list</h3>
            <p className={p}>
                Shows all 10 slots with the active one marked. Keys are masked to the middle third by default.
            </p>
            <pre className={pre}>{`/key list
/key list --provider custom
/key list --unmask`}</pre>
            <p className={p}>
                With no <code>--provider</code> value it lists every provider alongside its key count.
                When a provider is in no-key mode, the header is flagged with{' '}
                <code>Mode: NO KEY (null) &lt;- active</code>.
            </p>

            <h3 id="key-add" className={h3}>/key add</h3>
            <p className={p}>
                Writes a key into the <strong>first empty slot</strong> — it always appends, and never
                overwrites an existing key. Adding a provider's very first key also makes it active.
            </p>
            <pre className={pre}>{`/key add sk-abc123
/key add sk-abc123 --index 4
/key add sk-abc123 --index 2 --url http://localhost:8080/v1`}</pre>
            <p className={p}>
                Use <code>--index &lt;n&gt;</code> to target a specific slot (1-10). Adding a key
                automatically clears no-key mode for that provider.
            </p>

            <h3 id="key-remove" className={h3}>/key remove</h3>
            <p className={p}>
                Removes a key from the vault. With no argument it removes the <strong>active</strong> key.
            </p>
            <pre className={pre}>{`/key remove            # active key
/key remove 3          # slot 3
/key remove sk-abc     # matching key / substring
/key remove --all      # every key for the provider`}</pre>
            <p className={p}>
                Substring matching is supported, but ambiguous matches (more than one slot contains the
                fragment) error out rather than guessing — use a slot index or a longer fragment instead.
            </p>

            <h3 id="key-use" className={h3}>/key use</h3>
            <p className={p}>
                Sets which saved slot is <strong>active</strong>. This is persisted to disk, so it survives
                restarts. It is a pure selector — it does not add, write, or modify any key.
            </p>
            <pre className={pre}>{`/key use 2             # activate slot 2
/key use sk-abc123     # activate the matching saved key`}</pre>
            <p className={p}>
                If the key you pass is <em>not</em> already saved, nothing happens and you get{' '}
                <code>No matching key found.</code> — to persist a new key use{' '}
                <Link to="#key-add" className="text-blue-600 dark:text-blue-400 font-medium hover:underline">/key add</Link>{' '}
                instead. Activating a real slot always clears no-key mode.
            </p>

            <h3 id="key-temp" className={h3}>/key use &lt;key&gt; --temp</h3>
            <p className={p}>
                Uses a session-only key held <strong>in memory</strong>. Nothing is written to disk and the
                key disappears when the process exits. Useful for one-off testing without polluting your vault.
            </p>
            <pre className={pre}>{`/key use sk-temp999 --temp`}</pre>

            <h3 id="key-null" className={h3}>/key use --null</h3>
            <p className={p}>
                Tells FluxFlow to send <strong>no API key at all</strong> for this provider. No{' '}
                <code>Authorization</code> header, no <code>api-key</code> header, and no environment-variable
                fallback — the request goes out completely unauthenticated.
            </p>
            <pre className={pre}>{`/key use --null
/key use --null --provider ollama`}</pre>
            <p className={p}>
                This is the friendly way to tell the harness to stay keyless for local inference. Unlike a
                temporary key, the flag is <strong>persisted</strong> in settings and applies across both the
                CLI and the VS Code extension.
            </p>
            <ul className={p}>
                <li><strong>Supported providers:</strong> <code>custom</code> (Custom OpenAI-compatible endpoints) and <code>Ollama</code> only. Any other provider returns an error.</li>
                <li><strong>Non-destructive:</strong> saved slots are <em>kept intact</em> — they are simply ignored while the flag is on. Nothing is deleted.</li>
                <li><strong>Base URL preserved:</strong> for custom endpoints your configured endpoint (e.g. <code>http://localhost:8080/v1</code>) is still used; only the credential is dropped.</li>
                <li><strong>Auto-clears:</strong> running <code>/key add</code>, <code>/key use &lt;real slot&gt;</code>, or saving a key on the Settings page turns the mode back off automatically.</li>
            </ul>
            <p className={p}>
                A typical localhost workflow: leave a cloud key saved in slot 1, point the custom provider at
                your local server, and run <code>/key use --null</code>. When you want the cloud key back,
                just <code>/key use 1</code>.
            </p>

            <h3 id="key-clean" className={h3}>/key clean</h3>
            <p className={p}>
                Compacts gaps between slots so your keys sit contiguously from slot 1. This is a purely
                cosmetic reordering — <strong>no keys are deleted</strong>, and the active key stays active.
            </p>
            <pre className={pre}>{`/key clean
/key clean --provider custom`}</pre>
            <p className={p}>
                With no <code>--provider</code>, the entire key store is cleaned.
            </p>

            {/* CUSTOM ENDPOINTS */}
            <h2 id="custom-endpoints" className={h2}>Custom Endpoints &amp; <code>--url</code></h2>
            <p className={p}>
                The <code>custom</code> provider points at any OpenAI-compatible API. The{' '}
                <code>--url</code> flag is valid <strong>only</strong> for this provider and pins a slot to a
                specific endpoint, independent of the base URL saved in settings.
            </p>
            <ul className={p}>
                <li>Must start with <code>http://</code> or <code>https://</code>.</li>
                <li>Must end in <code>/v1</code> or <code>/v1/chat/completions</code>.</li>
                <li>Trailing slashes are stripped; <code>/v1</code> is resolved to the chat completions path at request time.</li>
                <li>Omit it to reuse the slot's existing URL, falling back to the settings base URL.</li>
            </ul>
            <pre className={pre}>{`/key add sk-local --url http://localhost:8080/v1
/key add sk-remote --url https://api.example.com/v1`}</pre>

            {/* NO KEY MODE */}
            <h2 id="no-key-mode" className={h2}>Sending No Key (Localhost)</h2>
            <p className={p}>
                Local inference servers — Ollama on <code>127.0.0.1:11434</code>, or any OpenAI-compatible
                runtime on localhost — typically need no credential. FluxFlow already treats a blank Ollama
                key as local, but if an <code>OLLAMA_API_KEY</code> or a saved cloud key is present, the
                provider will try to reach the hosted endpoint instead.
            </p>
            <p className={p}>
                <Link to="#key-null" className="text-blue-600 dark:text-blue-400 font-medium hover:underline">/key use --null</Link>{' '}
                overrides that: it forces keyless mode regardless of what is saved, so requests always go to
                your local endpoint. Because it is persisted and non-destructive, you can flip between local
                and cloud with a single command.
            </p>
            <pre className={pre}>{`# go local, no credentials sent
/key use --null
/key use --null --provider ollama

# back to a saved cloud key
/key use 1`}</pre>

            {/* SECURITY */}
            <h2 id="security" className={h2}>Storage &amp; Security</h2>
            <ul className={p}>
                <li>Keys live in an encrypted <code>secrets_v2.json</code> vault, not in plain settings.</li>
                <li>The active slot index per provider is tracked in settings.</li>
                <li>Keys are masked in <code>/key list</code> output unless you pass <code>--unmask</code>.</li>
                <li>Keys passed with <code>--temp</code> never touch the disk.</li>
                <li>No-key mode is stored as a simple boolean per provider — it never deletes or rewrites a stored key.</li>
            </ul>
        </DocPage>
    )
}
