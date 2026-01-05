# CI/CD Pipeline for Cloudflare Pages

This document describes the CI/CD strategy for deploying the Next.js app to Cloudflare Pages, including preview deployments, production gates, and rollback procedures.

## Overview

This repository uses **Direct Upload** deployment via GitHub Actions (`.github/workflows/cloudflare-pages.yml`). The workflow runs PR checks (lint, typecheck) and builds/deploys the app to Cloudflare Pages.

> [!NOTE]
> Cloudflare Pages also supports built-in Git integration (automatic deployments from Git). The current setup uses Direct Upload for more control over the build process. Both approaches are valid.

## Deployment Strategy

### Production Branch

**Default Production Branch**: `main` (or your configured default branch)

> [!IMPORTANT]
> Set the production branch explicitly in Cloudflare Pages Dashboard → Settings → Builds & deployments → Production branch. Don't rely on defaults.

### Current Setup: Direct Upload via GitHub Actions

This repository uses **Direct Upload** deployment (`.github/workflows/cloudflare-pages.yml`), which means:
- Deployments are handled by GitHub Actions, not Cloudflare's Git integration
- Preview deployments are created when the workflow runs on PRs
- Production deployments are created when the workflow runs on `main`/`master` branch

**Preview Deployment URL Format**: `https://<commit-hash>-<project-name>.pages.dev`

**Production URL**: `https://<project-name>.pages.dev` (or custom domain)

> [!NOTE]
> Alternative: You can switch to Cloudflare Pages' built-in Git integration for automatic deployments. See "Alternative: Git Integration" section below.

## CI/CD Pipeline Stages

### 1. PR Checks & Deployment (Current Workflow)

The existing workflow (`.github/workflows/cloudflare-pages.yml`) runs on PRs and production branches:

**Workflow Steps**:
1. Checkout code
2. Setup pnpm and Node.js
3. Install dependencies (frozen lockfile)
4. Run linting
5. Run type checking
6. Build for Cloudflare Pages
7. Deploy via Direct Upload

**Preview Deployments**: Created automatically when workflow runs on PRs

**Production Deployments**: Created automatically when workflow runs on `main`/`master` branch

### Alternative: Separate PR Checks Workflow (Optional)

If you want to separate PR checks from deployment, you could create a separate workflow:

```yaml
name: PR Checks

on:
  pull_request:
    branches:
      - main

jobs:
  lint-typecheck-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8.15.4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Lint
        run: pnpm --filter @avocat-ai/web run lint
      
      - name: Typecheck
        run: pnpm --filter @avocat-ai/web run typecheck
      
      - name: Test
        run: pnpm --filter @avocat-ai/web run test
      
      - name: Build
        run: pnpm --filter @avocat-ai/web run pages:build
        env:
          # Use placeholder values for build (actual values set in Cloudflare Dashboard)
          NEXT_PUBLIC_API_BASE_URL: ${{ secrets.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3333' }}
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co' }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key' }}
          NODE_ENV: production
```

**Required GitHub Secrets** (optional, for build step):
- `NEXT_PUBLIC_API_BASE_URL` (optional, uses default if not set)
- `NEXT_PUBLIC_SUPABASE_URL` (optional, uses default if not set)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (optional, uses default if not set)

> [!NOTE]
> These secrets are optional for CI builds since the build uses defaults. They're only needed if you want to test the build with actual values.

### 2. Preview Deployment (Automatic via Workflow)

With Direct Upload, preview deployments are created when:
- A PR is opened against `main`/`master` branch
- The workflow runs and deploys to Cloudflare Pages

**Workflow Configuration**: `.github/workflows/cloudflare-pages.yml`

**Build Command**: `pnpm --filter @avocat-ai/web run pages:build`

**Output Directory**: `apps/web/.vercel/output/static`

**Environment Variables**: Set in GitHub Secrets (see workflow file for required secrets)

### 3. Preview QA (Manual)

After preview deployment is created:

1. **Review Preview URL**: Check PR comments or Cloudflare Dashboard for preview URL
2. **Run Smoke Tests**:
   - [ ] App loads without errors
   - [ ] Deep links work (e.g., `/fr/workspace`)
   - [ ] API routes work (e.g., `/api/session`)
   - [ ] Authentication flow works
   - [ ] Core features function correctly
3. **Code Review**: Ensure code changes are reviewed and approved
4. **Merge to Production**: Only merge after QA passes

### 4. Production Deployment (Automatic via Workflow)

Production deployment is triggered automatically when:
- Code is pushed/merged to `main`/`master` branch
- The workflow runs and deploys to Cloudflare Pages
- Build completes successfully
- All environment variables are set correctly

**Environment Variables**: Set in GitHub Secrets (see workflow file for required secrets)

### 5. Post-Deployment Verification (Manual/Automated)

After production deployment:

1. **Smoke Tests**:
   - [ ] Production URL loads correctly
   - [ ] Deep links work
   - [ ] API routes work
   - [ ] Authentication works
   - [ ] No console errors
2. **Monitor**: Watch error logs and monitoring dashboards
3. **Rollback if Needed**: Use Cloudflare Dashboard to rollback if issues are detected

## Deployment Gates

### Recommended Workflow

```
PR Created
  ↓
PR Checks (lint, typecheck, test, build) ← GitHub Actions (optional)
  ↓
Preview Deployment (automatic) ← Cloudflare Pages
  ↓
QA Smoke Tests (manual)
  ↓
Code Review (manual)
  ↓
Merge to Production
  ↓
Production Deployment (automatic) ← Cloudflare Pages
  ↓
Post-Deployment Verification (manual/automated)
  ↓
Monitor & Rollback if Needed
```

### Deployment Gates Checklist

- [ ] PR checks pass (lint, typecheck, test, build)
- [ ] Preview deployment successful
- [ ] QA smoke tests pass on preview
- [ ] Code review approved
- [ ] Merge to production branch
- [ ] Production deployment successful
- [ ] Post-deployment smoke tests pass
- [ ] Monitor for errors/issues

## Rollback Procedure

### When to Rollback

Rollback immediately if:
- Critical bugs are discovered
- Authentication is broken
- API routes are failing
- Security issues are detected
- Performance degradation is severe

### How to Rollback

**Option 1: Cloudflare Pages Dashboard (Recommended)**

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Pages** → Your Project
3. Go to **Deployments** tab
4. Find the previous working deployment
5. Click the **⋮** (three dots) menu
6. Select **Retry deployment** or **Promote to production**

**Option 2: Wrangler CLI**

```bash
# List deployments
wrangler pages deployment list

# Rollback to a specific deployment (by deployment ID)
wrangler pages deployment rollback <deployment-id>
```

### Rollback Decision Tree

```
Issue Detected?
  ├─ P0 (Critical): Rollback immediately
  ├─ P1 (High): Attempt fix for 15 min, then rollback
  ├─ P2 (Medium): Fix in next release
  └─ P3 (Low): Schedule fix
```

### Post-Rollback Steps

1. **Verify Rollback**: Confirm previous version is live
2. **Investigate**: Determine root cause of the issue
3. **Fix**: Create fix in a new branch
4. **Test**: Test fix in preview deployment
5. **Redeploy**: Merge fix and deploy to production

## Alternative: Git Integration (If You Want to Switch)

If you prefer Cloudflare Pages' built-in Git integration (automatic deployments without GitHub Actions), you can:

1. **Disable the GitHub Actions workflow** (or remove it)
2. **Connect repository in Cloudflare Dashboard**:
   - Go to Pages → Create a project → Connect to Git
   - Select your repository and branch
   - Configure build settings:
     - **Framework preset**: `None`
     - **Build command**: `pnpm install && pnpm --filter @avocat-ai/web run pages:build`
     - **Build output directory**: `apps/web/.vercel/output/static`
     - **Root directory**: `/`
     - **Node version**: `20`
3. **Set environment variables** in Cloudflare Dashboard (Settings → Environment Variables)

**Benefits of Git Integration**:
- Simpler setup (no GitHub Actions workflow needed)
- Automatic deployments on every push
- Preview deployments automatically created for PRs

**Benefits of Direct Upload (Current)**:
- More control over build process
- Can run custom checks before deployment
- Unified CI/CD in GitHub Actions

## Best Practices

### 1. Always Test in Preview First

- Never merge to production without testing in preview
- Run smoke tests on preview deployment
- Verify all features work correctly

### 2. Use Deployment Gates

- Require PR checks to pass before merge
- Require code review approval
- Require QA sign-off for critical changes

### 3. Monitor Deployments

- Watch build logs for errors
- Monitor error tracking (Sentry, etc.) after deployment
- Check performance metrics after deployment

### 4. Keep Deployment Process Simple

- Use Cloudflare Pages Git integration for simplicity
- Only use Direct Upload if you need custom build steps
- Document any custom deployment steps

### 5. Document Rollback Procedure

- Know how to rollback before you need to
- Practice rollback procedure in staging
- Keep rollback procedure documented and accessible

## Troubleshooting

### Issue: Preview deployment fails

**Common causes**:
- Missing environment variables
- Build command fails
- Node version mismatch

**Solution**:
1. Check build logs in Cloudflare Dashboard
2. Verify build command matches local build
3. Verify environment variables are set for Preview environment
4. Check Node version matches `.nvmrc`

### Issue: Production deployment fails

**Common causes**:
- Missing production environment variables
- Build timeout
- Memory limits exceeded

**Solution**:
1. Check build logs in Cloudflare Dashboard
2. Verify all required environment variables are set for Production environment
3. Check if build is too slow (optimize if needed)
4. Contact Cloudflare support if memory limits are an issue

### Issue: Deployment succeeds but app doesn't work

**Common causes**:
- Missing environment variables
- Incorrect build output directory
- Routing issues

**Solution**:
1. Verify environment variables are set correctly
2. Check build output directory in Cloudflare Dashboard
3. Test preview deployment first
4. Check browser console for errors
5. Verify `_redirects` and `_headers` files are in build output

## Related Documentation

- [Cloudflare Pages Git Integration](https://developers.cloudflare.com/pages/platform/git-integration/)
- [Cloudflare Pages Direct Upload](https://developers.cloudflare.com/pages/platform/direct-upload/)
- [Cloudflare Pages Deployment Configuration](https://developers.cloudflare.com/pages/platform/build-configuration/)
- [GitHub Actions for Cloudflare Pages](https://github.com/cloudflare/pages-action)

