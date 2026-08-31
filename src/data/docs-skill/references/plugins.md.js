// Export plugins.md content to string
export const PLUGINS_MD = `# Fluxflow Instructions & Skills System

## 1. Instructions
* Locations:
  * Global: ~/.fluxflow/FLUXFLOW.md | ~/.fluxflow/AGENTS.md
  * Workspace: ./FLUXFLOW.md | ./AGENTS.md
* Auto indexed on boot

## 2. Skills System
* Locations:
  * Global: ~/.fluxflow/skills/**/SKILL.md
  * Workspace: ./skills/**/SKILL.md | ./SKILL.md

* Format:
  * YAML Frontmatter: --- block with name and description
  * Body: Markdown Instructions/Workflows

* On-Demand Reference Loading:
  * Reference: Offload deep/contexual specs to references/*.md linked from root SKILL.md. Saves tokens
`;
