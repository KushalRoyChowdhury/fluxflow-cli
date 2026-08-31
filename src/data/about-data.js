import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
// Markdown Imports
import { STARTUP_MD } from './docs-skill/references/startup.md.js';
import { ENV_MD } from './docs-skill/references/ENV.md.js';
import { COMMANDS_MD } from './docs-skill/references/commands.md.js';
import { SETTINGS_MD } from './docs-skill/references/settings.md.js';
import { TOOLS_MD } from './docs-skill/references/tools.md.js';
import { ARCH_MD } from './docs-skill/references/arch.md.js';
import { SUB_AGENTS_MD } from './docs-skill/references/sub_agents.md.js';
import { SECURITY_MD } from './docs-skill/references/security.md.js';
import { IDE_MD } from './docs-skill/references/ide.md.js';
import { MODES_MD } from './docs-skill/references/modes.md.js';
import { PROVIDERS_MD } from './docs-skill/references/providers.md.js';
import { PLUGINS_MD } from './docs-skill/references/plugins.md.js';

// Version & Update Logic
let appVersion = 'v4';
try {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const candidatePaths = [
        path.join(currentDir, '../../package.json'),
        path.join(currentDir, '../package.json')
    ];

    let found = false;
    for (const pkgPath of candidatePaths) {
        if (fs.existsSync(pkgPath)) {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
            if (pkg.version) {
                appVersion = pkg.version;
                found = true;
                break;
            }
        }
    }

    if (!found) {
        try {
            const out = execSync('fluxflow -v', {
                encoding: 'utf8',
                windowsHide: true,
                stdio: ['ignore', 'pipe', 'ignore'],
                timeout: 2000
            }).trim();
            if (out && (out.startsWith('v') || /^\d+\.\d+/.test(out))) {
                appVersion = out;
                found = true;
            }
        } catch (cliErr) {}
    }

    if (!found) {
        try {
            const raw = execSync('curl -s --max-time 3 https://raw.githubusercontent.com/KushalRoyChowdhury/fluxflow-cli/main/package.json', {
                encoding: 'utf8',
                windowsHide: true,
                stdio: ['ignore', 'pipe', 'ignore']
            });
            const pkg = JSON.parse(raw);
            if (pkg.version) {
                appVersion = pkg.version;
            }
        } catch (netErr) {}
    }
} catch (e) {}

export const ABOUT_SKILL_MANIFEST = {

    // ====================================== SKILL.md ======================================

    'SKILL.md': `---
name: fluxflow
description: System Generated Documentation. Read this if asked anything regarding FluxFlow Harness (this app)
---

# FluxFlow, by Kushal Roy Chowdhury
Open Source Terminal AI Assistant
App Version: ${appVersion}. Check Updates: fluxflow --update check. Update: fluxflow --update
GitHub: https://github.com/KushalRoyChowdhury/fluxflow-cli
Documentation: https://fluxflow-cli.onrender.com

[tool:functions.SearchKeyword(keyword="regex/word", path="#docs")]. Usage: search any keyword across docs, avoid hunting excessive references

## Supported Features & Documentation References
* Operating Modes (Flux, Flow, CU, FluxCU) → references/MODES.md
* Inference Providers & Aggregators (Setup, Local NIM, Ollama) → references/PROVIDERS.md
* In-App Settings (/settings) → references/SETTINGS.md
* In-app /commands → references/COMMANDS.md
* CLI Startup Flags → references/STARTUP.md
* Environment Variables → references/ENV.md
* Tool System (Workspace, Web, Communication, Sub-Agents, Safety, Creative, Computer Use) → references/TOOLS.md
* Sub-Agents & Multi-Agent Runtime → references/SUB_AGENTS.md
* Security, Sandboxing & Checkpoints (/revert, double-ESC) → references/SECURITY.md
* IDE Companion Extension & Real-time Context → references/IDE.md
* Priority Instructions (AGENTS.md/FLUXFLOW.md) & Skill System → references/PLUGINS.md
* Agent Architecture & Memory System → references/ARCHITECTURE.md

Docs missing required info? Say you are not sure enough to answer. Dont give wrong info`,

    // ======================================= MODES.md ========================================

    'references/MODES.md': MODES_MD,

    // ===================================== PROVIDERS.md ======================================

    'references/PROVIDERS.md': PROVIDERS_MD,

    // ====================================== PLUGINS.md =======================================

    'references/PLUGINS.md': PLUGINS_MD,

    // ====================================== STARTUP.md =======================================

    'references/STARTUP.md': STARTUP_MD,

    // ======================================== ENV.md =========================================

    'references/ENV.md': ENV_MD,

    // ====================================== COMMANDS.md ======================================

    'references/COMMANDS.md': COMMANDS_MD,

    // ====================================== SETTINGS.md ======================================

    'references/SETTINGS.md': SETTINGS_MD,

    // ======================================= TOOLS.md ========================================

    'references/TOOLS.md': TOOLS_MD,

    // ===================================== ARCHITECTURE.md ====================================

    'references/ARCHITECTURE.md': ARCH_MD,

    // ======================================= SUB_AGENTS.md ====================================

    'references/SUB_AGENTS.md': SUB_AGENTS_MD,

    // ======================================== SECURITY.md =====================================

    'references/SECURITY.md': SECURITY_MD,

    // ========================================== IDE.md ========================================

    'references/IDE.md': IDE_MD
};
