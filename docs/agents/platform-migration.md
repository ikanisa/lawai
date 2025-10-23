# Agent Platform Migration Checklist

## CI / Automation
- [ ] Wire `pnpm ops:evaluate -- --ci` into nightly pipelines with `OPENAI_EVAL_AGENT_ID`, `OPENAI_EVAL_DATASET_MAP`, `EVAL_ORG_ID`, and `EVAL_USER_ID` so OpenAI Evals jobs gate releases and persist metrics back to Supabase (`agent_learning_jobs`).
- [ ] Run `pnpm --filter @apps/api export:agent` in CI and store `apps/dist/platform/avocat-francophone.json` as build artefact.
- [ ] Upload artefacts to S3/GCS or attach to release tags for Agent Builder import.
- [ ] Wire OpenAI request-tag metrics into Datadog dashboards (API/OPS/EDGE components) using `OpenAI-Request-Tags` headers.
- [ ] Schedule nightly Agent Platform evaluations once workflows are imported (scenarios TBD).

## Agent Platform Setup
- [ ] Import `avocat-francophone` JSON into Agent Builder (see checklist) and record Agent ID.
- [ ] Register shared vector store (`OPENAI_VECTOR_STORE_AUTHORITIES_ID`) as a managed resource; capture its resource ID for future deployments.
- [ ] Review the [File Inputs (PDF) guide](./file-inputs-pdf.md) and confirm new artefacts are processed before platform registration.
- [ ] Configure guardrail bundles (France analytics, OHADA policies) and record version identifiers in the agent metadata checklist.
- [ ] Update observability dashboards with the new Agent ID/request tags (Datadog/Splunk links).

## ChatKit Integration
- [x] Implement Supabase schema migrations for sessions/messages/events.
- [x] Replace `apps/api/src/chatkit.ts` stub with ChatKit Session API calls (create/resume/cancel) and expose REST endpoints.
- [ ] Connect session lifecycle to frontend chat UI (buttons/task cards) and to the Agent orchestrator when live.
- [ ] Log session telemetry (OpenAI request tags + session metadata) for monitoring.

## MCP / Multi-Agent Readiness
- [ ] Define initial MCP topology (orchestrator agent + finance domain agents).
- [ ] Stub orchestrator routing rules aligning with finance playbooks (tax, audit, AP, CFO, risk).
- [ ] Map HITL reduction strategy: identify which tasks remain button-driven vs fully autonomous.

## Documentation
- [ ] Update `docs/runbooks/openai-foundation.md` with finance-specific guardrail mapping once Platform resources are applied.
- [ ] Create Agent Builder walkthrough (screenshots/config steps) for onboarding new team members.
- [ ] Publish ChatKit session contract (API + data schema) for frontend consumers.
- [ ] Review [File Inputs workflow](./pdf-inputs.md) alongside `/apps/api/src/routes/upload/` + `/apps/api/src/routes/corpus/data.ts` to confirm PDF intake parity and Supabase telemetry visibility after Agent Platform migration.
