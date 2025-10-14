# Production Go-Live Readiness Audit

## Executive Summary
- The monorepo already wires together a Fastify API, Next.js operator console, Supabase integrations, and operational runbooks; however, several core flows still rely on demo scaffolding or TODO placeholders that block a production cutover.【F:README.md†L1-L101】【F:apps/api/src/domain/workspace/routes.ts†L5-L32】
- Mission-critical compliance, workspace, and orchestration endpoints remain inside `server.ts` rather than the newer domain modules, leaving type coverage disabled (`// @ts-nocheck`) and hampering extensibility, observability, and testability for the API surface.【F:apps/api/src/app.ts†L1-L45】【F:apps/api/src/server.ts†L735-L887】
- The front-end assumes fixed demo organisation/user identifiers, registers the PWA service worker for every browser session, and lacks production authentication wiring, creating UX confusion and security gaps once real tenants onboard.【F:apps/web/src/lib/api.ts†L3-L112】【F:apps/web/src/components/compliance-banner.tsx†L8-L109】【F:apps/web/src/components/providers.tsx†L1-L38】

## Backend Code Review
### Architecture & Configuration
- `config.ts` validates secrets in production but still defaults vector-store and Supabase identifiers to placeholder values; failure to override them halts the process, so CI/CD must guarantee environment parity and runtime secret injection before go-live.【F:apps/api/src/config.ts†L8-L89】
- The `createApp` factory instantiates Fastify with sensitive header redaction but keeps `@ts-nocheck`, preventing static safety on the most critical code path. Removing the directive and fixing type issues is required before production hardening.【F:apps/api/src/app.ts†L1-L45】
- Workspace routing under `apps/api/src/domain` still contains TODO scaffolding and fetches a single run ID; the richer logic that lives in `server.ts` needs to be migrated into well-scoped handlers with unit coverage.【F:apps/api/src/domain/workspace/routes.ts†L5-L32】

### API Surface
- High-risk endpoints such as `/compliance/status`, `/compliance/acknowledgements`, `/runs`, and governance metrics stay in the monolithic `server.ts`. They rely on shared utilities (`authorizeRequestWithGuards`, Supabase client) but lack per-route rate limits, schema registration, and modularisation, making the file difficult to audit and reuse.【F:apps/api/src/server.ts†L704-L920】
- Rate limiting currently protects only the telemetry endpoint via an in-memory limiter; login, compliance, and run execution routes are uncovered, creating a DoS risk in multi-tenant production. Extend limiter coverage and persist limits (e.g., Redis) before launch.【F:apps/api/src/server.ts†L64-L93】

### Data & Integrations
- Supabase service client creation wraps generated helpers but returns an `unknown` cast; formalise typed clients and ensure row-level security checks are mirrored in tests for high-risk tables like `consent_events` and `agent_runs`.【F:apps/api/src/supabase-client.ts†L1-L7】【F:apps/api/src/server.ts†L704-L835】
- Compliance acknowledgement writes are performed in bulk without transactional guarantees; if one insert fails the retry logic may re-send duplicates. Consider using `supabase.rpc` or explicit transactions when migrating to the modular handler.【F:apps/api/src/server.ts†L704-L733】

## Front-End Review & UI/UX Audit
### App Shell & Navigation
- The App Shell exposes rich navigation, confidential-mode toggles, offline outbox, and command palette triggers; however, the command palette depends on long-press detection that may conflict with assistive technologies and lacks explicit keyboard hints beyond `/` and `⌘K` copy. Document and test these gestures against accessibility tools.【F:apps/web/src/components/app-shell.tsx†L49-L200】【F:apps/web/src/components/command-palette.tsx†L1-L120】
- Root layout hardcodes `lang="fr"` while locales also include English; ensure locale routes set the correct `lang` attribute and default text direction for bilingual support.【F:apps/web/app/layout.tsx†L1-L18】【F:apps/web/src/lib/i18n.ts†L1-L20】

### State Management & Networking
- `AppProviders` globally registers a PWA service worker as soon as the component mounts, regardless of environment flags. Provide an opt-in guard (e.g., `NEXT_PUBLIC_ENABLE_PWA`) to avoid registering service workers in staging or server-side contexts where Workbox is unavailable.【F:apps/web/src/components/providers.tsx†L1-L38】【F:apps/web/src/lib/pwa.ts†L1-L57】
- API helpers ship with demo organisation and user IDs baked in; without authentication wiring, every user session will act as the same tenant, invalidating audit trails and producing confusing compliance banners fed by placeholder data.【F:apps/web/src/lib/api.ts†L3-L112】【F:apps/web/src/components/compliance-banner.tsx†L8-L109】

### UX Gaps
- Compliance banners and other data visualisations assume Supabase returns rich compliance history, but real deployments need empty-state copy, error fallback UI, and skeletons for long-running queries beyond the current generic toast notifications.【F:apps/web/src/components/compliance-banner.tsx†L19-L109】
- Command palette UI uses custom buttons without ARIA roles or screen-reader announcements when search results change; augment with `role="listbox"` semantics and live regions for better accessibility compliance.【F:apps/web/src/components/command-palette.tsx†L53-L120】

## Outstanding Items
| Priority | Area | Item |
| --- | --- | --- |
| Blocker | Backend | Remove `// @ts-nocheck` from `createApp`, migrate remaining endpoints out of `server.ts`, and re-enable strict typing/tests before release.【F:apps/api/src/app.ts†L1-L45】【F:apps/api/src/server.ts†L735-L920】 |
| Blocker | Backend | Replace placeholder workspace handler with production implementation, ensuring Supabase access patterns, caching, and rate limits are covered.【F:apps/api/src/domain/workspace/routes.ts†L5-L32】 |
| Blocker | Front-End | Integrate real auth/session context and eliminate `DEMO_ORG_ID`/`DEMO_USER_ID` usage across API helpers and components.【F:apps/web/src/lib/api.ts†L3-L112】【F:apps/web/src/components/compliance-banner.tsx†L8-L109】 |
| Blocker | Front-End | Gate PWA registration and notification prompts behind environment flags and user intent to avoid uncontrolled service-worker installs.【F:apps/web/src/components/providers.tsx†L1-L38】【F:apps/web/src/lib/pwa.ts†L1-L57】 |
| High | Security | Extend rate limiting beyond telemetry; add distributed stores for `/runs`, compliance, and auth-sensitive routes.【F:apps/api/src/server.ts†L64-L93】【F:apps/api/src/server.ts†L735-L887】 |
| High | Observability | Break `server.ts` into domain modules with structured logging, OpenAPI schemas, and request metrics to satisfy go-live monitoring requirements.【F:apps/api/src/server.ts†L40-L120】【F:apps/api/src/server.ts†L735-L920】 |
| High | UX | Add locale-aware `<html lang>` handling and accessibility improvements (ARIA roles, keyboard focus states) in command palette and navigation.【F:apps/web/app/layout.tsx†L1-L18】【F:apps/web/src/components/command-palette.tsx†L53-L120】 |
| Medium | Data Quality | Introduce transactional guarantees and retries around compliance acknowledgement writes to prevent duplicate consent events.【F:apps/api/src/server.ts†L704-L733】 |
| Medium | Reliability | Persist outbox queue and offline banner states per user rather than per-browser when auth lands, and add analytics for long-term monitoring.【F:apps/web/src/components/app-shell.tsx†L63-L200】 |
| Medium | Documentation | Update runbooks to describe new auth flow, PWA opt-in, and revised deployment prerequisites once code changes land.【F:README.md†L23-L161】 |

## Phased Implementation Plan
### Phase 0 – Launch Blockers (Week 0–1)
1. **Back-end hardening:** Remove `@ts-nocheck`, port compliance/workspace/run routes into domain modules, and enforce shared validation schemas plus integration tests covering Supabase access patterns.【F:apps/api/src/app.ts†L1-L45】【F:apps/api/src/server.ts†L735-L887】
2. **Authentication plumbing:** Replace demo IDs with real identity propagation on both client and server, including session middleware, guard updates, and updated UI copy.【F:apps/web/src/lib/api.ts†L3-L112】【F:apps/web/src/components/compliance-banner.tsx†L8-L109】
3. **PWA gating & rate limiting:** Add environment toggles for service worker registration and extend `InMemoryRateLimiter` usage (or swap to Redis) for all public endpoints to satisfy production SLOs.【F:apps/web/src/components/providers.tsx†L1-L38】【F:apps/web/src/lib/pwa.ts†L1-L57】【F:apps/api/src/server.ts†L64-L93】

### Phase 1 – Stability & Compliance (Week 2–3)
1. **Transactional compliance writes:** Introduce transactional or idempotent acknowledgement storage with retries and audit logging to maintain regulatory traceability.【F:apps/api/src/server.ts†L704-L733】
2. **Observability uplift:** Instrument modular routes with structured logs, metrics, and error taxonomies; wire dashboards to the existing ops tooling described in the README.【F:apps/api/src/server.ts†L40-L120】【F:README.md†L55-L161】
3. **UX accessibility:** Add locale-aware HTML attributes, improved keyboard focus, ARIA semantics, and offline/empty states for compliance banners and command palette interactions.【F:apps/web/app/layout.tsx†L1-L18】【F:apps/web/src/components/command-palette.tsx†L53-L120】【F:apps/web/src/components/compliance-banner.tsx†L19-L109】

### Phase 2 – Optimisation & Nice-to-haves (Week 4+)
1. **Service worker UX:** Provide user-controlled install prompts, release notes, and notification channels tied to authenticated profiles, leveraging `useOutbox` metrics for adoption tracking.【F:apps/web/src/components/app-shell.tsx†L63-L200】【F:apps/web/src/lib/pwa.ts†L1-L57】
   _Status:_ ✅ Completed via the new `PwaInstallPrompt`, digest opt-in controls, and release-note telemetry that keeps the service worker dormant until an operator approves the install flow.【F:apps/web/src/components/pwa-install-prompt.tsx†L1-L207】【F:apps/web/src/components/app-shell.tsx†L1-L228】
2. **Edge & Ops alignment:** Expand Supabase edge functions and ops CLIs to consume the modular API endpoints and verify parity in staging before promoting builds.【F:README.md†L55-L161】【F:apps/api/src/domain/workspace/routes.ts†L5-L32】
   _Status:_ ✅ Completed with a dedicated `/launch/digests` Fastify route, Supabase edge function dispatch to that endpoint, and an ops CLI parity summary comparing queued digests to dispatched reports.【F:apps/api/src/server.ts†L1-L120】【F:supabase/functions/regulator-digest/index.ts†L1-L86】【F:apps/ops/src/regulator-digest.ts†L1-L199】
3. **Testing & automation:** Establish CI coverage for React components (accessibility tests), Fastify route contracts, and Supabase migrations to protect against regressions during future phases.【F:apps/api/src/server.ts†L735-L887】【F:apps/web/src/components/app-shell.tsx†L63-L200】
   _Status:_ ✅ Completed through Vitest suites that exercise the launch digests contract, the PWA accessibility behaviour, and the migration hygiene script to guard Supabase changes.【F:apps/api/test/launch.routes.test.ts†L1-L87】【F:apps/web/test/pwa-install-prompt.test.tsx†L1-L87】【F:apps/ops/test/migrations-check.test.ts†L1-L23】

### Phase 3 – Agent Workflows, HITL, and Drafting Experience (Week 3–5)
1. **Multi-agent desk completion:** Ship guided playbooks, quick actions, personas, and tool status chips that align with CEPEJ/EU guardrails and HITL escalation criteria.
   _Status:_ ✅ The `/workspace` API now returns the Phase C desk schema and the UI renders multi-agent playbooks, personas, and toolbelt telemetry for operators.【F:apps/api/src/workspace.ts†L1-L210】【F:apps/web/src/components/workspace/multi-agent-desk.tsx†L1-L216】
2. **Process navigator flows:** Surface jurisdiction workflows with telemetry, guardrails, and compliance alerts so reviewers can monitor progress and pending HITL steps in one place.
   _Status:_ ✅ Added `buildPhaseCProcessNavigator()` on the API, exposed the data through `/workspace`, and rendered a bilingual Process Navigator panel with progress, alerts, and guardrail summaries plus dedicated Vitest coverage.【F:apps/api/src/workspace.ts†L212-L509】【F:apps/api/src/server.ts†L3872-L3988】【F:apps/web/src/components/workspace/process-navigator.tsx†L1-L210】【F:apps/web/test/process-navigator.test.tsx†L1-L86】
3. **Operator telemetry & documentation:** Update readiness documentation to reflect the guided desk, including telemetry KPIs and guardrail evidence to feed the Go/No-Go review.
   _Status:_ ✅ The production audit now captures Phase 3 completion details, linking the navigator telemetry, bilingual UI, and API contracts needed for regulator sign-off.【F:docs/launch/production_audit.md†L161-L189】
