# Cloudflare Deployment Quick Start

This repository is configured for deployment to Cloudflare Pages. The web application (`apps/web`) is a Next.js app adapted for Cloudflare's Edge runtime.

> **Important**: This is an **internal staff-only system**. Access is controlled via user management - users can only access the system by invitation from system administrators. This is not a publicly available application.

## Quick Deployment

### Option 1: GitHub Actions (Recommended)

1. **Set up GitHub Secrets**:
   - `CLOUDFLARE_API_TOKEN`: API token with Pages:Edit permissions
   - `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID
   - `NEXT_PUBLIC_API_BASE_URL`: Your API base URL
   - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon key

2. **Push to main/master**: The workflow automatically deploys

3. **Pull Requests**: Preview deployments are created automatically

### Option 2: Cloudflare Dashboard

1. Go to [Cloudflare Dashboard → Pages](https://dash.cloudflare.com/pages)
2. Click **Create a project** → **Connect to Git**
3. Select this repository
4. Configure build settings:
   - **Framework preset**: `None`
   - **Build command**: `pnpm install && pnpm --filter @avocat-ai/web run pages:build`
   - **Build output directory**: `apps/web/.vercel/output/static`
   - **Root directory**: `/` (or leave empty)
   - **Node version**: `20`
5. Add environment variables (see `apps/web/cloudflare.env.example`)
6. Click **Save and Deploy**

**Quick reference**: See `CLOUDFLARE_BUILD_SETTINGS.md` for copy-paste ready settings.

### Option 3: Local Deployment with Wrangler

```bash
# Authenticate
wrangler login

# Build and deploy
cd apps/web
pnpm deploy:cloudflare
```

## Environment Variables

Required environment variables (set in Cloudflare Pages dashboard):

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NODE_ENV=production`

See `apps/web/cloudflare.env.example` for reference.

## Build Process

The build uses `@cloudflare/next-on-pages` to adapt Next.js for Cloudflare's Edge runtime:

1. Standard Next.js build
2. Transformation for Cloudflare Pages Functions
3. Output to `.vercel/output/static`

## Documentation

For detailed deployment instructions, troubleshooting, and advanced configuration, see:
- **[Full Deployment Guide](docs/deployment/cloudflare.md)**
- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [@cloudflare/next-on-pages Documentation](https://github.com/cloudflare/next-on-pages)

## Local Development

```bash
# Build for Cloudflare Pages locally
pnpm build:web:pages

# Test with Wrangler
cd apps/web
wrangler pages dev .vercel/output/static
```

## Support

- Check build logs in Cloudflare Dashboard
- Review [deployment guide](docs/deployment/cloudflare.md)
- Test locally with Wrangler CLI

