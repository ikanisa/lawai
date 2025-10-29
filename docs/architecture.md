# Avocat-AI Architecture Documentation

_Last updated: 2025-10-29_

This document provides a comprehensive overview of the Avocat-AI Francophone legal AI system architecture, module boundaries, data flows, and operational patterns.

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Layers](#architecture-layers)
3. [Module Map](#module-map)
4. [Data Flow](#data-flow)
5. [Dependency Graph](#dependency-graph)
6. [Technology Stack](#technology-stack)
7. [Security Architecture](#security-architecture)
8. [Deployment Architecture](#deployment-architecture)
9. [Integration Points](#integration-points)
10. [Observability](#observability)

---

## System Overview

Avocat-AI is a production-grade legal AI assistant designed for Francophone jurisdictions, built as a PNPM monorepo with multiple applications and shared packages.

### High-Level Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        PWA[PWA - Public Interface<br/>Next.js 14 App Router]
        WEB[Web Console - Operator UI<br/>Next.js 14 + shadcn/ui]
    end
    
    subgraph "API Layer"
        API[Fastify API Gateway<br/>Agent Orchestrator<br/>Port 3333]
    end
    
    subgraph "Edge Computing"
        EDGE[Supabase Edge Functions<br/>Deno Runtime<br/>20+ Functions]
    end
    
    subgraph "Data Layer"
        POSTGRES[(Supabase Postgres<br/>107+ Migrations)]
        STORAGE[Supabase Storage<br/>Buckets: authorities, uploads, snapshots]
        VECTOR[Vector Store<br/>OpenAI + pgvector]
    end
    
    subgraph "External Services"
        OPENAI[OpenAI API<br/>GPT-4 + Embeddings]
        SOURCES[Legal Sources<br/>SCC, Federal Laws, etc.]
    end
    
    subgraph "Operations"
        OPS[Ops CLI<br/>Migrations, Provisioning<br/>Evaluations, Red Team]
    end
    
    PWA --> API
    WEB --> API
    API --> POSTGRES
    API --> STORAGE
    API --> OPENAI
    API --> VECTOR
    EDGE --> POSTGRES
    EDGE --> STORAGE
    EDGE --> SOURCES
    EDGE --> OPENAI
    OPS --> POSTGRES
    OPS --> STORAGE
    OPS --> OPENAI
    
    style API fill:#4CAF50
    style POSTGRES fill:#2196F3
    style EDGE fill:#FF9800
    style OPENAI fill:#9C27B0
```

### System Characteristics

- **Scale**: ~1,300 TypeScript/JavaScript files across 21 packages
- **Runtime**: Node.js 20 (API, Web, PWA, Ops) + Deno (Edge Functions)
- **Package Manager**: PNPM 8.15.4 with workspaces
- **Database**: Supabase Postgres with 107+ migrations
- **AI/ML**: OpenAI Agents SDK with GPT-4 and embeddings
- **Deployment**: Vercel (front-ends), Supabase (edge), containerized (API)

---

## Architecture Layers

The system follows a layered clean architecture pattern:

```mermaid
graph LR
    subgraph "Presentation Layer"
        UI[User Interfaces<br/>PWA, Web Console]
    end
    
    subgraph "Application Layer"
        ROUTES[HTTP Routes<br/>Controllers]
        SERVICES[Business Services<br/>Orchestration]
    end
    
    subgraph "Domain Layer"
        DOMAIN[Domain Logic<br/>IRAC, Workspace<br/>Compliance]
        SCHEMAS[Schemas & Types<br/>Zod Validation]
    end
    
    subgraph "Infrastructure Layer"
        SUPABASE[Supabase Client]
        OPENAI_CLIENT[OpenAI Client]
        STORAGE_CLIENT[Storage Client]
    end
    
    UI --> ROUTES
    ROUTES --> SERVICES
    SERVICES --> DOMAIN
    SERVICES --> SCHEMAS
    DOMAIN --> SCHEMAS
    SERVICES --> SUPABASE
    SERVICES --> OPENAI_CLIENT
    SERVICES --> STORAGE_CLIENT
    
    style DOMAIN fill:#4CAF50
    style SCHEMAS fill:#2196F3
```

### Layer Responsibilities

| Layer | Purpose | Location | Rules |
|-------|---------|----------|-------|
| **Presentation** | User interfaces, API contracts | `apps/web/src`, `apps/pwa/src` | No direct DB/external service access |
| **Application** | HTTP handling, request orchestration | `apps/api/src/routes`, `apps/api/src/http` | Coordinates services, handles auth |
| **Domain** | Pure business logic, entities | `apps/api/src/domain`, `packages/shared/domain` | No I/O, framework-agnostic |
| **Infrastructure** | External integrations, persistence | `apps/api/src/infrastructure`, `packages/supabase` | Implements ports from domain |

---

## Module Map

### Applications

```mermaid
graph TB
    subgraph "Frontend Applications"
        direction LR
        WEB[apps/web<br/>Operator Console<br/>Port 3001<br/>131 files]
        PWA[apps/pwa<br/>Public PWA<br/>Port 3000<br/>TBD files]
    end
    
    subgraph "Backend Services"
        direction LR
        API[apps/api<br/>Fastify REST API<br/>Port 3333<br/>118 TS files]
        EDGE[apps/edge<br/>Edge Functions<br/>20+ Deno functions]
    end
    
    subgraph "Operations"
        OPS[apps/ops<br/>CLI Tooling<br/>tsx runtime]
    end
    
    subgraph "Shared Packages"
        direction TB
        SHARED[packages/shared<br/>Schemas, Constants, IRAC]
        SUPABASE_PKG[packages/supabase<br/>Generated Types]
        API_CLIENTS[packages/api-clients<br/>Typed API Client]
        COMPLIANCE[packages/compliance<br/>Compliance Rules]
        OBSERVABILITY[packages/observability<br/>Telemetry]
        UI_DRAWER[packages/ui-plan-drawer<br/>UI Components]
    end
    
    WEB --> API_CLIENTS
    WEB --> SHARED
    WEB --> SUPABASE_PKG
    PWA --> API_CLIENTS
    PWA --> SHARED
    API --> SHARED
    API --> SUPABASE_PKG
    API --> COMPLIANCE
    API --> OBSERVABILITY
    EDGE --> SHARED
    EDGE --> SUPABASE_PKG
    OPS --> SHARED
    OPS --> SUPABASE_PKG
    API_CLIENTS --> SHARED
```

### Module Ownership

| Module | Owner | Description | Key Dependencies |
|--------|-------|-------------|------------------|
| `apps/api` | Platform Squad | Fastify REST API, agent orchestrator | Fastify, OpenAI SDK, Supabase |
| `apps/web` | Frontend Squad | Operator console for HITL review | Next.js 14, shadcn/ui, TanStack Query |
| `apps/pwa` | Frontend Squad | Public-facing PWA for litigants | Next.js 14, Radix UI, three.js |
| `apps/edge` | Platform Squad | Crawlers, schedulers, webhooks | Deno, Supabase Edge Runtime |
| `apps/ops` | Ops Team | Migration, provisioning, evaluation CLI | tsx, Zod, Supabase |
| `packages/shared` | Platform Squad | Domain schemas, IRAC definitions | Zod |
| `packages/supabase` | Platform Squad | Generated DB types, client helpers | Supabase JS |
| `packages/api-clients` | Platform Squad | Typed REST client | Fetch API, Zod |
| `packages/compliance` | Platform Squad | Compliance validation rules | Zod |
| `packages/observability` | Platform Squad | Telemetry, logging, metrics | OpenTelemetry |

---

## Data Flow

### Research Request Flow

```mermaid
sequenceDiagram
    participant User as User (PWA/Web)
    participant API as API Gateway
    participant OpenAI as OpenAI Agents
    participant DB as Supabase DB
    participant Vector as Vector Store
    participant HITL as HITL Queue
    
    User->>API: POST /runs (research question)
    API->>DB: Create run record
    API->>Vector: Retrieve relevant authorities
    API->>OpenAI: Create agent run (IRAC prompt)
    
    loop Streaming Response
        OpenAI-->>API: SSE chunk (partial IRAC)
        API-->>User: Forward SSE chunk
    end
    
    OpenAI-->>API: Complete IRAC response
    API->>DB: Store IRAC result
    
    alt High Risk
        API->>HITL: Queue for human review
        API-->>User: Return with HITL flag
    else Normal Risk
        API-->>User: Return complete IRAC
    end
    
    Note over API,DB: Audit trail logged
```

### Document Ingestion Flow

```mermaid
sequenceDiagram
    participant Edge as Edge Function
    participant Storage as Supabase Storage
    participant DB as Supabase DB
    participant OpenAI as OpenAI API
    participant Vector as Vector Store
    
    Edge->>Storage: Fetch legal document
    Edge->>OpenAI: Generate summary
    Edge->>OpenAI: Generate embeddings
    Edge->>Vector: Store document + embeddings
    Edge->>DB: Update metadata
    Edge->>DB: Log provenance
    
    Note over Edge,DB: Scheduled via cron
```

---

## Dependency Graph

### Package Dependencies

```mermaid
graph TD
    subgraph "Applications"
        API[apps/api]
        WEB[apps/web]
        PWA[apps/pwa]
        OPS[apps/ops]
        EDGE[apps/edge]
    end
    
    subgraph "Shared Packages"
        SHARED[packages/shared]
        SUPABASE_PKG[packages/supabase]
        API_CLIENTS[packages/api-clients]
        COMPLIANCE[packages/compliance]
        OBSERVABILITY[packages/observability]
    end
    
    API --> SHARED
    API --> SUPABASE_PKG
    API --> COMPLIANCE
    API --> OBSERVABILITY
    
    WEB --> SHARED
    WEB --> SUPABASE_PKG
    WEB --> API_CLIENTS
    
    PWA --> SHARED
    PWA --> API_CLIENTS
    
    OPS --> SHARED
    OPS --> SUPABASE_PKG
    
    EDGE --> SHARED
    EDGE --> SUPABASE_PKG
    
    API_CLIENTS --> SHARED
    COMPLIANCE --> SHARED
    
    style SHARED fill:#4CAF50
    style SUPABASE_PKG fill:#2196F3
```

### Dependency Rules

1. **No circular dependencies** between packages
2. **Domain layer** (`packages/shared/domain`) has zero external dependencies
3. **Infrastructure packages** (`packages/supabase`) may depend on domain
4. **Application layer** may depend on all packages
5. **Edge functions** use Deno-compatible packages only

---

## Technology Stack

### Core Technologies

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Runtime | Node.js | 20.x | API, Web, PWA, Ops |
| Runtime | Deno | Latest | Edge Functions |
| Language | TypeScript | 5.4.5 | Type safety across all apps |
| Package Manager | PNPM | 8.15.4 | Monorepo workspace management |
| API Framework | Fastify | Latest | REST API server |
| Web Framework | Next.js | 14.x | PWA and Web console |
| UI Library (Web) | shadcn/ui | Latest | Operator console UI |
| UI Library (PWA) | Radix UI | Latest | Public interface UI |
| Database | Supabase (Postgres) | Latest | Primary data store |
| Vector DB | pgvector | Latest | Embedding storage |
| AI/ML | OpenAI API | Latest | GPT-4, embeddings, agents |
| Testing | Vitest | Latest | Unit and integration tests |
| E2E Testing | Playwright | Latest | End-to-end tests (Web) |
| Validation | Zod | 3.25.x | Runtime schema validation |

### Build & Development Tools

- **TypeScript Compiler**: tsc 5.4.5
- **Linter**: ESLint 8.57.0 (known to be deprecated)
- **SQL Formatter**: sql-formatter 15.6.10
- **Git Hooks**: Lefthook
- **CI/CD**: GitHub Actions

---

## Security Architecture

### Authentication & Authorization

```mermaid
graph TB
    User[User Request] --> Auth[Supabase Auth]
    Auth --> JWT[JWT Validation]
    JWT --> RLS[Row-Level Security]
    JWT --> RBAC[Role-Based Access]
    
    RLS --> DB[(Database)]
    RBAC --> API[API Routes]
    
    style Auth fill:#FF5722
    style JWT fill:#FF9800
    style RLS fill:#4CAF50
```

### Security Layers

1. **Transport Security**: TLS 1.3 for all connections
2. **Authentication**: Supabase Auth with JWT tokens
3. **Authorization**: 
   - Row-Level Security (RLS) in Postgres
   - API-level RBAC checks
   - Resource ownership validation
4. **Data Protection**:
   - Secrets via environment variables (never committed)
   - Production rejects placeholder secrets
   - Encrypted storage buckets (private)
5. **Compliance**:
   - GDPR-compliant data handling
   - French judge analytics ban enforcement
   - FRIA/CEPEJ obligations validation
   - Audit trail for all operations

### Security Guardrails

- **Confidential Mode**: Suppresses web search when enabled
- **HITL Escalation**: High-risk queries queue for human review
- **Rate Limiting**: Applied per feature bucket
- **Input Validation**: Zod schemas at API boundaries
- **SQL Injection Prevention**: Parameterized queries via Supabase client

---

## Deployment Architecture

### Production Deployment

```mermaid
graph TB
    subgraph "Vercel (Frontend)"
        PWA_PROD[PWA Production]
        WEB_PROD[Web Console Production]
    end
    
    subgraph "API Hosting (TBD)"
        API_PROD[API Production<br/>Port 3333]
    end
    
    subgraph "Supabase Cloud"
        EDGE_PROD[Edge Functions]
        DB_PROD[Postgres + Storage]
    end
    
    subgraph "External Services"
        OPENAI_PROD[OpenAI API]
    end
    
    PWA_PROD --> API_PROD
    WEB_PROD --> API_PROD
    API_PROD --> DB_PROD
    API_PROD --> OPENAI_PROD
    EDGE_PROD --> DB_PROD
    EDGE_PROD --> OPENAI_PROD
    
    style PWA_PROD fill:#4CAF50
    style WEB_PROD fill:#2196F3
    style API_PROD fill:#FF9800
```

### Environment Matrix

| Environment | Purpose | Frontend Host | API Host | Database |
|-------------|---------|---------------|----------|----------|
| **Development** | Local dev | localhost:3000/3001 | localhost:3333 | Local Supabase |
| **Preview** | PR previews | Vercel preview | Staging API | Staging Supabase |
| **Staging** | Pre-production | staging.domain | staging.api.domain | Staging Supabase |
| **Production** | Live system | domain | api.domain | Production Supabase |

### Deployment Checklist

See [docs/release-runbook.md](./release-runbook.md) for complete deployment procedures.

---

## Integration Points

### External Services

| Service | Purpose | Authentication | Rate Limits |
|---------|---------|----------------|-------------|
| **OpenAI API** | GPT-4 completions, embeddings, agents | API Key | Per-tier limits |
| **Supabase** | Database, storage, auth, edge runtime | Service Role Key | Enterprise tier |
| **Legal Sources** | SCC, Federal Laws, Fedlex, etc. | Public/API keys | Varies by source |

### Internal APIs

| Endpoint | Method | Purpose | Auth Required |
|----------|--------|---------|---------------|
| `/runs` | POST | Create research run | Yes |
| `/corpus` | GET | Query document corpus | Yes |
| `/matters` | GET/POST | Manage legal matters | Yes |
| `/agents` | GET | List available agents | Yes |
| `/hitl` | GET/POST | Human-in-the-loop queue | Yes (operator) |
| `/admin/*` | Various | Admin operations | Yes (admin only) |
| `/realtime` | WebSocket | Real-time updates | Yes |
| `/voice` | WebSocket | Voice interface | Yes |
| `/healthz` | GET | Health check | No |

---

## Observability

### Logging

- **Format**: Structured JSON via Pino (API) and custom loggers (Edge)
- **Correlation IDs**: `x-trace-id` propagated across services
- **Log Levels**: error, warn, info, debug
- **Sensitive Data**: Scrubbed before logging (no PII/secrets)

### Metrics

- **System Metrics**: Request count, latency, error rate
- **Business Metrics**: IRAC generation count, HITL queue depth, citation accuracy
- **AI Metrics**: Token usage, model latency, embedding generation time

### Tracing

- **Implementation**: OpenTelemetry hooks (apps/api)
- **Trace Propagation**: Via `x-trace-id` header
- **Span Types**: HTTP requests, database queries, OpenAI calls

### Health Checks

```typescript
// Health check endpoints
GET /healthz - Basic health
GET /ready - Readiness probe (DB connectivity)
```

### Monitoring Dashboards

1. **Web Vitals**: LCP, INP, CLS (target: ≤2.5s, ≤200ms, ≤0.1)
2. **Accuracy Metrics**: Citation accuracy, temporal validity, retrieval recall
3. **Voice Latency**: Real-time voice interface performance
4. **Ops Alerts**: Nightly link health, regulator digests

---

## Known Issues & Technical Debt

### Current Known Issues

1. **Observability Package**: Type errors due to OpenTelemetry version conflict (non-blocking)
2. **Compliance Package**: Missing ESLint config (workspace-specific lint works)
3. **Lockfile Sync**: `apps/edge/package.json` out of sync (use `--no-frozen-lockfile` locally)
4. **API Observability Types**: MetricReader version mismatch (expected, ignore typecheck failures)

### Technical Debt

1. **API Monolith**: `apps/api/src/server.ts` exceeds 5,000 LOC - needs domain extraction
2. **Edge Function Duplication**: Repeated Supabase/OpenAI wiring - needs shared Deno libs
3. **Missing Tests**: Some modules lack comprehensive test coverage
4. **Migration Rollback**: Manual scripts exist but no automated rollback
5. **API Deployment**: Deployment strategy for API service not finalized

### Planned Improvements

See [docs/refactor/architecture.md](./refactor/architecture.md) for staged refactoring plan:

- **Stage 1**: DX foundations (linting, testing, documentation) ✓ In Progress
- **Stage 2**: Backend domain decomposition (extract API modules)
- **Stage 3**: Frontend feature modules (PWA modularization)
- **Stage 4**: Data hardening (migration automation, observability)
- **Stage 5**: Production readiness (performance, monitoring, runbooks)

---

## References

- [Internal Packages Overview](./architecture/internal-packages.md)
- [API Module Map](./architecture/module-map.md)
- [Environment Variables Matrix](./env-matrix.md)
- [Deployment Guide](./deployment/vercel.md)
- [Operations Runbooks](./operations/)
- [Launch Runbook](./operations/avocat-ai-launch-runbook.md)
- [Contributing Guidelines](../CONTRIBUTING.md)
- [Copilot Instructions](../.github/copilot-instructions.md)

---

## Maintenance

This document should be updated:

- When adding/removing applications or packages
- When changing deployment architecture
- When modifying security patterns
- When external integrations change
- After each major refactoring milestone

**Document Owner**: Platform Squad  
**Review Cadence**: Monthly or after major changes  
**Last Reviewed**: 2025-10-29
