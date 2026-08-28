// Export security.md content to string
export const SECURITY_MD = `# FluxFlow Security, Sandboxing & Safety

## Human-in-the-Loop Governance
* Execution Approval Gate → Destructive commands and high-risk file modifications require explicit user authorization (Allow / Deny)
* Safe Command Auto-Pass → Read-only queries (ls, pwd, git status, node -v) execute without interrupting flow

## Sandbox Presets (/settings → Security)
* Strict → autoExec: OFF | allowExternalAccess: OFF | networkAccess: OFF | destructive commands blocked | strict HITL on all actions
* Balanced → autoExec: ON (safe commands) | allowExternalAccess: OFF | networkAccess: ON | destructive commands blocked | manual git approval
* Autonomous (YOLO) → autoExec: ON | allowExternalAccess: ON | networkAccess: ON | auto-approves git commits | prompts only on extreme-risk commands

## Granular Command & Access Policies
* Command Filtering:
  * Always Ask Commands → Configurable list always prompting for confirmation
  * Auto Approve Commands → Whitelist of trusted commands executed automatically
  * Auto Disapprove Commands → Blacklist of forbidden commands instantly rejected
* Workspace Directory Lock → Restricts file read/write operations strictly to current CWD unless External Access: ON
* Terminal Network Isolation → Blocks outbound network sockets for spawned shell commands when networkAccess: OFF

## Recovery & Data Sanctuary
* Emergency Rollback → Automatic pre-turn file snapshots; Agent can still fix it (default: OFF) → \`references/SETTINGS.md\`
* Git-less Checkpoint Reversion → Trigger conversational changes rollback via double-ESC
* External Sanctuary Redirection → Move \`~/.fluxflow\` data sanctuary (chats, keys etc)
`;
