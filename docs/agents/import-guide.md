# Agent Builder Import Guide (Avocat Francophone)

## Prerequisites
- OpenAI Agent Platform access with permission to create/edit agents.
- Export artefact produced by CI (`apps/dist/platform/avocat-francophone.json`).
- Vector store ID for authorities corpus (env `OPENAI_VECTOR_STORE_AUTHORITIES_ID`).
- Guardrail policy bundle/version IDs (France analytics, OHADA compliance).

## Import Steps
1. Download the latest artefact from the `Export Agent Definition` workflow (GitHub Actions artefact `agent-avocat-francophone`).
2. In Agent Builder, create a new agent and choose **Import JSON**. Select the downloaded file.
3. Confirm instructions and tool descriptions.
4. Map hosted tools:
   - `file_search` → Select existing vector store (Authorities). If not listed, register via Resource tab using the vector store ID.
   - `web_search` → enable Microsoft Bing or platform default search as per policy.
5. Add custom tools (they are informational in JSON). For each custom tool, attach the relevant MCP endpoint or internal API once orchestration is built.
6. Associate guardrail policy bundles: France Judge Analytics blocker, Compliance summarisation guardrails.
7. Save as draft, run test prompts (sample scenarios from inventory). Once satisfied, publish to the desired environment.

### JSON Field Mapping

| JSON Field | Agent Builder Section | Notes |
| --- | --- | --- |
| `name` | Agent metadata → Name | Use `avocat-francophone` (or environment-specific variant). |
| `description` | Agent metadata → Description | Copy verbatim to maintain context for stakeholders. |
| `instructions` | Prompt / System instructions | Paste into the system prompt editor. |
| `hostedTools` | Tools → Hosted | Tick `File Search` and `Web Search`, then configure resources. |
| `tools` (custom) | Tools → External / MCP | Create entries referencing internal MCP endpoints once available. |
| `resources.vectorStoreEnv` | Resources → Vector stores | Resolve environment variable to the actual vector store resource in the platform. |

### Example Configuration Walkthrough
1. **Details Tab**: Set Name = *Avocat Francophone*, Description copied from JSON, Purpose = *Legal research (FR/OHADA)*, Visibility = as required by deployment environment.
2. **Instructions Tab**: Use the imported instructions; append environment-specific compliance reminders if needed.
3. **Tools Tab**: Enable `File Search` → link to Authorities vector store; enable `Web Search` with restricted allowlist; add placeholders for custom tools pointing to future MCP endpoints.
4. **Guardrails Tab**: Attach compliance bundles (France analytics, OHADA acknowledgements). Note guardrail version for audits.
5. **Resources Tab**: Confirm vector store association and add placeholders for future datasets (e.g. finance tax corpus) if known.

Record the generated Agent ID and resource IDs; update `docs/agents/platform-migration.md` once the agent is live.

## Post-Import
- Update `docs/agents/platform-migration.md` with resource IDs and policy bundle names.
- Roll out ChatKit session integration referencing the new agent ID.
- Enable evaluations/red-team runs from Agent Platform UI.
