// Export plugins.md content to string
export const PLUGINS_MD = `# Fluxflow Instructions & Skills System

## 1. Instructions (AGENTS.md / FLUXFLOW.md)
* Locations:
  * Global: ~/.fluxflow/FLUXFLOW.md | ~/.fluxflow/AGENTS.md
  * Workspace: ./FLUXFLOW.md | ./AGENTS.md | Directory Scoped like src/AGENTS.md
* Auto indexed on boot

### Conditional Model & Provider Instructions (use /target command to get provider name & model-id)
You can scope instructions conditionally to specific providers, model IDs, or unique provider::model combinations using XML tags:
> Conditionals will only work in FLUXFLOW.md. AGENTS.md will be read as raw Markdown. Any prose outside valid conditionals in FLUXFLOW.md will be ignored

1. Unique Target (Provider + Model):
<start_model_google::gemini-2.5-flash>
Specific instruction for Gemini 2.5 Flash when served by Google.
<end_model_google::gemini-2.5-flash>

2. Model-Specific (Any Provider):
<start_model_gemini-2.5-flash>
Instruction for this model ID across all providers.
<end_model_gemini-2.5-flash>

3. Provider Scoping & Grouping:
<start_provider_google>
  <!-- General provider instruction -->
  <start_model_gemini-2.5-pro>
  Deep architectural reasoning steps.
  <end_model_gemini-2.5-pro>
<end_provider_google>

* Case-insensitive matching.
* Unmatched blocks are completely skipped; matched blocks have their tags stripped and contents included.

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
