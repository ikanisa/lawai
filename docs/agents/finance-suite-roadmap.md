# Finance Agent Suite – Requirements & Orchestration Snapshot

## Overview
Goal: autonomous, collaborating finance agents (tax, audit, AP, CFO, risk, regulatory) coordinated via MCP orchestrator with minimal HITL.

## Agent Requirements

### 1. Tax Compliance Agent
- **Primary Tasks**: Research tax regulations, draft filings, respond to audits.
- **Tools**:
  - Tax code lookup (jurisdiction-specific)
  - Filing deadline calculator
  - Audit response template generator
  - OCR ingestion for tax notices
- **Datasets**: Tax rulings, VAT/GST guides, withholding tables.
- **Guardrails**: Jurisdiction segregation, client data confidentiality, retention policies.
- **Hosted Resources**: `OPENAI_VECTOR_STORE_FINANCE_TAX`, dataset for tax bulletins.

### 2. Corporate Secretary Agent
- **Tasks**: Maintain board/AGM documentation, regulatory submissions.
- **Tools**: Board resolution generator, compliance calendar manager, e-signature hooks.
- **Datasets**: Charter documents, board minutes, regulatory forms.
- **Guardrails**: Entity separation, SOX compliance, signing authority validation.

### 3. Audit & Assurance Agent
- **Tasks**: Evidence requests, walkthrough narratives, testing results summarisation.
- **Tools**: Control matrix explorer, sampling calculator, PBC tracker, walkthrough summariser.
- **Datasets**: Workpapers, control libraries, audit programs.
- **Guardrails**: Independence rules, evidence retention, PII masking.

### 4. Accounts Payable Agent
- **Tasks**: Invoice ingestion, categorisation, approval routing, payment scheduling.
- **Tools**: OCR invoice parser, vendor validation, policy checker, ERP connector.
- **Datasets**: Vendor master, AP policies, approval matrix.
- **Guardrails**: Payment authority, fraud detection thresholds, privacy filters.

### 5. CFO Strategy Agent
- **Tasks**: KPI analysis, scenario planning, board-ready reports, Sora video summaries.
- **Tools**: Financial model interpreter, variance analyzer, presentation generator, Sora integration.
- **Datasets**: Budget models, KPIs, macroeconomic indicators.
- **Guardrails**: Forward-looking statement policy, disclosure controls.

### 6. Risk & Controls Agent
- **Tasks**: Maintain risk register, monitor control effectiveness, escalate remediation.
- **Tools**: Control effectiveness tracker, risk scoring engine, remediation workflow.
- **Datasets**: Risk library, control catalog, incident logs.
- **Guardrails**: Incident disclosure policy, regulatory retention.

### 7. Regulatory Filings Agent
- **Tasks**: Prepare and submit regulatory filings across jurisdictions, monitor deadlines.
- **Tools**: Filing template generator, submission portal adapters, deadline monitor.
- **Datasets**: Regulatory calendars, filing histories, submission guidelines.
- **Guardrails**: Jurisdiction-specific submission policies, PII masking.

### 8. Orchestrator Agent
- **Role**: Routes tasks across domain agents, manages shared context, ensures compliance guardrails, monitors HITL triggers.
- **Inputs**: ChatKit session metadata, domain capability registry, MCP actions.
- **Outputs**: Task assignments, escalation notices, consolidated reports.

## Orchestration Considerations
- **Session Context**: ChatKit session ID maps to orchestrator context; domain agents subscribe to context slices.
- **HITL Reduction**: Most approvals become chat button interactions; orchestrator only escalates when guardrail fails or confidence low.
- **Shared Memory**: Supabase/Vector stores standardised per domain; orchestrator references the correct resource ID per agent.
- **Evaluation Harness**: Each agent requires scenario suites (e.g., tax audit response, AP fraud scenario). Use Agent Platform evaluations to schedule nightly tests.
- **Guardrail Bundles**: Maintain version log per agent. Include compliance tags in `OpenAI-Request-Tags` (e.g., `policy=tax_v1`).
- **Observability**: Track agent invocation counts, cross-agent handoffs, and guardrail triggers via request tags and ChatKit session metrics.

### Phase A Progress (Director + Safety)
- Supabase schema now includes `orchestrator_sessions`, `orchestrator_commands`, `orchestrator_jobs`, and `org_connectors` with service-role/RLS policies.
- Director and Safety agents run via OpenAI Agents SDK; safety reviews gate every command before workers claim jobs.
- `/agent/commands`, `/agent/jobs/*`, and `/agent/connectors` endpoints back asynchronous orchestration with safety approvals and HITL flags.
- Connectors can be registered per org (ERP/Tax/Accounting/Compliance/Analytics) and referenced by Director plans.
- Pending work queues are exposed through job claim APIs so downstream workers (Director, Safety, domain agents) can fetch work without tight coupling.

### Phase B Progress (Domain Agents)
- Finance domain manifest published (`getFinanceCapabilityManifest`) with prompts, tool packs, datasets, guardrails and telemetry for Tax, AP, Audit, CFO, Risk and Regulatory agents.
- Capability endpoint `/agent/capabilities` surfaces manifest + connector coverage so Director/Safety can reason about readiness per org.
- Toolkit definitions include Supabase RPCs, function workers and external connectors for risk register, KAM/PBC, ERP, tax gateways, analytics stacks and regulatory portals.
- Guardrail requirements codified per domain (payment authority, forward-looking statements, incident disclosure, etc.) with policy tags ready for Agent Platform alignment.
- Telemetry metrics defined per agent (hitl rates, scenario counts, control failure rate) to back future dashboards.
- Worker harness available (`apps/api/src/worker.ts`) to pull orchestrator jobs, execute domain-specific logic, and persist results/HITL escalations.
- Domain executors now persist to Supabase tables (`finance_tax_filings`, `finance_ap_invoices`, `finance_audit_walkthroughs`, `finance_risk_control_tests`, `finance_board_packs`, `finance_regulatory_filings`) while reusing `risk_register` for overlays, so the MCP orchestrator works off live finance data.

## Next Steps
1. Finalise MCP schema (capabilities, handoff protocol, error handling) for Director ↔ domain collaboration.
2. Prioritise agent build order (suggested: Tax → AP → Risk → Audit → CFO → Corporate → Regulatory → Orchestrator iterations).
3. Expand `docs/agents/platform-migration.md` with finance agent-specific resource IDs as they are provisioned.
4. Begin capturing guardrail bundle requirements per agent (e.g., tax-confidentiality, AP-payment authority) and align with Agent Platform policies.
