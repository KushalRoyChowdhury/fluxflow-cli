// Export providers.md content to string
export const PROVIDERS_MD = `# FluxFlow Inference Providers & Setup

## Supported Providers
* Direct: Gemini (aistudio.google.com) | NVIDIA NIM (build.nvidia.com) | DeepSeek (platform.deepseek.com) | Mistral (admin.mistral.ai) | Ollama (ollama.com) | CrofAI (crof.ai) | InferX (model.inferx.net) | SenseNova (platform.sensenova.ai)
* Aggregators: OpenRouter (openrouter.ai) | AIHubMix (aihubmix.com)

* Fluxflow has default model list for many providers, updated based on vibes. Can be overriden using \`/model <model-id>\`

## Setup: Local NVIDIA NIM (OpenAI-Compatible)
1. Environment Variables (\`.fluxflow.env\` or shell):
   * \`NVIDIA_BASE_URL\` = \`http://<host>:<port>/v1/chat/completions\` (or custom endpoint)
   * \`NVIDIA_API_KEY\` = Optional API key (if NIM container requires authentication)
2. Switch Provider: Select \`NVIDIA\` in \`/settings → Providers\`
3. Select Model: \`/model <model_name>\`
* Note: Memory agent is automatically disabled on custom/local endpoints & few providers

## Setup: Ollama (Local / Cloud)
1. Endpoint & Authentication:
   * Local: Set API Key to \`LOCAL\` in \`/settings → Providers\` or on key prompt
   * Endpoint URL: Default is \`http://127.0.0.1:11434\` (Override via \`OLLAMA_HOST\`)
2. Model Selection:
   * Standard: \`/model <model-id>\`
   * Multimodal (Vision): \`/model <model-id> -m\`
3. Context Window Override:
   * Set \`HIGH_CONTEXT=<tokens>\` in \`.fluxflow.env\` (range: \`32k\` to \`1M\`)
`;
