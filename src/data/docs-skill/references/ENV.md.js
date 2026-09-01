// Export ENV.md content to string
export const ENV_MD = `# Env Variables

* Locations:
  * Shell
  * Global: ~/.fluxflow/.env.fluxflow | ~/.fluxflow/.env.agents
  * Workspace: ./.env.fluxflow | ./.env.agents

## Core Variables
* SUBAGENT_MODEL → Model override for sub-agents
* SUBAGENT_PROVIDER → Provider override for sub-agents
* NVIDIA_BASE_URL → Custom endpoint URL for NVIDIA NIM (Cloud/Local OpenAI Compatible)
* NVIDIA_API_KEY → API key for NVIDIA NIM
* OLLAMA_HOST → Custom Ollama endpoint (default: http://127.0.0.1:11434)
* SHELL → Terminal shell executable
* HIGH_CONTEXT → Context window override (false or integer 32k..1M)
* ENABLE_9ROUTER → Enable 9Router provider. Local proxy for using other providers & OAuth subscription like Codex, Claude Code, GitHub Copilot etc
* 9ROUTER_BASE_URL → 9Router base URL

## Diagnostic & Optimization Flags
* SHOW_DEBUG_GRID → (true|false, default: false) Coordinate grid overlay for Computer Use tooling
* DEBUG_OCR → (true|false, default: false) Enables verbose OCR diagnostic logs
* EXPERIMENTAL_MEMORY_MANAGER → (true|false, default: false) Reduces app memory footprint, slower boot times

* NO_DEV → (true|false, default: false) Token optimization flag; strips developer metadata and docs to maximize context headroom

* I_HAVE_TOO_MUCH_MONEY → (true|false, default: false) Fun Flag; inserts random padding in system prompt to break provider caching. Not intended for paid APIs unless user hate money
* GOOGLE_GEMMA_NONSENSE → (true|false, default: false) for the 16k TPM nonsense of gemma models on gemini API. False defaults to 256k
`;
