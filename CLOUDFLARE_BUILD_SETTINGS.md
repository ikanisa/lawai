# Cloudflare Pages Build Settings

Use these settings when configuring your project in the Cloudflare Pages dashboard.

## Build Configuration

### Framework preset
```
None
```

### Build command
```
pnpm install && pnpm --filter @avocat-ai/web run pages:build
```

### Build output directory
```
apps/web/.vercel/output/static
```

### Root directory (if available)
```
/
```
*(Leave as root, or leave empty if not available)*

### Node version
```
20
```

## Alternative: Using pnpm workspaces

If the above doesn't work, you can also use:

### Build command (alternative)
```
corepack enable && corepack prepare pnpm@9.12.3 --activate && pnpm install --frozen-lockfile && pnpm --filter @avocat-ai/web run pages:build
```

## Summary for Quick Copy-Paste

When setting up in Cloudflare Pages dashboard:

- **Framework preset**: `None`
- **Build command**: `pnpm install && pnpm --filter @avocat-ai/web run pages:build`
- **Build output directory**: `apps/web/.vercel/output/static`
- **Root directory**: `/` (or leave empty)
- **Node version**: `20`

## Notes

- The build output directory is `.vercel/output/static` inside the `apps/web` directory (not the repository root)
- The build command installs dependencies first, then builds the Next.js app for Cloudflare Pages
- Node.js 20 is required (specified in `.nvmrc`)
- pnpm is the package manager (specified in `package.json`)

