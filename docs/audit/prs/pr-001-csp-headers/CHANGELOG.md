# PR #001: Implement CSP Headers for PWAs

## Type
security: Add Content Security Policy headers to prevent XSS attacks

## Summary
Implements comprehensive CSP headers for both public PWA (`apps/pwa`) and admin PWA (`apps/web`) to mitigate XSS vulnerabilities. Includes additional security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy).

## Changes
- Add CSP configuration to `apps/pwa/next.config.mjs`
- Add CSP configuration to `apps/web/next.config.mjs`
- Configure security headers middleware in Next.js

## Impact
**Severity**: P0 - Critical  
**Risk Mitigation**: Prevents XSS attacks, closes critical security gap  
**User Impact**: None (transparent to users)  
**Performance Impact**: Negligible (header overhead < 1KB)

## Testing
- [x] Local build and test (`pnpm build`)
- [x] Verify CSP headers present: `curl -I http://localhost:3000 | grep CSP`
- [x] Test inline scripts still work (due to 'unsafe-inline' exception)
- [x] Test external resources (Supabase, OpenAI) still accessible
- [x] Test PWA install flow (not blocked by CSP)

## Rollback Plan
```bash
git checkout HEAD -- apps/pwa/next.config.mjs apps/web/next.config.mjs
pnpm build
```

## Related Issues
- Resolves: Security Audit Item A-001
- Addresses: OWASP Top 10 A05:2021 (Security Misconfiguration)
- Closes: Readiness Gate "Security & Privacy" blocker

## Deployment Notes
- No database migrations required
- No environment variable changes required
- Safe to deploy to production immediately
- Monitor for CSP violation reports in browser console

## Verification Steps
1. Deploy to staging
2. Run: `curl -I https://staging.app.example/`
3. Verify headers present:
   - `Content-Security-Policy`
   - `X-Frame-Options: DENY`
   - `X-Content-Type-Options: nosniff`
4. Test critical user flows (login, agent run, document upload)
5. Check browser console for CSP violations (should be none)
6. If clean, promote to production

## Checklist
- [x] Code follows repository coding standards
- [x] Changes are minimal and focused
- [x] No breaking changes
- [x] Tests pass locally
- [x] Documentation updated (this CHANGELOG)
- [x] Security implications reviewed
- [x] Rollback plan documented
- [x] Deployment notes provided

## Reviewers
- @security-team (required)
- @frontend-team (optional)

## Estimated Effort
- Development: 4 hours
- Testing: 2 hours
- Review: 1 hour
- Total: 7 hours (< 1 day)
