# 🧰 Agent Tools & Capabilities

Flux Flow provides a robust set of tools that allow the AI to interact with the file system, execute code, and search the web. The availability of these tools depends on the active operating mode.

## Tool Availability by Mode

| Tool Category | Flux Mode (Dev) | Flow Mode (Chat) |
| :--- | :---: | :---: |
| **Communication (Ask)** | ✅ | ✅ |
| **Web Search & Scrape** | ✅ | ✅ |
| **File System (Read/Write)** | ✅ | ❌ |
| **Terminal Execution** | ✅ | ❌ |
| **Search Keyword** | ✅ | ❌ |
| **File Map** | ✅ | ❌ |
| **Todo (Planning)** | ✅ | ❌ |
| **Creative (PDF/DOCX/Image)** | ❌ | ✅ |

---

## Tool Protocol

FluxFlow uses a transparent, string-based protocol for tool dispatching:
`[[tool:functions.ToolName(arg1="value", arg2=123)]]`

---

## Communication Tools

### `Ask`
- **Purpose**: Ambiguity Resolution.
- **Triggers**: Mandatory for Path Divergence, Security concerns, or Risk Mitigation.
- **Usage**: Suggests up to 4 best options; does not ask for open-ended preferences.

---

## Web Tools

### `WebSearch`
- **Purpose**: Proactive search for unknown topics.
- **Limit**: 3-10 results.

### `WebScrape`
- **Purpose**: Deep-dive research into specific webpages, documentation, or APIs.

---

## Workspace Tools (Flux Mode Only)

### `ReadFile`
- **Purpose**: Reads file content with support for line ranges.
- **Multimodal**: Supports images and documents.

### `FileMap`
- **Purpose**: Shows file structure, dependencies, functions, and variable maps. More token-efficient than ReadFile.

### `ReadFolder`
- **Purpose**: Provides detailed directory statistics.

### `PatchFile` (UpdateFile)
- **Purpose**: Surgical patching of code.
- **Usage**: Supports multiple patches in a single call to prevent spam. MUST VERIFY DIFF.

### `WriteFile`
- **Purpose**: Creates or overwrites files.
- **Safety**: Prefers PatchFile if the file already exists.

### `SearchKeyword`
- **Purpose**: Global project search for definitions or logic.

### `Run` (exec_command)
- **Purpose**: Runs shell commands (PowerShell/CMD on Windows, Bash on Unix).
- **Safety**: Restricted to workspace directory unless explicitly allowed. Irreversible operations require user approval.

### `Todo`
- **Purpose**: Manages an internal task list (`todo.md`) to keep goals consistent during long tasks.
- **Methods**: `create`, `append`, `check`.

---

## Creative Tools (Flow Mode Only)

### `WritePDF`
- **Purpose**: Generates high-fidelity, branded PDF documents from HTML/CSS.

### `WriteDoc`
- **Purpose**: Creates professional Word documents (.docx).

### `GenerateImage`
- **Purpose**: Creates high-fidelity images via AI.

---

## Memory Management

Managed primarily by the background **Janitor** model to maintain persistent user context and session summaries without bloating the reasoning loop.
