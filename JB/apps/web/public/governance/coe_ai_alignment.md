# Council of Europe AI Framework Convention Alignment

The Avocat-AI Francophone deployment adopts the forthcoming Council of Europe Framework Convention on Artificial Intelligence principles by mapping obligations to product artefacts.

## Transparency & Explainability
- **IRAC Structured Outputs** ensure reasoning is visible without exposing chain-of-thought.
- **Plan Drawer** summarises tools and provenance for every run.
- **Public documentation**: publish quarterly transparency report including case-score distributions and red-team outcomes.

## Oversight & Accountability
- **HITL queue** provides human decision checkpoints for high-risk matters.
- **Audit events** capture every privileged action (`audit_events` table) with immutable history.
- **Performance snapshots** record latency, citation precision, and temporal validity metrics for accountability reviews.

## Non-Discrimination & Fairness
- Case-quality scoring penalises politically sensitive courts and ensures OHADA precedence.
- Red-team harness exercises Maghreb translation, OHADA arbitration, and sanctions scenarios to detect bias.
- Evaluation CLI stores pass/fail metrics per jurisdiction for fairness audits.

## Data Governance & Privacy
- **Residency matrix** (see `data_residency_matrix.md`) defines permitted storage envelopes.
- Confidential mode enforces File Search-only operations and disables caching.
- Access logs and consent events demonstrate lawful basis tracking.

## Redress & Incident Response
- Incident response runbook defines escalation, containment, and remediation flows.
- `red_team_findings` table tracks outstanding vulnerabilities with mitigations and resolution status.
- Support SLOs and change-management procedures are published in the governance pack.

Maintainers must review this document at each release and link to supporting evidence in the Go / No-Go checklist.
