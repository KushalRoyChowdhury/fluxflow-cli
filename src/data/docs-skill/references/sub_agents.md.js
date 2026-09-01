// Export sub_agents.md content to string
export const SUB_AGENTS_MD = `# FluxFlow Sub-Agents & Multi-Agent Architecture

## Execution Modes
* InvokeSync → Synchronous blocking delegation; main agent halts until sub-agent finishes task
* Invoke → Asynchronous background delegation; spawns parallel worker
* Lifecycle Tools:
  * Await → Non-polling wait for completion
  * GetProgress → Query live logs & execution status
  * Steer → Inject dynamic instructions mid-flight
  * Cancel → Terminate running sub-agent

## Tool Sandboxing & Safety
* Sub-agents inherit isolated tool environments
* Destructive shell commands hard-blocked
* All file mutations tracked under parent session transaction

## Custom Model & Provider Setup
Route sub-agent workloads to faster/cheaper models independently of the main agent:

### 1. In-App Settings (/settings → Miscellaneous)
* Sub-Agents → ON | OFF
* Custom Sub-Agent Model:
  * SubAgentModel → Model name
  * SubAgentProvider → Provider

* Models are shown for providers whose API key is used before in fluxflow

### 2. Environment Variables for Custom Sub-Agent models (.env.fluxflow or Shell)
* SUBAGENT_MODEL → Target model override
* SUBAGENT_PROVIDER → Target provider override
* Setting SubAgentModel=ENV in settings pulls directly from environment overrides
`;
