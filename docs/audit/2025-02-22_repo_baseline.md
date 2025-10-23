# Repository Baseline & Governance Audit (2025-02-22)

## 1. Git Topology & Merge Targets
- **Remotes** – No remotes are configured; `git remote -v` returns no entries. This branch will require an upstream remote before review/merge automation can run.【8e5f9a†L1-L2】
- **Local branches** – Only the `work` branch is available locally. No tracking branches are defined yet.【6f7883†L1-L3】
- **Canonical integration branch** – Workflow triggers (Monorepo CI) run on pushes to `main`; treat `main` as the integration trunk and merge target once a remote is added.【ba7e04†L1-L27】
  - Secondary workflows (`ci.yml`) also watch `master`, but all modern automation (Monorepo CI, preview deployments) key off `main`. Align future PRs to target `main` unless policy dictates otherwise.【691d98†L1-L48】

## 2. Toolchain & Script Inventory
- **Package manager mismatch** – The README directs contributors to use `pnpm`, yet the root package sets `packageManager` to `npm@11.4.2` and relies on npm workspaces/scripts. This divergence leads to mixed guidance and install flags across automation.【c7a11d†L17-L60】【437625†L1-L38】
  - CI workflows further mix approaches: `monorepo-ci.yml` performs `npm ci` (after enabling pnpm), while `ci.yml` uses pnpm end-to-end. Decide on a single package manager (pnpm recommended to match README and existing pnpm workspace files) and update scripts accordingly.【ba7e04†L14-L27】【691d98†L11-L48】【d809ed†L1-L4】
- **Dependency health** – `npm ls --workspaces` reports numerous version mismatches (e.g., `@types/node`, `eslint`, `typescript`, `vitest`) and missing dependencies for `@avocat-ai/web` (e.g., `@tanstack/react-query-devtools`, `docx`, `file-saver`, `framer-motion`). Extraneous packages remain in the root `node_modules`, indicating inconsistent installs between pnpm/npm.【a13272†L1-L130】
- **Script coverage** – The root scripts wrap workspace commands for build/test/lint/typecheck plus Supabase/ops orchestration. Keep leveraging workspace-scoped scripts (`apps/api`, `apps/web`, `apps/ops`) for focused iteration and align CI to those entrypoints.【437625†L10-L38】【ce1898†L1-L34】【e8844a†L1-L47】【4aaf29†L1-L41】
- **pnpm workspace tooling** – `pnpm m list` currently returns no data, suggesting the `m` plugin is absent or not configured; document whether the repo intends to use pnpm `m` (monorepo) commands or retire them to avoid confusion.【d146e9†L1-L2】

## 3. Architecture Overview

### 3.1 High-level System Context
```mermaid
graph TD
  subgraph Web Layer
    WebApp[Next.js Operator Console (@avocat-ai/web)]
    PWA[PWA Shell (@apps/pwa)]
  end
  subgraph API Layer
    API[Fastify Agent Orchestrator (@apps/api)]
  end
  subgraph Ops Tooling
    OpsCLI[CLI Orchestration (@apps/ops)]
  end
  subgraph Shared Packages
    Shared[@avocat-ai/shared]
    SupabasePkg[@avocat-ai/supabase]
  end
  subgraph Supabase Cloud
    SupabaseDB[(Postgres + Storage)]
    EdgeFuncs[Edge Functions (apps/edge)]
  end
  WebApp -->|REST & Webhooks| API
  PWA --> API
  API -->|Tenancy + Storage| SupabaseDB
  EdgeFuncs --> SupabaseDB
  OpsCLI -->|Provision/Migrations| SupabaseDB
  OpsCLI --> API
  Shared --> API
  Shared --> WebApp
  Shared --> OpsCLI
  SupabasePkg --> WebApp
  SupabasePkg --> API
  SupabasePkg --> OpsCLI
```

### 3.2 Deployment & Ops Interactions
```mermaid
graph LR
  Dev[Developer] -->|Runs| OpsCLI
  OpsCLI -->|CLI Scripts| SupabaseMgmt[Supabase Management API]
  OpsCLI -->|Vector sync| OpenAI[OpenAI APIs]
  OpsCLI -->|Reports| GovernanceDocs[docs/governance/*]
  API -->|Exports agent| AgentsPkg[@openai/agents]
  WebApp -->|Auth + Data| SupabaseAuth[Supabase Auth]
  SupabaseDB[(Supabase DB/Storage)] --> WebApp
  SupabaseDB --> API
  EdgeFuncs -.->|Schedulers| SupabaseDB
  CI[CI Workflows] -->|lint/test/build| npmScripts[Workspace Scripts]
  CI -->|Deploys| Vercel[Vercel Projects]
```

## 4. Environment Variable Inventory & Gaps
- **Shared baseline (`.env.example`)** – Centralises OpenAI, Supabase, alerting, and dashboard thresholds. It introduces `SUPABASE_ANON_KEY`, alert webhooks, and transparency IDs not surfaced in service-specific examples; confirm whether API/web/ops read from root `.env` or expect per-app copies.【09afc6†L1-L73】
- **API service (`apps/api/.env.example`)** – Adds runtime ports, logging, WhatsApp templates, C2PA signing, and service-specific OpenAI tagging. Lacks `SUPABASE_ANON_KEY`, `SUPABASE_DB_URL`, and alert webhooks present at root, suggesting either unused or missing wiring in the API layer.【e9e1ad†L1-L38】
- **Web console (`apps/web/.env.example`)** – Focuses on Supabase service-role credentials (for server actions) and Next.js public metrics toggles; omits WhatsApp/C2PA variables which might be needed for feature parity with the API. Ensure these omissions are intentional.【8ca826†L1-L18】
- **Ops tooling (`apps/ops/.env.example`)** – Includes Supabase DB URL, management token, default org/user IDs, and vector store toggles. Shares many OpenAI tags with the API; consider centralising these in the root `.env` to avoid drift. Also defines `API_BASE_URL` instead of `NEXT_PUBLIC_API_BASE_URL`, which may cause inconsistencies when running scripts locally.【1938da†L1-L28】
- **Duplication highlights**:
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, and `OPENAI_VECTOR_STORE_AUTHORITIES_ID` appear in all environments; manage them via shared `.env` or secrets manager to reduce duplication risk.【09afc6†L26-L54】【e9e1ad†L21-L33】【8ca826†L1-L7】【1938da†L5-L25】
  - Dashboard thresholds (`NEXT_PUBLIC_*`) exist in both root and web `.env.example`; ensure the authoritative source is the web app to avoid conflicting documentation.【09afc6†L18-L36】【8ca826†L10-L18】
- **Gaps**:
  - Web `.env.example` lacks `NEXT_PUBLIC_SUPABASE_ANON_KEY`; verify whether Supabase auth relies on server-side service-role only or needs anon keys for client components.
  - API `.env.example` references WhatsApp + C2PA integration; corresponding secrets are absent from ops/web examples—call out if cross-service usage is expected.

## 5. Repository Conventions & Alignment Plan
- **Commit governance** – No CODEOWNERS or documented commit message policy exists; establish CODEOWNERS to gate critical paths and adopt a Conventional Commits (or similar) guide to standardise history before large refactors.【7d0dab†L1-L2】
- **CI gates** – `ci.yml` enforces workspace linting, typechecking (API + Web), migrations check, tests, and builds; `monorepo-ci.yml` provides an npm-based build/test fallback. Rationalise to a single workflow (prefer pnpm) and ensure new refactors keep migrations check and ops smoke tests enabled.【691d98†L11-L84】【ba7e04†L14-L29】
- **Preview/Deployment** – Additional workflows (`preview.yml`, `vercel-preview-build.yml`, `deploy.yml`) manage preview artefacts and Vercel deployments. Validate that future PRs surface the correct preview artefacts and align with Vercel’s production branch (`main`).【3a8a0b†L1-L1】
- **Recommended actions**:
  1. Publish a CONTRIBUTING guide covering package manager choice, commit style, and PR checklist (lint/typecheck/test + `pnpm check:binaries`).
  2. Adopt workspace-level dependency constraints (e.g., pnpm `overrides`) to eliminate current version drift.
  3. Introduce secrets management guidance (Supabase, OpenAI, WhatsApp) to prevent environment skew between services.

---
**Next steps** – Once package manager alignment and environment documentation are settled, we can plan targeted refactors (shared environment loader, dependency dedupe, ops/web integration tests) with confidence in the baseline above.
