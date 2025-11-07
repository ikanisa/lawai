# Netlify Deployment Guide

This guide walks through deploying Avocat-AI applications to Netlify.

## Prerequisites

- Netlify account
- GitHub repository access
- Node.js 20+ and pnpm 8.15.4
- Supabase project set up
- External API deployment (Railway, Render, etc.)

## Required Environment Variables

### Netlify Dashboard Settings

Configure these environment variables in Netlify's dashboard for each site:

#### Public Variables (Client-Safe)

**Supabase Configuration**
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**API Configuration**
```
NEXT_PUBLIC_API_BASE_URL=https://your-api.railway.app
```

**Dashboard Thresholds**
```
NEXT_PUBLIC_DASHBOARD_RUNS_HIGH=1000
NEXT_PUBLIC_DASHBOARD_RUNS_MEDIUM=200
NEXT_PUBLIC_EVAL_PASS_GOOD=0.9
NEXT_PUBLIC_EVAL_PASS_OK=0.75
NEXT_PUBLIC_EVAL_COVERAGE_GOOD=0.9
NEXT_PUBLIC_EVAL_COVERAGE_OK=0.75
NEXT_PUBLIC_EVAL_MAGHREB_GOOD=0.95
NEXT_PUBLIC_EVAL_MAGHREB_OK=0.8
NEXT_PUBLIC_TOOL_FAILURE_WARN=0.02
NEXT_PUBLIC_TOOL_FAILURE_CRIT=0.05
```

#### Build Variables

```
NODE_VERSION=20
PNPM_VERSION=8.15.4
ENABLE_COREPACK=true
NEXT_TELEMETRY_DISABLED=1
NODE_OPTIONS=--max-old-space-size=4096
```

## Deployment Steps

### 1. Prepare Repository

```bash
# Clone the repository
git clone https://github.com/ikanisa/lawai.git
cd lawai

# Install dependencies
corepack enable
corepack prepare pnpm@8.15.4 --activate
pnpm install --no-frozen-lockfile

# Run cleanup (if migrating from Vercel)
./scripts/cleanup-providers.sh
tsx scripts/verify-cleanup.ts
```

### 2. Create Netlify Sites

Create separate Netlify sites for each app:

#### Admin Panel (apps/web)

1. Go to Netlify Dashboard → Sites → Add new site → Import an existing project
2. Connect to GitHub repository
3. Configure build settings:
   - **Base directory**: `apps/web`
   - **Build command**: `cd ../.. && pnpm install --no-frozen-lockfile --filter @avocat-ai/web... && pnpm --filter @avocat-ai/web build`
   - **Publish directory**: `apps/web/.next`
   - **Functions directory**: `apps/web/netlify/functions`

#### Client PWA (apps/pwa)

1. Create another site in Netlify Dashboard
2. Connect to same GitHub repository
3. Configure build settings:
   - **Base directory**: `apps/pwa`
   - **Build command**: `cd ../.. && pnpm install --no-frozen-lockfile --filter @avocat-ai/pwa... && pnpm --filter @avocat-ai/pwa build`
   - **Publish directory**: `apps/pwa/.next`
   - **Functions directory**: `apps/pwa/netlify/functions`

### 3. Configure Environment Variables

For each site in Netlify Dashboard:

1. Go to Site settings → Environment variables
2. Add all required variables from the list above
3. Select deployment contexts (Production, Deploy Previews, Branch deploys)

### 4. Configure Build Settings

In Netlify Dashboard → Site settings → Build & deploy:

**Build image selection**: Ubuntu Focal 20.04

**Node version**: Use `.nvmrc` file (20)

**Package manager**: Detected from `package.json` (pnpm)

### 5. Deploy API Separately

The Fastify API (`apps/api`) cannot run on Netlify. Deploy it to:

**Option 1: Railway (Recommended)**
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

**Option 2: Render**
1. Create new Web Service
2. Connect repository
3. Build Command: `cd apps/api && pnpm install && pnpm build`
4. Start Command: `cd apps/api && pnpm start`

**Option 3: Fly.io**
```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Deploy
fly launch
fly deploy
```

### 6. Update API URLs

After deploying the API, update the environment variable in Netlify:

```
NEXT_PUBLIC_API_BASE_URL=https://your-api.railway.app
```

Then trigger a redeploy:
```bash
netlify deploy --prod
```

### 7. Configure Custom Domains

In Netlify Dashboard → Domain settings:

1. Add custom domain (e.g., `admin.avocat-ai.com`)
2. Configure DNS:
   ```
   CNAME admin your-site.netlify.app
   ```
3. Enable HTTPS (automatic with Let's Encrypt)

### 8. Set Up Deploy Contexts

Configure different environments in `netlify.toml`:

```toml
[context.production]
  command = "pnpm --filter @avocat-ai/web build"

[context.deploy-preview]
  command = "pnpm --filter @avocat-ai/web build"
  
[context.branch-deploy]
  command = "pnpm --filter @avocat-ai/web build"
```

## Testing Deployment

### Local Build Test

```bash
# Test web build
pnpm --filter @avocat-ai/web build

# Test pwa build
pnpm --filter @avocat-ai/pwa build

# Run pre-deployment checks
node scripts/predeploy-check.mjs
```

### Deploy Preview

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Link to site
netlify link

# Deploy preview
netlify deploy

# Deploy to production
netlify deploy --prod
```

## Troubleshooting

### Build Fails with "pnpm not found"

**Solution**: Add to `netlify.toml`:
```toml
[build.environment]
  PNPM_VERSION = "8.15.4"
  ENABLE_COREPACK = "true"
```

### Build Fails with "Cannot find module"

**Solution**: Ensure workspace dependencies are built:
```bash
pnpm install --no-frozen-lockfile --filter @avocat-ai/web...
```

### Next.js Image Optimization Errors

**Solution**: Use `unoptimized: true` in `next.config.mjs`:
```javascript
images: {
  unoptimized: true,
}
```

### Environment Variables Not Available

**Solution**: Prefix with `NEXT_PUBLIC_` for client-side access:
```
NEXT_PUBLIC_API_BASE_URL=https://api.example.com
```

### Build Timeout

**Solution**: Increase build time in Netlify settings or optimize build:
```toml
[build.environment]
  NODE_OPTIONS = "--max-old-space-size=4096"
```

## Monitoring

### Build Notifications

Set up notifications in Netlify Dashboard → Settings → Notifications:
- Email notifications for deploy failures
- Slack/Discord webhooks for deploy status
- GitHub commit status checks

### Performance Monitoring

1. Enable Netlify Analytics
2. Set up uptime monitoring (UptimeRobot, Pingdom)
3. Configure error tracking (Sentry)

### Health Checks

Add health check endpoint: `apps/web/app/api/healthz/route.ts`

```typescript
export async function GET() {
  return Response.json({ status: 'ok', timestamp: new Date().toISOString() });
}
```

## Rollback Procedure

If deployment fails:

```bash
# Via Netlify CLI
netlify rollback

# Via Dashboard
# Go to Deploys → Click on previous successful deploy → Publish deploy
```

## CI/CD Integration

See `.github/workflows/deploy-netlify.yml` for automated deployment setup.

## Security Considerations

1. ✅ Never commit real secrets to repository
2. ✅ Use environment variables for all sensitive data
3. ✅ Enable HTTPS (automatic on Netlify)
4. ✅ Configure CSP headers in `next.config.mjs`
5. ✅ Review Netlify security headers
6. ✅ Enable branch deploy protection
7. ✅ Set up deploy previews for PRs

## Cost Optimization

- Use Netlify's free tier for staging/preview
- Upgrade to Pro for production ($19/month)
- Consider bandwidth usage
- Enable build caching with Turbo
- Optimize images and assets

## Support Resources

- [Netlify Documentation](https://docs.netlify.com/)
- [Next.js on Netlify](https://docs.netlify.com/integrations/frameworks/next-js/)
- [PNPM Workspaces](https://pnpm.io/workspaces)
- Repository: `DEPLOYMENT_REFACTOR_PLAN.md`
- Issues: GitHub Issues

## Next Steps

1. ✅ Deploy to staging first
2. ✅ Run end-to-end tests
3. ✅ Validate all features work
4. ✅ Check performance metrics
5. ✅ Deploy to production
6. ✅ Update DNS records
7. ✅ Monitor for 24 hours
