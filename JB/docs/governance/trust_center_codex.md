# Trust Center Codex

The Trust Center codex prescribes how Avocat-AI Francophone communicates operational, compliance, and performance evidence to customers, regulators, and the public. It aligns with CEPEJ, EU AI Act, and Council of Europe transparency expectations while preserving client confidentiality.

## 1. Purpose & Scope

- Provide a single source of truth for policies, certifications, incident history, SLO performance, and compliance attestations.
- Enable rapid updates (within 24 hours) when CEPEJ/EU AI Act status changes, incidents occur, or new jurisdictions are launched.
- Support procurement, due diligence, and regulator briefings with exportable artefacts.

## 2. Core Sections & Required Content

| Section | Content | Update Cadence |
| --- | --- | --- |
| **Overview** | Mission statement, leadership contacts, responsible AI commitments, summary of CEPEJ/EU AI Act alignment. | Quarterly or upon material change. |
| **Compliance & Governance** | CEPEJ charter mapping (summary and PDF export), EU AI Act FRIA template, Council of Europe alignment, residency matrix, conflict of interest policy. | Update alongside any policy change. |
| **Operational Readiness** | SLO dashboard snapshot, incident response SLAs, support hours, Go / No-Go checklist status, operations readiness overview link. | Monthly or after drills. |
| **Security & Privacy** | Data handling statement, encryption posture, access control overview, regulator dispatch log summary, DPIA artefacts. | Within 24h of policy change. |
| **Incidents & Notifications** | Past 12 months incident summaries, remediation status, regulator notifications (linked to `regulator_dispatches`). | Within 24h of new incident. |
| **Performance & Evaluations** | Latest red-team and evaluation summaries, LegalBench/LexGLUE benchmarks, performance snapshot metrics, CEPEJ pass rate chart. | Monthly or after major release. |

## 3. Publication Workflow

1. Draft updates in Markdown (mirroring `apps/web/public/governance` content) and secure review from Compliance, Security, and Communications leads.
2. Generate supporting artefacts:
   - `pnpm ops:transparency` for CEPEJ metrics and FRIA evidence.
   - `pnpm ops:perf-snapshot` for latency and accuracy telemetry.
   - `pnpm ops:red-team` / `pnpm ops:evaluate` for guardrail and accuracy updates.
3. Publish updates to the Trust Center web pages, ensuring bilingual (FR/EN) parity and accessibility requirements (WCAG 2.2 AA) are met.
4. Log the publication in `governance_publications` with timestamp, owner, and summary of changes.

## 4. Change Control & Versioning

- Maintain Git history for all Trust Center Markdown updates with descriptive commit messages referencing incident IDs or policy tickets.
- Store exported artefacts (PDF, JSON) in versioned Supabase buckets with retention aligned to regulator expectations (≥ 5 years).
- For emergency updates, use the expedited approval path: Communications lead + Compliance lead + Executive sponsor.

## 5. Alignment with Other Artefacts

- **Operations Readiness Overview** – Link and surface current operational posture and evidence repositories.
- **CEPEJ & EU AI Act Compliance Codex** – Reference governance obligations and highlight user-control affordances.
- **Disaster Recovery Runbook & Incident Response Plan** – Provide direct download links and summarise test frequency/results.
- **Pricing & Onboarding Collateral** – Ensure sales collateral references Trust Center resources for procurement enablement.

## 6. Metrics for Success

- Trust Center updates published within SLA 100% of the time.
- CEPEJ pass rate ≥ 95% with remediation status visible on the Trust Center dashboard.
- Time-to-disclosure for incidents ≤ 24 hours.
- Positive feedback from customer due diligence (tracked via onboarding surveys) referencing Trust Center clarity.

Adhering to this codex guarantees consistent, regulator-grade transparency and reinforces customer confidence in Avocat-AI Francophone.
