import DocPage from '../components/DocPage'

const headings = [
    { id: 'model-selection', text: 'Model Selection & Flags', level: 2 },
    { id: 'model-flags', text: 'Supported Flags', level: 3 },
    { id: 'openrouter-routing', text: 'OpenRouter Routing & Syntax', level: 2 },
    { id: 'supported-providers', text: 'Supported Providers', level: 2 },
]

export default function StableModels() {
    return (
        <DocPage headings={headings}>
            <h1 id="stable-models">Model Management &amp; Providers</h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed mb-10">
                FluxFlow gives you full flexibility to select, persist, and manage AI models across multiple providers.
                Models can be switched dynamically or configured per provider directly in the terminal via the{' '}
                <code className="mx-1 text-blue-600 dark:text-blue-400 font-mono">/model</code> command.
            </p>

            {/* MODEL SELECTION & FLAGS */}
            <h2 id="model-selection" className="text-2xl font-bold text-slate-900 dark:text-white mt-10 mb-3 border-b border-slate-200 dark:border-slate-800 pb-2">
                Model Selection &amp; Management
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
                To switch the active model on the currently selected provider, run:
            </p>
            <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-sm my-3 font-mono">
{`/model <model-id>`}
            </pre>

            <h3 id="model-flags" className="text-xl font-semibold text-slate-900 dark:text-white mt-8 mb-3">
                Supported <code className="text-blue-500 font-mono">/model</code> Flags
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
                Manage your model list, defaults, and capabilities per provider directly from the command line:
            </p>

            <div className="overflow-x-auto my-6 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Flag</th>
                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Alias</th>
                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Usage &amp; Description</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-sm">
                        <tr>
                            <td className="py-3 px-4 font-mono text-blue-600 dark:text-blue-400 font-semibold">--save</td>
                            <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">-sv</td>
                            <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                                <div>Saves and persists a custom model ID to the active provider's model list.</div>
                                <code className="text-xs text-slate-500 font-mono mt-1 block">/model my-custom-model --save [-m]</code>
                            </td>
                        </tr>
                        <tr>
                            <td className="py-3 px-4 font-mono text-blue-600 dark:text-blue-400 font-semibold">--default</td>
                            <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">-df</td>
                            <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                                <div>Sets the specified model as the default startup model for the current provider.</div>
                                <code className="text-xs text-slate-500 font-mono mt-1 block">/model my-model --default [-m]</code>
                            </td>
                        </tr>
                        <tr>
                            <td className="py-3 px-4 font-mono text-blue-600 dark:text-blue-400 font-semibold">--remove</td>
                            <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">-rm</td>
                            <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                                <div>Removes a model ID from the active provider's saved model list.</div>
                                <code className="text-xs text-slate-500 font-mono mt-1 block">/model my-model --remove</code>
                            </td>
                        </tr>
                        <tr>
                            <td className="py-3 px-4 font-mono text-blue-600 dark:text-blue-400 font-semibold">--rename</td>
                            <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">-rn, -mv</td>
                            <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                                <div>Renames an existing model ID in the active provider's list.</div>
                                <code className="text-xs text-slate-500 font-mono mt-1 block">/model &lt;old-id&gt; &lt;new-id&gt; --rename</code>
                            </td>
                        </tr>
                        <tr>
                            <td className="py-3 px-4 font-mono text-blue-600 dark:text-blue-400 font-semibold">--multimodal</td>
                            <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">-m</td>
                            <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                                <div>Enables vision / image multimodal processing support for the model. Can be combined with <code>--save</code> or <code>--default</code>.</div>
                                <code className="text-xs text-slate-500 font-mono mt-1 block">/model my-vision-model -m</code>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* OPENROUTER ROUTING */}
            <h2 id="openrouter-routing" className="text-2xl font-bold text-slate-900 dark:text-white mt-12 mb-3 border-b border-slate-200 dark:border-slate-800 pb-2">
                OpenRouter Provider Routing &amp; Syntax
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
                When using <strong>OpenRouter</strong>, FluxFlow gives you fine-grained control over downstream host routing, priorities, and model variants:
            </p>

            <ul className="space-y-4 mb-6">
                <li>
                    <strong>Standard Model Syntax</strong>:
                    <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg text-sm my-2 font-mono">
{`/model <author>/<model-id>
# Example: /model anthropic/claude-3.5-sonnet
# Example: /model openai/gpt-4o`}
                    </pre>
                </li>
                <li>
                    <strong>Dedicated Service Tiers (<code className="font-mono text-blue-500">:flex</code> &amp; <code className="font-mono text-blue-500">:priority</code>)</strong>:
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        Use service tier variant suffixes provided by frontier upstream hosts (e.g. OpenAI, Vertex AI) for discounted flex pricing or prioritized latency. You can also chain downstream provider routing and service tiers:
                    </p>
                    <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg text-sm my-2 font-mono">
{`/model openai/gpt-5:flex                   # Direct flex tier
/model openai/gpt-5:priority               # Direct priority tier
/model openai/gpt-5:openai:flex            # Provider host (openai) + flex tier`}
                    </pre>
                </li>
                <li>
                    <strong>Enforced Downstream Provider Host (<code className="font-mono text-blue-500">:&lt;provider&gt;</code>)</strong>:
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        Append <code>:&lt;provider&gt;</code> to the model identifier to lock execution to a specific backend host with <code>allow_fallbacks: false</code>:
                    </p>
                    <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg text-sm my-2 font-mono">
{`/model meta-llama/llama-3.3-70b-instruct:together    # Forces Together AI host
/model deepseek/deepseek-r1:deepinfra               # Forces DeepInfra host`}
                    </pre>
                </li>
                <li>
                    <strong>OpenRouter Variants</strong>:
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        Variant suffixes (such as <code>:free</code>, <code>:nitro</code>, <code>:floor</code>, <code>:exacto</code>) are automatically parsed and passed directly as OpenRouter model variants.
                    </p>
                    <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg text-sm my-2 font-mono">
{`/model google/gemma-4-31b-it:free
/model mistralai/mistral-large-2411:nitro`}
                    </pre>
                </li>
            </ul>

            {/* SUPPORTED PROVIDERS */}
            <h2 id="supported-providers" className="text-2xl font-bold text-slate-900 dark:text-white mt-12 mb-3 border-b border-slate-200 dark:border-slate-800 pb-2">
                Supported Providers
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
                FluxFlow connects seamlessly to both direct API endpoints and multi-model aggregators:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6">
                <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                    <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Direct Providers</h4>
                    <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1 list-disc list-inside">
                        <li><strong>Google Gemini</strong> (Native multimodal &amp; Flash/Pro)</li>
                        <li><strong>DeepSeek</strong> (platform.deepseek.com)</li>
                        <li><strong>Mistral AI</strong> (admin.mistral.ai)</li>
                        <li><strong>NVIDIA NIM</strong> (Local &amp; cloud OpenAI-compatible endpoints)</li>
                        <li><strong>Ollama</strong> (Local models with multimodal support)</li>
                        <li><strong>SenseNova</strong> (platform.sensenova.ai)</li>
                        <li><strong>InferX</strong> (model.inferx.net)</li>
                        <li><strong>CrofAI</strong> (crof.ai)</li>
                        <li><strong>Poolside</strong> (platform.poolside.ai)</li>
                    </ul>
                </div>
                <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                    <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Aggregators &amp; Proxies</h4>
                    <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1 list-disc list-inside">
                        <li><strong>OpenRouter</strong> (openrouter.ai — routing &amp; variant support)</li>
                        <li><strong>TokenHarbor</strong> (tokenharbor.ai)</li>
                        <li><strong>AIHubMix</strong> (aihubmix.com)</li>
                        <li><strong>Experiential Labs</strong> (api.experientiallabs.ai)</li>
                        <li><strong>9router</strong> (Local proxy for OAuth subscriptions / Copilot. Also accepts any OpenAI & Anthropic Endpoints. Set ENV ENABLE_9ROUTER=true to enable)</li>
                    </ul>
                </div>
            </div>
        </DocPage>
    )
}
