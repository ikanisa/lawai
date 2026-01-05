# Environment Variables Matrix

This document provides a complete matrix of all environment variables used across development, preview, and production environments for the Cloudflare Pages deployment.

## Overview

Environment variables are managed in two ways:
1. **Cloudflare Pages Dashboard**: Set in Settings → Environment Variables (for build and runtime)
2. **Local Development**: Use `.env.local` files (git-ignored)

> [!WARNING]
> **Anything with `NEXT_PUBLIC_*` prefix is exposed to the browser**. Never put secrets in `NEXT_PUBLIC_*` variables.

## Variable Categories

### Client-Side Variables (`NEXT_PUBLIC_*`)

These variables are embedded in the client bundle and are **publicly visible** to anyone who views the page source.

### Server-Side Variables

These variables are only available to Server Components and API routes. They are **NOT exposed to the browser**.

## Complete Variable Matrix

### Client-Side Variables (NEXT_PUBLIC_*)

| Variable | Development | Preview | Production | Required | Location | Notes |
|----------|-------------|---------|------------|----------|----------|-------|
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:3333` | Preview API URL | Production API URL | ✅ **Yes** | Pages Dashboard | API endpoint for frontend requests |
| `NEXT_PUBLIC_SUPABASE_URL` | Local Supabase URL | Preview Supabase URL | Production Supabase URL | ✅ **Yes** | Pages Dashboard | Supabase project URL (format: `https://xxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Local anon key | Preview anon key | Production anon key | ✅ **Yes** | Pages Dashboard | Supabase anonymous key (public, safe to expose) |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Preview app URL | Production app URL | ⚠️ Optional | Pages Dashboard | Used for OAuth redirects, can be auto-detected |
| `NEXT_PUBLIC_DASHBOARD_RUNS_HIGH` | `1000` | `1000` | `1000` | ⚠️ Optional | Pages Dashboard | Dashboard threshold (has default) |
| `NEXT_PUBLIC_DASHBOARD_RUNS_MEDIUM` | `200` | `200` | `200` | ⚠️ Optional | Pages Dashboard | Dashboard threshold (has default) |
| `NEXT_PUBLIC_EVAL_PASS_GOOD` | `0.9` | `0.9` | `0.9` | ⚠️ Optional | Pages Dashboard | Evaluation threshold (has default) |
| `NEXT_PUBLIC_EVAL_PASS_OK` | `0.75` | `0.75` | `0.75` | ⚠️ Optional | Pages Dashboard | Evaluation threshold (has default) |
| `NEXT_PUBLIC_EVAL_COVERAGE_GOOD` | `0.9` | `0.9` | `0.9` | ⚠️ Optional | Pages Dashboard | Evaluation threshold (has default) |
| `NEXT_PUBLIC_EVAL_COVERAGE_OK` | `0.75` | `0.75` | `0.75` | ⚠️ Optional | Pages Dashboard | Evaluation threshold (has default) |
| `NEXT_PUBLIC_EVAL_MAGHREB_GOOD` | `0.95` | `0.95` | `0.95` | ⚠️ Optional | Pages Dashboard | Evaluation threshold (has default) |
| `NEXT_PUBLIC_EVAL_MAGHREB_OK` | `0.8` | `0.8` | `0.8` | ⚠️ Optional | Pages Dashboard | Evaluation threshold (has default) |
| `NEXT_PUBLIC_TOOL_FAILURE_WARN` | `0.02` | `0.02` | `0.02` | ⚠️ Optional | Pages Dashboard | Tool failure threshold (has default) |
| `NEXT_PUBLIC_TOOL_FAILURE_CRIT` | `0.05` | `0.05` | `0.05` | ⚠️ Optional | Pages Dashboard | Tool failure threshold (has default) |
| `NEXT_PUBLIC_ENABLE_PWA` | `false` | `false` | `true` | ⚠️ Optional | Pages Dashboard | PWA feature flag (has default) |

### Server-Side Variables

| Variable | Development | Preview | Production | Required | Location | Notes |
|----------|-------------|---------|------------|----------|----------|-------|
| `NODE_ENV` | `development` | `production` | `production` | ✅ Auto-set | Auto-set by platform | Automatically set by Cloudflare Pages |
| `APP_ENV` | `local` | `preview` | `production` | ⚠️ Optional | Pages Dashboard | Environment identifier |
| `DEPLOY_ENV` | `development` | `preview` | `production` | ⚠️ Optional | Pages Dashboard | Deployment environment identifier |
| `SUPABASE_URL` | Local Supabase URL | Preview Supabase URL | Production Supabase URL | ✅ **Yes** | Pages Dashboard (server-only) | Supabase project URL (same as NEXT_PUBLIC but server-only) |
| `SUPABASE_SERVICE_ROLE_KEY` | Local service role key | Preview service role key | Production service role key | ✅ **Yes** | Pages Dashboard (secret) | **SECRET**: Supabase service role key (full database access) |
| `ADMIN_PANEL_ACTOR` | - | - | Admin email | ⚠️ Optional | Pages Dashboard | Admin panel actor identifier |
| `ADMIN_PANEL_ORG` | - | - | Admin org ID | ⚠️ Optional | Pages Dashboard | Admin panel organization ID |
| `FEAT_ADMIN_PANEL` | `enabled` | `enabled` | `enabled` | ⚠️ Optional | Pages Dashboard | Feature flag for admin panel |

## Configuration Locations

### Cloudflare Pages Dashboard

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Pages** → Your Project
3. Go to **Settings** → **Environment Variables**
4. Add variables for each environment:
   - **Production**: Applied to production deployments
   - **Preview**: Applied to preview deployments (PRs)
   - **Development**: Applied to local development (if using Wrangler)

### Local Development

Create `.env.local` in `apps/web/` directory:

```bash
# .env.local (git-ignored)
NEXT_PUBLIC_API_BASE_URL=http://localhost:3333
NEXT_PUBLIC_SUPABASE_URL=https://your-local-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-local-anon-key
SUPABASE_URL=https://your-local-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-local-service-role-key
```

> [!NOTE]
> `.env.local` is git-ignored and should never be committed. Use `.env.example` files for documentation.

## Variable Validation

Environment variables are validated using Zod schemas:

- **Client variables**: `apps/web/src/env.client.ts`
- **Server variables**: `apps/web/src/env.server.ts`

Validation errors will cause the app to fail at startup, helping catch configuration mistakes early.

## Secrets Management

### Which Variables Are Secrets?

| Variable | Is Secret? | Why |
|----------|-----------|-----|
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ **YES** | Full database access, must be kept secret |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ❌ No | Public key, safe to expose (has RLS protections) |
| All `NEXT_PUBLIC_*` variables | ❌ No | Exposed to browser, not secrets |

### How to Set Secrets in Cloudflare Pages

1. Go to **Pages** → Your Project → **Settings** → **Environment Variables**
2. Click **Add variable**
3. Enter variable name (e.g., `SUPABASE_SERVICE_ROLE_KEY`)
4. Enter variable value
5. Select environment(s): Production, Preview, Development
6. Click **Save**

> [!WARNING]
> **Never commit secrets to git**. Always use Cloudflare Pages Dashboard or environment variable files that are git-ignored (`.env.local`, `.dev.vars`).

## Environment-Specific Configuration

### Development

**Purpose**: Local development with local services

**Typical Setup**:
- `NEXT_PUBLIC_API_BASE_URL`: `http://localhost:3333` (local API)
- `NEXT_PUBLIC_SUPABASE_URL`: Local Supabase project or dev Supabase project
- `NODE_ENV`: `development` (auto-set by Next.js)
- Other variables: Use defaults or local values

### Preview

**Purpose**: Preview deployments for pull requests

**Typical Setup**:
- `NEXT_PUBLIC_API_BASE_URL`: Preview/staging API URL
- `NEXT_PUBLIC_SUPABASE_URL`: Preview/staging Supabase project
- `NODE_ENV`: `production` (set by Cloudflare Pages)
- `DEPLOY_ENV`: `preview`
- Other variables: Same as production or preview-specific values

### Production

**Purpose**: Live production deployment

**Typical Setup**:
- `NEXT_PUBLIC_API_BASE_URL`: Production API URL
- `NEXT_PUBLIC_SUPABASE_URL`: Production Supabase project
- `NODE_ENV`: `production` (set by Cloudflare Pages)
- `DEPLOY_ENV`: `production`
- All secrets: Production values
- Feature flags: Production settings (e.g., `NEXT_PUBLIC_ENABLE_PWA=true`)

## Quick Reference: Required Variables

### Minimum Required for Production

**Client-Side (NEXT_PUBLIC_*)**:
- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Server-Side**:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (secret)

### Recommended Additional Variables

- `NEXT_PUBLIC_APP_URL` (for OAuth redirects)
- `NEXT_PUBLIC_ENABLE_PWA` (set to `true` in production)
- `DEPLOY_ENV` (for environment detection)

## Troubleshooting

### Issue: "Environment variable is missing" error

**Solution**:
1. Check variable name matches exactly (case-sensitive)
2. Verify variable is set in Cloudflare Pages Dashboard for the correct environment
3. Check validation schema in `env.client.ts` or `env.server.ts` for required variables

### Issue: Variable not available in client code

**Cause**: Server-side variable used in client code, or variable name doesn't start with `NEXT_PUBLIC_`

**Solution**:
- Server-side variables cannot be accessed in client code
- Client-accessible variables must start with `NEXT_PUBLIC_`

### Issue: Build fails due to missing variables

**Solution**:
- Check that all required variables are set in Cloudflare Pages Dashboard
- Verify variable values are valid (URLs, keys, etc.)
- Check build logs for specific validation errors

## Related Files

- `apps/web/src/env.client.ts`: Client-side variable validation
- `apps/web/src/env.server.ts`: Server-side variable validation
- `apps/web/cloudflare.env.example`: Example environment variables file
- `.gitignore`: Ensures `.env*` files are not committed

## References

- [Next.js Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
- [Cloudflare Pages Environment Variables](https://developers.cloudflare.com/pages/platform/build-configuration/#environment-variables)
- [Supabase Environment Variables Guide](https://supabase.com/docs/guides/getting-started/local-development#environment-variables)

