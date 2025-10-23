# Caddy + Cloudflare Tunnel Implementation Plan

This document captures the repository-wide assessment and phased execution plan for introducing a macOS-first reverse proxy and Cloudflare Zero-Trust wrapper around the private admin application. The goal is to front the existing Next.js admin with Caddy on `:8080`, expose it securely through a Cloudflare Tunnel at `https://${ADMIN_HOSTNAME}`, and publish a reproducible runbook without altering the app source.

## Repository Assessment

### Monorepo structure
- **Workspace orchestration.** The repository is governed by `pnpm-workspace.yaml`, grouping all Node-based services under a single lockfile. Task execution relies on pnpm scripts and shared TypeScript configurations rather than Turborepo.
- **Applications.**
  - `apps/web`: Next.js 14 App Router admin UI with Supabase auth helpers in `apps/web/src/server/supabase` and shared utilities in `apps/web/src/lib`, UI primitives under `apps/web/src/components`, and API routes within `apps/web/app/api`.
  - `apps/api`: Fastify + OpenAI orchestration service; exposes `pnpm dev`/`start` scripts in `apps/api/package.json` and depends on shared packages for logging, schema validation, and Supabase access.
  - `apps/edge`: Supabase Edge functions (TypeScript) with deploy scripts in `supabase/functions`.
  - `apps/ops`: CLI/process automation toolkit used by operations staff; relies on shared utils inside `packages/`.
  - `apps/pwa`: Progressive Web App shell that shares UI primitives with the admin interface.
- **Shared packages.** The `packages/` folder hosts `packages/config` (linting/tsconfig bases), `packages/shared` (domain models, zod schemas, Supabase helpers), and `packages/supabase` (database client abstractions). None require changes for the tunnel work but may consume environment variables we introduce.

### Runtime & developer tooling
- **Environment management.** `.env.example` at the root holds Supabase and OpenAI placeholders. Each app duplicates the pattern (`apps/web/.env.example`, `apps/api/.env.example`, etc.). No variable currently captures an external admin hostname, so introducing `ADMIN_HOSTNAME` will be additive.
- **Local operations guides.** `docs/local-hosting.md` provides macOS-first instructions for running the API and web stack, leaning on Homebrew, pnpm, Supabase CLI, and Docker (for optional services). There is no mention of reverse proxies or Cloudflare tunnels today, so new docs should cross-link here.
- **Automation scripts.** `scripts/` contains SQL linting, Supabase helpers, seeders, and deployment utilities but no orchestration for reverse proxies. Introducing `scripts/mac/` keeps tunnel tooling isolated from existing CI scripts.
- **Testing & linting.** `package.json` defines workspace-level scripts (`lint`, `typecheck`, `test`). None conflict with the proposed additions, but validation steps should confirm they still succeed after adding Make targets.
- **Ignore rules.** `.gitignore` blocks node modules, pnpm state, `.turbo`, `.next`, and logs (`*.log`) but does not account for PID or log directories that background services might create (e.g., `.logs/`). Update rules before introducing background scripts.

### Deployment context
- **legacy hosting platform deployments.** The admin (`apps/web`) deploys to legacy hosting platform; the new proxy/tunnel tooling must remain local-only. Document that legacy hosting platform workflows are unaffected and include a post-merge smoke test against the production deployment.
- **Supabase + Cloudflare.** Supabase provides auth/storage while Cloudflare DNS is authoritative for the public hostname. Any new hostname must be added to Supabase redirect/CORS settings and Cloudflare Access policies to maintain login flows.
- **Ops alignment.** Existing runbooks in `docs/operations/` and `docs/runbooks/` emphasise reversible automation. The new plan should mirror that tone with explicit rollback steps and references to existing incident response guides where applicable.

## Constraints & Non-Goals

1. **Additive-only.** Do not modify existing application code paths (`apps/`, `packages/`, `db/`). All changes live in `infra/`, `scripts/`, `docs/`, `.env.example`, and a new Makefile.
2. **No secrets in git.** Cloudflare credentials and hostnames must remain placeholders. Provide `.example` files and documentation instructions for local configuration.
3. **macOS-first tooling.** Prefer Homebrew (`brew bundle`) and shell scripts targeting macOS. Linux considerations may be called out in docs but not implemented.
4. **Private-by-default.** Ensure instructions emphasise Cloudflare Access policy setup before sharing the tunneled hostname.
5. **Rollback clarity.** Provide stop commands and optional uninstall steps for caddy/cloudflared.

## Phased Execution Plan

### Phase 0 — Baseline & Branching
- Create branch `chore/add-caddy-cloudflared-mac` and capture baseline context (tree, README excerpts) for reviewers.
- Ensure `.gitignore` (or new git rules) covers `.logs/` to avoid committing PID/log artefacts produced by background scripts.
- Verify `package.json` already advertises the correct `start` command (`next start -p ${PORT:-3000}` if alignment is needed) before introducing wrapper automation.
- Capture a high-level architectural snapshot (diagram or summary) in the PR to show reviewers which services remain untouched.

:::task-stub{title="Baseline branch and git hygiene"}
1. Create branch `chore/add-caddy-cloudflared-mac` from `main` and push it to origin.
2. Append `/.logs/` to `.gitignore` (or confirm existing ignore rules) to protect background log output.
3. Confirm the admin start command (`apps/web/package.json` and root `package.json`) matches the documented port assumptions (3000) and adjust only if necessary.
4. Document baseline service status (pnpm test, lint) in the PR description to demonstrate nothing regressed before infra changes.
:::

### Phase 1 — Homebrew Bundle & Dependency Bootstrapping
- Introduce `infra/mac/Brewfile` to pin `caddy` and `cloudflared` installations.
- Provide an installer script (`scripts/mac/install_caddy_cloudflared.sh`) that runs `brew bundle`, prints follow-up steps, and checks for Homebrew.
- Ensure the script lives under `scripts/mac/` with executable permissions and is referenced by new docs and Make targets.
- Record the installer usage in `docs/local-hosting.md` (or cross-link) so macOS operators have a single entry point.

:::task-stub{title="Add Brew bundle and installer"}
1. Create `infra/mac/` and add a `Brewfile` listing `caddy` and `cloudflared`.
2. Author `scripts/mac/install_caddy_cloudflared.sh` (macOS shell script) that checks for Homebrew, runs `brew bundle`, and prints next steps for configuring the tunnel.
3. Mark the script executable (`chmod +x`) and test it locally on macOS.
4. Update `docs/local-hosting.md` with a short “Proxy/Tunnel prerequisites” pointer to this installer to keep runbooks aligned.
:::

### Phase 2 — Caddy Reverse Proxy Configuration
- Add `infra/caddy/Caddyfile` to proxy `:8080 → localhost:3000` with sensible security headers. Keep it HTTP-only (Cloudflared will terminate TLS).
- Provide foreground (`caddy_up.sh`) and background (`caddy_bg.sh`) scripts plus a shutdown helper (`caddy_down.sh`) that manage PID files in `.logs/`.
- Ensure scripts validate the presence of `caddy` and point to the repo Caddyfile.
- Plan for a future Linux script variant by capturing deltas/limitations in documentation, even if not implemented now.

:::task-stub{title="Provision Caddy config and controls"}
1. Create `infra/caddy/Caddyfile` with reverse proxy definition, compression, and headers.
2. Implement `scripts/mac/caddy_up.sh` (foreground run) and `caddy_bg.sh` (background with `.logs/caddy.pid` & `.logs/caddy.out`).
3. Implement `scripts/mac/caddy_down.sh` to kill the recorded PID or fall back to `pkill`.
4. Test both foreground and background flows locally to confirm proxying works against `pnpm start`.
5. Document any macOS firewall prompts triggered by Caddy on first run so operators can pre-approve them.
:::

### Phase 3 — Cloudflared Tunnel Templates & Scripts
- Introduce `infra/cloudflared/config.yml.example` with placeholder tunnel settings, `${ADMIN_HOSTNAME}` variable expansion, and explicit notes on copying to `.gitignored` `config.yml`.
- Add `tunnel_up.sh`, `tunnel_bg.sh`, and `tunnel_down.sh` under `scripts/mac/` following the same pattern as Caddy (PID + logs under `.logs/`).
- Each script should gate on `cloudflared` presence and enforce that `infra/cloudflared/config.yml` exists before running.
- Capture instructions for rotating tunnel credentials and revoking old certs in the documentation to support incident response.

:::task-stub{title="Template Cloudflared tunnel and controls"}
1. Add `infra/cloudflared/config.yml.example` describing tunnel name, credentials file path placeholder, and ingress rules.
2. Implement macOS scripts `tunnel_up.sh`, `tunnel_bg.sh`, `tunnel_down.sh` mirroring the Caddy helpers with PID management.
3. Manually verify the foreground and background scripts on macOS after creating a real `config.yml`.
4. Add a note in the PR about storing `infra/cloudflared/config.yml` in 1Password or a secrets manager to prevent local misplacement.
:::

### Phase 4 — Makefile Integration & Developer UX
- Introduce a root `Makefile` with phony targets: `deps`, `build`, `start`, `admin`, `caddy-up/bg/down`, `tunnel-up/bg/down`.
- Ensure the `admin` target chains `pnpm build && pnpm start` to match the prompt.
- Wire the Makefile to call the new mac scripts and reuse existing pnpm commands.
- Validate that existing workspace scripts (`pnpm lint`, `pnpm test`, `pnpm build`) still work post-Makefile by checking CI or running locally.

:::task-stub{title="Expose convenience Make targets"}
1. Create `Makefile` with `deps`, `build`, `start`, `admin`, and proxy/tunnel management targets.
2. Point `deps` to the installer script; `admin` should run `pnpm build && pnpm start` in sequence.
3. Smoke test `make caddy-up`, `make caddy-bg`, `make tunnel-up`, and `make tunnel-bg` locally.
4. Confirm the new Make targets do not clash with existing CI jobs (`pnpm lint`, `pnpm test`) by running them before raising the PR.
:::

### Phase 5 — Documentation & Environment Updates
- Add `docs/local-caddy-cloudflare-tunnel.md` explaining installation, configuration, Cloudflare Access, Supabase CORS updates, validation steps, and rollback.
- Update `.env.example` to include `ADMIN_HOSTNAME=admin.sacco-plus.com` (placeholder) for consistency across docs/scripts.
- Cross-link from existing docs (e.g., add a short pointer in `docs/local-hosting.md` or README if desired) to surface the new playbook.
- Include a troubleshooting appendix (common tunnel errors, log paths) so operators can self-serve.

:::task-stub{title="Document workflow and surface env vars"}
1. Write `docs/local-caddy-cloudflare-tunnel.md` with step-by-step instructions (install, configure, run, Access, Supabase CORS, rollback).
2. Append `ADMIN_HOSTNAME=admin.sacco-plus.com` to `.env.example` near front-end settings.
3. Optionally update `docs/local-hosting.md` or README with a short reference to the new tunnel guide.
4. Add troubleshooting tips (log locations, Access policy debugging) to the new doc for faster iteration.
:::

### Phase 6 — Validation, PR, and Rollback Notes
- Draft validation checklist for PR body (make deps, start admin, test Caddy, configure Cloudflare, run tunnel, enforce Access, update Supabase CORS, end-to-end auth).
- Describe rollback (stop services, remove `.logs` if desired, `brew uninstall caddy cloudflared`).
- Ensure final PR summarises additive infra changes and includes verification steps (screenshots unnecessary unless UI changes occur).
- Coordinate with release managers to schedule merge during a low-traffic window and prepare a legacy hosting platform smoke test (visit production admin, confirm login).
- Outline monitoring signals (Cloudflare Zero Trust logs, Supabase auth logs) to watch post-merge.

:::task-stub{title="Validate and land the feature"}
1. Run through the local validation plan; capture any macOS-specific caveats for reviewers.
2. Assemble PR body with checklist and rollback instructions; request review from infra owners.
3. After approval and merge, monitor legacy hosting platform deployment (if admin app is deployed there) to confirm unaffected behaviour.
4. Document Cloudflare Access logs and Supabase metrics to review during rollout; link them in the PR for reviewers.
:::

## Risk & Mitigation Summary

- **Process conflicts.** Starting Caddy or cloudflared without shutting them down can leave orphaned PIDs. PID files and `pkill` fallback mitigate this; docs emphasise `make caddy-down`/`make tunnel-down`.
- **Port collisions.** Document default ports (`3000` for Next.js, `8080` for Caddy) and note how to adjust via env overrides if future conflicts arise.
- **TLS expectations.** Caddy listens on HTTP locally to avoid certificate issues; Cloudflare terminates TLS externally. Explicitly call this out in docs to prevent local TLS misconfiguration.
- **Supabase auth redirect errors.** Emphasise adding the tunneled hostname to Supabase redirect/CORS settings to avoid login loops when using the remote URL.
- **Secret leakage.** Use `.example` configs and highlight never to commit real credentials. Encourage storing `infra/cloudflared/config.yml` outside git.

Following these phases keeps changes additive, macOS-first, and fully documented for safe rollout and rollback.
