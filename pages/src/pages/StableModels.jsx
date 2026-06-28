import DocPage from '../components/DocPage'

const headings = [
    { id: 'google-gemini', text: 'Google Gemini', level: 2 },
    { id: 'deepseek', text: 'DeepSeek', level: 2 },
    { id: 'nvidia', text: 'NVIDIA (NIM)', level: 2 },
    { id: 'openrouter', text: 'OpenRouter', level: 2 },
]

export default function StableModels() {
    return (
        <DocPage headings={headings}>
            <h1 id="stable-models">Stable Models</h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed mb-10">
                FluxFlow supports a variety of high-performance AI models across multiple
                providers. You can switch between these models dynamically using the
                <code>/model</code> command during a session.
            </p>

            <h2 id="google-gemini">Google Gemini</h2>
            <p>
                The default and highly integrated provider, offering native multimodal capabilities and fast response times.
            </p>
            <div className="overflow-x-auto">
                <table>
                    <thead>
                        <tr>
                            <th>Model Name</th>
                            <th>Description</th>
                            <th>Tier</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><code>gemini-3.1-flash-lite</code></td>
                            <td>Ultra-Fast & Lite</td>
                        </tr>
                        <tr>
                            <td><code>gemini-3-flash-preview</code></td>
                            <td>Fast & Lightweight</td>
                        </tr>
                        <tr>
                            <td><code>gemini-3.5-flash</code></td>
                            <td>Flash Latest [Instability Issues]</td>
                        </tr>
                        <tr>
                            <td><code>gemini-3.1-pro-preview</code></td>
                            <td>Pro Reasoning</td>
                        </tr>

                        <tr>
                            <td><code>gemini-2.5-flash-lite</code></td>
                            <td>Fast & Cheap</td>
                        </tr>
                        <tr>
                            <td><code>gemini-2.5-flash</code></td>
                            <td>Fast & Reliable</td>
                        </tr>
                        <tr>
                            <td><code>gemini-2.5-pro</code></td>
                            <td>Last gen Pro reasoning</td>
                        </tr>

                        <tr>
                            <td><code>gemma-4-31b-it</code></td>
                            <td>Standard Default</td>
                        </tr>
                        <tr>
                            <td><code>gemma-4-26b-a4b-it</code></td>
                            <td>Standard & Faster</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <h2 id="deepseek">DeepSeek</h2>
            <p>
                Offers high-intelligence reasoning and efficient processing, ideal for complex coding tasks.
            </p>
            <div className="overflow-x-auto">
                <table>
                    <thead>
                        <tr>
                            <th>Model Name</th>
                            <th>Description</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><code>deepseek-v4-flash</code></td>
                            <td>Fast & Efficient</td>
                        </tr>
                        <tr>
                            <td><code>deepseek-v4-pro</code></td>
                            <td>High-Intelligence Reasoning</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <h2 id="nvidia">NVIDIA (NIM)</h2>
            <p>
                Access to a curated selection of powerful open-source.
            </p>
            <div className="overflow-x-auto">
                <table>
                    <thead>
                        <tr>
                            <th>Model Name</th>
                            <th>Description</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><code>moonshotai/kimi-k2.6</code></td>
                            <td>Multimodal</td>
                        </tr>

                        <tr>
                            <td><code>google/gemma-4-31b-it</code></td>
                            <td>Multimodal</td>
                        </tr>

                        <tr>
                            <td><code>stepfun-ai/step-3.7-flash</code></td>
                            <td>Multimodal</td>
                        </tr>

                        <tr>
                            <td><code>minimaxai/minimax-m2.7</code></td>
                            <td>Text Only</td>
                        </tr>
                        <tr>
                            <td><code>minimaxai/minimax-m3</code></td>
                            <td>Text Only</td>
                        </tr>

                        <tr>
                            <td><code>deepseek-ai/deepseek-v4-flash</code></td>
                            <td>Text Only</td>
                        </tr>
                        <tr>
                            <td><code>deepseek-ai/deepseek-v4-pro</code></td>
                            <td>Text Only</td>
                        </tr>

                        <tr>
                            <td><code>mistralai/mistral-medium-3.5-128b</code></td>
                            <td>Multimodal</td>
                        </tr>

                        <tr>
                            <td><code>openai/gpt-oss-20b</code></td>
                            <td>Text Only</td>
                        </tr>
                        <tr>
                            <td><code>openai/gpt-oss-120b</code></td>
                            <td>Text Only</td>
                        </tr>

                        <tr>
                            <td><code>z-ai/glm-5.1</code></td>
                            <td>Text Only</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <h2 id="openrouter">OpenRouter</h2>
            <p>
                A unified interface to access a massive ecosystem of AI models, categorized by Free and Paid tiers.
            </p>

            <h3 className="text-md font-medium text-slate-700 dark:text-slate-300 mt-6 mb-2">Paid Tier</h3>
            <div className="overflow-x-auto">
                <table>
                    <thead>
                        <tr>
                            <th>Model Name</th>
                            <th>Description</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/*
                        <!-- ========================================== -->
                        <!-- --- WESTERN FRONTIER MODELS (MULTIMODAL) -- -->
                        <!-- ========================================== -->
                        */}
                        <tr>
                            <td><code>google/gemini-3.5-flash</code></td>
                            <td>Multimodal</td>
                        </tr>
                        <tr>
                            <td><code>anthropic/claude-sonnet-4.5</code></td>
                            <td>Multimodal</td>
                        </tr>
                        <tr>
                            <td><code>anthropic/claude-opus-4.6</code></td>
                            <td>Multimodal</td>
                        </tr>
                        <tr>
                            <td><code>anthropic/claude-opus-4.8</code></td>
                            <td>Multimodal</td>
                        </tr>
                        <tr>
                            <td><code>openai/gpt-5.2-codex</code></td>
                            <td>Multimodal</td>
                        </tr>
                        <tr>
                            <td><code>openai/gpt-5.2-pro</code></td>
                            <td>Multimodal</td>
                        </tr>
                        <tr>
                            <td><code>openai/gpt-5.5-pro</code></td>
                            <td>Multimodal</td>
                        </tr>

                        {/*
                        <!-- ========================================== -->
                        <!-- --- CHINESE FRONTIER MODELS (MULTIMODAL) - -->
                        <!-- ========================================== -->
                        */}
                        <tr>
                            <td><code>moonshotai/kimi-k2.6</code></td>
                            <td>Multimodal</td>
                        </tr>
                        <tr>
                            <td><code>qwen/qwen3.7-plus</code></td>
                            <td>Multimodal</td>
                        </tr>
                        <tr>
                            <td><code>minimax/minimax-m3</code></td>
                            <td>Multimodal</td>
                        </tr>
                        <tr>
                            <td><code>deepseek/deepseek-v4-pro</code></td>
                            <td>Multimodal</td>
                        </tr>
                        <tr>
                            <td><code>deepseek/deepseek-v4-flash</code></td>
                            <td>Multimodal</td>
                        </tr>
                        <tr>
                            <td><code>xiaomi/mimo-v2.5-pro</code></td>
                            <td>Multimodal</td>
                        </tr>

                        {/*
                        <!-- ========================================== -->
                        <!-- --- TEXT ONLY SPECIALISTS ---------------- -->
                        <!-- ========================================== -->
                        */}
                        <tr>
                            <td><code>z-ai/glm-5</code></td>
                            <td>Text Only</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <h3 className="text-md font-medium text-slate-700 dark:text-slate-300 mt-6 mb-2">Free Tier</h3>
            <div className="overflow-x-auto">
                <table>
                    <thead>
                        <tr>
                            <th>Model Name</th>
                            <th>Description</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/*
                        <!-- ========================================== -->
                        <!-- --- MULTIMODAL CAPABLE MODELS ------------ -->
                        <!-- ========================================== -->
                        */}
                        <tr>
                            <td><code>google/gemma-4-31b-it:free</code></td>
                            <td>Multimodal</td>
                        </tr>
                        <tr>
                            <td><code>moonshotai/kimi-k2.6:free</code></td>
                            <td>Multimodal</td>
                        </tr>

                        {/*
                        <!-- ========================================== -->
                        <!-- --- TEXT ONLY SPECIALISTS ---------------- -->
                        <!-- ========================================== -->
                        */}
                        <tr>
                            <td><code>qwen/qwen3-coder:free</code></td>
                            <td>Text Only</td>
                        </tr>
                        <tr>
                            <td><code>z-ai/glm-4.5-air:free</code></td>
                            <td>Text Only</td>
                        </tr>
                    </tbody>
                </table>
            </div>

        </DocPage>
    )
}
