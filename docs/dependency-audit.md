# Dependency Audit & Modernization

_Last updated: 2025-10-29_

This document tracks the dependency audit results, identifies unused dependencies, documents deprecated packages, and provides a modernization roadmap.

## Audit Summary

**Audit Date**: 2025-10-29  
**Total Packages**: 1,408 (including transitive dependencies)  
**Direct Dependencies**: ~50 across all workspaces  
**Deprecated Warnings**: 17 packages (4 direct, 13 transitive)  
**Outdated Packages**: 2 major version updates available  
**Duplicate Dependencies**: 0 (all deduplicated ✅)

## Deprecated Dependencies

### Direct Dependencies (User Action Required)

| Package | Current | Status | Used In | Action Required |
|---------|---------|--------|---------|-----------------|
| **@types/pino** | 7.0.5 | ⚠️ Deprecated | apps/api | Update to latest or remove if unused |
| **eslint** | 8.57.0 | ⚠️ Deprecated | apps/api | Upgrade to ESLint 9.x (breaking changes) |
| **docx** | 8.6.0 | ⚠️ Deprecated | apps/web | Evaluate replacement or upgrade |
| **workbox-window** | 6.6.1 | ⚠️ Deprecated | apps/web | Part of next-pwa, monitor for updates |

### Transitive Dependencies (Monitor Only)

| Package | Current | Reason | Impact |
|---------|---------|--------|--------|
| **@humanwhocodes/config-array** | 0.11.14 | Deprecated | Low - ESLint dependency |
| **@humanwhocodes/object-schema** | 2.0.3 | Deprecated | Low - ESLint dependency |
| **@types/minimatch** | 6.0.0 | Deprecated | Low - Type definitions |
| **glob** | 7.2.3 | Deprecated | Low - Replaced by node:fs.glob |
| **inflight** | 1.0.6 | Deprecated | Low - Legacy fs utility |
| **rimraf** | 2.7.1, 3.0.2 | Deprecated | Low - Replaced by native fs.rm |
| **rollup-plugin-terser** | 7.0.2 | Deprecated | Low - Build tool |
| **source-map** | 0.8.0-beta.0 | Beta/deprecated | Low - Source maps |
| **sourcemap-codec** | 1.4.8 | Deprecated | Low - Source map utility |
| **workbox-*** | 6.6.x | Deprecated | Medium - PWA caching |

## Outdated Dependencies

### Major Version Updates Available

| Package | Current | Latest | Type | Breaking Changes | Priority |
|---------|---------|--------|------|------------------|----------|
| **typescript** | 5.4.5 | 5.9.3 | Dev | Minor breaking changes | High |
| **zod** | 3.25.76 | 4.1.12 | Dev | Major breaking changes | Medium |

### TypeScript 5.4.5 → 5.9.3

**Changes**:
- Improved type inference
- New utility types
- Performance improvements
- Minor breaking changes in edge cases

**Migration**:
1. Review [TypeScript 5.9 release notes](https://devblogs.microsoft.com/typescript/)
2. Update incrementally: 5.4.5 → 5.5 → 5.6 → 5.7 → 5.8 → 5.9
3. Run typecheck after each minor version
4. Fix any type errors
5. Update @types/* packages

**Risk**: Low - TypeScript is generally backward compatible
**Effort**: Medium - ~1-2 days for testing and fixing type errors
**Recommendation**: Upgrade incrementally, prioritize

### Zod 3.25.76 → 4.1.12

**Changes**:
- Major API changes
- New validation patterns
- Performance improvements
- Breaking changes in schema composition

**Migration**:
1. Review [Zod 4.0 migration guide](https://github.com/colinhacks/zod/releases)
2. Test all schema validations
3. Update schema definitions for breaking changes
4. Run comprehensive tests

**Risk**: High - Major version with breaking changes
**Effort**: High - ~3-5 days (Zod used extensively for validation)
**Recommendation**: Defer until post-launch, Zod 3.x is stable

## Known Issues Resolution

### 1. Observability Package - Type Errors

**Issue**: MetricReader version mismatch in OpenTelemetry  
**Status**: Known issue, non-blocking  
**Impact**: Typecheck fails in observability workspace  
**Resolution**:
- Short-term: Use workspace-specific typecheck (documented)
- Long-term: Align OpenTelemetry versions across dependencies
- Track upstream fix in OpenTelemetry SDK

**Action Items**:
- [ ] Document version conflict in package.json
- [ ] Create issue to track OpenTelemetry alignment
- [ ] Monitor for upstream fix

### 2. Compliance Package - ESLint Config Missing

**Issue**: Missing ESLint configuration  
**Status**: Known issue, workspace-specific lint works  
**Impact**: Root-level `pnpm lint` fails for compliance  
**Resolution**:
- Add `.eslintrc.cjs` to packages/compliance
- Use shared ESLint config or extend from root
- Test with `pnpm --filter @avocat-ai/compliance lint`

**Action Items**:
- [ ] Add ESLint config to packages/compliance
- [ ] Verify lint passes
- [ ] Update documentation

### 3. Lockfile Sync - apps/edge

**Issue**: `apps/edge/package.json` out of sync with lockfile  
**Status**: Use `--no-frozen-lockfile` locally  
**Impact**: Fresh installs may require flag  
**Resolution**:
- Update `apps/edge/package.json` to match lockfile
- Run `pnpm install` to regenerate lockfile
- Commit updated lockfile

**Action Items**:
- [ ] Review apps/edge dependencies
- [ ] Regenerate lockfile if needed
- [ ] Document any required changes

### 4. Cypress Download Failures

**Issue**: Cypress binary download fails in restricted networks  
**Status**: Non-blocking, use `--ignore-scripts`  
**Impact**: PWA E2E tests may not run locally  
**Resolution**:
- Use `pnpm install --ignore-scripts` as documented
- E2E tests can run in CI where network access is available
- Consider alternatives (Playwright) if persistent issue

**Action Items**:
- [ ] Document network requirements for Cypress
- [ ] Evaluate Playwright migration for PWA tests
- [ ] Ensure CI has network access

## Unused Dependencies Audit

### Methodology

1. **Static Analysis**: Check imports across all files
2. **Runtime Analysis**: Review actual usage in applications
3. **Type-only Dependencies**: Identify @types/* packages
4. **Peer Dependencies**: Verify peer dependency requirements

### Audit Results

**Status**: Pending full audit  
**Next Steps**:
1. Run `npx depcheck` on each workspace
2. Manually verify flagged dependencies
3. Remove confirmed unused dependencies
4. Update this document with findings

### Workspace-by-Workspace Audit

#### Root Dependencies

```json
{
  "dependencies": {
    "next-pwa": "^5.6.0"  // Used by apps/web and apps/pwa
  },
  "devDependencies": {
    "sql-formatter": "^15.6.10",  // Used by scripts/lint-sql.mjs
    "typescript": "^5.4.5",        // Used globally
    "zod": "^3.25.42"              // Used globally for validation
  }
}
```

**Status**: All root dependencies appear to be used ✅

#### apps/api

**To Audit**:
- [ ] Check Fastify plugins usage
- [ ] Verify OpenAI SDK dependencies
- [ ] Review Supabase client dependencies
- [ ] Check observability dependencies

#### apps/web

**To Audit**:
- [ ] Check Next.js plugin usage
- [ ] Verify shadcn/ui dependencies
- [ ] Review TanStack Query usage
- [ ] Check workbox dependencies (PWA)

#### apps/pwa

**To Audit**:
- [ ] Check Radix UI usage
- [ ] Verify three.js usage
- [ ] Review PWA manifest dependencies

#### packages/*

**To Audit**:
- [ ] Check shared package dependencies
- [ ] Verify type-only dependencies
- [ ] Review utility library usage

## Build System Optimization

### Current Build Performance

**Baseline** (measured on GitHub Actions):
- Install: ~1-2 minutes (with cache)
- Typecheck: ~30-60 seconds
- Lint: ~20-40 seconds  
- Test: ~5-15 seconds
- Build: ~2-4 minutes

### Optimization Opportunities

1. **Dependency Caching**
   - ✅ PNPM cache configured in CI
   - Status: Already optimized

2. **Build Caching**
   - Opportunity: Cache build outputs (.next/, dist/)
   - Implementation: Use @actions/cache for build directories
   - Expected improvement: 30-50% faster builds

3. **Parallel Execution**
   - Current: Sequential workspace builds
   - Opportunity: Parallel workspace operations
   - Implementation: Use pnpm --parallel flag
   - Expected improvement: 20-30% faster CI

4. **Incremental Builds**
   - Current: Full rebuild each time
   - Opportunity: TypeScript incremental builds
   - Implementation: Enable tsBuildInfoFile in tsconfig
   - Expected improvement: 40-60% faster typecheck

### Proposed Build Caching Strategy

```yaml
# .github/workflows/ci.yml addition
- name: Cache build outputs
  uses: actions/cache@v4
  with:
    path: |
      apps/*/dist
      apps/*/.next
      packages/*/dist
    key: build-${{ runner.os }}-${{ hashFiles('**/pnpm-lock.yaml') }}-${{ github.sha }}
    restore-keys: |
      build-${{ runner.os }}-${{ hashFiles('**/pnpm-lock.yaml') }}-
      build-${{ runner.os }}-
```

## Dependency Management Best Practices

### Update Strategy

1. **Security Updates**: Apply immediately via Dependabot
2. **Patch Updates**: Review and merge weekly
3. **Minor Updates**: Review and merge monthly
4. **Major Updates**: Plan and test thoroughly, schedule carefully

### Version Pinning Policy

- **Direct Dependencies**: Use caret ranges (^) for flexibility
- **Security-Critical**: Pin exact versions
- **Type Definitions**: Use latest compatible versions
- **Tools**: Pin exact versions for reproducibility

### Review Process

1. **Automated PRs**: Dependabot creates update PRs
2. **Review**: Team reviews for breaking changes
3. **Test**: CI runs full test suite
4. **Merge**: Approved updates merged promptly
5. **Monitor**: Watch for issues post-merge

## Modernization Roadmap

### Phase 1: Immediate (Current Release)

- [x] Audit dependencies and document status
- [x] Configure Dependabot for automated updates
- [ ] Fix known issue: Add ESLint config to compliance
- [ ] Fix known issue: Regenerate lockfile for apps/edge
- [ ] Document deprecated dependencies

### Phase 2: Short-term (Next 1-2 Months)

- [ ] Upgrade TypeScript 5.4.5 → 5.9.3 incrementally
- [ ] Update ESLint 8.x → 9.x (with migration guide)
- [ ] Remove or update @types/pino
- [ ] Audit and remove unused dependencies per workspace
- [ ] Implement build caching in CI

### Phase 3: Medium-term (Next 3-6 Months)

- [ ] Evaluate Zod 4.x migration (post-launch)
- [ ] Replace deprecated workbox dependencies
- [ ] Update docx or find alternative
- [ ] Consolidate OpenTelemetry versions
- [ ] Optimize build performance (parallel, incremental)

### Phase 4: Long-term (6+ Months)

- [ ] Regular dependency audits (quarterly)
- [ ] Stay current with LTS versions
- [ ] Evaluate new tools and libraries
- [ ] Continuous optimization

## Action Items Summary

### Immediate
- [ ] Add ESLint config to packages/compliance
- [ ] Review and fix apps/edge lockfile sync
- [ ] Document deprecated packages in package.json comments
- [ ] Run depcheck on all workspaces

### Short-term
- [ ] Create issue to track TypeScript 5.9 upgrade
- [ ] Create issue to track ESLint 9 migration
- [ ] Plan Zod 4.x migration (post-launch)
- [ ] Implement build caching in CI workflows

### Ongoing
- [ ] Monitor Dependabot PRs weekly
- [ ] Review security updates immediately
- [ ] Update this document quarterly
- [ ] Track upstream fixes for known issues

## Resources

- [PNPM Documentation](https://pnpm.io/)
- [Dependabot Configuration](https://docs.github.com/en/code-security/dependabot)
- [TypeScript Release Notes](https://devblogs.microsoft.com/typescript/)
- [ESLint Migration Guide](https://eslint.org/docs/latest/use/migrate-to-9.0.0)
- [npm-check-updates](https://www.npmjs.com/package/npm-check-updates)
- [depcheck](https://www.npmjs.com/package/depcheck)

## Maintenance

This document should be updated:
- After each dependency audit
- When upgrading major dependencies
- Quarterly as part of tech debt review
- After resolving known issues

**Document Owner**: Platform Squad  
**Review Cadence**: Quarterly or after major updates  
**Last Reviewed**: 2025-10-29  
**Next Review**: 2026-01-29
