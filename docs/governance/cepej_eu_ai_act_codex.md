# CEPEJ & EU AI Act Compliance Handling Codex

This codex summarises how Avocat-AI Francophone operationalises the Council of Europe's CEPEJ ethical charter and the EU AI Act (high-risk) governance requirements. It links automated safeguards implemented in the codebase with recurring human review and evidence capture expectations for regulators, clients, and internal risk teams.

## 1. Governance Objectives

- **Protect fundamental rights and fairness** – The orchestrator enforces structured reasoning, citation validation, and Maghreb binding-language banners before responses leave the agent pipeline. CEPEJ principles on transparency, non-discrimination, and user control are encoded as run-level acceptance gates.
- **Maintain documented FRIA checkpoints** – Every high-risk workflow must provide a Fundamental Rights Impact Assessment snapshot alongside remediation tickets when violations surface. The FRIA template in `docs/governance/fria_template.md` anchors the minimum evidence set and escalation flow.
- **Expose continuous monitoring artefacts** – `/metrics/governance`, `/metrics/cepej`, transparency reports, and SLO ledgers must remain exportable to back quarterly regulator briefings, Trust Center updates, and customer diligence.

## 2. Automated Controls in Product & API

| Control Area | Implementation | Evidence Sources |
| --- | --- | --- |
| **Run gating** | `apps/api/src/agent.ts` applies CEPEJ policy checks, EU AI Act FRIA detection, France judge-analytics prohibitions, and HITL escalation when violations are detected. | Compliance audit logs, HITL queue entries, `agent_runs` table metadata. |
| **Compliance service** | `apps/api/src/compliance.ts` normalises CEPEJ charter scenarios (transparency, impartiality, user control) and raises structured violation payloads that populate Go / No-Go criteria. | Compliance violations table, `/runs/:id` response payloads, Go / No-Go checklist exports. |
| **Metrics & dashboards** | `/metrics/cepej`, `/metrics/governance`, and regulator digests summarise pass rates, outstanding violations, and remediations. SLO snapshots, transparency reports, and CEPEJ exports are persisted for audit. | Supabase views (`cepej_metrics_view`), `transparency_reports`, `slo_snapshots`, `governance_publications`. |
| **Testing & CI hooks** | `apps/api/test/compliance.test.{ts,js}` and `apps/api/test/agent.test.{ts,js}` validate CEPEJ detection logic, ensuring new changes cannot regress compliance guardrails. | CI pipeline artefacts, evaluation report diffs. |

## 3. Manual Governance Workflow

1. **Daily triage** – Compliance and legal operators review the CEPEJ summary dashboard each morning. Violations trigger the documented mitigation process in `docs/operations/red_team_playbook.md` and assign remediation tickets with owners and deadlines.
2. **Weekly FRIA review** – The Responsible AI committee downloads FRIA artefacts and CEPEJ exports, confirming mitigation status, residual risk ratings, and user-control affordances. Material changes must be reflected in the Trust Center within 24 hours.
3. **Monthly transparency publication** – Use `pnpm ops:transparency` to generate regulator-facing reports, attach CEPEJ evidence, and submit to the governance publication ledger. Ensure Maghreb/Rwanda residency commitments, SLO targets, and HITL statistics are included.
4. **Quarterly audit rehearsal** – Run the full Go / No-Go checklist (`ops/reports/GO_NO_GO_CHECKLIST.md`), rehydrate red-team findings, and capture CEPEJ compliance attestations for board sign-off.

## 4. Incident & Escalation Handling

- **Violation severity**
  - _Critical_: Fundamental rights impact without mitigation or transparency (e.g., missing citations, non-consented personal data). Immediate HITL shutdown, regulator notification, and Go / No-Go failure until remediation.
  - _High_: Transparency gaps or automation bias with active mitigation. Requires 24-hour remediation and Trust Center disclosure.
  - _Medium_: Documentation or monitoring gaps. Resolve within the sprint and document in the monthly transparency report.
- **Escalation ladder** – Product owner → Compliance lead → Responsible AI committee → Executive sponsor. Regulator dispatches follow the ledger process in `supabase/migrations/20240101004600_regulator_dispatches.sql` and must be published in the Trust Center incidents section.
- **Post-incident review** – Capture timeline, root cause, CEPEJ principle impacted, FRIA update, corrective actions, and follow-up validations. Archive in the `governance_publications` store with reference to affected runs.

## 5. Evidence Checklist

| Artefact | Frequency | Owner |
| --- | --- | --- |
| CEPEJ metrics export (`pnpm ops:transparency --json`) | Weekly | Compliance operations |
| FRIA updates & residual risk register | Weekly | Responsible AI committee |
| Go / No-Go CEPEJ criterion status | Per release | Release manager |
| HITL queue and remediation ticket logs | Daily | Support operations |
| Trust Center compliance bulletin | Within 24h of change | Communications lead |

Adhering to this codex ensures Avocat-AI Francophone aligns with CEPEJ ethical imperatives and EU AI Act obligations while delivering auditable, regulator-ready evidence at all times.
