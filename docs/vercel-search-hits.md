# Vercel references audit

Summary of `rg "vercel" -n` hits across `apps/`, `packages/`, `scripts/`, and `.github/` (no `services/` or `infra/` directories exist in the repo):

- `.github/workflows/vercel-preview-build.yml`
  - L19: GitHub Action step running `npx vercel pull` for preview env.
  - L23: GitHub Action step running `npx vercel build` with token.
  - L28-L29: Artifact upload configuration pointing at `.vercel/output/logs`.
- `scripts/vercel-preflight.mjs`
  - L71-L72: Invokes `npx vercel pull` and `npx vercel build` during preflight script.
- `apps/web/vercel.json`
  - L2: References Vercel schema (`https://openapi.vercel.sh/vercel.json`).
