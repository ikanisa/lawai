# Observability & Monitoring Guide

_Last updated: 2025-10-29_

This document defines the observability strategy, logging patterns, metrics, tracing, and monitoring practices for the Avocat-AI system.

## Table of Contents

1. [Overview](#overview)
2. [Logging](#logging)
3. [Metrics](#metrics)
4. [Tracing](#tracing)
5. [Health Checks](#health-checks)
6. [Alerting](#alerting)
7. [Dashboards](#dashboards)
8. [Performance Baselines](#performance-baselines)
9. [SLOs](#slos)

---

## Overview

### Observability Stack

| Layer | Technology | Status | Purpose |
|-------|-----------|---------|---------|
| **Logging** | Pino (API), Custom (Edge) | ✅ Active | Structured JSON logging |
| **Metrics** | Custom counters | ✅ Active | Business and system metrics |
| **Tracing** | OpenTelemetry (API) | ⚠️ Partial | Distributed tracing |
| **APM** | TBD | 📋 Planned | Application performance monitoring |
| **Error Tracking** | TBD | 📋 Planned | Error aggregation and analysis |
| **Dashboards** | TBD | 📋 Planned | Visualization and alerting |

### Current Implementation

- **apps/api**: Pino logger with Fastify integration, OpenTelemetry spans
- **apps/web**: Next.js built-in logging + custom client logging
- **apps/pwa**: Client-side telemetry with offline queue
- **apps/edge**: Custom structured logging in Deno runtime
- **packages/observability**: Shared telemetry utilities

---

## Logging

### Structured Logging Pattern

**Format**: JSON with consistent schema

```typescript
{
  "level": "info",           // error, warn, info, debug
  "time": 1698765432000,     // Unix timestamp
  "msg": "User authenticated", // Human-readable message
  "traceId": "abc123",       // Correlation ID
  "userId": "user-123",      // Context
  "orgId": "org-456",        // Context
  "duration": 145,           // Duration in ms (if applicable)
  "error": {                 // Error details (if applicable)
    "message": "...",
    "stack": "...",
    "code": "AUTH_FAILED"
  }
}
```

### API Logging (Fastify + Pino)

**Configuration** (`apps/api/src/app.ts`):

```typescript
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty'
  } : undefined,
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      headers: sanitizeHeaders(req.headers),
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
});

const app = fastify({ logger });
```

**Usage**:

```typescript
// Request-scoped logging
app.get('/api/endpoint', async (request, reply) => {
  request.log.info({ userId: request.user.id }, 'Processing request');
  
  try {
    const result = await service.process();
    request.log.info({ duration: Date.now() - start }, 'Request completed');
    return result;
  } catch (error) {
    request.log.error({ error }, 'Request failed');
    throw error;
  }
});
```

### Edge Function Logging (Deno)

**Pattern** (`apps/edge/*/index.ts`):

```typescript
function log(level: string, message: string, context?: Record<string, any>) {
  console.log(JSON.stringify({
    level,
    time: Date.now(),
    msg: message,
    ...context,
  }));
}

// Usage
log('info', 'Function invoked', { functionName: 'crawl-authorities' });
log('error', 'Crawl failed', { source: 'scc', error: error.message });
```

### Client Logging (Web/PWA)

**Pattern**:

```typescript
// Only log errors in production, verbose in development
const logger = {
  error: (message: string, context?: any) => {
    console.error(message, context);
    // Send to error tracking service
    if (typeof window !== 'undefined' && window.analytics) {
      window.analytics.track('Error', { message, ...context });
    }
  },
  
  info: (message: string, context?: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.info(message, context);
    }
  },
};
```

### Log Levels

| Level | When to Use | Examples |
|-------|-------------|----------|
| **error** | Exceptions, failures | API errors, DB connection failures, validation errors |
| **warn** | Degraded state, non-critical issues | Rate limit approaching, slow queries, deprecated API usage |
| **info** | Normal operations | Request started/completed, user actions, scheduled jobs |
| **debug** | Detailed diagnostics | Variable values, control flow, internal state |

### Sensitive Data Handling

**Rules**:
1. **Never log**: Passwords, tokens, API keys, PII in plain text
2. **Redact**: Email addresses, phone numbers, IP addresses
3. **Mask**: Partial credit card numbers, partial SSNs
4. **Hash**: User identifiers (optional for privacy)

**Implementation**:

```typescript
function sanitizeHeaders(headers: Record<string, string>) {
  const sanitized = { ...headers };
  
  // Remove sensitive headers
  delete sanitized.authorization;
  delete sanitized.cookie;
  delete sanitized['x-api-key'];
  
  return sanitized;
}

function redactPII(data: any) {
  const redacted = { ...data };
  
  if (redacted.email) {
    redacted.email = `${redacted.email.substring(0, 3)}***`;
  }
  
  if (redacted.phone) {
    redacted.phone = `***${redacted.phone.slice(-4)}`;
  }
  
  return redacted;
}
```

### Correlation IDs

**Purpose**: Trace requests across services

**Implementation**:

```typescript
// Generate trace ID
app.addHook('onRequest', async (request, reply) => {
  request.id = request.headers['x-trace-id'] || crypto.randomUUID();
  reply.header('x-trace-id', request.id);
});

// Use in logs
request.log.info({ traceId: request.id }, 'Processing');

// Pass to downstream services
await fetch(url, {
  headers: {
    'x-trace-id': request.id,
  },
});
```

---

## Metrics

### Metric Types

| Type | Purpose | Examples |
|------|---------|----------|
| **Counter** | Monotonically increasing | Request count, error count |
| **Gauge** | Point-in-time value | Active connections, queue depth |
| **Histogram** | Distribution of values | Request duration, response size |
| **Summary** | Calculated statistics | p50, p95, p99 latencies |

### Current Metrics

**System Metrics** (`packages/observability/src/metrics.ts`):

```typescript
// HTTP requests
httpRequestsTotal.inc({ method: 'POST', path: '/runs', status: 200 });

// Request duration
httpRequestDuration.observe({ method: 'POST', path: '/runs' }, duration);

// Active connections
activeConnections.set(count);

// Error count
errorsTotal.inc({ type: 'validation', code: 'INVALID_INPUT' });
```

**Business Metrics**:

```typescript
// IRAC generation
iracGenerationsTotal.inc({ jurisdiction: 'FR', confidence: 'high' });

// HITL queue
hitlQueueDepth.set(count);

// Citation accuracy
citationAccuracy.observe(accuracy);

// OpenAI usage
openaiTokensUsed.inc({ model: 'gpt-4', type: 'completion' }, tokenCount);
```

### Metric Naming Convention

**Pattern**: `{namespace}_{metric}_{unit}`

Examples:
- `http_requests_total`
- `http_request_duration_seconds`
- `irac_generations_total`
- `openai_tokens_used_total`
- `database_connections_active`

### Metric Labels

**Guidelines**:
- Keep cardinality low (< 100 unique combinations)
- Use consistent label names
- Avoid high-cardinality labels (user IDs, trace IDs)

**Good**:
```typescript
httpRequestsTotal.inc({
  method: 'POST',        // Low cardinality: GET, POST, PUT, DELETE
  path: '/runs',         // Low cardinality: 10-20 endpoints
  status: '200',         // Low cardinality: HTTP status codes
});
```

**Bad**:
```typescript
httpRequestsTotal.inc({
  method: 'POST',
  path: '/runs',
  userId: 'user-12345',  // ❌ High cardinality!
  traceId: 'abc...',     // ❌ High cardinality!
});
```

---

## Tracing

### OpenTelemetry Integration

**Status**: Partial implementation in apps/api

**Configuration** (`packages/observability/src/node.ts`):

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

const sdk = new NodeSDK({
  serviceName: 'avocat-ai-api',
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-http': { enabled: true },
      '@opentelemetry/instrumentation-fastify': { enabled: true },
      '@opentelemetry/instrumentation-pg': { enabled: true },
    }),
  ],
});

sdk.start();
```

### Span Patterns

**HTTP Request Span**:

```typescript
const span = tracer.startSpan('http.request', {
  attributes: {
    'http.method': 'POST',
    'http.url': '/runs',
    'http.status_code': 200,
  },
});

try {
  await handler();
  span.setStatus({ code: SpanStatusCode.OK });
} catch (error) {
  span.setStatus({ code: SpanStatusCode.ERROR });
  span.recordException(error);
  throw error;
} finally {
  span.end();
}
```

**Database Query Span**:

```typescript
const span = tracer.startSpan('db.query', {
  attributes: {
    'db.system': 'postgresql',
    'db.operation': 'SELECT',
    'db.statement': 'SELECT * FROM runs WHERE id = $1',
  },
});

const result = await db.query(sql);
span.end();
```

**External API Span**:

```typescript
const span = tracer.startSpan('http.client', {
  attributes: {
    'http.method': 'POST',
    'http.url': 'https://api.openai.com/v1/chat/completions',
    'peer.service': 'openai',
  },
});

const response = await openai.createCompletion(...);
span.end();
```

### Trace Context Propagation

**Pattern**: Pass trace context via headers

```typescript
// Extract context from incoming request
const context = propagation.extract(context.active(), request.headers);

// Inject context into outgoing request
const headers = {};
propagation.inject(context, headers);

await fetch(url, { headers });
```

---

## Health Checks

### Health Check Endpoints

**API Health Checks** (`apps/api/src/routes/health.ts`):

```typescript
// Basic health check
app.get('/healthz', async (request, reply) => {
  return { status: 'ok', timestamp: Date.now() };
});

// Readiness check (includes dependencies)
app.get('/ready', async (request, reply) => {
  const checks = await Promise.all([
    checkDatabase(),
    checkOpenAI(),
    checkSupabase(),
  ]);
  
  const allHealthy = checks.every(c => c.healthy);
  
  return reply
    .code(allHealthy ? 200 : 503)
    .send({
      status: allHealthy ? 'ready' : 'not ready',
      checks,
    });
});
```

**Health Check Response Format**:

```json
{
  "status": "ready",
  "timestamp": 1698765432000,
  "checks": [
    {
      "name": "database",
      "healthy": true,
      "latency": 5,
      "message": "Connected"
    },
    {
      "name": "openai",
      "healthy": true,
      "latency": 120,
      "message": "API accessible"
    }
  ]
}
```

### Dependency Health Checks

```typescript
async function checkDatabase(): Promise<HealthCheck> {
  const start = Date.now();
  
  try {
    await supabase.from('_health').select('*').limit(1);
    return {
      name: 'database',
      healthy: true,
      latency: Date.now() - start,
      message: 'Connected',
    };
  } catch (error) {
    return {
      name: 'database',
      healthy: false,
      latency: Date.now() - start,
      message: error.message,
    };
  }
}
```

---

## Alerting

### Alert Severity Levels

| Severity | Response Time | Examples |
|----------|---------------|----------|
| **P0 - Critical** | 15 minutes | API down, database offline, data loss |
| **P1 - High** | 1 hour | High error rate, degraded performance |
| **P2 - Medium** | 4 hours | Elevated latency, partial feature failure |
| **P3 - Low** | 1 business day | Minor issues, informational |

### Alert Rules (To Be Implemented)

**System Alerts**:
```yaml
# API availability
- alert: APIDown
  expr: up{job="api"} == 0
  for: 1m
  severity: P0
  
# High error rate
- alert: HighErrorRate
  expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
  for: 5m
  severity: P1

# Slow response time
- alert: SlowResponseTime
  expr: histogram_quantile(0.95, http_request_duration_seconds) > 2
  for: 10m
  severity: P2
```

**Business Alerts**:
```yaml
# HITL queue backup
- alert: HITLQueueBacklog
  expr: hitl_queue_depth > 50
  for: 30m
  severity: P2

# OpenAI rate limit
- alert: OpenAIRateLimitApproaching
  expr: rate(openai_requests_total[5m]) > 0.9 * openai_rate_limit
  for: 5m
  severity: P1
```

### Alert Routing

**Notification Channels**:
- **Slack**: #alerts, #incidents
- **PagerDuty**: For P0/P1 alerts
- **Email**: For P2/P3 alerts
- **Webhook**: Custom integrations

---

## Dashboards

### Recommended Dashboards

**1. System Health Dashboard**
- API uptime
- Request rate (req/s)
- Error rate (%)
- Response time (p50, p95, p99)
- Database connections
- Memory/CPU usage

**2. Business Metrics Dashboard**
- IRAC generations per hour
- Average confidence scores
- HITL queue depth
- Citation accuracy
- User activity (DAU, MAU)

**3. OpenAI Usage Dashboard**
- Token usage per hour
- Cost tracking
- Model distribution
- Average latency

**4. Error Dashboard**
- Error rate by type
- Top errors
- Error distribution
- Failed requests

---

## Performance Baselines

### API Performance

| Endpoint | Method | Target Latency (p95) | Current (Baseline TBD) |
|----------|--------|----------------------|------------------------|
| /healthz | GET | <50ms | TBD |
| /ready | GET | <200ms | TBD |
| /runs | POST | <500ms | TBD |
| /runs/:id | GET | <200ms | TBD |
| /corpus | GET | <300ms | TBD |
| /hitl | GET | <400ms | TBD |

### Web Performance (PWA/Web)

| Metric | Target | Current (Baseline TBD) |
|--------|--------|------------------------|
| **LCP** (Largest Contentful Paint) | ≤2.5s | TBD |
| **INP** (Interaction to Next Paint) | ≤200ms | TBD |
| **CLS** (Cumulative Layout Shift) | ≤0.1 | TBD |
| **FCP** (First Contentful Paint) | ≤1.8s | TBD |
| **TTI** (Time to Interactive) | ≤3.8s | TBD |

### Database Performance

| Query Type | Target Latency (p95) | Notes |
|------------|----------------------|-------|
| Simple SELECT | <10ms | Single table, indexed |
| Complex JOIN | <50ms | Multi-table, indexed |
| Aggregation | <100ms | GROUP BY, ORDER BY |
| Full-text search | <200ms | Using pg_trgm |
| Vector search | <300ms | Using pgvector |

---

## SLOs

### Service Level Objectives

**API Availability**:
- **Target**: 99.9% uptime (43.2 minutes downtime/month)
- **Measurement**: Uptime monitoring, health checks
- **Error Budget**: 0.1% = ~43 minutes/month

**API Latency**:
- **Target**: 95% of requests complete in <500ms
- **Measurement**: p95 latency metric
- **Error Budget**: 5% of requests can exceed 500ms

**Data Durability**:
- **Target**: 99.999% (no data loss)
- **Measurement**: Backup verification, restoration tests
- **Error Budget**: 0.001% = acceptable in disaster scenarios only

**IRAC Accuracy**:
- **Target**: 90% citation accuracy
- **Measurement**: Evaluation harness, manual review
- **Error Budget**: 10% inaccurate citations

### SLI (Service Level Indicators)

| SLI | Definition | Measurement |
|-----|------------|-------------|
| **Availability** | % of successful health checks | `successful_health_checks / total_health_checks` |
| **Latency** | p95 request duration | `histogram_quantile(0.95, http_request_duration_seconds)` |
| **Error Rate** | % of failed requests | `errors / total_requests` |
| **Throughput** | Requests per second | `rate(http_requests_total[1m])` |

---

## Implementation Roadmap

### Phase 1: Current
- [x] Structured logging (Pino, custom)
- [x] Basic metrics collection
- [x] Health check endpoints
- [x] Correlation IDs
- [ ] Document baseline performance

### Phase 2: Short-term
- [ ] Configure APM service (Datadog, New Relic, or Grafana Cloud)
- [ ] Implement alerting rules
- [ ] Create dashboards
- [ ] Establish SLO monitoring
- [ ] Configure error tracking (Sentry, Rollbar)

### Phase 3: Medium-term
- [ ] Distributed tracing fully implemented
- [ ] Custom business metrics dashboards
- [ ] Automated incident response
- [ ] Performance regression detection
- [ ] Cost tracking and optimization

---

## Resources

- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [Pino Logger](https://getpino.io/)
- [Prometheus Best Practices](https://prometheus.io/docs/practices/)
- [Google SRE Book - Monitoring](https://sre.google/sre-book/monitoring-distributed-systems/)

---

**Document Owner**: Platform Squad  
**Review Cadence**: Quarterly  
**Last Reviewed**: 2025-10-29  
**Next Review**: 2026-01-29
