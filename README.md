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

## Getting Started

1. Install dependencies with **pnpm** (ensure pnpm ≥ 8.15):
   ```bash
   pnpm install
   ```
2. Copy `.env.example` to `.env` and fill in required secrets.
3. Apply database migrations directly against your Supabase instance (requires `SUPABASE_DB_URL`):
   ```bash
   pnpm db:migrate
   ```
4. Bootstrap Supabase storage buckets and synchronise allowlisted domains:
   ```bash
   pnpm --filter @apps/ops bootstrap
   ```
5. Seed base data (jurisdictions, allowlists) once:
   ```bash
   pnpm seed
   ```
6. Generate the PWA icons (required before running the web build in clean environments):
   ```bash
   pnpm --filter @avocat-ai/web icons:generate
   ```
7. Start the API locally:
   ```bash
   pnpm dev:api
   ```
8. Launch the operator console (Next.js App Router) on http://localhost:3001:
   ```bash
   pnpm dev:web
   ```

### Provisionner l'environnement complet

Pour enchaîner migrations, buckets, allowlist et vector store d'un coup, exécutez :

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

### Gouvernance, conformité et Trust Center

Consolidez vos preuves opérationnelles et réglementaires à l'aide des codex et runbooks suivants :

- `docs/governance/cepej_eu_ai_act_codex.md` : synthèse des contrôles CEPEJ et EU AI Act, escalades et artefacts attendus.
- `docs/operations/operations_readiness_overview.md` : checklist de préparation opérationnelle, activités Day-0/Day-1 et boucle d'amélioration continue.
- `docs/governance/trust_center_codex.md` : organisation du Trust Center, cadence de publication et obligations de transparence.

Ces documents complètent les runbooks existants (red-team, disaster recovery, FRIA) et servent de référence lors des audits, briefings régulateurs et revues clients.

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

### Tâches nocturnes (CI planifiées)

Un workflow GitHub Actions exécute chaque nuit les routines d'observabilité et d'ingestion incrémentale :

- Rapport d'apprentissage nocturne (`pnpm ops:learning -- --mode nightly`)
- Vérification de santé des liens officiels (HEAD sur un lot tournant) via `pnpm ops:link-health`
- Traitement des deltas Google Drive via la fonction Edge `gdrive-delta`

Configurez les secrets `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY` et `OPS_ORG_ID` dans votre dépôt pour activer le workflow `.github/workflows/nightly.yml`.

### Gestion des utilisateurs & WhatsApp OTP

- Le modèle RBAC×ABAC est documenté dans `docs/USER_MGMT_MODEL.md`.
- La configuration WhatsApp (Meta ou Twilio) est décrite dans `docs/WA_SETUP.md`.
- Les politiques de sécurité/privacité et les runbooks associés se trouvent dans `docs/SECURITY_PRIVACY_USER_MGMT.md` et `docs/runbooks/`.

### Vérifier le checklist Go / No-Go

Pour vérifier que chaque section (A–H) dispose d'une preuve satisfaite, qu'un artefact FRIA validé est présent et qu'une décision « GO » a été consignée pour un tag de release donné, utilisez le nouvel assistant :

```bash
pnpm ops:go-no-go --org $ORG --release rc-2024-09 --require-go
```

La commande récupère les entrées `go_no_go_evidence`, `go_no_go_signoffs` **et** les artefacts `fria_artifacts`, récapitule le nombre de critères satisfaits par section et échoue (code de sortie ≠ 0) tant qu'un item reste en attente, qu'aucune décision « GO » applicable n'est présente ou qu'aucun dossier FRIA validé ne couvre la release ciblée (ou l'organisation via un artefact global).

⚙️ Le workflow CI (`.github/workflows/ci.yml`) exécute `pnpm ops:go-no-go --require-go` par défaut avec les mêmes secrets (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPS_ORG_ID`). Des valeurs de secours sont utilisées si les secrets sont absents, mais alimentez-les pour déclencher la vérification sur votre projet réel.

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
    "embeddingModel": "text-embedding-3-small",
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

### Téléverser un document (API) et exécuter un run agent

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

Pour téléverser un fichier côté serveur (JSON base64), utilisez `/upload` :

```bash
curl -X POST http://localhost:3000/upload \
  -H "Content-Type: application/json" \
  -H "x-user-id: 00000000-0000-0000-0000-000000000000" \
  -d '{
    "orgId": "00000000-0000-0000-0000-000000000000",
    "name": "Code_civil_1240.html",
    "mimeType": "text/html",
    "contentBase64": "<BASE64>",
    "bucket": "authorities",
    "source": { "jurisdiction_code": "FR", "source_type": "statute", "title": "Code civil art. 1240" }
  }'
```

L’API stocke le fichier dans Supabase Storage (bucket `uploads` ou `authorities`), crée la ligne `documents` et tente une
synthèse/embedding (requiert `OPENAI_API_KEY`). La Console « Corpus & Sources » expose un bouton d’import graphique.

### Intégration Google Drive (Service Account — dossier unique)

1) Créez un compte de service GCP et partagez‑lui uniquement le dossier Drive autorisé (ou un Shared Drive entier si nécessaire) en lecture.

2) Renseignez les variables d’environnement :

```
GDRIVE_SERVICE_ACCOUNT_EMAIL=svc-avocat-drive@<project>.iam.gserviceaccount.com
GDRIVE_SERVICE_ACCOUNT_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GDRIVE_FOLDER_ID=<FOLDER_ID_AUTORISE>
# Optionnel si Shared Drive
GDRIVE_SHARED_DRIVE_ID=<DRIVE_ID>
# Webhook push (optionnel) – adresse publique pointant vers /gdrive/webhook
GDRIVE_WEBHOOK_URL=https://api.example.test/gdrive/webhook
GDRIVE_WATCH_CHANNEL_TOKEN=<RANDOM_SECRET>
```

3) Dans la Console Admin, ouvrez « Google Drive — Watch », saisissez l’ID du dossier (et du Drive si applicable), puis **Installer**.

- Si les identifiants sont valides, l’API récupère un `startPageToken` et tente de créer un canal Push (changes.watch) si `GDRIVE_WEBHOOK_URL` est défini. À défaut, le mode Pull reste disponible via `/gdrive/process-changes`.

4) Pour traiter les changements (mode Pull) :

```bash
curl -X POST http://localhost:3000/gdrive/process-changes \
  -H "Content-Type: application/json" \
  -H "x-user-id: 00000000-0000-0000-0000-000000000000" \
  -d '{ "orgId": "00000000-0000-0000-0000-000000000000" }'
```

L’API lit les changements, filtre par `folder_id`, exporte/telecharge les fichiers (HTML/CSV/PDF selon le type),
les stocke dans le bucket `snapshots`, crée/actualise `documents`, exécute une synthèse + embeddings (si `OPENAI_API_KEY`), insère `document_chunks`, puis met à jour `ingestion_runs`.

5) Traitement de manifeste (Drive Watcher Edge) : depuis la page « Corpus & Sources », collez l’URL d’un manifeste JSON/JSONL pour valider les entrées (allowlist, dates, langue Maghreb) et suivre la télémétrie.

## CI/CD

Le workflow GitHub Actions `.github/workflows/ci.yml` installe les dépendances PNPM, exécute `pnpm lint`, applique les migrations contre une instance Postgres de test et lance la suite de tests (`pnpm test`). Ajoutez vos étapes de déploiement selon vos environnements cibles pour garantir la conformité du plan de mise en production.

Consult `docs/avocat_ai_bell_system_plan.md` for the full BELL analysis and delivery roadmap.

## Gouvernance, conformité et exploitation

- Consultez [`docs/governance/`](docs/governance/) pour les politiques officielles : IA responsable, gestion des conflits, rétention, réponse aux incidents, gestion des changements, onboarding pilote et SLO/support.
- Les migrations `0026_user_management.sql` et `0027_user_management_rls.sql` ajoutent les tables et politiques nécessaires à la gestion d'utilisateurs multi-tenant (RBAC × ABAC, consentement, audit, invitations, entitlements). Toute requête API doit inclure `X-Org-Id` afin d'évaluer les droits (`org_policies`, `jurisdiction_entitlements`) et de journaliser les actions sensibles dans `audit_events`.
- Lorsque des politiques renforcées sont activées, l'API exige également : `X-Auth-Strength: mfa` ou `passkey` si `mfa_required` vaut `true`, `X-Consent-Version` correspondant à `org_policies.ai_assist_consent_version`, `X-CoE-Disclosure-Version` pour attester l'adhésion au traité du Conseil de l'Europe, et une adresse IP correspondant aux entrées `ip_allowlist_entries` lorsque `ip_allowlist_enforced` est actif.
- L'API `GET /metrics/governance?orgId=<uuid>` agrège les indicateurs clés (précision des citations, charge HITL, santé de l'ingestion, performance des outils) à partir des vues `org_metrics` et `tool_performance_metrics` créées par la migration `0025_governance_metrics.sql`.
- La console Admin affiche ces métriques dans le tableau de bord « Operations dashboard » et fournit un accès direct au téléchargement des politiques pour audit ou partage client.
- `pnpm ops:rotate-secrets` tente d'appeler l'API de gestion Supabase (`SUPABASE_ACCESS_TOKEN` + `SUPABASE_PROJECT_REF`) pour faire tourner les clés `anon` et `service_role`, et génère automatiquement des valeurs de secours si l'API n'est pas disponible. Conservez les nouveaux secrets dans votre gestionnaire sécurisé.
- `pnpm ops:rls-smoke` vérifie que `public.is_org_member` applique bien l'isolation multi-tenant après vos migrations (l'étape est également exécutée en CI).
