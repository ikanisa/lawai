# Provider Removal Checklist

This checklist tracks the removal of Vercel and Cloudflare specific code and configurations from the Avocat-AI codebase.

## Files to Delete

### Root Level
- [x] `vercel.json` (if exists) - **DONE**: Will be removed by cleanup script
- [ ] `wrangler.toml` (if exists)
- [ ] `.vercelignore` (if exists)

### App Level
- [x] `apps/web/vercel.json` - **EXISTS**: Will be removed
- [ ] `apps/pwa/vercel.json` (if exists)
- [ ] `apps/*/wrangler.toml` (if exists)

### Configuration Files
- [ ] Any `.vercel/` directories
- [ ] Any `.cloudflare/` directories

## Code Changes Required

### Import Statements

#### Vercel Analytics
- [ ] Search for: `@vercel/analytics`
- [ ] Search for: `import { Analytics } from '@vercel/analytics'`
- [ ] Replace with: Generic analytics or remove

#### Vercel Speed Insights
- [ ] Search for: `@vercel/speed-insights`
- [ ] Search for: `import { SpeedInsights } from '@vercel/speed-insights'`
- [ ] Replace with: Web vitals tracking or remove

#### Vercel KV / Edge Config
- [ ] Search for: `@vercel/kv`
- [ ] Search for: `@vercel/edge-config`
- [ ] Replace with: Supabase cache or Redis

#### Cloudflare Workers
- [ ] Search for: `@cloudflare/workers-types`
- [ ] Search for: `@cloudflare/kv`
- [ ] Replace with: Generic serverless or remove

### Runtime Declarations

#### Edge Runtime
- [ ] Search for: `export const runtime = 'edge'`
- [ ] Search for: `runtime: 'edge'`
- [ ] Replace with: Remove or change to `'nodejs'` (Netlify default)

#### Preferred Regions
- [ ] Search for: `export const preferredRegion`
- [ ] Remove: Netlify doesn't support this

### API Routes

#### Check all API routes in:
- [ ] `apps/web/app/api/*/route.ts`
- [ ] `apps/pwa/app/api/*/route.ts`

#### Remove from API routes:
- [ ] `export const runtime = 'edge'`
- [ ] `export const preferredRegion`
- [ ] Vercel-specific imports

### Middleware

#### Check middleware files:
- [ ] `apps/web/middleware.ts`
- [ ] `apps/pwa/middleware.ts`

#### Remove from middleware:
- [ ] `import { geolocation } from '@vercel/edge'`
- [ ] `import { ipAddress } from '@vercel/edge'`
- [ ] Replace with: Generic alternatives or Netlify edge functions

### Next.js Configuration

#### apps/web/next.config.mjs
- [x] Remove: `vercel.live` from CSP - **DONE**
- [x] Keep: `output: 'standalone'` - **DONE**
- [x] Keep: Security headers - **DONE**

#### apps/pwa/next.config.mjs
- [x] Remove: `vercel.live` from CSP - **DONE**
- [x] Keep: `output: 'standalone'` - **DONE**
- [x] Keep: Security headers - **DONE**

### Package Dependencies

#### Root package.json
- [ ] Check for: `@vercel/*` packages
- [ ] Check for: `@cloudflare/*` packages
- [ ] Remove if found

#### apps/web/package.json
- [ ] Check for: `@vercel/*` packages
- [ ] Check for: `@cloudflare/*` packages
- [ ] Remove if found

#### apps/pwa/package.json
- [ ] Check for: `@vercel/*` packages
- [ ] Check for: `@cloudflare/*` packages
- [ ] Remove if found

## Replacement Strategies

### Analytics Replacement

**Before (Vercel Analytics):**
```typescript
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

**After (Generic Web Vitals):**
```typescript
import { useReportWebVitals } from 'next/web-vitals';

export function WebVitals() {
  useReportWebVitals((metric) => {
    // Send to your analytics service
    console.log(metric);
  });
  return null;
}

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <WebVitals />
      </body>
    </html>
  );
}
```

### Caching Replacement

**Before (Vercel KV):**
```typescript
import { kv } from '@vercel/kv';

const cached = await kv.get('key');
await kv.set('key', value, { ex: 3600 });
```

**After (Supabase Cache):**
```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(url, key);

// Use cache table
const { data } = await supabase
  .from('cache')
  .select('value')
  .eq('key', 'key')
  .single();

await supabase.from('cache').upsert({
  key: 'key',
  value: value,
  expires_at: new Date(Date.now() + 3600000),
});
```

### Edge Config Replacement

**Before (Vercel Edge Config):**
```typescript
import { get } from '@vercel/edge-config';

const config = await get('feature-flags');
```

**After (Environment Variables or Supabase):**
```typescript
// Option 1: Environment variables
const config = JSON.parse(process.env.FEATURE_FLAGS || '{}');

// Option 2: Supabase table
const { data } = await supabase
  .from('config')
  .select('*')
  .eq('key', 'feature-flags')
  .single();
```

### Geolocation Replacement

**Before (Vercel Edge):**
```typescript
import { geolocation } from '@vercel/edge';

export function middleware(request) {
  const geo = geolocation(request);
  console.log(geo.country);
}
```

**After (Generic Headers):**
```typescript
export function middleware(request) {
  // Netlify provides geo headers
  const country = request.headers.get('x-country');
  const city = request.headers.get('x-city');
  console.log(country, city);
}
```

## Database Migrations

### Cache Table (if needed)

```sql
-- Create generic cache table
CREATE TABLE IF NOT EXISTS cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient lookups
CREATE INDEX idx_cache_key ON cache(key);
CREATE INDEX idx_cache_expires ON cache(expires_at) WHERE expires_at IS NOT NULL;

-- Cleanup expired entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
```

## Verification Steps

### 1. Run Cleanup Script
```bash
./scripts/cleanup-providers.sh
```

### 2. Scan for Remaining Code
```bash
tsx scripts/scan-provider-code.ts
```

### 3. Check Package Dependencies
```bash
grep -r "@vercel\|@cloudflare" package.json apps/*/package.json packages/*/package.json
```

### 4. Verify Build Still Works
```bash
pnpm --filter @avocat-ai/web build
pnpm --filter @avocat-ai/pwa build
```

### 5. Run Pre-deployment Checks
```bash
node scripts/predeploy-check.mjs
```

### 6. Final Verification
```bash
tsx scripts/verify-cleanup.ts
```

## Post-Removal Tasks

### Update Documentation
- [ ] Update README.md to remove Vercel references
- [ ] Update deployment documentation
- [ ] Update CONTRIBUTING.md if needed

### Update CI/CD
- [ ] Remove Vercel deployment workflows
- [ ] Add Netlify deployment workflows
- [ ] Update environment variable references

### Team Communication
- [ ] Notify team of changes
- [ ] Update runbooks
- [ ] Update deployment procedures

## Sign-off

- [ ] Technical lead approval
- [ ] DevOps approval
- [ ] Security review completed
- [ ] Documentation updated
- [ ] Team notified

## Notes

- The cleanup scripts automate most of the removal process
- Manual code changes are required for imports and replacements
- Test thoroughly before deploying to production
- Keep a backup of the pre-refactoring state

---

**Status**: ⚠️ In Progress
**Last Updated**: 2024
**Assigned To**: DevOps Team
