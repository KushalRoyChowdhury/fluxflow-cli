// Export arch.md content to string
export const ARCH_MD = `# Fluxflow Architecture

## 1. Terminal Engine
* Framework: React + Ink terminal UI
* Sub-Terminal: Live PTY shell bridge; TAB switches active keyboard focus
* OS Compatibility: Auto-detects pwsh, powershell, bash, cmd

## 2. Dual-Model Runtime
* Main Agent: Reasoning, code edits, and tool calls
* Memory Agent: Background context & preference synthesizer (fixed models; disable via /settings → Memory or use NIM API key)

## 3. Multi-Agent System
* Execution: Synchronous (InvokeSync) | Asynchronous (Invoke, ≤7 workers)
* Isolation: Restricted tool scope per subagent
* State Tracking: Mutations logged under parent task ledger

## 4. Security & Sandbox
* Approvals: HITL confirmation on destructive file/shell operations
* Modes: Strict | Balanced | Autonomous (YOLO)
* Recovery: Pre-turn snapshot indexing via EmergencyRollback

## 5. Computer Use Automation
* Vision: 720p normalized canvas, 4ms variance scan, Set-of-Marks (SoM) overlay
* OCR Alignment: Euclidean distance text matching to mark centers
* Hardware I/O: OS input dispatch via @nut-tree-fork/nut-js
* Memory Management: 2-turn sliding window with active V8 GC

## 6. IDE Bridge
* Protocol: WebSocket on ws://localhost:56832
* State Sync: Focused file, open tabs, cursor line, selection, diagnostics
`;
