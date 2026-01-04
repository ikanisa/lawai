# Cloudflare Pages Deployment Guide

This guide covers deploying the Avocat-AI web application to Cloudflare Pages using Next.js with `@cloudflare/next-on-pages`.

> **Important**: This is an **internal staff-only system**. Access is controlled via user management and invitations. Users can only access the system when invited by system administrators through the user management interface. This is not a publicly available application.

## Prerequisites

1. **Cloudflare Account**: Sign up at [cloudflare.com](https://www.cloudflare.com)
2. **Wrangler CLI**: Install globally (optional, for local testing)
   ```bash
   npm install -g wrangler
   # or
   pnpm add -g wrangler
   ```
3. **Cloudflare API Token**: Create with Pages:Edit permissions
4. **Node.js 20+**: Required for building the application

## Architecture

The web app (`apps/web`) is deployed to Cloudflare Pages using:
- **Next.js 14** with App Router
- **@cloudflare/next-on-pages**: Adapts Next.js for Cloudflare's Edge runtime
- **Cloudflare Pages**: For static site hosting and edge functions

## Environment Variables

### Required Environment Variables

Set these in the Cloudflare Pages dashboard under **Settings → Environment Variables**:

#### Production Environment
```
NEXT_PUBLIC_API_BASE_URL=https://api.yourdomain.com
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NODE_ENV=production
```

#### Preview Environment (for PRs)
Use the same variables with staging/test values if available.

### Setting Environment Variables

1. Go to Cloudflare Dashboard → Pages → Your Project
2. Navigate to **Settings → Environment Variables**
3. Add each variable for Production, Preview, or both
4. Click **Save**

## Local Build and Testing

### Build Locally

```bash
# From the repository root
pnpm install
pnpm build:web:pages
```

This builds the Next.js app for Cloudflare Pages and outputs to `apps/web/.vercel/output/static`.

### Test Locally with Wrangler

```bash
# From apps/web directory
cd apps/web
pnpm pages:build:local  # For watch mode
wrangler pages dev .vercel/output/static
```

### Deploy from Local Machine

```bash
# From repository root
pnpm deploy:cloudflare:web
```

**Note**: You'll need to authenticate with Wrangler first:
```bash
wrangler login
```

## CI/CD Deployment

### GitHub Actions

The repository includes a GitHub Actions workflow (`.github/workflows/cloudflare-pages.yml`) that automatically:
- Builds the application on push to `main`/`master`
- Creates preview deployments for pull requests
- Deploys to production on merge

### Required GitHub Secrets

Add these secrets to your GitHub repository (**Settings → Secrets and variables → Actions**):

1. `CLOUDFLARE_API_TOKEN`: API token with Pages:Edit permissions
2. `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID (found in dashboard URL)
3. `NEXT_PUBLIC_API_BASE_URL`: Your API base URL
4. `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
5. `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon key

### Getting Cloudflare API Token

1. Go to [Cloudflare Dashboard → My Profile → API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Click **Create Token**
3. Use **Edit Cloudflare Workers** template (includes Pages permissions)
4. Add your account and zone resources
5. Copy the token and add to GitHub Secrets

### Getting Account ID

Your Account ID can be found in:
- Cloudflare Dashboard URL: `https://dash.cloudflare.com/<ACCOUNT_ID>/`
- Or via API: `curl -X GET "https://api.cloudflare.com/client/v4/accounts" -H "Authorization: Bearer YOUR_API_TOKEN"`

## Manual Deployment via Dashboard

1. Go to [Cloudflare Dashboard → Pages](https://dash.cloudflare.com/pages)
2. Click **Create a project**
3. Connect your Git repository
4. Configure build settings:
   - **Framework preset**: `None`
   - **Build command**: `pnpm install && pnpm --filter @avocat-ai/web run pages:build`
   - **Build output directory**: `apps/web/.vercel/output/static`
   - **Root directory**: `/` (or leave empty)
   - **Node version**: `20`
5. Add environment variables (see above)
6. Click **Save and Deploy**

> **Quick reference**: See `CLOUDFLARE_BUILD_SETTINGS.md` in the repository root for copy-paste ready settings.

## Build Configuration

The build process:
1. Installs dependencies using `pnpm`
2. Builds workspace dependencies
3. Runs Next.js build
4. Transforms Next.js output using `@cloudflare/next-on-pages`
5. Outputs to `.vercel/output/static`

### Build Command

```bash
pnpm install && pnpm --filter @avocat-ai/web run pages:build
```

### Build Output

The output directory is `apps/web/.vercel/output/static` (as specified in `wrangler.toml`).

## Custom Domain Setup

1. Go to Cloudflare Pages → Your Project → **Custom domains**
2. Click **Set up a custom domain**
3. Enter your domain name
4. Follow DNS configuration instructions
5. SSL/TLS is automatically provisioned by Cloudflare

## Monitoring and Logs

### Viewing Logs

- **Production logs**: Cloudflare Dashboard → Pages → Project → **Deployments** → Select deployment → **Functions** tab
- **Real-time logs**: Use Wrangler CLI: `wrangler pages deployment tail`

### Analytics

- **Analytics**: Cloudflare Dashboard → Pages → Project → **Analytics**
- **Performance**: Built-in Web Analytics (enable in dashboard)

## Troubleshooting

### Build Failures

1. **Check Node version**: Ensure Node.js 20+ is used
2. **Check pnpm version**: Must use pnpm 9.12.3+ (specified in package.json)
3. **Review build logs**: Check Cloudflare Pages build logs for errors
4. **Test locally**: Run `pnpm build:web:pages` locally to reproduce

### Runtime Errors

1. **Check environment variables**: Ensure all required variables are set
2. **Review function logs**: Check Cloudflare Pages Functions logs
3. **Test API connectivity**: Verify API endpoints are accessible
4. **Check CORS**: Ensure API allows requests from Cloudflare Pages domain

### Common Issues

#### "Module not found" errors
- Ensure workspace dependencies are built before the app
- Check that `pnpm install` runs before build

#### Environment variables not available
- Verify variables are set in Cloudflare Pages dashboard
- Check variable names match exactly (case-sensitive)
- Ensure variables are set for the correct environment (Production/Preview)

#### Build timeout
- Cloudflare Pages has a 20-minute build timeout
- Optimize build: use build cache, reduce dependencies
- Consider splitting large builds

## Performance Optimization

### Caching

- Static assets are automatically cached by Cloudflare
- Configure cache headers in `next.config.mjs` if needed

### Edge Functions

- Next.js API routes run as Cloudflare Pages Functions (Edge)
- Optimize for Edge runtime: avoid Node.js-only features
- Use Edge-compatible libraries

### Image Optimization

- Images are set to `unoptimized: true` in Next.js config (required for Pages)
- Consider using Cloudflare Images or external CDN for optimization

## Security Considerations

1. **Environment Variables**: Never commit secrets to repository
2. **API Keys**: Use Cloudflare Pages environment variables only
3. **CSP Headers**: Configured in `next.config.mjs` for security
4. **HTTPS**: Automatically enabled by Cloudflare
5. **Access Control**: This is an internal system with access controlled via user management:
   - Users must be invited by system administrators
   - Access is managed through the user management interface
   - Role-based access control (RBAC) and attribute-based access control (ABAC) enforce permissions
   - Row-level security (RLS) in Supabase ensures data isolation
   - The system is not publicly accessible - only invited staff members can access it

## Rollback

To rollback to a previous deployment:

1. Go to Cloudflare Pages → Your Project → **Deployments**
2. Find the deployment you want to rollback to
3. Click the three dots (⋯) → **Retry deployment**
4. Or use Wrangler CLI: `wrangler pages deployment rollback <DEPLOYMENT_ID>`

## Support

For issues:
1. Check [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
2. Review [@cloudflare/next-on-pages Documentation](https://github.com/cloudflare/next-on-pages)
3. Check build logs in Cloudflare Dashboard
4. Test locally with Wrangler CLI

