// Export providers.md content to string
export const PROVIDERS_MD = `# FluxFlow AI Providers & Setup

## Supported Providers
* Gemini (aistudio.google.com) | NVIDIA NIM (build.nvidia.com) | DeepSeek (platform.deepseek.com) | Mistral (admin.mistral.ai) | Ollama Local/Cloud (ollama.com) | CrofAI (crof.ai) | InferX (inferx.net) | SenseNova (platform.sensenova.ai) | Poolside (platform.poolside.ai) | OpenRouter (openrouter.ai) | AIHubMix (aihubmix.com) | Experiential Labs (experientiallabs.ai) | TokenHarbor (tokenharbor.ai) | APInex (apinex.bond)
* Proxy: 9router. Can use OAuth subscription like Codex, Claude Code, GitHub Copilot etc. or any OpenAI/Anthropic API that FluxFlow dont have natively. Set ENV ENABLE_9ROUTER=true, needs 9router package installed (npm) & running

## OpenRouter: Routing, Tiers & Model Variants
* Model Syntax: /model model-id
* Provider Routing: Append :provider. /model model-id:provider
* Service Tiers & Variants:
  * :flex|priority. flex = cheaper, priority = faster & expensive. /model openai/gpt-5:tier or /model openai/gpt-5:openai:tier
  * Variants :free, :nitro, :floor, :exacto

## Setup: Local NVIDIA NIM (OpenAI-Compatible)
1. Environment Variables (.env.fluxflow or shell):
   * NVIDIA_BASE_URL = http://<host>:<port>/v1/chat/completions (or custom OpenAI endpoint)
   * NVIDIA_API_KEY = Optional API key (if NIM container requires authentication)
2. Switch Provider: Select NVIDIA in /settings → Providers
3. Select Model: /model <model_name>
* Memory agent is automatically disabled on custom/local & few providers endpoints

## Setup: Ollama (Local / Cloud)
1. Endpoint & Authentication:
   * Local: Set API Key to LOCAL in /settings → Providers or on key prompt
   * Endpoint URL: Default is http://127.0.0.1:11434 (Override via OLLAMA_HOST)
2. Model Selection:
   * Standard: /model <model-id>
   * Multimodal (Vision): /model <model-id> -m
3. Context Window Override:
   * Set HIGH_CONTEXT=<tokens> in ENV (range: 32k to 1M)
`;
