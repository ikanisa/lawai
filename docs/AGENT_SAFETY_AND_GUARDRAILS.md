# Agent Safety and Guardrails

This document enumerates the policy rails enforced by the Francophone Avocat-AI stack and how each guardrail is validated across environments.

## Policy Inventory
- `statute_first`: Prioritise statutory authority before secondary commentary.
- `ohada_preemption_priority`: OHADA uniform acts override national rules where applicable.
- `france_judge_analytics_block`: Blocks requests attempting to profile judges.
- `confidential_mode`: Disables outbound web search and restricts document diffusion.
- `sensitive_topic_hitl`: Routes sensitive topics to human-in-the-loop review queue.

## Enforcement Points
| Layer | Mechanism | Notes |
| ----- | --------- | ----- |
| OpenAI Agents | Guardrail instructions injected via system prompt + tool allowlist | Enforced per run with jurisdiction context. |
| Supabase | Row-Level Security policies verifying `is_org_member` and policy toggles | RLS tests run in CI using database harness. |
| API Gateway | Policy middleware reading `org_policies` and request metadata | Emits audit events on denied actions. |
| UI | Feature flags and contextual banners (RiskBanner, LanguageBanner) | Surfaces policy state to end-users. |

## Validation Checklist
- [ ] Automated tests cover denial of judge analytics requests.
- [ ] Agent-run telemetry logged for all guardrail interventions.
- [ ] HITL queue receives sensitive-topic escalations with source provenance.
- [ ] Policy changes require dual approval captured in `agent_policy_versions`.

## Incident Response
1. Record policy breach in `audit_events` with severity and impacted tenant.
2. Trigger mitigation playbook (disable agent, revoke tokens, notify stakeholders).
3. Run post-incident review and update guardrail regression tests.
