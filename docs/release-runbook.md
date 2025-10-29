# Release Runbook

**Project**: Avocat-AI Francophone Monorepo  
**Last Updated**: 2025-10-29  
**Version**: 1.0  
**Owner**: Platform Squad + Ops Team

---

## Overview

This runbook describes the end-to-end release process for the Avocat-AI platform, including build, test, staging deployment, production deployment, smoke testing, rollback procedures, and on-call handoff.

---

## Release Workflow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Development │────▶│   Staging    │────▶│  Production  │────▶│  Monitor &   │
│   & Testing  │     │  Validation  │     │  Deployment  │     │   Support    │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
       │                     │                     │                     │
       ├─ Build              ├─ Smoke Tests        ├─ Blue-Green (TBD)  ├─ Health Checks
       ├─ Lint               ├─ Integration Tests  ├─ Feature Flags     ├─ Error Tracking
       ├─ Unit Tests         ├─ Migration Test     ├─ Canary (TBD)      ├─ On-Call Handoff
       ├─ E2E Tests          └─ Load Test          └─ Smoke Tests       └─ Incident Response
       └─ Security Scans
```

---

## Phase 1: Pre-Release (Development)

### 1.1 Code Changes & PR

**Owner**: Developer  
**Duration**: Variable

**Steps**:

1. Create feature branch from `main`:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/your-feature-name
   ```

2. Make changes and commit using Conventional Commits:
   ```bash
   git commit -m "feat(api): add circuit breaker for OpenAI calls"
   ```

3. Run pre-commit checks locally:
   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   ALLOW_SUPABASE_MIGRATIONS=1 pnpm check:migrations
   pnpm check:binaries
   ```

4. Push branch and open PR:
   ```bash
   git push origin feature/your-feature-name
   ```

5. Complete PR template checklist:
   - [ ] All tests passing
   - [ ] Migrations applied (if applicable)
   - [ ] Documentation updated
   - [ ] CODEOWNERS notified
   - [ ] Staging smoke tests linked

### 1.2 CI/CD Validation

**Owner**: GitHub Actions  
**Duration**: 10-15 minutes

**Automated Checks**:

- ✅ Install dependencies (`pnpm install --frozen-lockfile`)
- ✅ Typecheck all workspaces (`pnpm typecheck`)
- ✅ Lint all workspaces (`pnpm lint`)
- ✅ Run unit tests (`pnpm test`)
- ✅ Build all workspaces (`pnpm build`)
- ✅ Check migrations (`ALLOW_SUPABASE_MIGRATIONS=1 pnpm check:migrations`)
- ✅ Binary asset check (`pnpm check:binaries`)
- ✅ CodeQL analysis (JavaScript/TypeScript)
- ✅ Dependabot security check
- ✅ Secret scanning
- ✅ Container scanning (Trivy)
- ✅ SBOM generation

**Success Criteria**: All CI checks green ✅

### 1.3 Code Review

**Owner**: CODEOWNERS (Platform/Frontend/Ops Squad)  
**Duration**: 1-3 business days

**Review Checklist**:

- [ ] Code follows project conventions
- [ ] Security considerations addressed
- [ ] Performance impact assessed
- [ ] Breaking changes documented
- [ ] Tests adequate for changes
- [ ] Documentation updated
- [ ] Migration rollback strategy clear (if applicable)

**Approval**: Minimum 1 approving review from CODEOWNERS

### 1.4 Merge to Main

**Owner**: Developer (after approval)  
**Duration**: Immediate

**Steps**:

1. Ensure CI is green on latest commit
2. Merge PR using "Squash and merge" or "Rebase and merge"
3. Delete feature branch
4. Monitor main branch CI for regressions

---

## Phase 2: Staging Deployment

### 2.1 Pre-Staging Checks

**Owner**: Ops Team  
**Duration**: 5-10 minutes

**Pre-flight Validation**:

```bash
# 1. Verify environment secrets
pnpm env:validate

# 2. Run deployment preflight script
node scripts/deployment-preflight.mjs

# 3. Check staging database connectivity
SUPABASE_DB_URL=$SUPABASE_STAGING_DB_URL pnpm ops:check --org <staging-org>
```

**Success Criteria**: All preflight checks pass

### 2.2 Database Migrations (Staging)

**Owner**: Ops Team  
**Duration**: 1-5 minutes (depends on migration complexity)

**Steps**:

```bash
# 1. Backup staging database (Supabase auto-backup + manual snapshot)
# Via Supabase dashboard: Settings → Database → Create snapshot

# 2. Apply migrations to staging
SUPABASE_DB_URL=$SUPABASE_STAGING_DB_URL pnpm db:migrate

# 3. Verify migration success
SUPABASE_DB_URL=$SUPABASE_STAGING_DB_URL pnpm ops:check --org <staging-org>

# 4. Run RLS smoke tests
SUPABASE_DB_URL=$SUPABASE_STAGING_DB_URL pnpm ops:rls-smoke
```

**Rollback Plan**: If migration fails, restore from snapshot

**Success Criteria**: Migrations applied without errors; RLS policies functional

### 2.3 Application Deployment (Staging)

**Owner**: Platform Squad  
**Duration**: 5-10 minutes

**For Vercel Deployments (PWA/Web)**:

```bash
# 1. Trigger Vercel preview build (automatic on PR merge to 'work')
# Or manual:
vercel deploy --prebuilt --env staging

# 2. Verify deployment URL
# Vercel provides preview URL automatically
```

**For Docker Deployments (API)**:

```bash
# 1. Build container image
docker build -t avocat-ai-api:staging -f apps/api/Dockerfile .

# 2. Tag for staging registry
docker tag avocat-ai-api:staging registry.example.com/avocat-ai-api:staging

# 3. Push to registry
docker push registry.example.com/avocat-ai-api:staging

# 4. Update staging environment
kubectl set image deployment/api api=registry.example.com/avocat-ai-api:staging --namespace=staging
# Or via deployment pipeline tool
```

**Success Criteria**: Deployment completes without errors

### 2.4 Staging Smoke Tests

**Owner**: QA/Developer  
**Duration**: 10-20 minutes

**Automated Smoke Tests**:

```bash
# Run staging smoke test suite
STAGING_SMOKE_BASE_URL=https://staging.example.com pnpm test:staging-smoke
```

**Manual Verification Checklist**:

- [ ] Health check responds: `curl https://staging-api.example.com/healthz`
- [ ] Admin panel loads (if `FEAT_ADMIN_PANEL=1`)
- [ ] Agent run executes successfully (test question)
- [ ] HITL escalation triggers correctly
- [ ] Document ingestion works (test manifest)
- [ ] Metrics endpoint returns data: `/metrics/governance?orgId=<test-org>`
- [ ] Audit events logged for sensitive actions
- [ ] Rate limiting enforced (test with burst requests)
- [ ] Authentication and authorization work (various roles)

**Critical User Paths** (E2E Tests):

1. **Agent Run**: Submit question → Retrieve authorities → Generate IRAC → Display with citations
2. **HITL Review**: Escalation → Notification → Review → Approval → Audit log
3. **Document Ingestion**: Upload manifest → Crawl → Summarize → Embed → Search
4. **Admin Operations**: Login → View dashboard → Trigger evaluation → Review results

**Success Criteria**: All automated tests pass; manual checks green; no critical errors in logs

### 2.5 Staging Validation Period

**Owner**: Product/QA Team  
**Duration**: 24-48 hours (for major releases)

**Activities**:

- Internal testing by team members
- Evaluation runs with test cases
- Red team testing (if security changes)
- Performance monitoring
- Log review for errors/warnings

**Success Criteria**: No critical issues; performance acceptable; logs clean

---

## Phase 3: Production Deployment

### 3.1 Go/No-Go Decision

**Owner**: Release Manager + Platform Lead  
**Duration**: 30 minutes

**Decision Criteria**:

- [ ] All staging tests passed
- [ ] No critical bugs open
- [ ] Performance acceptable in staging
- [ ] Rollback plan documented
- [ ] On-call engineer available
- [ ] Maintenance window communicated (if needed)
- [ ] Database migration tested in staging
- [ ] Feature flags configured appropriately

**Decision**: GO / NO-GO  
**Documented In**: Release ticket or Slack thread

### 3.2 Pre-Production Checklist

**Owner**: Ops Team  
**Duration**: 10 minutes

```bash
# 1. Verify production secrets
APP_ENV=production pnpm env:validate

# 2. Run production preflight
APP_ENV=production node scripts/deployment-preflight.mjs

# 3. Verify production database access
pnpm ops:check --org <prod-org>

# 4. Verify Go/No-Go evidence
pnpm ops:go-no-go --org <prod-org> --release <tag> --require-go

# 5. Alert on-call engineer
# Post in #on-call channel: "Production deployment starting for <release-tag>"
```

**Success Criteria**: All checks pass; on-call notified

### 3.3 Database Migrations (Production)

**Owner**: Ops Team + DBA  
**Duration**: 5-30 minutes (depends on data volume)

**Steps**:

```bash
# 1. Create production database snapshot
# Via Supabase dashboard: Settings → Database → Create snapshot
# Name: "pre-migration-<timestamp>"

# 2. Announce migration (if downtime expected)
# Post in #status: "Database migration in progress. Brief downtime expected."

# 3. Apply migrations
SUPABASE_DB_URL=$SUPABASE_PRODUCTION_DB_URL pnpm db:migrate

# 4. Verify migration success
SUPABASE_DB_URL=$SUPABASE_PRODUCTION_DB_URL pnpm ops:check --org <prod-org>

# 5. Run RLS smoke tests
SUPABASE_DB_URL=$SUPABASE_PRODUCTION_DB_URL pnpm ops:rls-smoke

# 6. Verify data integrity (if applicable)
# Run custom validation queries for critical tables
```

**Rollback Plan**:

1. If migration fails immediately: Restore from snapshot
2. If migration succeeds but application fails: See Application Rollback

**Success Criteria**: Migrations applied; no data corruption; RLS policies functional

### 3.4 Application Deployment (Production)

**Owner**: Platform Squad  
**Duration**: 5-15 minutes

**For Vercel Deployments (PWA/Web)**:

```bash
# Option 1: Promote staging build
vercel promote <deployment-url> --prod

# Option 2: Deploy to production
vercel deploy --prod

# Verify deployment
curl -I https://app.example.com
```

**For Docker Deployments (API)**:

```bash
# 1. Build and tag production image
docker build -t avocat-ai-api:v1.2.3 -f apps/api/Dockerfile .
docker tag avocat-ai-api:v1.2.3 registry.example.com/avocat-ai-api:v1.2.3
docker tag avocat-ai-api:v1.2.3 registry.example.com/avocat-ai-api:latest

# 2. Push to production registry
docker push registry.example.com/avocat-ai-api:v1.2.3
docker push registry.example.com/avocat-ai-api:latest

# 3. Deploy with zero-downtime strategy
# Blue-Green (TBD):
kubectl apply -f k8s/blue-green-deployment.yaml

# Or Rolling Update:
kubectl set image deployment/api api=registry.example.com/avocat-ai-api:v1.2.3 --namespace=production
kubectl rollout status deployment/api --namespace=production

# 4. Verify pods are healthy
kubectl get pods -n production
```

**Feature Flag Strategy**:

```bash
# Enable new features gradually
# Example: Enable new feature for 10% of users
FEAT_NEW_FEATURE_ROLLOUT_PERCENTAGE=10
```

**Success Criteria**: Deployment completes; health checks pass; no errors in logs

### 3.5 Production Smoke Tests

**Owner**: On-Call Engineer + Release Manager  
**Duration**: 15-30 minutes

**Automated Checks**:

```bash
# 1. Health check
curl https://api.example.com/healthz

# 2. Foundation check
pnpm ops:check --org <prod-org>

# 3. Phase progression check
pnpm ops:phase --org <prod-org>

# 4. Sample evaluation (with production API key)
pnpm ops:evaluate --org <prod-org> --user <service-user> --limit 5 --dry-run

# 5. Metrics check
curl https://api.example.com/metrics/governance?orgId=<prod-org>
```

**Manual Verification** (same as staging but production URLs):

- [ ] API health check responds
- [ ] Web console loads
- [ ] PWA loads
- [ ] Agent run executes (test question with prod data)
- [ ] HITL flow works
- [ ] Document search returns results
- [ ] Metrics display in admin panel
- [ ] Audit events logged
- [ ] No errors in centralized logging (Sentry/Datadog)

**Performance Baseline Check**:

- [ ] API latency P95 < 2000ms
- [ ] Error rate < 0.5%
- [ ] Database connection pool healthy
- [ ] Redis cache hit rate > 80%

**Success Criteria**: All checks pass; performance within SLO; no critical errors

### 3.6 Post-Deployment Monitoring

**Owner**: On-Call Engineer  
**Duration**: 2-4 hours (active monitoring)

**Monitoring Checklist** (first 30 minutes):

- [ ] Error rate dashboard (Sentry/Datadog)
- [ ] API latency metrics (P50, P95, P99)
- [ ] Database query performance
- [ ] Redis/cache health
- [ ] OpenAI API call success rate
- [ ] HITL queue depth
- [ ] Ingestion pipeline health
- [ ] User-reported issues (support channels)

**Alerting Thresholds** (should be pre-configured):

- Error rate > 1% → Page on-call
- API latency P95 > 3000ms → Warning alert
- Database connections > 80% → Warning alert
- HITL queue depth > 100 → Warning alert
- OpenAI API errors > 5% → Warning alert

**Success Criteria**: Metrics stable; no unexpected errors; user reports normal

---

## Phase 4: Rollback Procedures

### 4.1 Rollback Decision Criteria

**When to Rollback**:

- Critical bug affecting core functionality
- Data corruption detected
- Security vulnerability introduced
- Performance degradation > 50%
- Error rate > 5%
- Database migration causing issues
- User-facing outage

**Decision Maker**: On-Call Engineer + Platform Lead

### 4.2 Application Rollback

**Owner**: On-Call Engineer  
**Duration**: 5-10 minutes

**For Vercel Deployments**:

```bash
# 1. Identify previous deployment
vercel ls

# 2. Promote previous deployment to production
vercel promote <previous-deployment-url> --prod

# 3. Verify rollback
curl -I https://app.example.com
```

**For Docker/Kubernetes Deployments**:

```bash
# Option 1: Rollback using kubectl
kubectl rollout undo deployment/api --namespace=production

# Option 2: Explicitly set previous version
kubectl set image deployment/api api=registry.example.com/avocat-ai-api:v1.2.2 --namespace=production

# 3. Verify rollback
kubectl rollout status deployment/api --namespace=production
kubectl get pods -n production
```

**Success Criteria**: Previous version deployed; health checks pass; errors resolved

### 4.3 Database Migration Rollback

**Owner**: Ops Team + DBA  
**Duration**: 10-30 minutes (depends on data volume)

**Strategy 1: Revert Migration** (if migration includes DOWN script):

```bash
# Run rollback migration
SUPABASE_DB_URL=$SUPABASE_PRODUCTION_DB_URL pnpm db:rollback

# Verify rollback success
pnpm ops:check --org <prod-org>
```

**Strategy 2: Restore from Snapshot** (if no DOWN script or complex migration):

```bash
# 1. Via Supabase dashboard:
#    Settings → Database → Restore from snapshot
#    Select: "pre-migration-<timestamp>"

# 2. Wait for restoration (5-20 minutes depending on size)

# 3. Verify restoration
pnpm ops:check --org <prod-org>

# 4. Re-run pre-migration tests
SUPABASE_DB_URL=$SUPABASE_PRODUCTION_DB_URL pnpm ops:rls-smoke
```

**Data Loss Consideration**: Understand RPO (Recovery Point Objective)  
- Snapshot restoration loses data since snapshot was taken
- Typically acceptable for emergency rollback
- Consider manual data export before rollback if critical

**Success Criteria**: Database restored to stable state; application functions correctly

### 4.4 Post-Rollback Actions

**Owner**: Platform Squad + Ops Team  
**Duration**: 1-4 hours

**Immediate Actions**:

1. **Communicate rollback**:
   - Post in #status channel
   - Update status page
   - Notify affected users (if applicable)

2. **Root cause analysis**:
   - Review logs and metrics
   - Identify failure point
   - Document findings in incident report

3. **Fix and re-test**:
   - Create hotfix branch if urgent
   - Or fix in next release
   - Test thoroughly in staging

4. **Post-mortem**:
   - Schedule post-mortem meeting (within 48 hours)
   - Document lessons learned
   - Update runbook with improvements

**Success Criteria**: Service restored; root cause identified; prevention plan in place

---

## Phase 5: On-Call Handoff

### 5.1 Handoff Timing

**When**: After production deployment and 2-4 hours of monitoring

**Duration**: 15-30 minutes

### 5.2 Handoff Checklist

**Deployer → On-Call Engineer**:

- [ ] **Release summary**:
  - Release version/tag
  - Key features/changes
  - Known issues or warnings
  - Monitoring dashboards to watch

- [ ] **Deployment status**:
  - Deployment timestamp
  - Smoke test results
  - Current error rate
  - Performance metrics (P95 latency)

- [ ] **Configuration changes**:
  - Environment variables modified
  - Feature flags enabled/disabled
  - Migration summary (if applicable)

- [ ] **Rollback plan**:
  - Previous stable version
  - Rollback steps documented
  - Database snapshot name

- [ ] **Monitoring**:
  - Key metrics to watch
  - Alert thresholds
  - Dashboard links
  - Log aggregation links

- [ ] **Support information**:
  - Known issues (and workarounds)
  - Escalation contacts
  - Documentation links

### 5.3 Handoff Documentation

**Template** (post in #on-call channel):

```
🚀 Production Deployment Handoff

**Release**: v1.2.3
**Deployed**: 2025-10-29 15:30 UTC
**Deployed by**: @engineer

**Summary**:
- Added circuit breaker for OpenAI calls
- Fixed HITL queue performance issue
- Updated CORS configuration

**Status**: ✅ Stable
- Error rate: 0.2%
- API latency P95: 1200ms
- All smoke tests passed

**Known Issues**:
- None currently

**Monitoring**:
- Dashboard: https://grafana.example.com/d/production
- Logs: https://app.datadoghq.com/logs
- Errors: https://sentry.io/avocat-ai

**Rollback Plan**:
- Previous version: v1.2.2
- DB snapshot: pre-migration-20251029-1500
- Rollback steps: See release runbook

**On-Call Contact**: @on-call-engineer
```

---

## Appendices

### A. Environment-Specific Configurations

| Environment | API URL | Database | Vercel Project | Feature Flags |
|-------------|---------|----------|----------------|---------------|
| Development | http://localhost:3333 | Local Supabase | N/A | All enabled |
| Staging | https://staging-api.example.com | Staging Supabase | staging-project | All enabled |
| Production | https://api.example.com | Production Supabase | production-project | Selective |

### B. Critical Service Dependencies

| Service | Status Page | Escalation |
|---------|-------------|------------|
| Supabase | https://status.supabase.com | Support ticket |
| OpenAI | https://status.openai.com | Priority support |
| Vercel | https://vercel.com/status | Support ticket |
| Redis | Internal monitoring | Ops team |

### C. Emergency Contacts

| Role | Primary | Backup |
|------|---------|--------|
| Platform Lead | @platform-lead | @platform-backup |
| Ops Lead | @ops-lead | @ops-backup |
| Security Lead | @security-lead | @security-backup |
| On-Call Engineer | PagerDuty rotation | #on-call channel |

### D. Useful Commands Reference

```bash
# Health checks
curl https://api.example.com/healthz
pnpm ops:check --org <org-id>

# Metrics
curl https://api.example.com/metrics/governance?orgId=<org-id>
pnpm ops:slo --org <org-id> --user <user-id> --list

# Evaluations
pnpm ops:evaluate --org <org-id> --user <user-id> --limit 10

# Red team testing
pnpm ops:red-team --org <org-id> --user <user-id>

# Secret rotation (emergency)
pnpm ops:rotate-secrets

# Database operations
pnpm db:migrate
pnpm ops:foundation
pnpm ops:provision

# Logs (assuming kubectl)
kubectl logs -f deployment/api --namespace=production --tail=100
```

### E. Post-Mortem Template

**Incident**: [Brief description]  
**Date**: YYYY-MM-DD  
**Severity**: Critical / High / Medium / Low  
**Duration**: [Start time] to [End time]  
**Impact**: [Users affected, services impacted]

**Timeline**:
- HH:MM - Event occurred
- HH:MM - Detection
- HH:MM - Escalation
- HH:MM - Mitigation started
- HH:MM - Resolution

**Root Cause**: [Technical explanation]

**Action Items**:
1. [Preventive measure 1] - Owner: [Team/Person] - Due: [Date]
2. [Preventive measure 2] - Owner: [Team/Person] - Due: [Date]

**Lessons Learned**: [Key takeaways]

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-10-29 | GitHub Copilot | Initial release runbook |

---

**Questions or Feedback**: Contact Platform Squad via `.github/CODEOWNERS`
