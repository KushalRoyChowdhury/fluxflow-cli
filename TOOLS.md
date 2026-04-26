# 🧰 Agent Tools & Capabilities

Flux Flow provides a robust set of tools that allow the AI to interact with the file system, execute code, and search the web. The availability of these tools depends on the active operating mode.

## Tool Availability by Mode

| Tool | Flux Mode (Dev) | Flow Mode (Chat) |
| :--- | :---: | :---: |
| **Web Search** | ✅ | ✅ |
| **Web Scrape** | ✅ | ✅ |
| **View/Read Files** | ✅ | ❌ |
| **Write/Update Files** | ✅ | ❌ |
| **Execute Commands** | ✅ | ❌ |

---

## Core Tools

### 🌐 Web & Research
- **`web_search`**: Uses DuckDuckGo to find up-to-date information on the internet. Crucial for answering questions about recent events or unlearned documentation.
- **`web_scrape`**: Extracts the detailed text content from a specific URL, allowing the agent to read documentation or articles.

### 📁 File System Operations
- **`list_files`**: Lists the contents of a directory to help the agent understand the project structure.
- **`read_folder`**: Provides detailed statistics and metadata about a directory's contents.
- **`view_file`**: Reads the content of a file. Supports reading specific line ranges (`start_line`, `end_line`) to manage context size efficiently.

### ✍️ Code Editing
- **`write_file`**: Creates a new file or completely overwrites an existing one with new content.
- **`update_file` (Smart Patching)**: Surgically replaces a specific block of text within a file.
  - *Diff Generation*: It returns a high-fidelity visual diff (Red/Green changes with context lines) to the UI, allowing the user to see exactly what the agent modified.

### 💻 Terminal Execution
- **`exec_command`**: Runs a shell command directly in the terminal using Node's `child_process.spawn`.
  - *Context Aware*: Runs in the current working directory.
  - *Cross-Platform*: Uses `shell: true` to handle Windows `.cmd`/`.bat` files natively.

---

## Memory Management

The memory tool (`memory.js`) is primarily used by the background **Janitor** model, but can be accessed by the main agent if necessary.

- **Temporary Context (`action='temp'`)**: Saves a rolling summary of the current session to maintain conversational context without bloating the main prompt history.
- **Persistent User Memory (`action='user'`)**:
  - The Janitor analyzes conversations to detect user preferences, hobbies, or instructions.
  - It uses `add`, `update`, or `delete` methods to manage facts in the encrypted `memories.json` vault.
  - These memories are injected into the system prompt of *future* sessions, allowing Flux Flow to learn and adapt to the user over time.