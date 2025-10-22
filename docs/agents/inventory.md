# Agent Inventory & Platform Assessment

## Existing Agents

### Avocat Francophone (apps/api/src/agent.ts)
- **Purpose**: IRAC-based legal assistant focused on Francophone jurisdictions.
- **SDK Usage**: Implemented with `@openai/agents` (custom Agent instance, hosted file/web search tools, custom Zod-typed tools).
- **Custom Tools**: Jurisdiction routing, OHADA preemption, deadline estimator, limitation checker, interest calculator, binding-language validator, citation validator, redline diff, template generator, case alignment, snapshot capture.
- **Context Sources**: Supabase (case scores, policy versions, synonyms), OpenAI vector store (file search), local hybrid retrieval (`match_chunks` RPC).
- **Guardrails**: Allowlist output guardrail, policy checks (France analytics ban, compliance summaries), manual telemetry budgeting.
- **Current Gaps**:
  - Not registered in Agent Platform (no Agent Builder workflow, no hosted resource lifecycle, no policy bundle tracking).
  - No ChatKit session integration; deduplication uses custom `run_key` logic.
  - No Agent evaluation harness or red-team pipeline; manual tests only.
  - Hosted tools limited to file/web search; no code interpreter/datasets registered via platform.
  - Debugging logs recently added but not yet surfaced in dashboards.

## Missing Agents (Finance Suite Vision)
- **Tax Compliance Agent**: handles jurisdiction-specific tax research, filing requirements, audit responses.
- **Corporate Secretary Agent**: manages board resolutions, entity governance, regulatory submissions.
- **Audit & Assurance Agent**: automates evidence collection, walkthrough narratives, PBC tracking.
- **Accounts Payable Agent**: ingests invoices (OCR), categorises spend, drafts approvals, interacts with ERP.
- **CFO Strategy Agent**: synthesises financial KPIs, scenario planning, board presentations.
- **Risk & Controls Agent**: monitors control library, raises remediation tasks, coordinates with audit agent.
- **Regulatory Filings Agent**: orchestrates statutory filings, liaises with external portals, ensures deadlines.
- **Agent Orchestrator**: MCP-based coordinator to mediate agent collaboration, HITL reduction, and escalation policies.

## Platform Requirements vs Current State
| Capability | Current Implementation | Gap |
| --- | --- | --- |
| Agent Platform / Agent Builder | YAML/TS definitions only | Need to export builder workflow, versioning, deployment pipelines. |
| Hosted Resources | manual vector-store + Supabase | Register datasets, code interpreter, shared knowledge bases via platform. |
| ChatKit Sessions | Custom run dedupe | Implement ChatKit sessions, cancel/resume APIs for chat-first UX. |
| MCP Orchestration | None | Introduce MCP orchestrator for multi-agent workflows. |
| Realtime Voice | Stubbed endpoint | Build Realtime Calls gateway and UI integration. |
| Multimodal (vision/video) | Not implemented | Bring OCR + Sora 2 into finance scenarios. |
| Evaluations / Red-team | Manual unit tests | Leverage Agent Platform evaluations, nightly red-team scenarios. |
| Observability | Request tags/logging in place | Need dashboards in Datadog/Splunk per service/component. |
| Guardrails | Manual policy checks | Map guardrails to Agent Platform policy bundles with versioning. |

## Immediate Work Items (Phase 1 Preparation)
1. Export current agent definition to Agent Builder (document instructions, tools, guardrails).
2. Define shared resource inventory (vector stores, datasets, tools) for registration in Agent Platform.
3. Draft ChatKit session schema and lifecycle (creation, resume, cancel) ahead of implementation.
4. Identify evaluation scenarios per finance agent (taxonomy for later automation).
5. Establish environment variables and secret mappings for organisation/project-specific deployments.
6. Roll out the finance PDF ingestion pipeline using the [PDF file inputs rollout guide](./pdf-file-inputs.md); success requires ≥95% parse fidelity on the pilot corpus with no outstanding P0 compliance issues, owned by the Data Platform & Ingestion team.

## Prototype Artifacts
- `apps/api/scripts/export-agent-definition.ts` – generates a JSON stub (`apps/dist/platform/avocat-francophone.json`) for ingestion into Agent Builder.
- `apps/api/src/agent.ts` – exports `TOOL_NAMES`, a single source of truth for custom tool identifiers consumed by both runtime handlers and the manifest export; extend this map when introducing a new tool to avoid name drift.
- `apps/api/src/chatkit.ts` – initial in-memory session scaffold outlining the future ChatKit integration surface.

## Shared Resources & Guardrail Roadmap

| Resource / Guardrail | Status | Notes |
| --- | --- | --- |
| Authorities Vector Store (`OPENAI_VECTOR_STORE_AUTHORITIES_ID`) | In production (legal) | Register as managed resource in Agent Platform; finance agents will need separate stores (e.g. `OPENAI_VECTOR_STORE_FINANCE_TAX`, `..._AUDIT`). |
| Finance Document Datasets | Not yet created | Plan dedicated datasets for tax rulings, audit workpapers, AP policies (store in Supabase + mirrored OpenAI datasets). |
| Compliance Guardrail – France Judge Analytics | Implemented manually | Convert to Agent Platform guardrail bundle; include policy version tagging via request tags (`policy=fr_judge_v1`). |
| Compliance Guardrail – OHADA Acknowledgements | Implemented manually | Same as above; ensure finance agents reference shared compliance summary service. |
| Finance Guardrail Bundles (Tax, Audit, AP) | Not started | Define policy rules (e.g. confidentiality, retention, segregation by client) before activating finance agents. |
| Evaluation Scenarios | Not started | Draft scenario suites for each finance agent to feed into Agent Platform evaluations/red-team runs. |

### Finance Agent Resource Matrix (Draft)

| Agent | Vector Store(s) | Datasets | Guardrails | Notes |
| --- | --- | --- | --- | --- |
| Tax Compliance | `OPENAI_VECTOR_STORE_FINANCE_TAX` (tax codes, rulings) | VAT/GST corpus, withholding tables | Tax confidentiality, jurisdictional restrictions, client-data masking | Requires OCR ingestion of tax notices; connect to tax authority APIs. |
| Corporate Secretary | `OPENAI_VECTOR_STORE_FINANCE_CORPSEC` | Board minutes, charter templates | Entity separation, SOX documentation guardrails | Should integrate with document signing workflows. |
| Audit & Assurance | `OPENAI_VECTOR_STORE_FINANCE_AUDIT` | Workpapers, control matrices | Audit independence, evidence retention | Needs evaluation scenarios for sampling vs. recalculation. |
| Accounts Payable | `OPENAI_VECTOR_STORE_FINANCE_AP` | Vendor master, invoice library | PII scrub, payment approval policy | Will consume OCR outputs and interact with ERP connectors. |
| CFO Strategy | `OPENAI_VECTOR_STORE_FINANCE_CFO` | KPI dashboards, budgeting models | Forward-looking disclosure guardrails | Might use Sora-generated video summaries. |
| Risk & Controls | `OPENAI_VECTOR_STORE_FINANCE_RISK` | Control library, risk registers | Control data sensitivity, incident disclosure | Should coordinate with Audit agent via orchestrator. |
| Regulatory Filings | `OPENAI_VECTOR_STORE_FINANCE_REG` | Filing templates, regulatory calendars | Jurisdictional filing policies | Ensure integration with government portals via MCP. |
| Agent Orchestrator | Uses domain stores read-only | Shared policy dataset | Meta-guardrail: escalation thresholds | Needs ChatKit + MCP coordination across agents. |
