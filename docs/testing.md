# Testing

This repository includes unit tests across services and an end-to-end (E2E) regression for the compliance acknowledgement flow. The commands below assume you are running them from the monorepo root (`/workspace/lawai`).

## End-to-end compliance acknowledgement flow

The Playwright suite located in `apps/web/tests/e2e/` bootstraps the local API and web experience, then exercises the acknowledgement banner against a deterministic Supabase dataset. Follow these steps to run it locally:

1. **Start Supabase locally** (one-time per shell):
   ```bash
   supabase start
   ```
   The CLI writes credentials to `supabase/.env` after the stack is ready.

2. **Export Supabase credentials** so the API and seed scripts can connect:
   ```bash
   set -a
   source supabase/.env
   set +a
   ```

3. **Reset the database** to apply migrations and a clean slate:
   ```bash
   supabase db reset
   ```

4. **Seed acknowledgement fixtures** to ensure predictable banner state:
   ```bash
   node scripts/seed-acknowledgements.mjs
   ```
   You can override the seeded versions by setting `ACK_TEST_CONSENT_VERSION` or `ACK_TEST_COE_VERSION` in your environment before running the script.

5. **Install Playwright browsers** (first run only):
   ```bash
   cd apps/web
   npx playwright install --with-deps chromium
   cd ../..
   ```

6. **Run the E2E suite** (from the repository root):
   ```bash
   pnpm --filter @avocat-ai/web test:e2e
   ```

The configuration listens on `http://127.0.0.1:3000` for the Next.js app and `http://127.0.0.1:3333` for the Fastify API. Ensure these ports are available before starting the suite.

## Unit and integration tests

To execute the existing unit and integration suites across the workspace:

```bash
pnpm -r test
```

Refer to the individual package READMEs for additional testing commands (e.g., linting, type-checking).
