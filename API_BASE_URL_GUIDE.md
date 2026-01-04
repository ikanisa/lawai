# NEXT_PUBLIC_API_BASE_URL - Guide

## What is it?

`NEXT_PUBLIC_API_BASE_URL` is the **base URL** of your backend API service. It's used by the frontend (Next.js web app) to make HTTP requests to your API for:

- Legal research queries
- Agent operations and planning
- Workspace management
- User authentication flows
- Telemetry and analytics
- Administrative operations

## Why "NEXT_PUBLIC_" prefix?

The `NEXT_PUBLIC_` prefix makes this environment variable available to **client-side code** (browser). Without this prefix, environment variables are only available on the server side in Next.js.

Since the frontend makes API calls from the browser, this variable must be public.

## What does it look like?

The URL format depends on where your API is deployed:

**Examples:**
```
https://api.yourdomain.com
https://your-api.railway.app
https://your-api.render.com
https://api-avocat-ai.up.railway.app
http://localhost:3333  # For local development
```

**Important:** 
- ✅ Must include the protocol (`https://` or `http://`)
- ✅ No trailing slash (`/`)
- ✅ Use `https://` in production (required for security)

## How to get it?

The API base URL is the URL where your **API service** (`apps/api`) is deployed.

### Option 1: If you've already deployed the API

1. Check your deployment platform (Railway, Render, Fly.io, etc.)
2. Find the URL of your deployed API service
3. It should be something like:
   - `https://your-api.railway.app`
   - `https://api.yourdomain.com`
   - `https://your-api.render.com`

### Option 2: Check deployment documentation

Look in your deployment platform dashboard:
- **Railway**: Project → Service → Settings → Domains
- **Render**: Dashboard → Service → Settings → Public URL
- **Fly.io**: `fly status` or Dashboard → App → URL
- **Self-hosted**: Your server's public URL

### Option 3: For local development

Use:
```
http://localhost:3333
```

(This is the default if not set - see `apps/web/src/env.client.ts`)

## Where to set it?

### For Cloudflare Pages Deployment:

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Pages** → Your Project
3. Go to **Settings** → **Environment Variables**
4. Click **Add variable**
5. Add:
   - **Name**: `NEXT_PUBLIC_API_BASE_URL`
   - **Value**: `https://your-api-url.com` (your deployed API URL)
   - **Environment**: Select **Production** (and/or **Preview**)

### For Local Development:

Add to `.env.local` in the project root:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:3333
```

## How it's used in the code

In this project, `NEXT_PUBLIC_API_BASE_URL` is used in:

1. **`apps/web/src/lib/constants.ts`** - Exported as `API_BASE` constant
2. **`apps/web/src/lib/api.ts`** - For all API client requests
3. **`packages/api-clients/`** - REST client configuration
4. **`apps/web/src/env.client.ts`** - Environment validation (defaults to `http://localhost:3333`)
5. **`apps/web/next.config.mjs`** - Content Security Policy (CSP) configuration
6. **`apps/web/reportWebVitals.ts`** - Telemetry endpoint

Example usage:
```typescript
// apps/web/src/lib/constants.ts
export const API_BASE = clientEnv.NEXT_PUBLIC_API_BASE_URL;

// apps/web/src/lib/api.ts
const response = await fetch(`${API_BASE}/research/query`, {
  method: 'POST',
  body: JSON.stringify(payload),
});
```

## API Service Location

The API service is the `apps/api` directory in this monorepo. It's a Fastify-based API that handles:
- Legal research operations
- Agent planning and execution
- Workspace management
- User authentication
- Administrative endpoints

The API needs to be deployed separately from the web app (which goes to Cloudflare Pages).

## Common Deployment Platforms

### Railway
```bash
NEXT_PUBLIC_API_BASE_URL=https://your-api.railway.app
```

### Render
```bash
NEXT_PUBLIC_API_BASE_URL=https://your-api.onrender.com
```

### Fly.io
```bash
NEXT_PUBLIC_API_BASE_URL=https://your-api.fly.dev
```

### Self-hosted / Custom Domain
```bash
NEXT_PUBLIC_API_BASE_URL=https://api.yourdomain.com
```

### Local Development
```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:3333
```

## Security Notes

✅ **HTTPS Required in Production**: Always use `https://` in production environments

✅ **CORS Configuration**: Ensure your API service allows requests from your Cloudflare Pages domain in CORS settings

✅ **Safe to Expose**: This URL is public and exposed to browsers - it's the same URL users would see if they inspected network requests

⚠️ **API Authentication**: The API should still require proper authentication (cookies, tokens, etc.) - the base URL being public doesn't mean the endpoints are unprotected

## Troubleshooting

### "Failed to fetch" or network errors

1. **Verify the URL is correct**:
   - Check for typos
   - Ensure no trailing slash
   - Verify protocol (`https://` or `http://`)

2. **Check API is running**:
   ```bash
   curl https://your-api-url.com/health
   ```

3. **Check CORS settings**:
   - API must allow requests from your Cloudflare Pages domain
   - Check API CORS configuration

4. **Check Content Security Policy**:
   - URL should be in CSP `connect-src` (already configured in `next.config.mjs`)

### CORS errors

If you see CORS errors in the browser console:
1. Add your Cloudflare Pages domain to API CORS allowed origins
2. Check API CORS middleware configuration
3. Verify API is responding with correct CORS headers

### "Invalid URL" errors

- Ensure the URL includes protocol (`https://` or `http://`)
- Remove any trailing slashes
- Check for extra spaces

### API returns 404 or 502

- Verify API service is deployed and running
- Check API deployment logs
- Test API endpoint directly: `curl https://your-api-url.com/health`

## Testing

### Test the API URL locally:

```bash
# From repository root
curl http://localhost:3333/health
# or
curl https://your-api-url.com/health
```

### Verify in browser:

Open browser DevTools → Network tab → Look for requests to your API base URL

## Quick Reference

| Item | Value |
|------|-------|
| **Variable name** | `NEXT_PUBLIC_API_BASE_URL` |
| **Format** | `https://your-api-url.com` or `http://localhost:3333` |
| **Where to find** | Your API deployment platform (Railway, Render, etc.) |
| **Used for** | Frontend HTTP requests to backend API |
| **Default (dev)** | `http://localhost:3333` |
| **Required in prod** | Yes (must be set) |
| **Security** | Must use HTTPS in production |

## Related Documentation

- API service: See `apps/api/README.md` (if exists)
- Deployment: See `docs/deployment/` for API deployment guides
- Local development: See `README.md` for running API locally

