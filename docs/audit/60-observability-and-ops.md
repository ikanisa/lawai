# Observability & Operations Audit

**Date**: 2025-11-01  
**Scope**: Logging, Tracing, Metrics, SLOs, Runbooks, DR

---

## Executive Observability Summary

**Overall Observability Posture**: 🟢 **GREEN** - Strong foundation with minor gaps

**Observability Score**: 11/15 (73%)

- ✅ **Strengths**: Structured logging (Pino), OpenTelemetry integration, SLO monitoring command, health checks
- ⚠️ **Gaps**: No centralized logging, alerting policy unclear, no distributed tracing in production
- 🟡 **Improvements**: Add centralized logging (Datadog/ELK), define alert thresholds, DR drills

---

## Logging

### Current Implementation

**Logger**: Pino 10.1.0 (high-performance Node.js logger)

**Format**: Structured JSON logs

**Levels**: trace, debug, info, warn, error, fatal

**Example**:
```typescript
// apps/api/src/server.ts
import pino from 'pino';

const logger = pino({
  level: env.LOG_LEVEL || 'info',
  transport: env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
  } : undefined,
});

logger.info({ orgId, userId, runId }, 'Agent run started');
```

**Score**: ✅ 9/10 - Excellent structured logging

### Recommendations

#### 1. Centralized Logging (P1)

**Options**:
- **Datadog**: Commercial, comprehensive
- **ELK Stack**: Open-source, self-hosted
- **Grafana Loki**: Lightweight, integrates with Grafana

**Implementation** (Datadog example):
```typescript
// apps/api/src/logger.ts
import pino from 'pino';
import { pinoHttp } from 'pino-http';

export const logger = pino({
  level: env.LOG_LEVEL,
  formatters: {
    level: (label) => ({ level: label }),
  },
  mixin: () => ({
    service: 'avocat-ai-api',
    env: env.NODE_ENV,
    version: env.APP_VERSION,
  }),
});

// Send to Datadog
if (env.DATADOG_API_KEY) {
  logger.transport = {
    target: '@datadog/pino',
    options: {
      apiKey: env.DATADOG_API_KEY,
      service: 'avocat-ai-api',
      hostname: env.HOSTNAME,
    },
  };
}
```

#### 2. Log Retention Policy (P2)

```
- Debug logs: 7 days
- Info logs: 30 days
- Warn logs: 90 days
- Error logs: 1 year
- Audit logs: 7 years (compliance)
```

---

## Tracing

### Current Implementation

**Framework**: OpenTelemetry (via `@avocat-ai/observability` package)

**Status**: ⚠️ Type errors (known OpenTelemetry version conflict)

**Exporters**: Not configured (needs verification)

**Score**: 🟡 6/10 - Integrated but not production-ready

### Recommendations

#### 1. Fix OpenTelemetry Type Errors (P1)

```json
// packages/observability/package.json
{
  "dependencies": {
    "@opentelemetry/api": "^1.8.0",
    "@opentelemetry/sdk-node": "^0.49.1",
    "@opentelemetry/instrumentation-http": "^0.49.1",
    "@opentelemetry/instrumentation-fastify": "^0.34.0",
    "@opentelemetry/exporter-trace-otlp-http": "^0.49.1"
  }
}
```

#### 2. Configure Trace Exporter (P1)

```typescript
// packages/observability/src/tracing.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

const traceExporter = new OTLPTraceExporter({
  url: env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
  headers: {
    'x-api-key': env.OTEL_API_KEY,
  },
});

const sdk = new NodeSDK({
  traceExporter,
  serviceName: 'avocat-ai-api',
});

sdk.start();
```

#### 3. Add Custom Spans (P2)

```typescript
// apps/api/src/agent.ts
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('agent-orchestrator');

export async function runAgent(input: AgentRunInput) {
  return await tracer.startActiveSpan('agent.run', async (span) => {
    span.setAttribute('org.id', input.orgId);
    span.setAttribute('user.id', input.userId);
    
    try {
      const result = await executeAgent(input);
      span.setAttribute('agent.run_id', result.runId);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  });
}
```

---

## Metrics

### Current Implementation

**Status**: ⚠️ Not explicitly detected (may be in observability package)

**Recommended**: Prometheus + Grafana

**Score**: 🟡 5/10 - Needs implementation

### Key Metrics to Track

#### API Metrics
```typescript
// apps/api/src/metrics.ts
import { Counter, Histogram, Gauge } from 'prom-client';

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration',
  labelNames: ['method', 'route'],
  buckets: [0.1, 0.5, 1, 2, 5],
});

export const agentRunsInProgress = new Gauge({
  name: 'agent_runs_in_progress',
  help: 'Number of agent runs currently executing',
});
```

#### Agent Metrics
```
- agent_runs_total{status, org_id}
- agent_run_duration_seconds{org_id}
- agent_tool_invocations_total{tool_name, org_id}
- agent_hitl_escalations_total{reason, org_id}
- agent_compliance_failures_total{type, org_id}
```

#### Business Metrics
```
- daily_active_users{org_id}
- cases_created_total{org_id}
- cases_closed_total{org_id}
- document_uploads_total{org_id, file_type}
```

---

## SLOs (Service Level Objectives)

### Current Implementation

**Command**: ✅ `pnpm ops:slo` (in ops CLI)

**Status**: Needs verification of implementation

**Score**: 🟡 7/10 - Command exists, needs documentation

### Recommended SLOs

| Service | SLI | Target | Budget |
|---------|-----|--------|--------|
| **API Availability** | % of successful requests | 99.9% | 43 min/month |
| **API Latency** | % of requests < 500ms | 95% | 5% slow |
| **Agent Success Rate** | % of runs completed without error | 99% | 1% failures |
| **HITL Response Time** | % of reviews < 1 hour | 80% | 20% slow |
| **Database Availability** | % uptime | 99.95% | 22 min/month |

### SLO Monitoring

```typescript
// apps/ops/src/commands/slo.ts
export async function calculateSLO(timeRange: string) {
  const metrics = await fetchMetrics(timeRange);
  
  const apiAvailability = 
    (metrics.successfulRequests / metrics.totalRequests) * 100;
  
  const errorBudget = 100 - 99.9;
  const errorBudgetRemaining = errorBudget - (100 - apiAvailability);
  
  console.log(`API Availability: ${apiAvailability.toFixed(3)}%`);
  console.log(`Error Budget Remaining: ${errorBudgetRemaining.toFixed(3)}%`);
  
  if (errorBudgetRemaining < 0) {
    console.warn('⚠️  Error budget exhausted! Stop feature releases.');
  }
}
```

---

## Alerting

### Current State

**Alerting**: ❌ Not detected

**Score**: 🔴 0/10 - Missing

### Recommended Alert Policies

#### Critical Alerts (Page immediately)
```yaml
- name: API Down
  condition: http_requests_total{status="5xx"} > 10 in 5m
  severity: critical
  channels: [pagerduty, slack]

- name: Database Connection Failed
  condition: db_connection_errors > 5 in 1m
  severity: critical
  channels: [pagerduty, slack]

- name: Error Budget Exhausted
  condition: error_budget_remaining < 0
  severity: critical
  channels: [pagerduty, slack]
```

#### High Alerts (Notify within 15 min)
```yaml
- name: High API Latency
  condition: http_request_duration_seconds{p95} > 2s for 5m
  severity: high
  channels: [slack, email]

- name: High Agent Failure Rate
  condition: agent_runs_total{status="failed"} / agent_runs_total > 0.05 for 10m
  severity: high
  channels: [slack, email]

- name: HITL Queue Backlog
  condition: hitl_queue_depth > 50
  severity: high
  channels: [slack]
```

---

## Runbooks

### Current State

**Documentation**: ✅ Some runbooks exist in `docs/operations/`

**Coverage**: ⚠️ Partial (needs expansion)

**Score**: 🟡 6/10 - Some runbooks, needs standardization

### Recommended Runbook Structure

```markdown
# Runbook: [Incident Type]

## Symptoms
- API returning 500 errors
- Dashboard shows spike in error rate

## Impact
- Users cannot create new agent runs
- Severity: P1 (High)

## Diagnosis
1. Check API logs: `kubectl logs -l app=api --tail=100`
2. Check metrics: Grafana dashboard [link]
3. Check database connections: `SELECT count(*) FROM pg_stat_activity`

## Remediation
1. If database connections exhausted:
   - Scale up connection pool
   - Restart API pods: `kubectl rollout restart deployment/api`
2. If memory leak:
   - Restart API pods
   - File incident for investigation

## Prevention
- Add connection pool monitoring
- Add memory leak detection

## Escalation
- If not resolved in 15 minutes, page on-call engineer
- Slack: #incidents
- PagerDuty: [link]
```

### Priority Runbooks to Create

1. **API Downtime** (P0)
2. **Database Connection Issues** (P0)
3. **Agent Run Failures** (P1)
4. **HITL Queue Backlog** (P1)
5. **Supabase Storage Full** (P2)
6. **OpenAI API Rate Limit** (P2)

---

## Rollback Strategy

### Current State

**Deployment Strategy**: ⚠️ Not documented

**Rollback**: ⚠️ Manual (assumed)

**Score**: 🟡 5/10 - Needs documentation and automation

### Recommended Rollback Procedures

#### Application Rollback
```bash
# Vercel (web/pwa)
vercel rollback [deployment-url]

# Docker (api) - assuming k8s
kubectl rollout undo deployment/api

# Supabase Edge Functions
supabase functions deploy [function-name] --no-verify-jwt
```

#### Database Rollback
```bash
# PITR (Point-in-Time Recovery)
# Via Supabase dashboard or CLI
supabase db restore --backup-id [id] --project-ref [ref]

# Or restore specific timestamp
supabase db restore --time "2025-11-01T10:00:00Z"
```

#### Rollback Decision Tree
```
Incident Severity?
├─ P0 (Critical): Rollback immediately
├─ P1 (High): Attempt fix for 15 min, then rollback
├─ P2 (Medium): Fix in next release
└─ P3 (Low): Schedule fix
```

---

## Backup & Restore

### Backup Strategy

**Database**: ✅ Supabase PITR (15 min RPO)

**Files**: ✅ Supabase Storage (replicated)

**Configuration**: ⚠️ Not backed up (should version in git)

### Restore Procedures

```bash
# Test restore (quarterly drill)
1. Create test environment
2. Restore database: pnpm ops:restore --env test --timestamp [ISO]
3. Verify data integrity: pnpm ops:verify-backup
4. Start API against restored DB
5. Run smoke tests: pnpm ops:smoke-test
6. Measure RTO (target: < 4 hours)
7. Document results
```

**Score**: ✅ 8/10 - Good backups, needs DR drills

---

## Health Checks

### Current Implementation

**Endpoints**: ✅ Assumed `/healthz` or `/health`

**Checks**: ⚠️ Needs verification

### Recommended Health Checks

```typescript
// apps/api/src/routes/health.ts
app.get('/healthz', async (request, reply) => {
  const checks = await Promise.allSettled([
    checkDatabase(),
    checkRedis(),
    checkOpenAI(),
    checkSupabase(),
  ]);
  
  const failures = checks.filter(c => c.status === 'rejected');
  
  if (failures.length > 0) {
    return reply.code(503).send({
      status: 'unhealthy',
      checks: checks.map((c, i) => ({
        name: ['database', 'redis', 'openai', 'supabase'][i],
        status: c.status,
      })),
    });
  }
  
  return { status: 'healthy' };
});

// Liveness probe (simple)
app.get('/livez', async () => ({ status: 'alive' }));

// Readiness probe (checks dependencies)
app.get('/readyz', async () => {
  const canAcceptTraffic = await checkDatabaseConnection();
  return canAcceptTraffic
    ? { status: 'ready' }
    : reply.code(503).send({ status: 'not ready' });
});
```

---

## Observability Checklist

### P0 (Critical)

- [ ] **Add Centralized Logging** (2 days)
  - Choose provider (Datadog/ELK/Loki)
  - Configure log shipping
  - Set up dashboards

- [ ] **Define Alert Policies** (1 day)
  - Create critical/high/medium alerts
  - Set up PagerDuty integration
  - Test alert delivery

### P1 (High)

- [ ] **Fix OpenTelemetry Type Errors** (1 day)
  - Upgrade dependencies
  - Configure trace exporter
  - Test tracing end-to-end

- [ ] **Document Rollback Procedures** (4 hours)
  - Application rollback steps
  - Database rollback steps
  - Decision tree

- [ ] **Create Critical Runbooks** (2 days)
  - API Downtime
  - Database Issues
  - Agent Failures

- [ ] **Implement Metrics** (2 days)
  - Set up Prometheus
  - Instrument API and agents
  - Create Grafana dashboards

### P2 (Medium)

- [ ] **Conduct DR Drill** (4 hours quarterly)
  - Test backup/restore
  - Measure RTO/RPO
  - Update procedures

- [ ] **Add Custom Spans** (1 day)
  - Instrument critical paths
  - Add business metrics

---

## Success Metrics

| Metric | Target |
|--------|--------|
| **Mean Time to Detect (MTTD)** | < 5 minutes |
| **Mean Time to Resolve (MTTR)** | < 1 hour |
| **Log Retention** | 30 days (info), 1 year (error) |
| **Trace Sampling** | 10% (reduce costs) |
| **Alert False Positive Rate** | < 5% |
| **Runbook Coverage** | 100% of P0/P1 incidents |
| **SLO Compliance** | ≥ 99.9% API availability |

---

**End of Observability & Operations Audit**
