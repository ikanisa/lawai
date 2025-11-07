# Avocat-AI Netlify Deployment Refactoring

## Overview

This document outlines the complete refactoring plan for deploying Avocat-AI to Netlify. The refactoring addresses monorepo structure optimization, removes Vercel/Cloudflare dependencies, and configures proper Netlify deployment.

## Current State

The repository is a large monorepo (~1300 TS/JS files) with:
- PNPM 8.15.4 workspaces
- Node.js 20
- Multiple Next.js apps (web, pwa, staff-pwa, admin-pwa)
- Fastify API (incompatible with Netlify - requires separate deployment)
- Supabase Edge Functions (Deno)

## Issues for Netlify Deployment

1. **Monorepo Structure**: Needs optimization for Netlify's build system
2. **API Incompatibility**: Fastify API cannot run on Netlify (serverless/edge only)
3. **Build Dependencies**: Package dependencies need proper workspace configuration
4. **Provider Lock-in**: Remove Vercel-specific code and configuration

## Solution Architecture

### Frontend Deployment (Netlify)
- `apps/web` - Admin panel (Next.js)
- `apps/pwa` - Client PWA (Next.js)
- `apps/staff-pwa` - Staff PWA (Next.js)
- `apps/admin-pwa` - Admin PWA (Next.js)

### Backend Deployment (External Service)
- `apps/api` - Fastify REST API (deploy to Railway, Render, or similar)
- `apps/edge` - Supabase Edge Functions (deploy to Supabase)

### Mobile SDK
- `packages/mobile-sdk` - React Native/Expo SDK for mobile apps

## Files Created

### Configuration Files

1. **Root `netlify.toml`**
   - Basic monorepo configuration
   - Environment settings for pnpm and Node.js
   - Build ignore patterns

2. **`apps/web/netlify.toml`**
   - Admin panel build configuration
   - Security headers
   - Cache control for static assets
   - Build command with workspace dependencies

3. **`apps/pwa/netlify.toml`**
   - Client PWA build configuration
   - PWA-specific caching rules
   - Service worker configuration

4. **`turbo.json`**
   - Turborepo configuration for faster builds
   - Build pipeline with dependency management
   - Cache strategies for different tasks

### Build Scripts

5. **`scripts/netlify-build.sh`**
   - Automated build process for Netlify
   - Enables pnpm via corepack
   - Handles workspace dependencies
   - Context-aware building (web vs pwa)

6. **`scripts/predeploy-check.mjs`**
   - Pre-deployment validation
   - Environment file checks
   - Configuration validation
   - Vercel code detection
   - Migration and binary checks

### Cleanup Scripts

7. **`scripts/cleanup-providers.sh`**
   - Removes Vercel configuration files
   - Scans for Vercel/Cloudflare imports
   - Detects edge runtime declarations
   - Checks package.json for provider dependencies

8. **`scripts/scan-provider-code.ts`**
   - Detailed code scanning for provider-specific patterns
   - TypeScript-based analysis
   - Reports all occurrences with file/line numbers
   - Categorizes by provider type

9. **`scripts/verify-cleanup.ts`**
   - Verification that cleanup is complete
   - Ensures all Vercel files are removed
   - Confirms Netlify files exist
   - Validates no provider dependencies remain

### Mobile SDK

10. **`packages/mobile-sdk/`**
    - Complete React Native/Expo SDK
    - Supabase authentication
    - API client with automatic auth headers
    - AsyncStorage integration
    - TypeScript types
    - Full documentation

## Configuration Updates

### Next.js Configuration

Both `apps/web/next.config.mjs` and `apps/pwa/next.config.mjs` updated:
- ✅ Removed `vercel.live` reference from CSP
- ✅ Kept `output: 'standalone'` for Netlify compatibility
- ✅ Maintained security headers
- ✅ Preserved image optimization settings

### Package Configuration

Ready for updates to add:
- Deployment scripts (predeploy, cleanup, verify)
- Build optimization with Turbo
- Mobile SDK workspace

## Environment Variables

### Required for Netlify

**Supabase (Public - Safe for Client)**
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

**API Configuration**
```
NEXT_PUBLIC_API_BASE_URL=https://your-api.example.com
```

**Dashboard Thresholds**
```
NEXT_PUBLIC_DASHBOARD_RUNS_HIGH=1000
NEXT_PUBLIC_DASHBOARD_RUNS_MEDIUM=200
NEXT_PUBLIC_EVAL_PASS_GOOD=0.9
... (see .env.example for full list)
```

### Build-Time Variables

```
NODE_VERSION=20
PNPM_VERSION=8.15.4
ENABLE_COREPACK=true
NEXT_TELEMETRY_DISABLED=1
NODE_OPTIONS=--max-old-space-size=4096
```

## Deployment Strategy

### Phase 1: Netlify Setup
1. Connect repository to Netlify
2. Create separate sites for each app:
   - `avocat-web` (apps/web)
   - `avocat-pwa` (apps/pwa)
3. Configure build settings per app
4. Set environment variables
5. Configure custom domains

### Phase 2: API Deployment (Separate Service)
1. Deploy Fastify API to external service:
   - Railway (recommended)
   - Render
   - Fly.io
   - Custom VPS
2. Update `NEXT_PUBLIC_API_BASE_URL` to point to deployed API
3. Configure CORS to allow Netlify domains

### Phase 3: Edge Functions (Supabase)
1. Deploy edge functions to Supabase
2. Configure environment variables
3. Set up cron jobs if needed

## Build Process

### Netlify Build Flow

```
1. Clone repository
2. Enable corepack
3. Install pnpm 8.15.4
4. Run pnpm install --no-frozen-lockfile
5. Build workspace dependencies (--filter app...)
6. Build target app (--filter app)
7. Deploy .next directory
```

### Build Commands

**Admin Panel (apps/web)**
```bash
cd ../.. && pnpm install --no-frozen-lockfile --filter @avocat-ai/web... && pnpm --filter @avocat-ai/web build
```

**Client PWA (apps/pwa)**
```bash
cd ../.. && pnpm install --no-frozen-lockfile --filter @avocat-ai/pwa... && pnpm --filter @avocat-ai/pwa build
```

## Pre-Deployment Checklist

Run these commands before deploying:

```bash
# 1. Cleanup provider-specific code
./scripts/cleanup-providers.sh

# 2. Scan for remaining provider code
tsx scripts/scan-provider-code.ts

# 3. Verify cleanup is complete
tsx scripts/verify-cleanup.ts

# 4. Run pre-deployment checks
node scripts/predeploy-check.mjs

# 5. Test builds locally
pnpm --filter @avocat-ai/web build
pnpm --filter @avocat-ai/pwa build
```

## CI/CD Integration

A GitHub Actions workflow will be needed:
- Trigger on push to main/production branches
- Run pre-deployment checks
- Automatic Netlify deployment via CLI
- Health check validation

## Migration Path

### Step 1: Clean Up
```bash
# Remove Vercel files and scan code
pnpm run cleanup:providers
```

### Step 2: Validate
```bash
# Ensure everything is clean
pnpm run verify:cleanup
```

### Step 3: Test Build
```bash
# Test builds locally
pnpm --filter @avocat-ai/web build
pnpm --filter @avocat-ai/pwa build
```

### Step 4: Deploy
```bash
# Deploy to Netlify
netlify deploy --prod
```

## Key Benefits

✅ **Clean Architecture**: No provider lock-in
✅ **Proper Separation**: Frontend on Netlify, API elsewhere
✅ **Optimized Builds**: Turbo cache for faster builds
✅ **Mobile Ready**: SDK for React Native/Expo apps
✅ **Automated Validation**: Pre-deployment checks prevent issues
✅ **Maintainable**: Clear scripts and documentation

## Next Steps

1. Review and approve this refactoring plan
2. Set up Netlify accounts and sites
3. Choose API deployment platform
4. Configure environment variables
5. Run cleanup scripts
6. Test deployments to staging
7. Deploy to production
8. Update DNS records
9. Monitor and validate

## Support

For issues or questions:
- Check troubleshooting guide: `docs/troubleshooting_network.md`
- Review operations docs: `docs/operations/`
- Consult `CONTRIBUTING.md`
