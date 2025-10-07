# Avocat-AI Francophone — Phase 9 Release Notes

**Release date:** _TBD (awaiting production credential wiring)_  
**Release owner:** Agent-First Front-End Team

## Highlights

- ✅ **Launch pipeline hardened** — CI now enforces linting, testing, migrations, evaluation harness runs, Go/No-Go sign-offs, and a Next.js production build that must satisfy bundle budgets (1.9 MB aggregate chunks, 420 KB max entry). A companion preview workflow publishes downloadable artifacts for every PR.
- ✅ **PWA install & offline polish** — Workbox precaches the offline shell, serves `/offline.html` on navigation failures, and exposes a proactive install banner with a 14-day snooze, coupled with refreshed 192/512/maskable icons and shortcut badges.
- ✅ **Operations playbooks** — New launch runbook documents telemetry dashboards, guardrail verification steps, HITL escalation paths, and promotion procedures tied to secret rotation.
- ✅ **Telemetry instrumentation** — The workspace hero, research desk, drafting studio, procedural navigator, consoles, and voice bar emit Web Vitals, accuracy, recall, latency, and offline retry metrics into the telemetry dashboard provider for post-launch monitoring.

## Upgrade Guide

1. **Pull the release tag** and run `pnpm install --frozen-lockfile` to align dependencies.
2. **Build assets** with `pnpm --filter @apps/pwa build && pnpm --filter @apps/pwa bundle:check` prior to deploying to staging.
3. **Populate environment secrets** (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `PREVIEW_API_BASE_URL`) in the GitHub repository and target hosting platform.
4. **Publish the preview artifact** from the GitHub Actions summary when circulating to stakeholders.

## Acceptance Verification

- [ ] Lighthouse PWA score ≥ 90 with installable status and offline capability.
- [ ] Workbox catch handler renders the offline card when network requests fail.
- [ ] Install prompt banner appears on Chromium browsers and respects the 14-day snooze.
- [ ] Telemetry dashboard captures LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 on Pixel 6 profile.
- [ ] HITL escalation path confirmed end-to-end (Research → HIGH risk → queue → resolution recorded).

## Known Limitations

- Mock API responses remain until backend services supply production data sources. Swap to live endpoints before GA.
- Database migrations contain placeholders for production IDs; coordinate with the platform team before applying to shared environments.
- Voice realtime API uses stub tokens in development; ensure `/api/realtime/session` is backed by the production agent orchestrator during rollout.

## Residual Risks

| Risk | Mitigation |
| --- | --- |
| Bundle budgets may regress as new features arrive. | Monitor CI bundle check failures and refactor with dynamic imports when needed. |
| Offline shell serves static copy without localisation toggles. | Follow-up backlog item to render locale-specific offline HTML snippets. |
| Preview artifact requires manual hosting for stakeholders. | Evaluate integrating with Vercel/Pages for automated staging once credentials are provisioned. |

## Next Steps

- Wire production Supabase/OpenAI credentials and flip mock APIs to live services.
- Extend offline fallback to include contextual help and support contact details per jurisdiction.
- Automate deployment to staging/production hosting once compliance review approves target infrastructure.
