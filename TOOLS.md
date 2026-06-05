# 🧰 Agent Tools & Capabilities

Flux Flow provides a robust set of tools that allow the AI to interact with the file system, execute code, and search the web. The availability of these tools depends on the active operating mode.

## Tool Availability by Mode

| Tool | Flux Mode (Dev) | Flow Mode (Chat) |
| :--- | :---: | :---: |
| **Web Search** | ✅ | ✅ |
| **Web Scrape** | ✅ | ✅ |
| **Generate Image** | ✅ | ❌ |
| **Write PDF** | ✅ | ❌ |
| **Write DOCX** | ✅ | ❌ |
| **View/Read Files** | ✅ | ❌ |
| **Write/Update Files** | ✅ | ❌ |
| **Execute Commands** | ✅ | ❌ |
| **Search Keyword** | ✅ | ❌ |

---

## Core Tools

### 🌐 Web & Research
- **`WebSearch`**: Uses DuckDuckGo to find up-to-date information on the internet. Crucial for answering questions about recent events or unlearned documentation.
- **`WebScrape`**: Extracts the detailed text content from a specific URL, allowing the agent to read documentation or articles.

### 📄 Document Engineering (The Office Suite)
- **`WritePDF`**: Generates high-fidelity, branded PDF documents from HTML/CSS. Features automatic watermarking and page-aware layout management.
- **`WriteDOCX`**: Generates professional Word documents (.docx) from HTML. Supports multi-page layouts, automatic page numbering, and native styling.

### 🎨 Creative & Visual
- **`GenerateImage`**: Generates high-fidelity images using Pollinations AI.
  - **Customization**: Supports customizable models (Flux, ZImage, Qwen, Nanobanana-Pro, etc.), aspect ratios, custom prompt generation, and random seeds.
  - **Telemetry**: Tracks hourly credit usage (Low, Medium, Ultra, Premium tiers) with built-in daily limit checks and interactive dashboard displays.

### 📁 File System Operations
- **`ListFiles`**: Lists the contents of a directory to help the agent understand the project structure.
- **`ReadFolder`**: Provides detailed statistics and metadata about a directory's contents.
- **`ViewFile`**: Reads the content of a file.
  - **Native Multimodality**: Supports analyzing images (JPG, PNG, WEBP) and PDF documents. The tool automatically detects binary formats and encodes them for AI analysis.
  - **Text Reading**: Supports specific line ranges (`start_line`, `end_line`) to manage context size efficiently.
- **`SearchKeyword`**: Performs a global project search for a specific string or keyword. Returns file paths and line numbers where matches are found, making it essential for navigation and impact analysis.

### ✍️ Code Editing
- **`WriteFile`**: Creates a new file or completely overwrites an existing one with new content.
- **`UpdateFile` (Smart Patching)**: Surgically replaces a specific block of text within a file.
  - *Diff Generation*: It returns a high-fidelity visual diff (Red/Green changes with context lines) to the UI, allowing the user to see exactly what the agent modified.

### 💻 Terminal Execution
- **`Run`**: Runs a shell command directly in the terminal using Node's `child_process.spawn` or `node-pty` when available.
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