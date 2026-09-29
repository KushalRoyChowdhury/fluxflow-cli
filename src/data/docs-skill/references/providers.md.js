// Export providers.md content to string
export const PROVIDERS_MD = `# FluxFlow AI Providers & Setup

## Supported Providers
* Gemini (aistudio.google.com) | NVIDIA NIM (build.nvidia.com) | DeepSeek (platform.deepseek.com) | Mistral (admin.mistral.ai) | Ollama Local/Cloud (ollama.com) | InferX (inferx.net) | SenseNova (platform.sensenova.ai) | Poolside (platform.poolside.ai) | OpenRouter (openrouter.ai) | AIHubMix (aihubmix.com) | Experiential Labs (experientiallabs.ai) | TokenHarbor (tokenharbor.ai) | APInex (apinex.bond)
* Proxy: 9router. Can use OAuth subscription like Codex, Claude Code, GitHub Copilot etc. or any OpenAI/Anthropic API that FluxFlow dont have natively

## Switch Providers/Models:
* /model model-id --flags → Flags optional to customize list (--save, --remove, --default, /model old-model new-model --rename)
* /provider → Switch AI provider

## OpenRouter: Routing, Tiers & Model Variants
* Provider Routing: Append :provider. /model model-id:provider
* Service Tiers & Variants:
  * :flex|priority. flex = cheaper, priority = faster & expensive. /model openai/gpt-5:tier or /model openai/gpt-5:openai:tier
  * Variants :free, :nitro, :floor, :exacto

## Setup Local NVIDIA NIM (OpenAI-Compatible)
1. Environment Variables:
  * NVIDIA_BASE_URL = http://.../v1/chat/completions or custom openai endpoint, dot get fooled by BASE, its not
  * NVIDIA_API_KEY = If needed

## Setup Ollama (Local / Cloud)
1. Endpoint & Authentication:
  * Local: Set API Key to LOCAL in /settings → Providers or on key prompt
  * Endpoint URL: Default is http://127.0.0.1:11434 Override via OLLAMA_HOST

## Setup: 9Router
1. Install NPM Package (9router)
2. Set ENV ENABLE_9ROUTER=true
  * NINEROUTER_URL = https://.../v1/chat/completions Support external openai compatible endpoints too
  * NINEROUTER_KEY = If any needed
`;
