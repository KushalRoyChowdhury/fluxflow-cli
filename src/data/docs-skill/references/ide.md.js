// Export ide.md content to string
export const IDE_MD = `# Fluxflow IDE Companion

## WebSocket Bridge Protocol
* Local Bridge → Runs on ws://localhost:56832 connecting FluxFlow CLI with the companion editor extension
* Bi-directional Handshake → Exchanges CLI version, process PID/PPID, and editor capabilities on connection

## Real-Time Context Awareness
* User Turn Context → Injected dynamically on every prompt turn:
  * file_focused → Active editor tab currently visible
  * opened_editors → List of all open file tabs in workspace
  * cursor_line & selected → Exact cursor line number and selected text snippet
  * manual_edits → User manual modifications since last turn
* Agentic Turn JIT Awareness → Re-evaluates open file context, diagnostics, and linter error state after each tool call to catch compiler/linter issues immediately

## Editor Actions & Visual Feedback
* File Focus → Automatically opens edited files in active IDE window
* Diff Preview → Streams side-by-side or inline diff highlights (showDiff, highlightDiff) directly in editor
* Status Bar Sync → Real-time agent status (thinking, running tool, awaiting input) reflected in IDE status bar
`;
