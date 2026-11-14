export const searchIndex = [
    // Overview
    {
        title: 'Introduction',
        path: '/',
        section: 'introduction',
        keywords: ['fluxflow', 'intro', 'overview', 'about', 'concept', 'vision'],
        description: 'Overview of the FluxFlow high-fidelity agentic terminal.'
    },
    {
        title: 'Why FluxFlow?',
        path: '/',
        section: 'why-fluxflow',
        keywords: ['features', 'benefits', 'multimodal', 'ide', 'advantages'],
        description: 'Key features and unique selling points of FluxFlow.'
    },
    {
        title: 'Dual-Intelligence System',
        path: '/',
        section: 'dual-intelligence',
        keywords: ['flux', 'flow', 'modes', 'intelligence', 'performance', 'latency'],
        description: 'Understanding Flux (Dev) and Flow (Chat) operating modes.'
    },
    {
        title: 'Digital Fortress Governance',
        path: '/',
        section: 'security',
        keywords: ['security', 'governance', 'sandbox', 'permissions', 'safety', 'privacy'],
        description: 'Security boundaries and sandbox settings.'
    },

    // Getting Started
    {
        title: 'Getting Started',
        path: '/getting-started',
        section: 'getting-started',
        keywords: ['start', 'begin', 'setup', 'tutorial', 'onboarding'],
        description: 'Quick start guide to get FluxFlow running.'
    },
    {
        title: 'Prerequisites',
        path: '/getting-started',
        section: 'prerequisites',
        keywords: ['requirements', 'node', 'npm', 'keys', 'dependency'],
        description: 'Hardware and software requirements for FluxFlow.'
    },
    {
        title: 'Installation Options',
        path: '/getting-started',
        section: 'installation',
        keywords: ['install', 'setup', 'npx', 'global', 'download'],
        description: 'How to install FluxFlow via npx or npm.'
    },
    {
        title: 'The First Run',
        path: '/getting-started',
        section: 'first-run',
        keywords: ['config', 'setup', 'initialize', 'api key', 'provider'],
        description: 'Initial configuration and integrity checks.'
    },

    // Startup Arguments
    {
        title: 'Startup Arguments',
        path: '/startup-args',
        section: 'startup-arguments',
        keywords: ['cli', 'flags', 'parameters', 'arguments', 'launch', 'options'],
        description: 'Customizing sessions via terminal launch commands.'
    },
    {
        title: 'Core Settings Flags',
        path: '/startup-args',
        section: 'core-settings',
        keywords: ['mode', 'resume', 'deletion'],
        description: 'CLI flags for mode, session resumption, and log deletion.'
    },
    {
        title: 'Security Permissions Flags',
        path: '/startup-args',
        section: 'security-permissions',
        keywords: ['yolo', 'auto-exec', 'external', 'permissions'],
        description: 'Controlling agent autonomy from the command line.'
    },

    // App Commands
    {
        title: 'App Commands',
        path: '/app-commands',
        section: 'app-commands',
        keywords: ['slash', 'commands', 'in-app', 'terminal commands'],
        description: 'Rich set of slash commands available within the chat.'
    },
    {
        title: 'Session Management Commands',
        path: '/app-commands',
        section: 'session-management',
        keywords: ['clear', 'save', 'resume', 'chats', 'export', 'revert'],
        description: 'Commands for managing chat history and codebase state.'
    },
    {
        title: 'Agent Control Commands',
        path: '/app-commands',
        section: 'agent-controls',
        keywords: ['mode', 'thinking', 'depth', 'key', 'api key', 'model'],
        description: 'Dynamically adjusting agent behavior and reasoning.'
    },

    // API Keys
    {
        title: 'API Keys & Providers',
        path: '/api-keys',
        section: 'api-keys',
        keywords: ['key', 'keys', 'api key', 'vault', 'slots', 'provider', 'apikey'],
        description: 'Managing API keys in the 10-slot per-provider vault.'
    },
    {
        title: '/key use --null',
        path: '/api-keys',
        section: 'key-null',
        keywords: ['null', 'no key', 'keyless', 'localhost', 'ollama', 'no api key'],
        description: 'Send no API key at all for local endpoints (custom / Ollama).'
    },
    {
        title: '/key add',
        path: '/api-keys',
        section: 'key-add',
        keywords: ['add key', 'new key', 'index', 'url', 'endpoint'],
        description: 'Add a key to the first empty slot or a specific slot.'
    },
    {
        title: '/key use',
        path: '/api-keys',
        section: 'key-use',
        keywords: ['use key', 'switch key', 'active key', 'temp'],
        description: 'Switch the active key, or use a temporary session key.'
    },
    {
        title: 'Custom Endpoints & --url',
        path: '/api-keys',
        section: 'custom-endpoints',
        keywords: ['custom', 'openai', 'localhost', 'base url', 'url', 'compatible'],
        description: 'Point the custom provider at any OpenAI-compatible endpoint.'
    },

    // Architecture
    {
        title: 'Architecture & Design',
        path: '/architecture',
        section: 'architecture-design',
        keywords: ['tech', 'stack', 'internal', 'how it works', 'engine'],
        description: 'Technical deep-dive into FluxFlow internals.'
    },
    {
        title: 'The Agentic Loop',
        path: '/architecture',
        section: 'agentic-loop',
        keywords: ['reasoning', 'loop', 'cycle', 'stream', 'protocol'],
        description: 'How the AI agent processes context and executes tools.'
    },
    {
        title: 'IDE Bridge',
        path: '/architecture',
        section: 'ide-bridge',
        keywords: ['vscode', 'extension', 'companion', 'websocket', 'bridge'],
        description: 'Real-time synchronization between CLI and Editor.'
    },

    // Tools
    {
        title: 'Tools & Capabilities',
        path: '/tools',
        section: 'tools-capabilities',
        keywords: ['tools', 'functions', 'capabilities', 'actions'],
        description: 'Comprehensive list of agent capabilities.'
    },
    {
        title: 'Tool Protocol',
        path: '/tools',
        section: 'protocol',
        keywords: ['syntax', 'format', 'call', 'dispatch'],
        description: 'The string-based protocol used for tool execution.'
    },
    {
        title: 'Workspace Tools',
        path: '/tools',
        section: 'workspace-tools',
        keywords: ['read', 'write', 'patch', 'file', 'run', 'search', 'todo'],
        description: 'Local development and file system interaction tools.'
    },
    {
        title: 'Creative Tools',
        path: '/tools',
        section: 'creative-tools',
        keywords: ['pdf', 'docx', 'word', 'image', 'generation'],
        description: 'Tools for generating professional documents and assets.'
    },

    // Stable Models
    {
        title: 'Stable Models',
        path: '/models',
        section: 'stable-models',
        keywords: ['models', 'providers', 'ai', 'llm', 'list'],
        description: 'Supported AI models categorized by provider.'
    },
    {
        title: 'Google Gemini Models',
        path: '/models',
        section: 'google-gemini',
        keywords: ['gemini', 'gemma', 'flash', 'pro', 'google'],
        description: 'High-performance native Google models.'
    },
    {
        title: 'OpenRouter Models',
        path: '/models',
        section: 'openrouter',
        keywords: ['claude', 'gpt', 'mistral', 'openrouter', 'free tier'],
        description: 'Access to a massive ecosystem of AI models.'
    },

    // Parser (Fidelity)
    {
        title: 'Parser (Fidelity)',
        path: '/parser',
        section: 'fidelity-parser',
        keywords: ['parser', 'fidelity', 'dsl', 'tool calling', 'signal', 'arguments', 'parseargs'],
        description: 'Fidelity — the parser for FluxFlow\'s custom DSL-based tool-calling format.'
    },
    {
        title: 'Fidelity Version History',
        path: '/parser',
        section: 'v35-streaming',
        keywords: ['v1', 'v2', 'v3', 'heuristic', 'streaming', 'strict quote', 'unescape'],
        description: 'Evolution of Fidelity from regex matcher to streaming-aware heuristic parser.'
    },

    // Common Natural Language Mappings
    {
        title: 'How to install',
        path: '/getting-started',
        section: 'installation',
        keywords: ['how to install', 'get fluxflow', 'setup guide', 'installation'],
        description: 'Direct link to installation instructions.'
    },
    {
        title: 'How to switch modes',
        path: '/app-commands',
        section: 'agent-controls',
        keywords: ['switch mode', 'change mode', 'flux to flow', '/mode'],
        description: 'Commands for toggling between Flux and Flow modes.'
    },
    {
        title: 'How to use tools',
        path: '/tools',
        section: 'protocol',
        keywords: ['use tools', 'run tools', 'how tools work'],
        description: 'Understanding the tool execution protocol.'
    },
    {
        title: 'How does tool calling work',
        path: '/parser',
        section: 'fidelity-parser',
        keywords: ['how does tool calling work', 'tool call format', 'tool syntax', 'custom dsl', 'signal format'],
        description: 'The custom DSL tool-calling format and its parser (Fidelity).'
    },
    {
        title: 'How to write documentation pages',
        path: '/architecture',
        section: 'docpage',
        keywords: ['write docs', 'add a page', 'documentation guide', 'new page', 'docpage component'],
        description: 'How documentation pages are structured using DocPage.'
    },
    {
        title: 'Where are the commands',
        path: '/app-commands',
        section: 'command-list',
        keywords: ['commands list', 'slash commands', 'what commands exist', 'command reference'],
        description: 'Full reference of application commands.'
    },
    {
        title: 'How to configure the project',
        path: '/getting-started',
        section: 'configuration',
        keywords: ['configure', 'config file', 'settings', 'environment variables', 'customize'],
        description: 'Configuration options and environment setup.'
    },
    {
        title: 'How to fix parsing errors',
        path: '/parser',
        section: 'v3-fidelity',
        keywords: ['parsing errors', 'parse fail', 'unescaped quotes', 'malformed arguments', 'fix tool call'],
        description: 'How Fidelity handles malformed tool-call arguments.'
    },
    {
        title: 'What is streaming',
        path: '/parser',
        section: 'v35-streaming',
        keywords: ['what is streaming', 'partial args', 'live parsing', 'peek', 'strict quote keys'],
        description: 'Streaming-aware parsing and strict-quote extraction in Fidelity v3.5.'
    },
    {
        title: 'Where is the sidebar defined',
        path: '/architecture',
        section: 'navigation',
        keywords: ['sidebar', 'navigation menu', 'add nav link', 'nav structure'],
        description: 'Where and how the docs sidebar navigation is defined.'
    },
    {
        title: 'How to add a route',
        path: '/architecture',
        section: 'routing',
        keywords: ['add route', 'react router', 'new route', 'routing setup'],
        description: 'Registering new page routes in the app.'
    },
    {
        title: 'What version is FluxFlow',
        path: '/getting-started',
        section: 'overview',
        keywords: ['version', 'latest version', 'changelog', 'release', '5.6.2'],
        description: 'Current FluxFlow version and release info.'
    },
    {
        title: 'How to search the docs',
        path: '/getting-started',
        section: 'overview',
        keywords: ['search', 'find docs', 'search bar', 'look up'],
        description: 'Using the documentation search feature.'
    }
];
