# Avocat Francophone – Agent Builder Checklist

Use this checklist while importing the JSON artefact into the Agent Platform. Update the placeholders once the agent is deployed.

| Item | Value / Notes |
| --- | --- |
| Agent ID | `TODO` |
| Environment | `dev / staging / prod` |
| Vector Store Resource ID | `TODO` (`OPENAI_VECTOR_STORE_AUTHORITIES_ID`) |
| Web Search Provider | `TODO` (Bing / Platform default) |
| Guardrail Bundle – France Judge Analytics | `TODO` (bundle ID / version) |
| Guardrail Bundle – OHADA Compliance | `TODO` |
| Evaluation Suite | `TODO` (scenario IDs once created) |
| Observability Dashboard | `TODO` (link to OpenAI request-tag dashboard) |
| Responsible Owner | `TODO` |
| Import Date | `TODO` |

## Validation Steps
1. Run sample IRAC prompt (FR civil liability) – verify citations and compliance banners.
2. Trigger OHADA scenario – confirm tool budget adjustments and guardrail response.
3. Execute file search query referencing authorities vector store – ensure hosted tool connectivity.
4. Review Agent Platform telemetry – confirm `OpenAI-Request-Tags` propagate (`service=api,component=backend`).

Document any deviations or hotfixes in `docs/agents/platform-migration.md` after deployment.
