# Netlify Deployment Refactoring - Quick Start

This directory contains all the files and documentation for deploying Avocat-AI to Netlify.

## 📚 Documentation

- **[DEPLOYMENT_REFACTOR_PLAN.md](./DEPLOYMENT_REFACTOR_PLAN.md)** - Complete refactoring plan and architecture
- **[docs/netlify-deployment.md](./docs/netlify-deployment.md)** - Step-by-step deployment guide
- **[FULLSTACK_CODE_REVIEW.md](./FULLSTACK_CODE_REVIEW.md)** - Code review and security audit
- **[PROVIDER_REMOVAL_CHECKLIST.md](./PROVIDER_REMOVAL_CHECKLIST.md)** - Checklist for removing Vercel/Cloudflare code

## 🚀 Quick Start

### 1. Pre-requisites

Ensure you have:
- Node.js 20+ installed
- pnpm 8.15.4 configured
- Netlify account set up
- Supabase project configured
- API deployed externally (Railway, Render, etc.)

### 2. Install Dependencies

```bash
# Enable pnpm via corepack
corepack enable
corepack prepare pnpm@8.15.4 --activate

# Install dependencies
pnpm install --no-frozen-lockfile
```

### 3. Run Pre-Deployment Checks

```bash
# Run all checks
pnpm run predeploy:check

# Check for provider-specific code
pnpm run scan:providers

# Verify cleanup is complete
pnpm run verify:cleanup
```

### 4. Test Local Builds

```bash
# Build admin panel
pnpm run build:web

# Build client PWA
pnpm run build:pwa
```

### 5. Deploy to Netlify

#### Option A: Via Netlify Dashboard

1. Create new sites in Netlify for:
   - Admin Panel (`apps/web`)
   - Client PWA (`apps/pwa`)

2. Configure build settings (already in `netlify.toml`):
   - Base: `apps/web` or `apps/pwa`
   - Build command: Uses workspace dependencies
   - Publish: `.next`

3. Add environment variables in Netlify Dashboard

#### Option B: Via Netlify CLI

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Deploy admin panel
cd apps/web
netlify deploy --prod

# Deploy client PWA
cd apps/pwa
netlify deploy --prod
```

#### Option C: Via GitHub Actions

The workflow is already configured in `.github/workflows/deploy-netlify.yml`

Required secrets in GitHub:
- `NETLIFY_AUTH_TOKEN`
- `NETLIFY_WEB_SITE_ID`
- `NETLIFY_PWA_SITE_ID`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_BASE_URL`

## 📦 New Packages

### Mobile SDK

A React Native/Expo SDK has been created in `packages/mobile-sdk/`:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AvocatAIMobileSDK } from '@avocat-ai/mobile-sdk';

const sdk = new AvocatAIMobileSDK({
  supabaseUrl: 'https://your-project.supabase.co',
  supabaseAnonKey: 'your-anon-key',
  apiBaseUrl: 'https://your-api.example.com',
  storage: AsyncStorage,
});
```

See [packages/mobile-sdk/README.md](./packages/mobile-sdk/README.md) for full documentation.

## 🔧 Available Scripts

```bash
# Deployment checks
pnpm run predeploy:check    # Run all pre-deployment checks
pnpm run cleanup:providers  # Remove Vercel/Cloudflare files
pnpm run scan:providers     # Scan for provider-specific code
pnpm run verify:cleanup     # Verify cleanup completeness

# Building
pnpm run build:web          # Build admin panel
pnpm run build:pwa          # Build client PWA

# Development
pnpm run dev:web            # Start admin panel dev server
pnpm --filter @avocat-ai/pwa dev  # Start PWA dev server
```

## 📋 Configuration Files

- **Root `netlify.toml`**: Monorepo configuration
- **`apps/web/netlify.toml`**: Admin panel build settings
- **`apps/pwa/netlify.toml`**: Client PWA build settings
- **`turbo.json`**: Build optimization configuration
- **`.github/workflows/deploy-netlify.yml`**: CI/CD workflow

## 🔐 Environment Variables

Required for Netlify deployment:

### Public (Client-Safe)
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_API_BASE_URL=https://your-api.railway.app
NEXT_PUBLIC_DASHBOARD_RUNS_HIGH=1000
NEXT_PUBLIC_DASHBOARD_RUNS_MEDIUM=200
# ... (see .env.example for full list)
```

### Build-Time
```
NODE_VERSION=20
PNPM_VERSION=8.15.4
ENABLE_COREPACK=true
NEXT_TELEMETRY_DISABLED=1
NODE_OPTIONS=--max-old-space-size=4096
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Netlify CDN                         │
│  ┌──────────────────┐      ┌──────────────────┐        │
│  │   Admin Panel    │      │   Client PWA     │        │
│  │   (apps/web)     │      │   (apps/pwa)     │        │
│  └──────────────────┘      └──────────────────┘        │
└─────────────────────────────────────────────────────────┘
                     ↓                    ↓
         ┌───────────────────────────────────┐
         │    External API (Railway/Render)  │
         │         (apps/api)                │
         └───────────────────────────────────┘
                     ↓
         ┌───────────────────────────────────┐
         │       Supabase                    │
         │  - Database (Postgres)            │
         │  - Auth                           │
         │  - Storage                        │
         │  - Edge Functions (apps/edge)     │
         └───────────────────────────────────┘
```

## ✅ What's Been Done

- [x] Created Netlify configuration files
- [x] Removed Vercel-specific code and configuration
- [x] Updated Next.js configs for Netlify compatibility
- [x] Created build and deployment scripts
- [x] Added pre-deployment validation
- [x] Created mobile SDK package
- [x] Written comprehensive documentation
- [x] Set up GitHub Actions workflow
- [x] Configured build optimization with Turbo

## ⚠️ Important Notes

1. **API Deployment**: The Fastify API (`apps/api`) cannot run on Netlify. Deploy it separately to Railway, Render, Fly.io, or similar.

2. **Edge Functions**: Keep Supabase Edge Functions (`apps/edge`) on Supabase. Don't migrate them to Netlify.

3. **Environment Variables**: All `NEXT_PUBLIC_*` variables are exposed to the client. Never put secrets in them.

4. **Build Times**: First builds may take 5-10 minutes. Subsequent builds with Turbo cache should be faster.

5. **Testing**: Always test on Netlify staging before production deployment.

## 🐛 Troubleshooting

### Build fails with "pnpm not found"
**Solution**: Add `ENABLE_COREPACK=true` to Netlify environment variables.

### Build fails with "Cannot find module"
**Solution**: Ensure workspace dependencies are built with `--filter app...` flag.

### Environment variables not available
**Solution**: Prefix client-side variables with `NEXT_PUBLIC_`.

### Build timeout
**Solution**: Increase `NODE_OPTIONS=--max-old-space-size=4096` in Netlify settings.

## 📞 Support

- Review [docs/netlify-deployment.md](./docs/netlify-deployment.md) for detailed instructions
- Check [FULLSTACK_CODE_REVIEW.md](./FULLSTACK_CODE_REVIEW.md) for architecture decisions
- See [PROVIDER_REMOVAL_CHECKLIST.md](./PROVIDER_REMOVAL_CHECKLIST.md) for migration details
- Open a GitHub issue for problems

## 🎯 Next Steps

1. Review all documentation
2. Set up Netlify sites
3. Deploy API to external service
4. Configure environment variables
5. Run staging deployment
6. Test all features
7. Deploy to production
8. Monitor and validate

---

**Status**: ✅ Ready for Deployment
**Version**: 1.0.0
**Last Updated**: 2024
