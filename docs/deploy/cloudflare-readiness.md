# Cloudflare Deployment Readiness Audit

**Generated**: 2026-01-05  
**Auditor**: Senior Release Engineer  
**Status**: 🔴 BLOCKED - Critical issues must be resolved

---

## Executive Summary

The `lawai` monorepo deployment to Cloudflare Pages is currently **blocked** due to several critical configuration issues. The primary frontend app (`apps/web`) is a Next.js 14 application using Server Components, but the current configuration attempts static deployment which is incompatible with SSR.

> [!CAUTION]
> The production error "An error occurred in the Server Components render" indicates the app is being served as static files but contains server-side code that requires edge runtime execution.

---

## 1. Frontend Applications

### Primary: `apps/web` (Main Web App)
| Property | Value |
|----------|-------|
| Framework | Next.js 14.2.5 (App Router) |
| Rendering | Server Components + SSR |
| Build Output | `.vercel/output/static` (via @cloudflare/next-on-pages) |
| Localization | `[locale]` route segments (fr, en) |
| PWA | Service Worker with Workbox |

**Current Issues:**
- ❌ `pages:build` script is **missing** from `package.json`
- ❌ `@cloudflare/next-on-pages` not listed as dependency
- ❌ Root `wrangler.toml` points to static output, incompatible with SSR

### Secondary Apps (Not Deployed to Cloudflare Pages)
| App | Framework | Purpose | Deployment Target |
|-----|-----------|---------|-------------------|
| `apps/pwa` | Next.js 14 | Consumer PWA | Separate deployment |
| `apps/admin-pwa` | Next.js 14 | Admin dashboard | Separate deployment |
| `apps/staff-pwa` | Next.js 14 | Staff interface | Separate deployment |
| `apps/api` | Fastify | Backend API | Railway/Container |
| `apps/edge` | Deno | Edge functions | Supabase Edge |
| `apps/mcp` | Node.js | MCP Server | Self-hosted |

---

## 2. Backend/Edge Code Analysis

### Server-Side Code in `apps/web`

| File | Runtime Requirement | Cloudflare Compatibility |
|------|---------------------|-------------------------|
| `src/env.server.ts` | Server-only | ✅ Compatible with `nodejs_compat` |
| `src/server/supabase/admin-client.ts` | Supabase client | ✅ Compatible |
| `app/api/*` | API Routes | ⚠️ Requires edge runtime |
| `src/lib/cache.ts` | Supabase service client | ✅ Compatible |

**API Routes Found:**
- `/api/admin/*` (15 endpoints) - Admin operations
- `/api/auth/*` (1 endpoint) - Authentication
- `/api/session/*` (1 endpoint) - Session management

### Runtime Assumptions
| Assumption | Status |
|------------|--------|
| Node.js `fs` module | ⚠️ Not used directly in web app |
| Native modules | ❌ `sharp` in devDependencies (image processing) |
| `process.env` | ✅ Supported via `nodejs_compat` |
| `server-only` import | ✅ Compatible |

> [!WARNING]
> `sharp` is listed as a dev dependency. Ensure it's only used during build, not at runtime.

---

## 3. Environment Variables Matrix

### Client-Side Variables (NEXT_PUBLIC_*)

| Variable | Dev | Preview | Prod | Required |
|----------|-----|---------|------|----------|
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:3333` | Preview API URL | Production API URL | ✅ Yes |
| `NEXT_PUBLIC_SUPABASE_URL` | Local Supabase | Preview Supabase | Production Supabase | ✅ Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Local key | Preview key | Production key | ✅ Yes |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Preview URL | Production URL | Optional |
| `NEXT_PUBLIC_DASHBOARD_RUNS_HIGH` | `1000` | `1000` | `1000` | Optional |
| `NEXT_PUBLIC_DASHBOARD_RUNS_MEDIUM` | `200` | `200` | `200` | Optional |
| `NEXT_PUBLIC_EVAL_PASS_GOOD` | `0.9` | `0.9` | `0.9` | Optional |
| `NEXT_PUBLIC_EVAL_PASS_OK` | `0.75` | `0.75` | `0.75` | Optional |
| `NEXT_PUBLIC_EVAL_COVERAGE_GOOD` | `0.9` | `0.9` | `0.9` | Optional |
| `NEXT_PUBLIC_EVAL_COVERAGE_OK` | `0.75` | `0.75` | `0.75` | Optional |
| `NEXT_PUBLIC_EVAL_MAGHREB_GOOD` | `0.95` | `0.95` | `0.95` | Optional |
| `NEXT_PUBLIC_EVAL_MAGHREB_OK` | `0.8` | `0.8` | `0.8` | Optional |
| `NEXT_PUBLIC_TOOL_FAILURE_WARN` | `0.02` | `0.02` | `0.02` | Optional |
| `NEXT_PUBLIC_TOOL_FAILURE_CRIT` | `0.05` | `0.05` | `0.05` | Optional |
| `NEXT_PUBLIC_ENABLE_PWA` | `false` | `false` | `true` | Optional |

### Server-Side Variables

| Variable | Dev | Preview | Prod | Required |
|----------|-----|---------|------|----------|
| `NODE_ENV` | `development` | `production` | `production` | ✅ Auto-set |
| `APP_ENV` | `local` | `preview` | `production` | Optional |
| `DEPLOY_ENV` | `development` | `preview` | `production` | Optional |
| `SUPABASE_URL` | Local | Preview | Production | ✅ Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Local key | Preview key | Production key | ✅ Yes |
| `ADMIN_PANEL_ACTOR` | - | - | Admin email | Optional |
| `ADMIN_PANEL_ORG` | - | - | Admin org ID | Optional |
| `FEAT_ADMIN_PANEL` | `enabled` | `enabled` | `enabled` | Optional |

### Cloudflare-Specific Secrets

| Secret | Purpose | Location |
|--------|---------|----------|
| `CLOUDFLARE_API_TOKEN` | Pages deployment | GitHub Secrets |
| `CLOUDFLARE_ACCOUNT_ID` | Account identifier | GitHub Secrets |

---

## 4. Cloudflare Deployment Plan

### Critical File Changes Required

#### 4.1 Fix `apps/web/package.json` - Add Missing Scripts

```diff
  "scripts": {
    "predev": "node ./scripts/generate-icons.mjs",
    "prebuild": "node ./scripts/generate-icons.mjs",
    "prestart": "node ./scripts/generate-icons.mjs",
    "dev": "node ./scripts/prepare-sw.mjs && next dev",
    "build": "next build && node ./scripts/inject-sw.mjs",
+   "pages:build": "pnpm run build && npx @cloudflare/next-on-pages@1",
+   "pages:preview": "wrangler pages dev .vercel/output/static",
+   "deploy:cloudflare": "pnpm run pages:build && wrangler pages deploy .vercel/output/static",
    "prepare-sw": "node ./scripts/prepare-sw.mjs",
    ...
  },
  "devDependencies": {
+   "@cloudflare/next-on-pages": "^1.13.0",
+   "wrangler": "^3.0.0",
    ...
  }
```

#### 4.2 Update Root `wrangler.toml`

Current configuration is insufficient for Server Components:

```toml
# Current (BROKEN)
name = "avocat-ai-web"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = "apps/web/.vercel/output/static"
```

**Required Update:**
```toml
# Cloudflare Pages Configuration
name = "avocat-ai-web"
compatibility_date = "2024-12-01"
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = "apps/web/.vercel/output/static"

# Ensure edge runtime for Server Components
[vars]
NODE_ENV = "production"
```

#### 4.3 Create `apps/web/_routes.json` (SPA Fallback)

```json
{
  "version": 1,
  "include": ["/*"],
  "exclude": [
    "/_next/static/*",
    "/icons/*",
    "/manifest.webmanifest",
    "/sw.js",
    "/favicon.ico"
  ]
}
```

#### 4.4 Ensure `apps/web/public/_headers` Exists

```
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=()

/_next/static/*
  Cache-Control: public, max-age=31536000, immutable
```

#### 4.5 Update GitHub Actions Workflow

The current `.github/workflows/cloudflare-pages.yml` needs to ensure lockfile sync:

```diff
      - name: Install dependencies
-       run: pnpm install --frozen-lockfile
+       run: pnpm install
+
+     - name: Verify lockfile is in sync
+       run: |
+         if git diff --exit-code pnpm-lock.yaml; then
+           echo "Lockfile is in sync"
+         else
+           echo "ERROR: pnpm-lock.yaml is out of sync"
+           exit 1
+         fi
```

---

## 5. Deployment Checklist

### Pre-Deployment (Must Complete)

- [ ] **CRITICAL**: Add `pages:build` script to `apps/web/package.json`
- [ ] **CRITICAL**: Add `@cloudflare/next-on-pages` as devDependency
- [ ] **CRITICAL**: Add `wrangler` as devDependency
- [ ] Update `compatibility_date` to recent date (2024-12-01+)
- [ ] Create `apps/web/public/_headers` file
- [ ] Create `apps/web/_routes.json` for SPA routing
- [ ] Regenerate `pnpm-lock.yaml` after dependency changes
- [ ] Verify all `NEXT_PUBLIC_*` variables are set in Cloudflare Dashboard

### Cloudflare Dashboard Configuration

- [ ] Set **Framework preset**: `None`
- [ ] Set **Build command**: `pnpm install && pnpm --filter @avocat-ai/web run pages:build`
- [ ] Set **Build output directory**: `apps/web/.vercel/output/static`
- [ ] Set **Root directory**: `/`
- [ ] Set **Node version**: `20`
- [ ] Configure all environment variables from matrix above

### Post-Deployment Verification

- [ ] Confirm build completes without errors
- [ ] Verify SSR pages render correctly (not static errors)
- [ ] Test API routes functionality
- [ ] Verify service worker registration
- [ ] Check i18n locale routing (fr/en)
- [ ] Test admin panel access (if `FEAT_ADMIN_PANEL=enabled`)

---

## 6. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Server Components fail at runtime | 🔴 Critical | Ensure `@cloudflare/next-on-pages` transforms output correctly |
| Missing environment variables | 🔴 Critical | Use Zod schema defaults to allow build, validate at runtime |
| `sharp` native module incompatibility | 🟡 Medium | Confirm only used in `prebuild` scripts, not runtime |
| Lockfile desync on CI | 🟡 Medium | Add lockfile verification step to workflow |
| i18n routing conflicts | 🟢 Low | App Router `[locale]` pattern should work |
| Service worker caching issues | 🟢 Low | Use `Cache-Control` headers correctly |

---

## 7. Root Cause of Current Error

The production error:
```
Error: An error occurred in the Server Components render. The specific message is omitted in production builds...
```

**Root Cause**: The current build process uses `next build` directly without `@cloudflare/next-on-pages` transformation. This outputs SSR-capable code to `.next/`, but Cloudflare Pages expects static assets or edge function bundles.

**Solution**: The `pages:build` script must:
1. Run `next build` to generate `.next/` output
2. Run `@cloudflare/next-on-pages` to transform SSR into edge-compatible functions
3. Output to `.vercel/output/static/` with `_worker.js` for edge execution

---

## 8. Files to Modify

| File | Action | Purpose |
|------|--------|---------|
| [`apps/web/package.json`](file:///Volumes/PRO-G40/Projects/repos/lawai/apps/web/package.json) | MODIFY | Add `pages:build`, deps |
| [`wrangler.toml`](file:///Volumes/PRO-G40/Projects/repos/lawai/wrangler.toml) | MODIFY | Update compatibility_date |
| `apps/web/_routes.json` | NEW | SPA routing config |
| `apps/web/public/_headers` | NEW | Security headers |
| [`pnpm-lock.yaml`](file:///Volumes/PRO-G40/Projects/repos/lawai/pnpm-lock.yaml) | REGENERATE | After dep changes |

---

## 9. Verification Commands

```bash
# Local build test
cd /Volumes/PRO-G40/Projects/repos/lawai
pnpm install
pnpm --filter @avocat-ai/web run pages:build

# Verify output structure
ls -la apps/web/.vercel/output/static/
# Should contain: _worker.js, _routes.json, static assets

# Local preview (after build)
cd apps/web
npx wrangler pages dev .vercel/output/static
```

---

## Appendix: Reference Documentation

- [@cloudflare/next-on-pages](https://github.com/cloudflare/next-on-pages)
- [Cloudflare Pages Next.js Guide](https://developers.cloudflare.com/pages/framework-guides/nextjs/)
- [Wrangler Configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [Next.js App Router on Cloudflare](https://developers.cloudflare.com/pages/framework-guides/nextjs/ssr/get-started/)
