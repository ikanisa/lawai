# CEPEJ Ethical Charter Mapping

The Avocat-AI Francophone programme implements the Council of Europe CEPEJ ethical charter for the use of AI in judicial systems by mapping each principle to concrete product controls and evidence.

| CEPEJ Principle | Implementation Control | Evidence & Monitoring |
| --- | --- | --- |
| **Respect of fundamental rights** | Cite-or-refuse policy enforced by the Agents SDK guardrails; red-team scenarios ensure high-risk matters route to HITL; audit log captures every override. | `red_team_findings` table, HITL queue status, audit events `red_team.recorded`. |
| **Non-discrimination** | Case-quality scoring penalises politically sensitive jurisdictions and requires OHADA/CCJA precedence; evaluator CLI tracks fairness drift via scenario coverage. | Case score axes (`case_scores.axes`), evaluation CLI outputs, fairness notes in `performance_snapshots.metadata`. |
| **Quality and security** | Performance baselines capture latency and allowlisted citation precision; ingestion pipelines hash authoritative sources and log provenance. | `performance_snapshots`, governance dashboard `/metrics/governance`, Supabase storage hashes. |
| **Transparency, impartiality and fairness** | IRAC structured outputs expose reasoning and citations; Maghreb translation banners surface binding-language caveats; CEPEJ compliance documented in operator console. | Research UI telemetry (`ui_telemetry`), language banners, CEPEJ compliance exports. |
| **User control** | Mandatory HITL escalation for penal/sanctions matters; reviewers can accept/reject and annotate responses; red-team harness verifies interventions. | HITL queue analytics, `red_team_findings` status transitions, reviewer audit events. |

## Operating Procedure

1. Run `pnpm ops:red-team` after every model or prompt update. Record findings in `red_team_findings` and resolve critical issues before deployment.
2. Capture a performance snapshot with `pnpm ops:perf-snapshot --notes "post-red-team"` to freeze latency and citation precision metrics.
3. Present CEPEJ evidence during governance reviews using the metrics endpoint (`/metrics/governance`) and downloadable dashboard exports.
4. Update this document quarterly with any new mitigations or policy adjustments.
