# Avocat-AI Francophone Monorepo

This repository contains the production implementation scaffold for the Avocat-AI Francophone autonomous legal agent. It is organised as a PNPM workspace with API, operational tooling, Supabase integrations, database migrations, and shared packages for schemas and constants.

## Structure

```
apps/
  api/        # Fastify API service hosting the agent orchestrator and REST endpoints
  edge/       # Supabase Edge Functions (Deno) for crawlers, schedulers, and webhooks
  ops/        # Command-line tooling for ingestion and evaluations
  web/        # Next.js App Router front-end (liquid-glass UI, shadcn primitives, TanStack Query)

db/
  migrations/ # SQL migrations (Supabase/Postgres)
  seed/       # Seed scripts and helper data

packages/
  shared/     # Shared TypeScript utilities (IRAC schema, allowlists, constants)
  supabase/   # Generated types and helpers for Supabase clients
```

## Local Setup (MacBook)

1. Install dependencies with **pnpm@8.15.4** (Corepack will download the pinned version declared in `package.json`):
   ```bash
   corepack pnpm install
   ```
2. Create `.env.local` from the template and populate the secrets listed in
   [Environment Variables](#environment-variables):
   ```bash
   cp .env.example .env.local
   ```
3. Apply database migrations against the target Supabase instance (requires a
   valid `SUPABASE_DB_URL`):
   ```bash
   pnpm db:migrate
   ```
4. Provision operational fixtures (buckets, allowlists, vector store) once per
   environment:
   ```bash
   pnpm --filter @apps/ops bootstrap
   ```
5. Seed base data (jurisdictions, allowlists) as part of the initial bootstrap:
   ```bash
   pnpm seed
   ```
6. Generate the PWA icons before running a production web build:
   ```bash
   pnpm --filter @avocat-ai/web icons:generate
   ```
7. Start the API locally on port 3333:
   ```bash
   pnpm dev:api
   ```
8. Launch the operator console on http://localhost:3001:
   ```bash
   pnpm dev:web
   ```

For a production-mode smoke test on a laptop follow the
[local hosting guide](docs/local-hosting.md), which outlines the
`pnpm install && pnpm build && pnpm start` flow and optional reverse proxy
setups.

## Environment Variables

- `.env.local` (root) powers both the Fastify API and the Next.js console. Use
  `.env` only for CI secrets that never leave the vault.
- Required keys:
  - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` for service-to-service calls.
  - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` for the web
    client.
  - `OPENAI_API_KEY` and `OPENAI_VECTOR_STORE_AUTHORITIES_ID` for agent
    orchestration.
  - Feature toggles such as `FEAT_ADMIN_PANEL` and `APP_ENV` mirror the runtime
    checks inside `apps/web/src/config/feature-flags.ts`.
- The API performs runtime validation via `apps/api/src/env.server.ts`; the web
  app mirrors this with `apps/web/src/env.server.ts`. Invalid or missing values
  will surface as boot-time errors.

## Run Commands

| Command | Description |
| ------- | ----------- |
| `pnpm dev:api` | Start the Fastify API with hot reload on port 3333. |
| `pnpm dev:web` | Run the Next.js operator console on http://localhost:3001. |
| `pnpm typecheck` | Execute TypeScript checks across all workspaces. |
| `pnpm lint` | Enforce ESLint rules in every package. |
| `pnpm build` | Build API, web, PWA, and shared packages. |
| `pnpm test` | Run the workspace test suites (Vitest, etc.). |
| `pnpm check:binaries` | Guard-rail to prevent binary assets in Git history. |
| `pnpm ops:foundation` | One-shot Supabase provisioning with safety checks. |
| `pnpm ops:provision` | Re-run provisioning without the secrets audit. |
| `pnpm ops:check` | Continuous environment compliance report. |

## Supabase Notes

- Database extensions (`pgvector`, `pg_trgm`, optional `pg_cron`) must be
  enabled before `pnpm ops:foundation` succeeds.
- The Supabase Edge functions listed in `supabase/config.toml` now rely on
  manual scheduling—see [`scripts/cron.md`](scripts/cron.md) for the recommended
  cadence and example runners.
- `supabase/migrations/` contains canonical SQL. Run `pnpm db:migrate` against
  the production database URL to keep parity with your Supabase project.
- The Supabase CLI (`brew install supabase/tap/supabase`) is required for edge
  deployments triggered in CI and for local function testing.

## Vercel Decommissioning Summary

- The Vercel preview workflow and cron configuration have been removed from the
  repository. Preview builds now rely on local scripts instead of
  `.github/workflows/vercel-preview-build.yml`.
- Scheduled workloads should be wired through cron/Node runners documented in
  [`scripts/cron.md`](scripts/cron.md).
- Local production-style hosting is documented in
  [`docs/local-hosting.md`](docs/local-hosting.md) so MacBook operators can
  self-host without Vercel.

## Ops automation reference

### Assembler les fondations en une étape

Lorsque vous préparez un nouvel environnement (local ou cloud), exécutez :

```bash
pnpm ops:foundation
```

La commande applique toutes les migrations, vérifie la présence des extensions `pgvector`/`pg_trgm`,
provisionne les buckets privés (`authorities`, `uploads`, `snapshots`), synchronise les zones de résidence et l'allowlist,
valide les garde-fous de résidence puis crée le vector store `authorities-francophone` si nécessaire.
Elle échoue immédiatement si un secret critique (OpenAI ou Supabase) reste en valeur par défaut.

#### Garde-fous sur les secrets de production

Au démarrage en production, l'API refusera les valeurs de configuration suivantes :

- `SUPABASE_URL` pointant vers `https://example.supabase.co`, `https://project.supabase.co` ou toute URL `localhost`.
- `OPENAI_API_KEY` contenant `CHANGEME`, `placeholder`, `test-openai-key` ou des clés factices commençant par `sk-test-`, `sk-demo-`, `sk-example-`, `sk-placeholder-`, `sk-dummy-` ou `sk-sample-`.
- `SUPABASE_SERVICE_ROLE_KEY` contenant `placeholder` ou `service-role-test`.

Mettez à jour vos secrets avant déploiement pour éviter l'échec `configuration_invalid`.

### Préflight de mise en production

Le script `scripts/deployment-preflight.mjs` automatise les vérifications critiques avant une promotion en production :

- Validation des secrets partagés via `@avocat-ai/shared/config/env` (échec immédiat si `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` ou `OPENAI_API_KEY` sont manquants ou encore en valeur factice).
- Exécution séquentielle de `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck` et `pnpm build` avec propagation des codes de sortie.

Lancez-le localement avec :

```bash
node scripts/deployment-preflight.mjs
```

Le workflow GitHub Actions [`Deploy`](.github/workflows/deploy.yml) exécute désormais ce préflight avant d'appliquer les migrations ou de publier une version, garantissant que la promotion respecte le Go / No-Go.

### Provisionner l'environnement complet

Si vous souhaitez uniquement reprovisionner migrations, buckets, allowlist et vector store (sans audit des secrets), exécutez :

```bash
pnpm ops:provision
```

### Vérifier la conformité de l'environnement

Le plan de production impose de contrôler régulièrement l'état des extensions Postgres, des buckets Supabase et du vector store OpenAI.
Un CLI dédié synthétise ces vérifications et échoue si un prérequis manque :

```bash
pnpm ops:check
```

Le script confirme la présence des extensions `pgvector`/`pg_trgm`, des buckets `authorities`/`uploads`/`snapshots`,
de la synchronisation de `authority_domains` avec l'allowlist officielle et de l'accessibilité du vector store référencé
par `OPENAI_VECTOR_STORE_AUTHORITIES_ID`.

### Piloter la progression phase par phase

Lorsque l'équipe demande de « continuer la mise en œuvre phase par phase », la commande suivante calcule l'état réel des phases
Fondation, Ingestion et Agent/HITL à partir de Supabase et du vector store :

```bash
pnpm ops:phase
```

Chaque phase est marquée `OK`, `À vérifier` (simulation) ou `Incomplet`.
Le CLI examine l'existence des tables critiques, des buckets, des domaines allowlist, des synchronisations de documents,
des exécutions d'adaptateurs, des scores de jurisprudence et des événements d'audit.

Options utiles :

- `--dry-run` : ignore les appels réseau sensibles (vector store) et renvoie des avertissements plutôt qu'un échec.
- `--json` : produit la sortie structurée (utile pour CI/CD ou Confluence).

### Éviter les fichiers binaires bloquants

L'automatisation de création de PR refuse tout asset binaire (PNG, PDF, archives, etc.).
Exécutez le garde-fou suivant avant de pousser ou d'utiliser `make_pr` :

```bash
pnpm check:binaries
```

La commande échoue en listant les fichiers interdits détectés dans l'index Git.
Remplacez-les par des équivalents textuels (ex. : SVG générateur → PNG) avant de soumettre votre contribution.

### Synchroniser le vector store OpenAI

Après ingestion de nouvelles autorités (via Supabase Edge), synchronisez les documents en attente avec le vector store OpenAI :

```bash
pnpm --filter @apps/ops vectorstore
```

Le script crée automatiquement le vector store `authorities-francophone` si `OPENAI_VECTOR_STORE_AUTHORITIES_ID` est vide.

### Lancer la campagne d'évaluation

Un CLI dédié exécute les cas d'évaluation stockés dans la table `eval_cases`, appelle l'API `/runs` et journalise les résultats dans `eval_results` :

```bash
pnpm ops:evaluate --org 00000000-0000-0000-0000-000000000000 --user 00000000-0000-0000-0000-000000000000
```

Utilisez `--dry-run` pour inspecter les cas sans déclencher d'appels OpenAI, et `--limit <n>` pour restreindre l'échantillon lors d'un smoke test.

L'option `--benchmark <legalbench|lexglue>` charge les jeux de tests publiés dans `apps/ops/fixtures/benchmarks` afin de journaliser des résultats comparables entre organisations et d'alimenter les rapports de dérive/fairness.

Chaque exécution non simulée génère également un tableau de bord JSON (`ops/reports/evaluation-summary.json`) agrégeant la précision des citations, la validité temporelle, le nombre d'avertissements sur la langue contraignante et la provenance du benchmark. Ce fichier peut être ingéré dans Supabase ou un outil BI pour suivre vos objectifs (≥95 % de précision allowlist, ≥95 % de validité temporelle, bannière Maghreb systématique) et surveiller les dérives d'équité.

### Lancer la campagne red-team

Une batterie de scénarios critiques vérifie la bonne application des garde-fous (HITL pénal/sanctions, bannière Maghreb, priorité OHADA). Les résultats sont enregistrés dans la table `red_team_findings` et alimentent le Go / No-Go checklist.

```bash
pnpm ops:red-team --org 00000000-0000-0000-0000-000000000000 --user 00000000-0000-0000-0000-000000000000
```

Utilisez `--dry-run` pour un diagnostic sans insertion Supabase ou `--scenario <clé>` pour cibler un test. Consultez `docs/operations/red_team_playbook.md` pour la procédure complète.

### Capturer un snapshot de performance

Afin de démontrer la robustesse (latence, précision des citations, couverture HITL), enregistrez régulièrement un snapshot via :

```bash
pnpm ops:perf-snapshot --org 00000000-0000-0000-0000-000000000000 --user 00000000-0000-0000-0000-000000000000 --notes "post-red-team"
```

### Planifier les rapports de conformité

Les rapports de transparence, SLO et régulateur peuvent être programmés depuis Supabase en une seule commande :

```bash
pnpm --filter @apps/ops schedule-reports --org <org-id> --user <service-user> --api https://api.avocat.ai
```

Le CLI vérifie les garde-fous de résidence avant d’archiver les rapports dans `ops_report_runs`, journalise chaque succès dans `audit_events` et signale les échecs partiels (avec message d’erreur) dans la sortie standard.

## Panneau d'administration (feature flag FEAT_ADMIN_PANEL)

Un nouveau panneau d'administration Next.js est livré derrière le flag `FEAT_ADMIN_PANEL`. Le flag est activé par défaut en
développement et en préproduction, et reste désactivé en production tant que `FEAT_ADMIN_PANEL=1` n'est pas fourni.

- **Activer localement** : ajoutez `FEAT_ADMIN_PANEL=1` à votre `.env.local`.
- **Prévisualisation hébergeur** : les environnements `preview` héritent d'un comportement activé par défaut.
- **Production** : définir explicitement `FEAT_ADMIN_PANEL=1` dans les variables de la plateforme avant le déploiement.

Les routes `/api/admin/*` valident systématiquement la présence des en-têtes `x-admin-actor` et `x-admin-org` (ou retombent sur
les valeurs de configuration `ADMIN_PANEL_ACTOR`/`ADMIN_PANEL_ORG`).

## Runbooks condensés (Drive, Ingestion, Evals)

- **Drive watcher & Corpus** : utiliser `/api/admin/jobs` avec `type="drive-watch"` pour relancer la surveillance. Les buckets
  Supabase sont préfixés par organisation via les politiques RLS créées dans `supabase/migrations/20240710120000_admin_panel.sql`.
- **Ingestion** : le bouton « Start backfill » du panneau appelle `/api/admin/ingestion` avec `action="backfill"`, ce qui ajoute
  une entrée dans `admin_jobs`. Suivez la progression dans la vue « Jobs » du tableau de bord.
- **Evaluations** : la commande « Trigger nightly eval » appelle `/api/admin/evaluations` et `queueJob(..., 'eval-nightly', ...)`.
  Surveillez les résultats dans la page « Evaluations » (SLO gates) et vérifiez les événements correspondants dans l'audit log.

La commande agrège `/metrics/governance` et `tool_performance_metrics`, calcule un P95 global et insère la ligne correspondante dans `performance_snapshots`.

### Générer un rapport de transparence

Pour documenter les engagements CEPEJ/FRIA et produire un rapport partageable avec les autorités, exécutez :

```bash
pnpm ops:transparency --org 00000000-0000-0000-0000-000000000000 --user 00000000-0000-0000-0000-000000000000 --start 2024-07-01 --end 2024-07-31 --output reports/transparency-juillet.json
```

La commande insère par défaut le rapport dans `transparency_reports` (JSON complet stocké dans `metrics` et `cepej_summary`).
Utilisez `--dry-run` pour générer le rapport sans insertion Supabase.

### Capturer et consulter les SLO

Suivez vos engagements de disponibilité/latence via le nouveau snapshot SLO :

```bash
# Enregistrer un nouveau snapshot (tous les indicateurs sont requis)
pnpm ops:slo --org $ORG --user $USER --uptime 99.95 --hitl-p95 180 --retrieval-p95 12 --citation-p95 98.5 --notes "Semaine 32"

# Lister l’historique (JSON)
pnpm ops:slo --org $ORG --user $USER --list

# Export CSV pour diffusion aux régulateurs
pnpm ops:slo --org $ORG --user $USER --list --export > reports/slo.csv
```

### Vérifier le checklist Go / No-Go

Pour vérifier que chaque section (A–H) dispose d'une preuve satisfaite, qu'un artefact FRIA validé est présent et qu'une décision « GO » a été consignée pour un tag de release donné, utilisez le nouvel assistant :

```bash
pnpm ops:go-no-go --org $ORG --release rc-2024-09 --require-go
```

La commande récupère les entrées `go_no_go_evidence`, `go_no_go_signoffs` **et** les artefacts `fria_artifacts`, récapitule le nombre de critères satisfaits par section et échoue (code de sortie ≠ 0) tant qu'un item reste en attente, qu'aucune décision « GO » applicable n'est présente ou qu'aucun dossier FRIA validé ne couvre la release ciblée (ou l'organisation via un artefact global).

### Piloter la boucle d'apprentissage

Lancer le worker horaire (traitement des tickets de synonymes/guardrail + snapshot de file) :

```bash
pnpm ops:learning --org $ORG --mode hourly
```

Déclencher les rapports nocturnes (dérive + évaluations) à la demande :

```bash
pnpm ops:learning --org $ORG --mode nightly
```

Utilisez `--mode reports` pour récupérer simplement le JSON retourné par la fonction Edge (utile pour la CI ou les audits).

### Générer un digest régulateur hebdomadaire

Pour agréger les enregistrements `regulator_dispatches` dans un bulletin Markdown prêt à diffusion, exécutez :

```bash
pnpm ops:regulator-digest --org $ORG --user $USER --start 2024-09-01 --end 2024-09-07
```

Ajoutez `--json` pour récupérer le payload natif et l'intégrer dans vos propres gabarits.

Pour téléverser un dossier FRIA (PDF stocké dans Supabase Storage ou URL externe), appelez l’API d’administration :

```bash
curl -X POST "https://<api>/admin/org/$ORG/go-no-go/fria" \
  -H "x-user-id: $USER" \
  -H "Content-Type: application/json" \
  -d '{
    "releaseTag": "rc-2024-09",
    "title": "FRIA complète",
    "storagePath": "'$ORG'/compliance/fria-rc-2024-09.pdf",
    "hashSha256": "<SHA256>",
    "validated": true
  }'
```

Le service met automatiquement à jour `go_no_go_evidence` (section A) avec le critère « EU AI Act (high-risk): FRIA completed » et expose les artefacts via `GET /admin/org/:orgId/go-no-go/fria`.

### Lancer le crawler Edge manuellement

Déployez la fonction `crawl-authorities` puis exécutez-la en fournissant les identifiants suivants :

```bash
curl -X POST https://<project-ref>.functions.supabase.co/crawl-authorities \
  -H "Content-Type: application/json" \
  -d '{
    "supabaseUrl": "'$SUPABASE_URL'",
    "supabaseServiceRole": "'$SUPABASE_SERVICE_ROLE_KEY'",
    "orgId": "<UUID organisation>",
    "openaiApiKey": "'$OPENAI_API_KEY'",
    "vectorStoreId": "'$OPENAI_VECTOR_STORE_AUTHORITIES_ID'",
    "embeddingModel": "text-embedding-3-large",
    "summariserModel": "gpt-4o-mini",
    "maxSummaryChars": 12000
  }'
```

Lorsque la clé OpenAI est fournie, le crawler extrait un texte exploitable (HTML, XML, texte brut), produit une synthèse structurée (résumé + points clefs) stockée dans `document_summaries`, puis génère automatiquement des chunks avec embeddings (`document_chunks`) tout en renseignant les colonnes `summary_status`, `summary_generated_at`, `chunk_count` et `summary_error` dans `documents`. Les PDF ou formats non textuels sont marqués « skipped » et peuvent être retraités manuellement.

L’interface Corpus (Next.js) expose désormais ces métadonnées : chaque instantané affiche le statut de synthèse, le nombre de segments pgvector, les points clefs générés et un bouton « Relancer la synthèse » qui rejoue le pipeline de résumé/embeddings via l’API `/corpus/:id/resummarize`.

### Déployer le watcher Google Drive + validateur de manifestes

La fonction Edge `drive-watcher` valide les manifestes Google Drive et journalise les entrées non conformes. Déployez-la puis
appelez-la en transmettant l’identifiant d’organisation et un manifeste (JSON/JSONL) :

```bash
supabase functions deploy drive-watcher --project-ref <project-ref>

curl -X POST https://<project-ref>.functions.supabase.co/drive-watcher \
  -H "Content-Type: application/json" \
  -d '{
    "orgId": "00000000-0000-0000-0000-000000000000",
    "manifestName": "manifest.jsonl",
    "manifestContent": "{\"file_id\":\"1\",\"juris_code\":\"FR\",\"source_type\":\"code\",\"title\":\"Code civil\",\"publisher\":\"Légifrance\",\"source_url\":\"https://www.legifrance.gouv.fr/code\"}"
  }'
```

### Planifier les crawlers et la boucle d'apprentissage

Le fichier [`supabase/config.toml`](supabase/config.toml) référence trois planifications Supabase Cron :

- `crawl-authorities` toutes les 6 heures pour actualiser les portails Légifrance, Justel, Legilux, Fedlex, Maghreb et OHADA avec détection de hash/ETag.
- `process-learning` chaque heure pour traiter les tickets de synonymes/guardrails et rejouer les jobs du learning loop.
- `drive-watcher` toutes les 15 minutes afin de repérer les nouveaux manifestes Google Drive.
- `regulator-digest` chaque matin pour agréger les entrées `regulator_dispatches` des 7 derniers jours et publier un bulletin Markdown dans `governance_publications`.

Après déploiement des fonctions, exécutez :`supabase functions deploy <nom>` puis `supabase functions schedule up` pour activer les tâches définies dans `config.toml`.

La fonction crée un enregistrement dans `drive_manifests`, insère le détail des lignes (`drive_manifest_items`) et ouvre une entrée `ingestion_runs` pour traquer l’état du flux. Les erreurs (domaine hors allowlist, champs manquants, langue Maghreb) sont retournées dans la réponse JSON.

### Exécuter le run agent côté API

L’API `/runs` nécessite désormais l’identifiant d’organisation et d’utilisateur pour historiser les requêtes :

```bash
curl -X POST http://localhost:3000/runs \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Une clause de non-concurrence est-elle valable ?",
    "orgId": "00000000-0000-0000-0000-000000000000",
    "userId": "00000000-0000-0000-0000-000000000000"
  }'
```

## CI/CD

Le workflow GitHub Actions `.github/workflows/ci.yml` installe les dépendances PNPM, exécute `pnpm lint`, applique les migrations contre une instance Postgres de test et lance la suite de tests (`pnpm test`). Ajoutez vos étapes de déploiement selon vos environnements cibles pour garantir la conformité du plan de mise en production.

### Tests E2E d'accusé de conformité

Une suite Playwright valide le flux d'accusé de conformité entre le front (`apps/web`) et l'API (`apps/api`). Les tests fonctionnent avec une instance Supabase existante (locale ou distante) et nécessitent l'activation d'un compte de démonstration.

1. Configurez les variables d'environnement `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` (ainsi que `OPENAI_API_KEY` si vous ne souhaitez pas utiliser la valeur par défaut). Facultativement, ajustez `E2E_ORG_ID`, `E2E_USER_ID`, `E2E_CONSENT_VERSION` ou `E2E_COE_VERSION` pour cibler une autre organisation ou version d'accusé.
2. Générez les données déterministes via `node ./scripts/seed-compliance-test-data.mjs`. Ce script crée/actualise l'organisation de test, rattache l'utilisateur et remet à zéro les événements de consentement afin que la bannière demande un accusé.
3. (Première exécution uniquement) installez les navigateurs Playwright : `pnpm --filter @avocat-ai/web exec playwright install --with-deps chromium`.
4. Lancez les tests : `pnpm --filter @avocat-ai/web test:e2e`. Une interface interactive est disponible via `pnpm --filter @avocat-ai/web test:e2e:ui`.

La CI déclenche ces étapes dans le job `e2e` du workflow principal. En cas d'échec local, vérifiez que les en-têtes Supabase sont valides et que le script de seed s'exécute sans erreur avant de relancer Playwright.

Consult `docs/avocat_ai_bell_system_plan.md` for the full BELL analysis and delivery roadmap.
Review [`docs/vector-embeddings.md`](docs/vector-embeddings.md) for guidance on selecting, generating, and scaling semantic embeddings with the latest OpenAI models.

## Troubleshooting

Most commands in this monorepo reach out to Supabase or OpenAI. When those
domains are unreachable the tooling reports generic "network issue" errors. A
troubleshooting guide is available at
[`docs/troubleshooting_network.md`](docs/troubleshooting_network.md); it covers
the common root causes (restricted runners, missing credentials, blocked
hosts), the stubbed offline modes, and the diagnostics to collect before
escalating.

## Gouvernance, conformité et exploitation

- Consultez [`docs/governance/`](docs/governance/) pour les politiques officielles : IA responsable, gestion des conflits, rétention, réponse aux incidents, gestion des changements, onboarding pilote et SLO/support.
- Les migrations `0026_user_management.sql` et `0027_user_management_rls.sql` ajoutent les tables et politiques nécessaires à la gestion d'utilisateurs multi-tenant (RBAC × ABAC, consentement, audit, invitations, entitlements). Toute requête API doit inclure `X-Org-Id` afin d'évaluer les droits (`org_policies`, `jurisdiction_entitlements`) et de journaliser les actions sensibles dans `audit_events`.
- Lorsque des politiques renforcées sont activées, l'API exige également : `X-Auth-Strength: mfa` ou `passkey` si `mfa_required` vaut `true`, `X-Consent-Version` correspondant à `org_policies.ai_assist_consent_version`, `X-CoE-Disclosure-Version` pour attester l'adhésion au traité du Conseil de l'Europe, et une adresse IP correspondant aux entrées `ip_allowlist_entries` lorsque `ip_allowlist_enforced` est actif.
- L'API `GET /metrics/governance?orgId=<uuid>` agrège les indicateurs clés (précision des citations, charge HITL, santé de l'ingestion, performance des outils) à partir des vues `org_metrics` et `tool_performance_metrics` créées par la migration `0025_governance_metrics.sql`.
- La console Admin affiche ces métriques dans le tableau de bord « Operations dashboard » et fournit un accès direct au téléchargement des politiques pour audit ou partage client.
- `pnpm ops:rotate-secrets` tente d'appeler l'API de gestion Supabase (`SUPABASE_ACCESS_TOKEN` + `SUPABASE_PROJECT_REF`) pour faire tourner les clés `anon` et `service_role`, et génère automatiquement des valeurs de secours si l'API n'est pas disponible. Conservez les nouveaux secrets dans votre gestionnaire sécurisé.
- `pnpm ops:rls-smoke` vérifie que `public.is_org_member` applique bien l'isolation multi-tenant après vos migrations (l'étape est également exécutée en CI).
## Dashboard Badges Legend

Badges on the Admin dashboard and Trust Center provide at‑a‑glance status. Colors are consistent across cards:

- Green “OK/Good/Healthy” – within target thresholds
- Amber “Pending/Acceptable/Warning” – noteworthy but not failing
- Red “Errors/Critical/Attention” – action recommended

Key badges and defaults (configurable via environment variables):

- Runs (30 days): High/Medium/Low volume
  - High ≥ `NEXT_PUBLIC_DASHBOARD_RUNS_HIGH` (default 1000)
  - Medium ≥ `NEXT_PUBLIC_DASHBOARD_RUNS_MEDIUM` (default 200)
- Ingestion: OK/Failures
  - Based on success vs failures over the last 24h (7‑day window displayed)
- HITL backlog: OK/Backlog
  - Backlog when `hitlPending > 0`
- Allowlisted precision: Good/Acceptable/Low
  - Good ≥ 95%, Acceptable ≥ 90% (display only)
- Summary coverage: OK/Pending/Errors
  - Derived from documents pending/failed
- Drive manifest: OK/Warnings/Errors
  - Computed server‑side from last manifest (warnings/errors)
- Retrieval “No citations”: OK/Attention
  - Attention if any recent runs returned zero citations
- Tool health: Healthy/Warning/Critical
  - Failure rate thresholds: `NEXT_PUBLIC_TOOL_FAILURE_WARN` (default 2%), `NEXT_PUBLIC_TOOL_FAILURE_CRIT` (default 5%)
- Evaluation pass & coverage: Good/Acceptable/Poor
  - Pass thresholds: `NEXT_PUBLIC_EVAL_PASS_GOOD` (default 0.9), `NEXT_PUBLIC_EVAL_PASS_OK` (0.75)
  - Coverage thresholds: `NEXT_PUBLIC_EVAL_COVERAGE_GOOD` (0.9), `NEXT_PUBLIC_EVAL_COVERAGE_OK` (0.75)
  - Maghreb banner coverage thresholds: `NEXT_PUBLIC_EVAL_MAGHREB_GOOD` (0.95), `NEXT_PUBLIC_EVAL_MAGHREB_OK` (0.8)
- SLO freshness: Fresh/Stale
  - Fresh if last capture ≤ 7 days

Alerting (Edge functions)

- Set `ALERTS_SLACK_WEBHOOK_URL` and/or `ALERTS_EMAIL_WEBHOOK_URL` to receive notifications.
- Drive watcher manifest alerts: configure `ALERTS_MANIFEST_ALWAYS_REASONS`, `ALERTS_MANIFEST_THRESHOLD`.
- GDrive watcher quarantine alerts: configure `ALERTS_QUARANTINE_THRESHOLD`, `ALERTS_QUARANTINE_ALWAYS_REASONS`.
- Provenance (link‑health) alerts: Configure `PROVENANCE_STALE_RATIO_THRESHOLD`, `PROVENANCE_FAILED_COUNT_THRESHOLD` and schedule via pg_cron. See `docs/ops/provenance-alerts.md`.
