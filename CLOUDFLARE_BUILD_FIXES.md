# Cloudflare Pages Build Fixes - 2026-01-04

## Issues Identified and Fixed

### 1. Missing `patch-package` Dependency
**Problem**: The build was failing because `patch-package` was not available during the postinstall script for `rollup` (a dependency of `vitest`).

**Error**:
```
node_modules/vitest/node_modules/rollup postinstall: sh: 1: patch-package: not found
ELIFECYCLE  Command failed.
```

**Fix**: Added `patch-package` as a devDependency in the root `package.json`:
```json
"devDependencies": {
  "patch-package": "^8.0.0",
  ...
}
```

### 2. Incomplete Build Process
**Problem**: The `pages:build` script was calling `@cloudflare/next-on-pages` directly without first running `next build`, which is required to generate the `.next` directory.

**Fix**: Updated `apps/web/package.json` to run `next build` first:
```json
"pages:build": "pnpm run build && npx @cloudflare/next-on-pages@1"
```

This ensures:
1. `prebuild` hooks run (generates icons and prepares service worker)
2. `next build` creates the `.next` directory
3. `@cloudflare/next-on-pages` transforms the output for Cloudflare Pages

### 3. pnpm Configuration
**Fix**: Updated `.npmrc` to explicitly allow postinstall scripts:
```
workspaces=true
node-linker=hoisted
ignore-scripts=false
```

## Build Configuration

### Cloudflare Pages Dashboard Settings

**Framework preset**: `None`

**Build command**:
```bash
pnpm install && pnpm --filter @avocat-ai/web run pages:build
```

**Build output directory**:
```
apps/web/.vercel/output/static
```

**Root directory**: `/` (or leave empty)

**Node version**: `20`

### Required Environment Variables

Set these in Cloudflare Pages Dashboard → Settings → Environment Variables:

- `NEXT_PUBLIC_API_BASE_URL` - Your API base URL
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon key
- `NODE_ENV` - Set to `production`

See `apps/web/cloudflare.env.example` for reference.

## Build Process Flow

1. **Install dependencies**: `pnpm install`
   - Installs all workspace dependencies
   - `patch-package` is now available for postinstall scripts

2. **Run build script**: `pnpm --filter @avocat-ai/web run pages:build`
   - Triggers `prebuild` hook (generates icons, prepares service worker)
   - Runs `next build` to create `.next` directory
   - Runs `@cloudflare/next-on-pages` to transform output
   - Outputs to `apps/web/.vercel/output/static`

3. **Deploy**: Cloudflare Pages automatically deploys from the output directory

## Verification

To test the build locally:

```bash
# Install dependencies
pnpm install

# Run the build
pnpm --filter @avocat-ai/web run pages:build

# Verify output exists
ls -la apps/web/.vercel/output/static
```

## Additional Notes

- The `prebuild` script automatically runs before `next build`, so icons and service workers are generated
- All workspace dependencies are built automatically via pnpm workspaces
- The build uses Node.js 20 and pnpm 9.12.3 (as specified in package.json)

## Troubleshooting

If you encounter issues:

1. **Postinstall script errors**: Ensure `patch-package` is installed (now in devDependencies)
2. **Missing .next directory**: Ensure `next build` runs before `@cloudflare/next-on-pages`
3. **Environment variables**: Verify all required variables are set in Cloudflare Pages dashboard
4. **Build timeout**: Cloudflare Pages has a default timeout; complex builds may need optimization

## Files Modified

- `package.json` - Added `patch-package` devDependency
- `.npmrc` - Added `ignore-scripts=false` to allow postinstall scripts
- `apps/web/package.json` - Updated `pages:build` to run `next build` first
- `CLOUDFLARE_BUILD_SETTINGS.md` - Updated documentation

