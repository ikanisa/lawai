# Public PWA (`@apps/pwa`)

Next.js App Router surface for litigants and reviewers. Ships offline support via `next-pwa`, 3D explainers powered by three.js, and Radix UI primitives.

## Prerequisites

- Node.js 20.x
- pnpm 8.15.4
- Browser-friendly Supabase anon key and API URL
- Optional: Cypress (`pnpm dlx cypress open`) for E2E runs

## Install

```bash
pnpm install
cp apps/pwa/.env.example apps/pwa/.env.local
```

## Development

```bash
pnpm --filter @apps/pwa run dev            # http://localhost:3000
```

Set `PORT=3002` to avoid clashing with the operator console. Run `pnpm --filter @apps/pwa run bundle:check` before merging to guard bundle size budgets.

## Quality gates

```bash
pnpm --filter @apps/pwa run lint
pnpm --filter @apps/pwa run typecheck
pnpm --filter @apps/pwa run test
pnpm --filter @apps/pwa run cy:e2e         # optional, requires browsers
```

Vitest executes React Testing Library suites. Cypress end-to-end tests hit the deployed preview URL when `NEXT_PUBLIC_PREVIEW_URL` is configured.

## Build & deploy

```bash
pnpm --filter @apps/pwa run build
pnpm --filter @apps/pwa run start          # production mode
```

Vercel is the canonical deploy target. Ensure preview builds succeed before promoting to production (`main` branch merges trigger the Production deploy). Consult [`../../docs/deployment/vercel.md`](../../docs/deployment/vercel.md) for the full checklist.

## Observability

Client runtime emits Web Vitals and custom events to the **User Experience** dashboard. Dashboard wiring instructions live in [`../../docs/observability.md`](../../docs/observability.md). Use the Troubleshooting playbook in [`../../docs/troubleshooting_network.md`](../../docs/troubleshooting_network.md) when preview builds fail to reach Supabase.
