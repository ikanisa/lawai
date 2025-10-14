# SLO et support opérationnel

## 1. Objectifs de service
| Domaine | Indicateur | SLO | Mesure |
| --- | --- | --- | --- |
| API /runs | Disponibilité | ≥ 99.5 % mensuel | Monitoring Fastify + Supabase Health |
| Latence | P95 temps de réponse | ≤ 20 s | Logs agent_runs (finished_at - started_at) |
| HITL | Délai médian de traitement | ≤ 4 h | Vue `org_metrics.hitl_median_response_minutes` |
| Ingestion | Taux de succès 7 jours | ≥ 97 % | Vue `org_metrics.ingestion_success_last_7_days` |
| Evaluation | Précision allowlist | ≥ 95 % | CLI `ops:evaluate` + `org_metrics.evaluation_pass_rate` |

## 2. Engagements support
- **Support standard** : 24/5 (jours ouvrés UE) – réponse initiale < 4h.
- **Support premium** : 24/7 – réponse initiale < 1h.
- **Canaux** : portail client, e-mail dédié, option Slack partagé.
- **Escalade** : incidents P0/P1 déclenchent la procédure d'astreinte (voir plan incident).

## 3. Reporting
- Tableau de bord Admin (section « Operations dashboard ») alimenté par les vues Supabase `org_metrics` et `tool_performance_metrics`.
- Rapport mensuel envoyé aux clients : disponibilité, incidents, tendances HITL, métriques d'évaluation.
- Revue trimestrielle avec le comité client : analyse des écarts, plan d'amélioration continue.

## 4. Amélioration continue
- Analyse des tendances (latence, HITL, échecs d'ingestion) pour ajuster les ressources et prioriser les développements.
- Boucle d'apprentissage : intégration des retours support dans la roadmap, ajustement des politiques et outils.
