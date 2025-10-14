# EU AI Act FRIA Template – Avocat-AI Francophone

This template records the Fundamental Rights Impact Assessment for each release of the autonomous legal agent. Complete before launching any new capability or significant jurisdictional expansion.

## 1. Context
- **Release / Feature**: _e.g. Maghreb ingestion refresh 2024-09_
- **Owner**: _Product Counsel_
- **Date**: _YYYY-MM-DD_
- **Jurisdictions impacted**: _FR, OHADA, Maghreb_
- **Business purpose**: _Describe the legal workflow supported_

## 2. Stakeholder & Rights Analysis
| Stakeholder | Rights at stake | Risk description | Existing safeguards | Residual risk |
| --- | --- | --- | --- | --- |
| Litigants & defendants | Fair trial, presumption of innocence | Model could recommend actions that breach sanctions or due process | HITL escalation, cite-or-refuse, CEPEJ mapping | _Low/Medium/High_ |
| Judges / magistrates | Data protection, analytics ban | Risk of profiling despite France-mode | France analytics guard, audit logs | |
| Clients & counsel | Confidentiality, legal privilege | Data leakage across tenants | RLS, confidential mode, audit events | |
| Public authorities | Trust in justice system | Incorrect citations or outdated statutes | Performance snapshots, evaluation CLI | |

## 3. High-Risk Classification
- **EU AI Act category**: High-risk (Annex III – Administration of justice)
- **Human oversight**: Provide reviewer roster & escalation steps.
- **Technical robustness**: Document evaluation metrics, red-team outcomes, performance baselines.
- **Data governance**: Cite authoritative ingestion sources and residency matrix entries.

## 4. Mitigation Plan
- **Preventive**: _e.g. run `pnpm ops:red-team` weekly, lock CIT thresholds_
- **Detective**: _Monitoring dashboards, alerts_
- **Corrective**: _HITL SLA, incident response_

## 5. Approval & Sign-off
| Role | Name | Signature / Date |
| --- | --- | --- |
| Product Counsel | | |
| DPO / Privacy | | |
| Engineering Lead | | |
| Compliance Officer | | |

## 6. Archival
- Store completed FRIA in Supabase storage (`governance/fria/<release>.pdf`).
- Record summary entry in `performance_snapshots` metadata and update `GO_NO_GO_CHECKLIST.md`.
