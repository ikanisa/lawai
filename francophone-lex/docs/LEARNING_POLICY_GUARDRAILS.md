# Learning Policy Guardrails

## Principles

- **Safety-first**: statute-first retrieval, cite-or-refuse, mandatory HITL for high-risk domains.
- **Privacy-by-design**: learning operates on metadata (signals, policies); no client content is reused for base-model training.
- **Auditability**: every change emits an `agent_policy_versions` entry with author, diff, and approver.
- **Jurisdictional fidelity**: OHADA, Maghreb, Canada bilingual, and Rwanda tri-language rules are encoded via query hints and canonicalizers.
- **France mode**: ensures judge analytics remain disabled, including in learning-derived prompts.

## Change Types

| Change | Source | Controls |
| --- | --- | --- |
| Synonym expansion | Diagnoser → `synonyms_needed` | Requires reviewer approval; limited to ±6 expansions. |
| Query hints (`query_hints`) | Guardrail tuning | Weighted additions per jurisdiction/topic with activation timestamp + policy version. |
| Citation canonicalization | Dead-link / canonical issues | Patterns recorded in `citation_canonicalizer`; QA ensures HTTPS + ELI/ECLI preferred. |
| Denylist/deboost | Case/retrieval escalations | `denylist_deboost` records reason, pattern, action (deny/deboost). |
| Case score adjustments | Citator recompute | Axis weight adjustments bounded ±0.03 per policy version with rationale. |

## Approval Workflow (P1)

1. Diagnoser emits job (`agent_learning_jobs`).
2. Analyst reviews proposed change → creates policy draft.
3. Reviewer/Admin approves via `/api/learning/approve`; change committed, `agent_policy_versions` incremented.
4. Evaluate-and-gate runs nightly; thresholds enforce automatic rollback via `/api/learning/rollback`.

## Thresholds

- Allowlisted precision ≥ 0.95 (P95).
- Dead-link rate ≤ 1%.
- Temporal validity ≥ 0.95.
- HITL recall for high-risk ≥ 0.98.

Violations escalate alerts and trigger rollback if post-change metrics regress.

