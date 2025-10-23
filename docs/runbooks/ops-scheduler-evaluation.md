# Scheduler & Évaluation – Runbook

Ce runbook décrit les commandes d’orchestration et les sorties attendues après l’introduction
du planificateur partagé et de la nouvelle UX CLI.

## Planificateur d’opérations

Le planificateur exposé par `buildOpsScheduler` centralise trois familles de tâches :

| ID de tâche            | Type     | Déclenchement par défaut | Commande associée                              |
|-----------------------|----------|--------------------------|------------------------------------------------|
| `ingestion-hourly`    | queue    | `0 * * * *` (UTC)        | `curl -s -X POST "$EDGE_PROCESS_LEARNING_URL?mode=hourly"` |
| `evaluation-nightly`  | cron     | `0 2 * * *` (UTC)        | `npm run evaluate --workspace @apps/ops -- --ci`            |
| `red-team-weekly`     | cron     | `0 6 * * MON` (UTC)      | `npm run red-team --workspace @apps/ops -- --ci`            |

### Vérification rapide

```bash
node -e "const { buildOpsScheduler } = require('../apps/ops/dist/lib/scheduler'); const s = buildOpsScheduler(process.env); console.table(s.list().map(t => ({ id: t.id, trigger: t.trigger.kind })));"
```

Sortie attendue : un tableau listant les trois tâches précédentes avec les bons types.

## CLI d’évaluation

La commande reste inchangée mais fournit désormais une progression, des relances et un
résumé enrichi.

```bash
npm run evaluate --workspace @apps/ops -- --ci --limit 2
```

Sorties attendues :

- `Loaded X evaluation cases.` suivi de `Progress [i/n]` en mode CI.
- En cas de relance, un message `Nouvelle tentative (2) pour le cas …`.
- Résumé final : `Résultats: …` avec les éventuels avertissements de seuils.
- Export JSON dans `ops/reports/evaluation-summary.json` contenant `coverage_*` et `threshold_failures`.

## Déclenchement manuel des tâches

Pour simuler une exécution CRON :

```bash
node -e "const { buildOpsScheduler } = require('../apps/ops/dist/lib/scheduler'); const s = buildOpsScheduler({ EDGE_PROCESS_LEARNING_URL: 'https://edge.example/process-learning' }); s.run('ingestion-hourly');"
```

Un statut HTTP 200 est attendu. Tout autre statut déclenchera une erreur explicite
(`Ingestion trigger failed with status …`).

