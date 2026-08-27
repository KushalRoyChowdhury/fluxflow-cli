// Export modes.md content to string
export const MODES_MD = `# FluxFlow Operating Modes

## Modes Overview
* [Flux] (Workspace / Dev) → Primary coding & workspace agent
* [Flow] (Studio / Creative) → Web research & formatted document authoring (PDF / DOCX)
* [ICU] (Computer Use) → Autonomous GUI & OS desktop automation
* [FluxCU] (Omni) → Unified full-stack agent (Workspace Dev + Computer Use + Web)

## Tool Availability
* File Operations: \`ReadFile\`, \`PatchFile\`, \`WriteFile\`, \`ReadFolder\`, \`CodeSearch\` → [Flux] | [FluxCU]
* Terminal Execution: \`Run\` → [Flux] | [FluxCU]
* Task Management: \`Todo\` → [Flux] | [FluxCU]
* Sub-Agents: \`InvokeSync\`, \`Invoke\`, \`Await\`, \`GetProgress\`, \`Steer\`, \`Cancel\` → [Flux] | [FluxCU]
* Checkpoint Recovery: \`EmergencyRollback\` → [Flux] | [FluxCU]
* Web & Research: \`WebSearch\`, \`WebScrape\` → [Universal]
* User Inquiry: \`AskUser\` → [Universal]
* Document Creation: \`WritePDF\`, \`WriteDoc\` → [Flow]
* GUI & Desktop Automation: \`Click\`, \`Drag\`, \`Scroll\`, \`KeyboardTyping\`, \`KeyPress\`, \`RecaptureScreen\` → [ICU] | [FluxCU]
`;
