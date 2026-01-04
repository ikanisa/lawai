# NEXT_PUBLIC_SUPABASE_URL - Guide

## What is it?

`NEXT_PUBLIC_SUPABASE_URL` is the **public API URL** of your Supabase project. It's used by the frontend (Next.js app) to connect to your Supabase backend for:

- Database queries (via Supabase client)
- Authentication (user sign-in, sign-up, sessions)
- Real-time subscriptions
- Storage access
- Edge Functions calls

## Why "NEXT_PUBLIC_" prefix?

The `NEXT_PUBLIC_` prefix makes this environment variable available to **client-side code** (browser). Without this prefix, environment variables are only available on the server side in Next.js.

Since the Supabase client needs to connect from the browser, this variable must be public.

## What does it look like?

The URL format is:
```
https://<your-project-ref>.supabase.co
```

Where `<your-project-ref>` is your unique Supabase project reference ID.

**Example:**
```
https://abcdefghijklmnop.supabase.co
```

## How to get it?

### Option 1: From Supabase Dashboard (Easiest)

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project (or create a new one)
3. Go to **Settings** → **API** (or **Project Settings** → **API**)
4. Find **Project URL** under the **Project API keys** section
5. Copy the URL - it looks like `https://xxxxxxxxxxxxx.supabase.co`

### Option 2: From Project Settings

1. In Supabase Dashboard, select your project
2. Click **Settings** (gear icon) in the sidebar
3. Click **API**
4. The **Project URL** is displayed at the top
5. Copy this URL

### Option 3: From Environment Variables (if already set up)

If you have a local `.env` or `.env.local` file:

```bash
# Check if it's already in your environment
grep NEXT_PUBLIC_SUPABASE_URL .env.local
```

## Where to set it?

### For Cloudflare Pages Deployment:

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Pages** → Your Project
3. Go to **Settings** → **Environment Variables**
4. Click **Add variable**
5. Add:
   - **Name**: `NEXT_PUBLIC_SUPABASE_URL`
   - **Value**: `https://your-project-ref.supabase.co`
   - **Environment**: Select **Production** (and/or **Preview**)

### For Local Development:

Add to `.env.local` in the project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
```

## Related Variables

You'll also need:

- **`NEXT_PUBLIC_SUPABASE_ANON_KEY`** - The public (anon) API key for Supabase
  - Found in the same **Settings → API** page
  - It's the `anon` or `public` key (safe to expose in frontend code)

**Note:** You might see a `service_role` key - **DO NOT** use that in `NEXT_PUBLIC_*` variables as it has admin access and should only be used server-side!

## How it's used in the code

In this project, `NEXT_PUBLIC_SUPABASE_URL` is used in:

1. **`apps/web/src/lib/config.ts`** - Main configuration object
2. **`apps/web/next.config.mjs`** - Content Security Policy (CSP) configuration
3. **Supabase client initialization** - To create the Supabase client instance

Example usage:
```typescript
// apps/web/src/lib/config.ts
export const config = {
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  },
};
```

## Security Notes

✅ **Safe to expose**: The URL and anon key are designed to be public - they're used by your frontend code running in users' browsers.

✅ **Row Level Security (RLS)**: Your database should have RLS policies enabled to protect data - the anon key alone doesn't give access to everything.

❌ **Never expose**: The `service_role` key should never be in `NEXT_PUBLIC_*` variables - only use it server-side.

## Troubleshooting

### "Invalid API key" or connection errors

1. Verify the URL is correct (no trailing slash)
2. Check the anon key matches the URL
3. Ensure RLS policies allow public access (if needed)
4. Check Supabase project is active (not paused)

### "CORS" errors

The URL should be included in your Content Security Policy (already configured in `next.config.mjs`). If you see CORS errors, check:
- CSP settings in `apps/web/next.config.mjs`
- Supabase project settings allow your domain

## Quick Reference

| Item | Value |
|------|-------|
| **Variable name** | `NEXT_PUBLIC_SUPABASE_URL` |
| **Format** | `https://<project-ref>.supabase.co` |
| **Where to find** | Supabase Dashboard → Settings → API → Project URL |
| **Used for** | Frontend connection to Supabase (auth, database, storage) |
| **Security** | Safe to expose (public URL) |

