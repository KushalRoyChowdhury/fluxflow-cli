import DocPage from '../components/DocPage'

const headings = [
    { id: 'google-gemini', text: 'Google Gemini', level: 2 },
    { id: 'deepseek', text: 'DeepSeek', level: 2 },
    { id: 'ollama', text: 'Ollama', level: 2 },
    { id: 'mistral', text: 'Mistral', level: 2 },
    { id: 'nvidia', text: 'NVIDIA (NIM)', level: 2 },
    { id: 'openrouter', text: 'OpenRouter', level: 2 },
]

function Badge({ type }) {
    switch (type) {
        case 'multimodal':
            return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50">Multimodal</span>
        case 'text':
            return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">Text Only</span>
        case 'experimental':
            return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100/50 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80">Experimental</span>
        case 'auto':
            return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">Custom</span>
        default:
            return null
    }
}

function CategoryHeader({ title }) {
    return (
        <tr className="bg-slate-100/90 dark:bg-slate-800/90 border-y border-slate-200 dark:border-slate-700">
            <td colSpan={3} className="py-2 px-4 font-semibold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                {title}
            </td>
        </tr>
    )
}

export default function StableModels() {
    return (
        <DocPage headings={headings}>
            <h1 id="stable-models">Supported Models</h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed mb-10">
                FluxFlow supports a variety of high-performance AI models across multiple
                providers. You can switch between models dynamically using the
                <code className="mx-1 text-blue-600 dark:text-blue-400 font-mono">/model</code> command during a session.
            </p>

            {/* GOOGLE GEMINI */}
            <h2 id="google-gemini" className="text-2xl font-bold text-slate-900 dark:text-white mt-10 mb-3 border-b border-slate-200 dark:border-slate-800 pb-2">
                Google Gemini
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
                The default provider, offering native multimodal capabilities, ultra-fast responses, and large context windows.
            </p>
            <div className="overflow-x-auto my-6 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Model Name</th>
                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-sm">
                        <CategoryHeader title="Gemini 3 Series" />
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">gemini-3.6-flash</td>
                            <td className="py-2.5 px-4"><Badge type="multimodal" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Flash Latest <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">[Instability Issues]</span></td>
                        </tr>
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">gemini-3.5-flash-lite</td>
                            <td className="py-2.5 px-4"><Badge type="multimodal" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Latest Flash Lite</td>
                        </tr>
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">gemini-3-flash-preview</td>
                            <td className="py-2.5 px-4"><Badge type="multimodal" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Default, Fast & Lightweight</td>
                        </tr>
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">gemini-3.1-flash-lite</td>
                            <td className="py-2.5 px-4"><Badge type="multimodal" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Ultra-Fast & Lite</td>
                        </tr>
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">gemini-3.1-pro-preview</td>
                            <td className="py-2.5 px-4"><Badge type="multimodal" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Pro Reasoning</td>
                        </tr>

                        <CategoryHeader title="Gemini 2.5 Series" />
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">gemini-2.5-flash</td>
                            <td className="py-2.5 px-4"><Badge type="multimodal" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Fast & Reliable</td>
                        </tr>
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">gemini-2.5-flash-lite</td>
                            <td className="py-2.5 px-4"><Badge type="multimodal" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Fast & Cheap</td>
                        </tr>
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">gemini-2.5-pro</td>
                            <td className="py-2.5 px-4"><Badge type="multimodal" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Last gen Pro reasoning</td>
                        </tr>

                        <CategoryHeader title="Gemma Models" />
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">gemma-4-31b-it</td>
                            <td className="py-2.5 px-4"><Badge type="multimodal" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Standard Default</td>
                        </tr>
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">gemma-4-26b-a4b-it</td>
                            <td className="py-2.5 px-4"><Badge type="multimodal" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Standard & Faster</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* DEEPSEEK */}
            <h2 id="deepseek" className="text-2xl font-bold text-slate-900 dark:text-white mt-12 mb-3 border-b border-slate-200 dark:border-slate-800 pb-2">
                DeepSeek
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
                High-intelligence reasoning models tailored for coding and complex logic tasks.
            </p>
            <div className="overflow-x-auto my-6 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Model Name</th>
                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-sm">
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">deepseek-v4-flash</td>
                            <td className="py-2.5 px-4"><Badge type="text" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Fast & Efficient</td>
                        </tr>
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">deepseek-v4-pro</td>
                            <td className="py-2.5 px-4"><Badge type="text" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">High-Intelligence Reasoning</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* OLLAMA */}
            <h2 id="ollama" className="text-2xl font-bold text-slate-900 dark:text-white mt-12 mb-3 border-b border-slate-200 dark:border-slate-800 pb-2">
                Ollama
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
                Run local or cloud Ollama models directly within FluxFlow. Type any custom model name (e.g. <code className="font-mono text-blue-600 dark:text-blue-400">llama3.2</code>, <code className="font-mono text-blue-600 dark:text-blue-400">qwen2.5-coder</code>) using <code className="font-mono text-blue-600 dark:text-blue-400">/model &lt;model-name&gt;</code>. Pass <code className="font-mono text-blue-600 dark:text-blue-400">--multimodal</code> or <code className="font-mono text-blue-600 dark:text-blue-400">-m</code> flag for vision models. Eg. <code className="font-mono text-blue-600 dark:text-blue-400">/model gemma4:31b -m</code> OR <code className="font-mono text-blue-600 dark:text-blue-400">/model gemma4:31b --multimodal</code>
            </p>
            <div className="overflow-x-auto my-6 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Model Name</th>
                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-sm">
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">&lt;custom-model-id&gt;</td>
                            <td className="py-2.5 px-4"><Badge type="auto" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">User-Defined Model Input (Cloud / Local Host)</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* MISTRAL */}
            <h2 id="mistral" className="text-2xl font-bold text-slate-900 dark:text-white mt-12 mb-3 border-b border-slate-200 dark:border-slate-800 pb-2">
                Mistral
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
                Access to Mistral AI's reasoning, coding, and cost-saving models.
            </p>
            <div className="overflow-x-auto my-6 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Model Name</th>
                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-sm">
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">ministral-3b-2512</td>
                            <td className="py-2.5 px-4"><Badge type="experimental" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Cost Saving (Text Only)</td>
                        </tr>
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">ministral-8b-2512</td>
                            <td className="py-2.5 px-4"><Badge type="experimental" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Cost Saving (Text Only)</td>
                        </tr>
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">ministral-14b-2512</td>
                            <td className="py-2.5 px-4"><Badge type="experimental" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Cost Saving (Text Only)</td>
                        </tr>
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">mistral-small-2506</td>
                            <td className="py-2.5 px-4"><Badge type="experimental" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Default, Cost Saving</td>
                        </tr>
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">open-mistral-nemo</td>
                            <td className="py-2.5 px-4"><Badge type="experimental" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Cost Saving</td>
                        </tr>
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">devstral-2512</td>
                            <td className="py-2.5 px-4"><Badge type="experimental" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Devstral Coding</td>
                        </tr>
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">mistral-medium-2508</td>
                            <td className="py-2.5 px-4"><Badge type="multimodal" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Mistral Medium Multimodal</td>
                        </tr>

                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">mistral-large-2512</td>
                            <td className="py-2.5 px-4"><Badge type="multimodal" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Mistral Large (Multimodal)</td>
                        </tr>
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">labs-leanstral-1-5-1</td>
                            <td className="py-2.5 px-4"><Badge type="experimental" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Enable Lab Models</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* NVIDIA NIM */}
            <h2 id="nvidia" className="text-2xl font-bold text-slate-900 dark:text-white mt-12 mb-3 border-b border-slate-200 dark:border-slate-800 pb-2">
                NVIDIA (NIM)
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
                Access to open-weights models hosted on high-speed NVIDIA Infrastructure.
            </p>
            <div className="overflow-x-auto my-6 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Model Name</th>
                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-sm">
                        <CategoryHeader title="DeepSeek Models" />
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">deepseek-ai/deepseek-v4-flash</td>
                            <td className="py-2.5 px-4"><Badge type="text" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Text Only</td>
                        </tr>
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">deepseek-ai/deepseek-v4-pro</td>
                            <td className="py-2.5 px-4"><Badge type="text" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Text Only</td>
                        </tr>

                        <CategoryHeader title="StepFun Models" />
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">stepfun-ai/step-3.7-flash</td>
                            <td className="py-2.5 px-4"><Badge type="multimodal" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Multimodal</td>
                        </tr>

                        <CategoryHeader title="Google Models" />
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">google/gemma-4-31b-it</td>
                            <td className="py-2.5 px-4"><Badge type="multimodal" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Multimodal</td>
                        </tr>
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">google/diffusiongemma-26b-a4b-it</td>
                            <td className="py-2.5 px-4"><Badge type="text" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Caffeinated Speed</td>
                        </tr>

                        <CategoryHeader title="Mistral Models" />
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">mistralai/mistral-large-3-675b-instruct-2512</td>
                            <td className="py-2.5 px-4"><Badge type="multimodal" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Multimodal</td>
                        </tr>

                        <CategoryHeader title="OpenAI Models" />
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">openai/gpt-oss-20b</td>
                            <td className="py-2.5 px-4"><Badge type="text" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Text Only</td>
                        </tr>
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">openai/gpt-oss-120b</td>
                            <td className="py-2.5 px-4"><Badge type="text" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Text Only</td>
                        </tr>

                        <CategoryHeader title="Z-AI Models" />
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">z-ai/glm-5.2</td>
                            <td className="py-2.5 px-4"><Badge type="text" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Text Only</td>
                        </tr>

                        <CategoryHeader title="MiniMax Models" />
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">minimaxai/minimax-m3</td>
                            <td className="py-2.5 px-4"><Badge type="text" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Text Only</td>
                        </tr>

                        <CategoryHeader title="NVIDIA Models" />
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">nvidia/nemotron-3-ultra-550b-a55b</td>
                            <td className="py-2.5 px-4"><Badge type="experimental" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Text Only [EXPERIMENTAL]</td>
                        </tr>
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">nvidia/nemotron-3-super-120b-a12b</td>
                            <td className="py-2.5 px-4"><Badge type="experimental" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Text Only [EXPERIMENTAL]</td>
                        </tr>

                        <CategoryHeader title="Meta Models" />
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">meta/llama-3.3-70b-instruct</td>
                            <td className="py-2.5 px-4"><Badge type="text" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Text Only</td>
                        </tr>
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">meta/llama-3.2-90b-vision-instruct</td>
                            <td className="py-2.5 px-4"><Badge type="multimodal" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Multimodal</td>
                        </tr>

                        <CategoryHeader title="Thinking Machines Models" />
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">thinkingmachines/inkling</td>
                            <td className="py-2.5 px-4"><Badge type="experimental" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Text Only [EXPERIMENTAL]</td>
                        </tr>

                        <CategoryHeader title="PoolSide Models" />
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">poolside/laguna-xs-2.1</td>
                            <td className="py-2.5 px-4"><Badge type="experimental" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Text Only [EXPERIMENTAL]</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* OPENROUTER */}
            <h2 id="openrouter" className="text-2xl font-bold text-slate-900 dark:text-white mt-12 mb-3 border-b border-slate-200 dark:border-slate-800 pb-2">
                OpenRouter
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
                A unified gateway to access a massive ecosystem of top-tier AI models, divided into Paid and Free tiers.
            </p>

            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mt-6 mb-3">Free Tier</h3>
            <div className="overflow-x-auto my-4 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Model Name</th>
                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-sm">
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">google/gemma-4-31b-it:free</td>
                            <td className="py-2.5 px-4"><Badge type="multimodal" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Multimodal</td>
                        </tr>


                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">google/gemma-4-26b-a4b-it:free</td>
                            <td className="py-2.5 px-4"><Badge type="multimodal" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Multimodal</td>
                        </tr>
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">poolside/laguna-s-2.1:free</td>
                            <td className="py-2.5 px-4"><Badge type="text" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Text Only</td>
                        </tr>
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">nvidia/nemotron-3-ultra-550b-a55b:free</td>
                            <td className="py-2.5 px-4"><Badge type="text" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Text Only</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mt-8 mb-3">Paid Tier</h3>
            <div className="overflow-x-auto my-4 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Model Name</th>
                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                            <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-sm">
                        <CategoryHeader title="Anthropic Models" />
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">anthropic/claude-sonnet-4.5</td>
                            <td className="py-2.5 px-4"><Badge type="multimodal" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Multimodal</td>
                        </tr>
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">anthropic/claude-opus-4.6</td>
                            <td className="py-2.5 px-4"><Badge type="multimodal" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Multimodal</td>
                        </tr>
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">anthropic/claude-opus-4.8</td>
                            <td className="py-2.5 px-4"><Badge type="multimodal" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Multimodal</td>
                        </tr>
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">anthropic/claude-fable-5</td>
                            <td className="py-2.5 px-4"><Badge type="multimodal" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Multimodal</td>
                        </tr>
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">anthropic/claude-opus-5</td>
                            <td className="py-2.5 px-4"><Badge type="multimodal" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Multimodal</td>
                        </tr>

                        <CategoryHeader title="OpenAI Models" />
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">openai/gpt-5.2-codex</td>
                            <td className="py-2.5 px-4"><Badge type="multimodal" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Multimodal</td>
                        </tr>
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">openai/gpt-5.2-pro</td>
                            <td className="py-2.5 px-4"><Badge type="multimodal" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Multimodal</td>
                        </tr>
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">openai/gpt-5.5-pro</td>
                            <td className="py-2.5 px-4"><Badge type="multimodal" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Multimodal</td>
                        </tr>
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">openai/gpt-5.6-terra</td>
                            <td className="py-2.5 px-4"><Badge type="multimodal" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Multimodal</td>
                        </tr>
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">openai/gpt-5.6-luna</td>
                            <td className="py-2.5 px-4"><Badge type="multimodal" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Multimodal</td>
                        </tr>
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">openai/gpt-5.6-sol</td>
                            <td className="py-2.5 px-4"><Badge type="multimodal" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Multimodal</td>
                        </tr>

                        <CategoryHeader title="Google & DeepSeek Models" />
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">google/gemini-3.5-flash</td>
                            <td className="py-2.5 px-4"><Badge type="multimodal" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Multimodal</td>
                        </tr>
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">deepseek/deepseek-v4-pro</td>
                            <td className="py-2.5 px-4"><Badge type="text" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Text Only</td>
                        </tr>
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">deepseek/deepseek-v4-flash</td>
                            <td className="py-2.5 px-4"><Badge type="text" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Text Only</td>
                        </tr>

                        <CategoryHeader title="Other Frontier Models" />
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">qwen/qwen3.7-plus</td>
                            <td className="py-2.5 px-4"><Badge type="multimodal" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Multimodal</td>
                        </tr>
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">minimax/minimax-m3</td>
                            <td className="py-2.5 px-4"><Badge type="multimodal" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Multimodal</td>
                        </tr>
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">moonshotai/kimi-k2.6</td>
                            <td className="py-2.5 px-4"><Badge type="multimodal" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Multimodal</td>
                        </tr>
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">x-ai/grok-4.5</td>
                            <td className="py-2.5 px-4"><Badge type="multimodal" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Multimodal</td>
                        </tr>
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">xiaomi/mimo-v2.5-pro</td>
                            <td className="py-2.5 px-4"><Badge type="text" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Text Only</td>
                        </tr>
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">z-ai/glm-5</td>
                            <td className="py-2.5 px-4"><Badge type="text" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Text Only</td>
                        </tr>
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">z-ai/glm-5.2</td>
                            <td className="py-2.5 px-4"><Badge type="text" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Text Only</td>
                        </tr>
                        <tr>
                            <td className="py-2.5 px-4 font-mono text-slate-800 dark:text-slate-200">tencent/hy3</td>
                            <td className="py-2.5 px-4"><Badge type="text" /></td>
                            <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">Text Only</td>
                        </tr>
                    </tbody>
                </table>
            </div>

        </DocPage>
    )
}
