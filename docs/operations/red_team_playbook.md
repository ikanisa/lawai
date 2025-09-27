# Red-Team Playbook – Autonomous Francophone Lawyer

## Objectives
- Stress-test high-risk guardrails before every release.
- Capture findings in `red_team_findings` for governance reporting.
- Feed results into performance baselines and FRIA documentation.

## Tooling
- Command: `pnpm ops:red-team --org <orgId> --user <userId> --api https://api.example.com`
- Scenarios defined in `apps/ops/src/red-team/scenarios.ts` (HITL escalation, Maghreb translation warning, OHADA precedence).
- Results automatically insert into Supabase when not run with `--dry-run`.

## Schedule
| Trigger | Action |
| --- | --- |
| Weekly (during pilot) | Run red-team CLI against staging agent; file results |
| Before production release | Execute CLI, capture performance snapshot, update Go / No-Go checklist |
| After major ingestion change | Run CLI focusing on affected jurisdictions |

## Reporting Workflow
1. Execute `pnpm ops:red-team` with production-like credentials.
2. Review console summary and Supabase `red_team_findings` entries.
3. For any failed scenario:
   - Assign mitigation owner.
   - Update status to `in_progress` via PATCH endpoint or Supabase UI.
   - Document mitigation in CEPEJ mapping and FRIA.
4. Once resolved, update status to `resolved` and capture evidence.
5. Record `pnpm ops:perf-snapshot --notes "post-red-team"` to log baseline metrics.

## Escalation Matrix
| Severity | Response Time | Owner |
| --- | --- | --- |
| Critical (sanctions/HITL failure) | Immediate, block release | Compliance Officer + Eng Lead |
| High (translation banner missing) | ≤1 business day | Product + Localization |
| Medium (OHADA reference absent) | Include in next sprint | Legal Research lead |
| Low (copy updates) | Track in backlog | Product |

Store all reports and mitigation evidence in the governance SharePoint / Supabase bucket (`governance/red-team`).
