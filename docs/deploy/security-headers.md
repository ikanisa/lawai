# Security Headers Configuration

This document explains the security headers configuration for the Cloudflare Pages deployment and how to tune CSP (Content-Security-Policy) safely per environment.

## Overview

Security headers are configured in two places:

1. **`apps/web/next.config.mjs`**: Headers for Server Components and API routes (dynamic responses)
2. **`apps/web/public/_headers`**: Headers for static assets (files served directly by Cloudflare Pages)

> [!IMPORTANT]
> **Headers do NOT apply to Pages Functions**: The `_headers` file applies to static assets only. Headers for API routes (`/api/*`) and Server Components are set in `next.config.mjs` and applied by Next.js.

## Header Configuration Locations

### Static Assets (`_headers`)

Location: `apps/web/public/_headers`

This file is copied to the build output (`apps/web/.vercel/output/static/_headers`) and applies to static files like:
- Static HTML files
- JavaScript bundles (`/_next/static/*`)
- Images (`/icons/*`)
- Service worker (`/sw.js`)
- Manifest (`/manifest.json`)

### Dynamic Responses (`next.config.mjs`)

Location: `apps/web/next.config.mjs`

The `headers()` function returns headers that apply to:
- Server Components (all pages rendered server-side)
- API routes (`/api/*`)
- Dynamic routes

## Current Headers

### Security Headers (All Routes)

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Frame-Options` | `DENY` | Prevents clickjacking (page cannot be embedded in iframe) |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME type sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Controls referrer information |
| `Permissions-Policy` | `geolocation=(), microphone=(), camera=()` | Disables geolocation, microphone, camera |

### Content Security Policy (CSP)

CSP is configured in `next.config.mjs` and uses environment variables for API and Supabase URLs.

**Development CSP** (from `next.config.mjs`):
- Allows `'unsafe-eval'` for development tools
- Allows connections to `localhost` APIs
- More permissive script sources

**Production CSP** (from `next.config.mjs`):
- Stricter script sources (no `'unsafe-eval'`)
- Only allows connections to configured API and Supabase URLs
- Upgrades insecure requests

### Caching Headers

| Path Pattern | Cache Control | Purpose |
|--------------|---------------|---------|
| `/_next/static/*` | `public, max-age=31536000, immutable` | Long cache for hashed assets (safe to cache forever) |
| `/index.html` | `public, max-age=0, must-revalidate` | No cache to avoid stale deployments |
| `/sw.js` | `public, max-age=0, must-revalidate` | No cache for service worker updates |
| `/workbox-*.js` | `public, max-age=31536000, immutable` | Long cache for Workbox libraries |
| `/icons/*` | `public, max-age=86400` | 24-hour cache for icons |
| `/manifest.json` | `public, max-age=3600` | 1-hour cache for manifest |

## Tuning CSP Per Environment

### Understanding CSP Sources

The CSP in `next.config.mjs` is built dynamically based on environment variables:

```javascript
const connectSources = [
  "'self'",
  process.env.NEXT_PUBLIC_API_BASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  'https://*.supabase.co',
  'https://*.supabase.in',
  'https:',  // Allows all HTTPS connections (may need to tighten)
  'wss:',    // Allows all WebSocket connections (may need to tighten)
].filter(Boolean);
```

### Environment-Specific Tuning

#### Development

**Current behavior**: Allows `'unsafe-eval'` for development tools.

**To tighten** (if needed):
- Remove `'unsafe-eval'` from script sources
- Restrict `connect-src` to specific domains only

#### Preview/Staging

**Recommendations**:
- Use strict CSP (no `'unsafe-eval'`)
- Restrict `connect-src` to preview API and Supabase URLs only
- Test thoroughly before deploying to production

#### Production

**Current behavior**: Stricter CSP, but allows all HTTPS connections.

**To tighten** (recommended):
1. **Remove broad `https:` and `wss:` from `connect-src`**
   - Replace with specific domains only
   - Example: `'https://api.yourdomain.com'`, `'https://your-project.supabase.co'`

2. **Add specific domains for external services**:
   ```javascript
   const connectSources = [
     "'self'",
     process.env.NEXT_PUBLIC_API_BASE_URL,
     process.env.NEXT_PUBLIC_SUPABASE_URL,
     'https://*.supabase.co',
     'https://*.supabase.in',
     // Add specific external APIs if needed:
     // 'https://api.openai.com',
     // 'https://api.sentry.io',
   ].filter(Boolean);
   ```

3. **Tighten `img-src` if possible**:
   - Current: `'self' data: blob: https:`
   - Consider: `'self' data: blob: https://*.supabase.co https://your-cdn.com`

### CSP Tuning Checklist

- [ ] Review all external domains your app connects to
- [ ] List all external image sources
- [ ] Identify all script sources (analytics, error tracking, etc.)
- [ ] Create environment-specific CSP configurations
- [ ] Test in preview/staging before production
- [ ] Monitor CSP violations in browser console
- [ ] Use report-uri or report-to for CSP violation reports (optional)

## Strict-Transport-Security (HSTS)

### Current Status

HSTS is **NOT enabled** in `_headers` because:
- It requires all subdomains to be HTTPS-ready
- It has long-term implications (browser will enforce HTTPS for the domain)

### When to Enable

Enable HSTS only when:
1. ✅ All subdomains are HTTPS-ready
2. ✅ You're committed to HTTPS-only (no HTTP fallback)
3. ✅ You understand the implications (browser will cache the policy)

### How to Enable

If you decide to enable HSTS, add to `_headers`:

```
/*
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

**Recommended values**:
- `max-age=31536000`: 1 year (standard)
- `includeSubDomains`: Apply to all subdomains
- `preload`: Submit to HSTS preload list (optional, requires commitment)

## Testing Headers

### Local Testing

After building, test headers locally:

```bash
# Build the app
cd apps/web
pnpm run pages:build

# Start local preview
pnpm run pages:preview

# In browser DevTools → Network tab:
# 1. Check Response Headers for security headers
# 2. Verify CSP is present
# 3. Check Cache-Control headers for static assets
```

### Production Testing

1. **Check headers in browser DevTools**:
   - Open DevTools → Network tab
   - Reload page
   - Click on any request
   - Check "Response Headers" section

2. **Use online tools**:
   - [SecurityHeaders.com](https://securityheaders.com/)
   - [Mozilla Observatory](https://observatory.mozilla.org/)

3. **Verify CSP**:
   - Open browser console
   - Look for CSP violation warnings
   - Fix any violations before production

## Common Issues

### Issue: CSP blocks legitimate requests

**Symptoms**: Console shows CSP violation errors, features don't work.

**Solution**:
1. Identify the blocked resource from the console error
2. Add the domain to the appropriate CSP directive
3. Test in preview/staging first
4. Deploy to production

### Issue: Static assets not cached

**Symptoms**: Assets reload on every request, slow page loads.

**Solution**:
- Verify `_headers` file is in build output
- Check Cache-Control headers in browser DevTools
- Ensure path patterns match (case-sensitive)

### Issue: Stale deployments (index.html cached)

**Symptoms**: Users see old version after deployment.

**Solution**:
- Verify `index.html` has `Cache-Control: public, max-age=0, must-revalidate`
- Check `_headers` file is in build output
- Hard refresh browser (Ctrl+Shift+R) to test

## Security Headers Checklist

- [x] `X-Frame-Options: DENY` (prevents clickjacking)
- [x] `X-Content-Type-Options: nosniff` (prevents MIME sniffing)
- [x] `Referrer-Policy` (controls referrer info)
- [x] `Permissions-Policy` (locks down browser features)
- [x] `Content-Security-Policy` (XSS protection)
- [ ] `Strict-Transport-Security` (HSTS) - Enable only if ready
- [x] Cache headers for static assets
- [x] Cache headers for `index.html` (no-cache)
- [x] Cache headers for service worker (no-cache)

## References

- [Cloudflare Pages Headers Documentation](https://developers.cloudflare.com/pages/platform/headers/)
- [MDN: Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [SecurityHeaders.com](https://securityheaders.com/)
- [Next.js Headers Configuration](https://nextjs.org/docs/app/api-reference/next-config-js/headers)

