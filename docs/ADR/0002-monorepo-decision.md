# ADR 0002: Monorepo Consolidation and Workspace Layout

- **Status:** Proposed
- **Deciders:** Platform Engineering, Experience Engineering, Database Engineering
- **Date:** 2025-02-25

## Context

The Avocat-AI repository is organised as a PNPM workspace that currently treats every top-level `apps/*`, `packages/*`, and `db/*` directory as a first-class project. This layout made sense while each team iterated independently, but it now forces duplicate tooling, duplicated Supabase migrations, and uneven framework upgrades across surfaces.【F:pnpm-workspace.yaml†L1-L4】【F:README.md†L5-L31】 Consolidation is required to eliminate the `JB/*` shadow workspace, establish shared config ownership, and unblock a single deployment cadence for Vercel and Supabase.

## Decision

We will converge on a single workspace tree by:

1. Grouping runtime services under `apps/platform/*` and user-facing experiences under `apps/experience/*`.
2. Normalising shared libraries under clear domain buckets (`packages/platform`, `packages/domain`, `packages/ui`) and relocating repository-wide tooling into a new `configs/` root.
3. Folding database assets into Supabase's canonical structure while preserving git history with explicit `git mv` steps.
4. Establishing a framework version alignment plan (Next.js, React, TanStack Query, Tailwind CSS) so every surface upgrades in lockstep.

These steps unblock `pnpm recursive` tooling, clarify ownership, and keep subsequent `git mv` operations deterministic for review tooling.

## Migration Plan

### Application Moves

| Current Path | Target Path | `git mv` Command | Notes |
| --- | --- | --- | --- |
| `apps/api` | `apps/platform/api` | `git mv apps/api apps/platform/api` | Fastify orchestrator remains under Platform Engineering ownership. |
| `apps/edge` | `apps/platform/edge-functions` | `git mv apps/edge apps/platform/edge-functions` | Supabase edge functions align with backend deploy pipeline. |
| `apps/ops` | `apps/platform/ops-cli` | `git mv apps/ops apps/platform/ops-cli` | CLI + schedulers join platform toolchain for shared infra secrets. |
| `apps/pwa` | `apps/experience/public-pwa` | `git mv apps/pwa apps/experience/public-pwa` | Public-facing Next.js surface grouped with other product experiences. |
| `apps/web` | `apps/experience/operator-console` | `git mv apps/web apps/experience/operator-console` | Operator console shares React stack with public PWA while keeping distinct build output. |

### Package Moves

| Current Path | Target Path | `git mv` Command | Notes |
| --- | --- | --- | --- |
| `packages/api-clients` | `packages/platform/api-clients` | `git mv packages/api-clients packages/platform/api-clients` | Houses REST/agent SDKs consumed by platform services. |
| `packages/compliance` | `packages/domain/compliance` | `git mv packages/compliance packages/domain/compliance` | Domain logic shared by API and workflows. |
| `packages/config` | `configs/eslint` | `git mv packages/config configs/eslint` | ESLint presets relocate to dedicated `configs/` root (see System Overview). |
| `packages/observability` | `packages/platform/observability` | `git mv packages/observability packages/platform/observability` | Logging/metrics infrastructure shared across services. |
| `packages/shared` | `packages/domain/shared` | `git mv packages/shared packages/domain/shared` | Domain models & utilities surfaced via `@avocat-ai/shared`. |
| `packages/supabase` | `packages/platform/supabase` | `git mv packages/supabase packages/platform/supabase` | Generated Supabase types owned by platform data team. |
| `packages/ui-plan-drawer` | `packages/ui/plan-drawer` | `git mv packages/ui-plan-drawer packages/ui/plan-drawer` | UI primitives grouped by design system maintainers. |

### Database Moves

| Current Path | Target Path | `git mv` Command | Notes |
| --- | --- | --- | --- |
| `db/migrations` | `supabase/migrations/core` | `git mv db/migrations supabase/migrations/core` | Collocates historical SQL alongside Supabase-managed migrations for parity. |
| `db/seed` | `supabase/seed` | `git mv db/seed supabase/seed` | Seed scripts join Supabase directory for single-source bootstrap. |

### Infrastructure Moves

| Current Path | Target Path | `git mv` Command | Notes |
| --- | --- | --- | --- |
| `infra/caddy` | `infra/proxy/caddy` | `git mv infra/caddy infra/proxy/caddy` | Groups reverse-proxy configuration with other ingress tooling. |
| `infra/cloudflared` | `infra/network/cloudflared` | `git mv infra/cloudflared infra/network/cloudflared` | Network tunnels move under shared networking stack. |

## Version Alignment Strategy

To keep Next.js surfaces deployable in a single Vercel preview, we will align on the following framework versions and enforce them through shared configs:

| Stack | Target Version | Rationale |
| --- | --- | --- |
| Next.js | `14.2.5` | Matches operator console and is the latest stable App Router release already running in production.【F:apps/web/package.json†L9-L74】 |
| React | `18.3.1` | Keeps both experiences on the React 18 line to avoid mismatched concurrent rendering between apps.【F:apps/web/package.json†L41-L44】【F:apps/pwa/package.json†L39-L44】 |
| TanStack Query | `^5.51.9` | Aligns data fetching hooks used across operator console and PWA while respecting existing compatibility.【F:apps/web/package.json†L29-L30】【F:apps/pwa/package.json†L32-L34】 |
| Tailwind CSS | `3.4.4` | Already consistent between surfaces; pin in shared config to avoid drift.【F:apps/web/package.json†L71-L74】【F:apps/pwa/package.json†L34-L46】 |

Action items:

1. Downgrade `apps/experience/public-pwa` from the experimental Next 16/React 19 stack to the approved versions before executing the moves.【F:apps/pwa/package.json†L39-L44】
2. Publish unified ESLint, TypeScript, Vitest, and Cypress presets from `configs/` so every workspace shares the same peer dependency ranges.
3. Wire Renovate/Changesets to gate upgrades on multi-app smoke tests once consolidation completes.

This alignment removes conflicting peer trees, keeps Vercel preview builds deterministic, and lets Supabase-driven migrations use a single CLI pipeline.
