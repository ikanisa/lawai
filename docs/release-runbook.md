# Release Runbook

_Last updated: 2025-10-29_

This runbook provides step-by-step procedures for building, testing, deploying, and rolling back releases of the Avocat-AI system. It covers all applications in the monorepo and includes smoke tests, rollback procedures, and on-call handoff.

## Table of Contents

1. [Pre-Release Checklist](#pre-release-checklist)
2. [Build Procedures](#build-procedures)
3. [Testing & Validation](#testing--validation)
4. [Deployment Procedures](#deployment-procedures)
5. [Smoke Tests](#smoke-tests)
6. [Rollback Procedures](#rollback-procedures)
7. [Post-Deployment](#post-deployment)
8. [Monitoring & Alerts](#monitoring--alerts)
9. [On-Call Handoff](#on-call-handoff)
10. [Incident Response](#incident-response)

---

## Pre-Release Checklist

### Code Freeze & Preparation

- [ ] **Code freeze announced** (24h before release)
- [ ] **Release branch created** from `main`/`master`
- [ ] **Changelog updated** with user-facing changes
- [ ] **Version numbers bumped** (follow semantic versioning)
- [ ] **Migration scripts reviewed** (if applicable)
- [ ] **Feature flags configured** for gradual rollout
- [ ] **Secrets rotated** if required (use `pnpm ops:rotate-secrets`)

### Quality Gates

- [ ] **All CI checks passing** on release branch
  - [ ] Typecheck: `pnpm typecheck` (workspace-specific for known issues)
  - [ ] Lint: `pnpm lint` (workspace-specific for known issues)
  - [ ] Tests: `pnpm test` (all tests passing)
  - [ ] Build: `pnpm build` (all apps build successfully)
- [ ] **Migration checks passing**: `ALLOW_SUPABASE_MIGRATIONS=1 pnpm check:migrations`
- [ ] **Binary assets check passing**: `pnpm check:binaries`
- [ ] **SQL linting passing**: `pnpm lint:sql`
- [ ] **Environment validation passing**: `pnpm env:validate`
- [ ] **Security scans completed** (CodeQL, dependency audit)
- [ ] **Test coverage meets threshold** (≥80% or baseline +10%)

### Documentation

- [ ] **Architecture docs updated** if architecture changed
- [ ] **API documentation updated** if endpoints changed
- [ ] **Environment variables documented** in `.env.example`
- [ ] **Breaking changes documented** with migration guide
- [ ] **Runbook updated** if deployment procedures changed

### Stakeholder Approval

- [ ] **Product Owner sign-off** for feature changes
- [ ] **Security team review** for security-related changes
- [ ] **Ops team notified** of deployment window
- [ ] **Go/No-Go meeting completed**: `pnpm ops:go-no-go --release <tag>`

---

## Build Procedures

### Local Build Verification

Before deploying, verify builds locally with production configuration:

```bash
# 1. Ensure environment is clean
git status
git checkout <release-branch>
git pull origin <release-branch>

# 2. Clean install dependencies
rm -rf node_modules
pnpm install --frozen-lockfile

# 3. Build all workspaces
pnpm build

# 4. Verify specific app builds
pnpm --filter @apps/api build
pnpm --filter @avocat-ai/web build
pnpm --filter @apps/pwa build

# 5. Check bundle sizes (PWA)
pnpm --filter @apps/pwa bundle:check
```

### CI Build

All builds must pass in CI before deployment:

```bash
# Monitor CI status
gh run list --branch <release-branch>
gh run view <run-id>
```

### Artifact Generation

For each release, generate and archive:

1. **Build artifacts**: `.next/` directories, compiled bundles
2. **SBOM (Software Bill of Materials)**: Dependency manifest
3. **Source maps**: For error tracking (store securely)
4. **Database migration checksums**: For verification

```bash
# Generate SBOM (to be implemented)
# pnpm generate:sbom > release-artifacts/sbom-<version>.json

# Archive build artifacts
tar -czf release-artifacts/web-<version>.tar.gz -C apps/web/.next .
tar -czf release-artifacts/pwa-<version>.tar.gz -C apps/pwa/.next .
```

---

## Testing & Validation

### Staging Environment Tests

Deploy to staging first and run comprehensive tests:

```bash
# 1. Deploy to staging (see Deployment Procedures)

# 2. Run ops checks
pnpm ops:check

# 3. Run RLS smoke tests
pnpm ops:rls-smoke

# 4. Run evaluation harness
pnpm ops:evaluate --org <staging-org-uuid> --user <staging-user-uuid>

# 5. Run red team tests
pnpm ops:red-team
```

### Manual Testing Checklist

- [ ] **Authentication flow** (login, logout, session management)
- [ ] **Core user journeys**:
  - [ ] Submit research question
  - [ ] View IRAC results
  - [ ] Review HITL queue (operators)
  - [ ] Approve/reject HITL items
  - [ ] Upload documents
  - [ ] Search corpus
- [ ] **Edge cases**:
  - [ ] Offline behavior (PWA)
  - [ ] Slow network simulation
  - [ ] High load (multiple concurrent requests)
  - [ ] Error handling (invalid inputs)
- [ ] **Security guardrails**:
  - [ ] France judge analytics ban
  - [ ] Confidential mode restrictions
  - [ ] HITL escalation triggers
  - [ ] Audit trail logging
- [ ] **Accessibility**:
  - [ ] Screen reader compatibility
  - [ ] Keyboard navigation
  - [ ] WCAG 2.1 AA compliance
- [ ] **Browser compatibility**:
  - [ ] Chrome (latest)
  - [ ] Firefox (latest)
  - [ ] Safari (latest)
  - [ ] Edge (latest)
  - [ ] Mobile browsers (iOS Safari, Chrome Mobile)

### Performance Testing

```bash
# Run performance snapshot
pnpm ops:perf-snapshot

# Verify Web Vitals (target thresholds)
# - LCP (Largest Contentful Paint): ≤ 2.5s
# - INP (Interaction to Next Paint): ≤ 200ms
# - CLS (Cumulative Layout Shift): ≤ 0.1
```

### Load Testing

Run load tests against staging:

```bash
# Use k6 or similar tool (to be implemented)
# k6 run load-tests/research-flow.js
```

---

## Deployment Procedures

### Environment Variables

Ensure all required environment variables are set in target environment:

**API (`apps/api`)**:
- `OPENAI_API_KEY` (no placeholders like `sk-test-`)
- `SUPABASE_URL` (no `localhost` or `example.supabase.co`)
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL` (for migrations)
- `PORT` (default 3333)
- `NODE_ENV=production`

**Web Console (`apps/web`)**:
- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side)
- `NODE_ENV=production`

**PWA (`apps/pwa`)**:
- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NODE_ENV=production`

### Database Migrations

**CRITICAL**: Always run migrations before deploying new code.

```bash
# 1. Backup database
# (Use Supabase dashboard or pg_dump)

# 2. Review pending migrations
ls -la db/migrations/

# 3. Dry run (if supported)
# pnpm db:migrate --dry-run

# 4. Apply migrations
pnpm db:migrate

# 5. Verify migration success
pnpm ops:check
```

### Deployment Steps by Application

#### API Deployment (Container/VM)

```bash
# 1. Build Docker image (if containerized)
docker build -t avocat-ai-api:$VERSION -f apps/api/Dockerfile .

# 2. Run security scan
# docker scan avocat-ai-api:$VERSION

# 3. Push to registry
# docker push registry/avocat-ai-api:$VERSION

# 4. Deploy to environment
# kubectl apply -f k8s/api-deployment.yaml
# OR
# Deploy via hosting platform

# 5. Verify health
curl https://api.domain/healthz
curl https://api.domain/ready
```

#### Web Console Deployment (Vercel)

```bash
# 1. Ensure Vercel project configured
vercel link

# 2. Set environment variables (one-time)
vercel env pull .env.production

# 3. Build preview
vercel build --prod

# 4. Deploy
vercel deploy --prebuilt --prod

# 5. Verify deployment
curl https://web.domain/healthz
```

#### PWA Deployment (Vercel)

```bash
# 1. Build PWA
cd apps/pwa
pnpm build

# 2. Verify bundle size
pnpm bundle:check

# 3. Deploy via Vercel
vercel deploy --prod

# 4. Verify PWA manifest
curl https://domain/manifest.json

# 5. Test offline functionality
# (Use browser DevTools > Network > Offline)
```

#### Edge Functions Deployment (Supabase)

```bash
# 1. Deploy all edge functions
supabase functions deploy

# Or deploy specific function
# supabase functions deploy <function-name>

# 2. Verify function logs
supabase functions logs <function-name>

# 3. Test function invocation
curl -X POST https://<project>.supabase.co/functions/v1/<function-name> \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

### Gradual Rollout

Use feature flags or traffic splitting for gradual rollout:

1. **10% traffic** - Monitor for 1 hour
2. **25% traffic** - Monitor for 2 hours
3. **50% traffic** - Monitor for 4 hours
4. **100% traffic** - Full deployment

```bash
# Configure traffic split (implementation varies by platform)
# Example for Vercel:
# vercel alias <deployment-url> production --traffic 10
```

---

## Smoke Tests

Run smoke tests immediately after deployment:

### API Smoke Tests

```bash
# Health checks
curl https://api.domain/healthz
# Expected: {"status": "ok"}

curl https://api.domain/ready
# Expected: {"status": "ready", "database": "connected"}

# Authenticated endpoint test
curl -X POST https://api.domain/runs \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Test question",
    "orgId": "'$TEST_ORG_ID'",
    "userId": "'$TEST_USER_ID'"
  }'
# Expected: Run created successfully
```

### Web Console Smoke Tests

```bash
# 1. Open browser to https://web.domain
# 2. Verify login page loads
# 3. Login with test credentials
# 4. Navigate to /hitl
# 5. Verify HITL queue loads
# 6. Navigate to /admin (if admin)
# 7. Logout
```

### PWA Smoke Tests

```bash
# 1. Open browser to https://domain
# 2. Verify PWA loads
# 3. Check manifest: https://domain/manifest.json
# 4. Test research flow (submit question)
# 5. Test offline mode (enable offline, reload)
# 6. Verify service worker registered (DevTools > Application)
# 7. Test install prompt (if not previously installed)
```

### Edge Function Smoke Tests

```bash
# Test critical edge functions
supabase functions invoke eval-nightly --body '{"test": true}'
supabase functions invoke crawl-authorities --body '{"source": "scc", "test": true}'
```

---

## Rollback Procedures

### When to Rollback

Rollback immediately if:

- **Critical bugs** discovered in production
- **Data corruption** or loss detected
- **Performance degradation** beyond acceptable thresholds
- **Security vulnerability** exposed
- **High error rates** (>5% of requests failing)
- **Unable to complete smoke tests** successfully

### Rollback Steps

#### API Rollback

```bash
# 1. Identify previous stable version
docker images | grep avocat-ai-api

# 2. Deploy previous version
# kubectl rollout undo deployment/api
# OR
# docker tag avocat-ai-api:$PREVIOUS_VERSION avocat-ai-api:latest
# Deploy via hosting platform

# 3. Verify rollback
curl https://api.domain/healthz
```

#### Web/PWA Rollback (Vercel)

```bash
# 1. List recent deployments
vercel ls

# 2. Promote previous deployment
vercel alias <previous-deployment-url> production

# 3. Verify rollback
curl https://domain
```

#### Database Migration Rollback

**WARNING**: Database rollbacks are risky and may cause data loss.

```bash
# 1. Stop all services accessing the database

# 2. Restore from backup
# (Use Supabase dashboard or pg_restore)

# 3. Verify data integrity
pnpm ops:check

# 4. Restart services

# Alternative: Reapply migration
# See migration rollback strategy in migration file comments
```

#### Edge Function Rollback

```bash
# 1. Redeploy previous version
git checkout <previous-tag>
supabase functions deploy <function-name>

# 2. Verify function
supabase functions logs <function-name>
```

### Post-Rollback

- [ ] **Notify stakeholders** of rollback
- [ ] **Update status page** (if applicable)
- [ ] **Create incident report** with root cause
- [ ] **Schedule post-mortem** meeting
- [ ] **Fix issues** before re-attempting deployment

---

## Post-Deployment

### Immediate Post-Deployment (0-1 hour)

- [ ] **Monitor error rates** in logs and dashboards
- [ ] **Monitor response times** (API latency, page load times)
- [ ] **Check health endpoints** every 5 minutes
- [ ] **Review user reports** (support channels, feedback)
- [ ] **Monitor resource usage** (CPU, memory, database connections)

### Short-term Monitoring (1-24 hours)

- [ ] **Review telemetry dashboards** (Web Vitals, accuracy metrics)
- [ ] **Check HITL queue depth** (should not grow abnormally)
- [ ] **Monitor OpenAI usage** (token consumption, costs)
- [ ] **Review audit logs** for anomalies
- [ ] **Check database performance** (slow queries, connection pool)

### Long-term Monitoring (24+ hours)

- [ ] **Analyze user feedback** (NPS, satisfaction scores)
- [ ] **Review business metrics** (conversion rates, engagement)
- [ ] **Check for technical debt** introduced
- [ ] **Update capacity planning** if usage patterns changed

### Documentation Updates

- [ ] **Update CHANGELOG** with actual deployment date
- [ ] **Archive release artifacts** (builds, SBOMs, configs)
- [ ] **Document any manual interventions** performed
- [ ] **Update known issues** list if new issues found
- [ ] **Create follow-up tickets** for technical debt

---

## Monitoring & Alerts

### Critical Alerts (Page immediately)

- **API down** (health check failing)
- **Database connection lost**
- **Error rate >5%** (5-minute window)
- **Response time >5s** (p95, 5-minute window)
- **Security incident** (unauthorized access attempts)
- **Data breach detected**

### Warning Alerts (Notify on-call)

- **Error rate >2%** (15-minute window)
- **Response time >2s** (p95, 15-minute window)
- **HITL queue depth >50** items
- **Disk usage >80%**
- **Memory usage >85%**
- **OpenAI rate limit approaching**

### Info Alerts (Log only)

- **Deployment completed**
- **Migration applied**
- **Scheduled task completed**
- **Backup completed**

### Monitoring Dashboards

1. **System Health**: https://monitoring.domain/system (API status, DB status, uptime)
2. **Application Metrics**: https://monitoring.domain/app (request rates, latencies, errors)
3. **Business Metrics**: https://monitoring.domain/business (IRAC generations, HITL reviews)
4. **Security**: https://monitoring.domain/security (auth attempts, rate limits, suspicious activity)

### Key Metrics to Watch

| Metric | Target | Alert Threshold | Dashboard |
|--------|--------|-----------------|-----------|
| API Uptime | 99.9% | <99.5% | System Health |
| API Response Time (p95) | <500ms | >2s | Application |
| Error Rate | <0.5% | >2% | Application |
| HITL Queue Depth | <10 | >50 | Business |
| Database CPU | <50% | >80% | System Health |
| OpenAI Token Usage | Budget-dependent | 90% of quota | Application |
| LCP (PWA) | <2.5s | >3s | Application |
| INP (PWA) | <200ms | >300ms | Application |

---

## On-Call Handoff

### Handoff Checklist

When rotating on-call:

- [ ] **Review recent deployments** and changes
- [ ] **Check current system status** (all green?)
- [ ] **Review open incidents** and ongoing investigations
- [ ] **Note any scheduled maintenance** or deploys
- [ ] **Verify access** to all systems (dashboards, logs, alerts)
- [ ] **Review escalation procedures** and contacts
- [ ] **Check runbook updates** since last rotation

### On-Call Responsibilities

1. **Respond to alerts** within SLA (critical: 15 min, warning: 1 hour)
2. **Triage incidents** and escalate if needed
3. **Monitor deployments** and assist with rollbacks
4. **Document incidents** in incident tracking system
5. **Participate in post-mortems** for major incidents
6. **Update runbooks** with lessons learned

### Contact Information

| Role | Contact | When to Escalate |
|------|---------|------------------|
| **Primary On-Call** | Slack: @oncall | First responder |
| **Platform Squad Lead** | [Contact] | API/infrastructure issues |
| **Frontend Squad Lead** | [Contact] | Web/PWA issues |
| **Ops Team Lead** | [Contact] | Database/migration issues |
| **Security Team** | security@domain | Security incidents |
| **CTO** | [Contact] | Major outages, data loss |

### Escalation Paths

```
Minor Issue (P3)
└─> On-Call Engineer
    └─> (If needed) Squad Lead

Moderate Issue (P2)
└─> On-Call Engineer
    └─> Squad Lead
        └─> (If needed) Engineering Manager

Critical Issue (P1)
└─> On-Call Engineer
    └─> Squad Lead + Engineering Manager (parallel)
        └─> CTO (if user-facing impact)

Security Incident
└─> On-Call Engineer
    └─> Security Team (immediate)
        └─> CTO (parallel)
```

---

## Incident Response

### Incident Classification

| Severity | Impact | Response Time | Examples |
|----------|--------|---------------|----------|
| **P0** | Complete outage | 15 minutes | API down, database offline |
| **P1** | Major degradation | 30 minutes | High error rate, data loss |
| **P2** | Partial degradation | 1 hour | Single feature broken, slow response |
| **P3** | Minor issue | 4 hours | UI glitch, non-critical bug |

### Incident Response Procedure

1. **Acknowledge**: Confirm receipt of alert within SLA
2. **Assess**: Determine severity and impact
3. **Communicate**: Post in incident channel (#incidents)
4. **Investigate**: Check logs, metrics, recent changes
5. **Mitigate**: Apply immediate fix or rollback
6. **Monitor**: Verify issue resolved
7. **Document**: Create incident report
8. **Post-Mortem**: Schedule within 48 hours (P0-P1)

### Incident Communication Template

```markdown
**Incident**: [Brief description]
**Severity**: P0/P1/P2/P3
**Impact**: [User-facing impact]
**Started**: [Timestamp]
**Status**: Investigating/Mitigating/Resolved
**Updates**:
- [Timestamp] Initial report
- [Timestamp] Root cause identified
- [Timestamp] Fix applied
- [Timestamp] Monitoring
**Resolution**: [What fixed it]
**Next Steps**: [Follow-up actions]
```

### Post-Mortem Template

```markdown
# Post-Mortem: [Incident Title]

**Date**: [Date]
**Severity**: P0/P1/P2
**Duration**: [Total downtime/degradation]
**Impact**: [Users affected, data lost, revenue impact]

## Timeline
- [Time] Incident began
- [Time] Alert fired
- [Time] On-call acknowledged
- [Time] Root cause identified
- [Time] Fix deployed
- [Time] Incident resolved

## Root Cause
[Detailed explanation of what caused the incident]

## Resolution
[What was done to resolve the incident]

## Prevention
[Action items to prevent recurrence]

## Lessons Learned
[What we learned from this incident]

## Action Items
- [ ] [Action item 1] - Owner: [Name] - Due: [Date]
- [ ] [Action item 2] - Owner: [Name] - Due: [Date]
```

---

## Appendix

### Useful Commands

```bash
# Check system status
pnpm ops:check

# View API logs
docker logs -f avocat-ai-api
# OR
kubectl logs -f deployment/api

# View database connections
# (via Supabase dashboard or psql)

# Check OpenAI usage
# (via OpenAI dashboard)

# Force cache clear (if CDN)
# (implementation varies)

# View recent deployments
vercel ls
# OR
kubectl rollout history deployment/api

# Trigger manual backup
# (via Supabase dashboard or pg_dump)
```

### Emergency Contacts

Keep updated list of emergency contacts in secure location (e.g., PagerDuty, Slack workspace).

### Related Documentation

- [Architecture Documentation](./architecture.md)
- [Operations Runbooks](./operations/)
- [Deployment Guide (Vercel)](./deployment/vercel.md)
- [Go/No-Go Checklist](./GO_NO_GO_CHECKLIST.md)
- [Security Policy](../SECURITY.md)

---

**Document Owner**: Platform Squad + Ops Team  
**Review Cadence**: After each major release or quarterly  
**Last Reviewed**: 2025-10-29  
**Version**: 1.0
