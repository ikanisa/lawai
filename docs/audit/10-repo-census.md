# Repository Census

**Date**: 2025-11-01  
**Repository**: ikanisa/lawai  
**Branch**: main

---

## Overview

- **Repository Type**: Monorepo (PNPM workspaces)
- **Package Manager**: pnpm@8.15.4 (Corepack-managed)
- **Node Version**: 20.x (specified in `.nvmrc`, enforced in CI)
- **TypeScript Version**: 5.4.5
- **Total Packages**: 21 workspaces
- **Lines of Code**: ~97,241 (TS/TSX/JS/JSX, excluding node_modules)
- **Test Files**: 175 test files (.test.ts, .spec.ts)
- **Database Migrations**: 107 SQL files in `db/migrations/`

---

## Monorepo Layout

```
lawai/
├── apps/                      # Application workspaces
│   ├── api/                   # Fastify REST API + Agent Orchestrator
│   ├── edge/                  # Supabase Edge Functions (Deno)
│   ├── ops/                   # CLI tooling for operations
│   ├── pwa/                   # Public PWA (Next.js 16 + React 19)
│   └── web/                   # Admin/Staff PWA (Next.js 14 + React 18)
├── packages/                  # Shared libraries
│   ├── api-clients/           # API client libraries
│   ├── compliance/            # Compliance validation
│   ├── config/                # Shared configuration
│   ├── observability/         # Telemetry and logging
│   ├── shared/                # Common schemas and constants
│   ├── supabase/              # Generated Supabase types
│   └── ui-plan-drawer/        # Shared UI component
├── db/                        # Database artifacts
│   ├── migrations/            # SQL migrations (canonical)
│   └── seed/                  # Seed scripts
├── JB/                        # JetBrains project artifacts
├── docs/                      # Documentation
├── infra/                     # Infrastructure as Code
├── scripts/                   # Build and validation scripts
├── supabase/                  # Supabase config and legacy migrations
├── .github/                   # GitHub Actions workflows
│   └── workflows/             # 20 CI/CD workflows
└── prompts/                   # AI prompt templates
```

---

## Workspace Packages

### Applications (apps/)

#### 1. apps/api
- **Purpose**: Fastify REST API service, agent orchestrator
- **Framework**: Fastify 4.26, OpenAI Agents SDK 0.1.9
- **Port**: 3333 (default)
- **Key Dependencies**:
  - `@openai/agents@0.1.9` - Agent framework
  - `fastify@4.26.1` - HTTP server
  - `ioredis@5.4.1` - Redis client
  - `pino@10.1.0` - Logging
  - `zod@3.25.42` - Schema validation
- **Scripts**:
  - `dev`: Run with tsx (TypeScript execution)
  - `build`: Compile TypeScript
  - `test`: Vitest unit tests
  - `lint`: ESLint
  - `typecheck`: TSC no-emit
- **Known Issues**: 
  - ⚠️ Observability type errors (OpenTelemetry version conflict)
  - ⚠️ eslint@8.57.0 deprecated
  - ⚠️ @typescript-eslint/parser version mismatch

#### 2. apps/web
- **Purpose**: Admin/Staff operator console
- **Framework**: Next.js 14.2.5 + React 18.3.1
- **Port**: 3001 (default)
- **Key Dependencies**:
  - `next@14.2.5` - React framework
  - `@supabase/supabase-js@2.75.1` - Supabase client
  - `@tanstack/react-query@5.51.9` - Data fetching
  - `workbox-window@6.5.4` - Service worker utilities
  - `web-vitals@3.5.2` - Performance monitoring
- **Scripts**:
  - `predev/prebuild`: Generate icons and prepare service worker
  - `dev`: Development server
  - `build`: Production build
  - `test`: Vitest
  - `test:e2e`: Playwright tests
- **Build Configuration**:
  - `output: 'standalone'` in next.config.mjs
  - Docker-ready multi-stage Dockerfile
  - Non-root user (nextjs:nodejs)
- **Known Issues**:
  - ⚠️ No PWA manifest in public/ directory
  - ⚠️ workbox-window@6.6.1 deprecated

#### 3. apps/pwa
- **Purpose**: Public-facing PWA for litigants and reviewers
- **Framework**: Next.js 16.0.1 + React 19.2.0
- **Port**: 3000 (default)
- **Key Dependencies**:
  - `next@16.0.1` - React framework (latest)
  - `react@19.2.0` - React library (latest)
  - `@radix-ui/*` - UI components
  - `@react-three/fiber@8.15.16` - 3D graphics
  - `zustand@4.5.2` - State management
- **Scripts**:
  - `dev`: Development server
  - `build`: Production build
  - `test`: Vitest
  - `cy:e2e`: Cypress E2E tests
  - `bundle:check`: Bundle size validation
- **PWA Features**:
  - ✅ Manifest at `public/manifest.json`
  - ✅ Maskable icons defined
  - ❌ No service worker detected
  - ❌ No offline routing/fallbacks
- **Known Issues**:
  - ⚠️ React 19 peer dependency warnings (most deps expect React 18)
  - ⚠️ Cypress may fail to install in restricted networks

#### 4. apps/ops
- **Purpose**: Operational CLI tooling
- **Runtime**: Node + tsx
- **Commands**:
  - `migrate`: Apply database migrations
  - `provision`: Provision environment resources
  - `foundation`: Full setup (migrations + buckets + vector store)
  - `evaluate`: Run agent evaluations
  - `red-team`: Red team testing
  - `transparency`: Generate transparency reports
  - `slo`: SLO monitoring
  - `learning`: Learning data analysis
  - `go-no-go`: Go/no-go readiness check
  - `check`: Health check
  - `rotate-secrets`: Secret rotation
  - `rls-smoke`: RLS policy smoke tests
  - `phase`: Deployment phase management
- **Key Dependencies**:
  - `zod@3.25.42` - Schema validation
  - `dotenv@17.2.3` - Environment variables
- **Known Issues**:
  - ⚠️ @typescript-eslint/parser version mismatch

#### 5. apps/edge
- **Purpose**: Supabase Edge Functions (Deno runtime)
- **Runtime**: Deno
- **Functions**: 20+ edge functions
- **Deployment**: `supabase functions deploy <name>`
- **Configuration**: `supabase/config.toml` (CRON schedules)
- **Known Issues**:
  - ⚠️ Lockfile out of sync warning
  - ⚠️ Optional: Set `DENO_BIN` if Deno not installed

### Shared Packages (packages/)

#### 1. packages/shared
- **Purpose**: Shared TypeScript utilities, schemas, constants
- **Exports**:
  - IRAC schemas (Issue, Rule, Application, Conclusion)
  - Allowlists (domains, jurisdictions)
  - Web search modes and types
  - Orchestrator schemas
  - Transparency utilities
- **Tests**: 8 test files (allowlist, scheduling, transparency, etc.)

#### 2. packages/supabase
- **Purpose**: Generated Supabase types and client helpers
- **Generation**: `supabase gen types typescript`
- **Types**: Database schema types, RLS-aware

#### 3. packages/compliance
- **Purpose**: Compliance validation logic
- **Status**: ⚠️ Lint fails (missing ESLint config)

#### 4. packages/observability
- **Purpose**: OpenTelemetry integration, structured logging
- **Status**: ⚠️ Type errors (MetricReader version mismatch, known issue)

#### 5. packages/api-clients
- **Purpose**: API client libraries for external services

#### 6. packages/config
- **Purpose**: Shared configuration utilities

#### 7. packages/ui-plan-drawer
- **Purpose**: Shared UI component for plan visualization
- **Framework**: React component library

---

## Dependency Summary

### Root Dependencies
```json
{
  "dependencies": {
    "next-pwa": "^5.6.0"
  },
  "devDependencies": {
    "sql-formatter": "^15.6.10",
    "typescript": "^5.4.5",
    "zod": "^3.25.42"
  }
}
```

### Key Dependency Versions
- **Node**: >=20 <21 (enforced)
- **PNPM**: 8.15.4 (pinned via packageManager field)
- **TypeScript**: 5.4.5 (workspace-wide)
- **Next.js**: 14.2.5 (web), 16.0.1 (pwa)
- **React**: 18.3.1 (web), 19.2.0 (pwa)
- **Fastify**: 4.26.1
- **OpenAI Agents SDK**: 0.1.9
- **Supabase JS**: 2.75.1
- **Zod**: 3.25.42 (multiple versions)

### Peer Dependency Issues
```
⚠️ React version mismatch:
  - apps/pwa uses React 19.2.0
  - Most Radix UI, react-three/fiber, lucide-react expect React 18
  - apps/web uses React 18.3.1 (correct)

⚠️ TypeScript ESLint parser mismatch:
  - apps/api uses @typescript-eslint/parser@8.46.2
  - @typescript-eslint/eslint-plugin@6.21.0 expects ^6.0.0

⚠️ Observability package:
  - Expects @types/node@^20
  - apps/api has @types/node@24.9.2
```

### Deprecated Warnings
- `eslint@8.57.0` (apps/api, apps/ops)
- `workbox-window@6.6.1` (apps/web)
- `docx@8.6.0` (apps/web)
- 13 deprecated subdependencies (glob, rimraf, rollup-plugin-terser, etc.)

---

## Tooling Versions

### Build Tools
- **Package Manager**: pnpm 8.15.4
- **Node Version Manager**: nvm (`.nvmrc`: 20.11.0)
- **TypeScript Compiler**: 5.4.5
- **Bundlers**:
  - Next.js (built-in webpack/turbopack)
  - Vite (Vitest)
  - esbuild (apps/web scripts)

### Testing
- **Unit Tests**: Vitest 1.6.0
- **E2E Tests**:
  - Playwright 1.51.1 (apps/web)
  - Cypress 13.8.1 (apps/pwa)
- **Component Tests**: @testing-library/react 14.2.1
- **Coverage**: Vitest coverage (not configured)

### Linting & Formatting
- **ESLint**: 8.57.0 (apps/api, apps/ops), 9.38.0 (apps/web, apps/pwa)
- **TypeScript ESLint**: Multiple versions (6.21.0, 8.46.2)
- **Prettier**: Not explicitly configured (should add)
- **EditorConfig**: ✅ `.editorconfig` present

### CI/CD Tools
- **Git Hooks**: Lefthook (`.lefthook.yml`)
- **Changesets**: `.changeset/` directory
- **Docker**: Multi-stage Dockerfiles
- **Vercel**: `vercel.json` config (apps/web)

---

## Database Migrations

### Migration Management
- **Location**: `db/migrations/` (canonical, 107 files)
- **Legacy**: `supabase/migrations/` (14 files, READ-ONLY)
- **Format**: `YYYYMMDDHHMMSS_slug.sql`
- **Manifest**: `db/migrations/manifest.json` (auto-generated)
- **Validation**: `pnpm check:migrations` (requires `ALLOW_SUPABASE_MIGRATIONS=1`)

### Migration Categories
- Schema evolution (tables, columns, indexes)
- RLS policies (multi-tenant isolation)
- Extensions (pgvector, pg_trgm)
- Functions and triggers
- Seed data (jurisdictions, allowlists)

### Rollback Strategies
Documented in manifest.json:
- `manual-restore`: PITR or backup restore
- `reapply-migration`: Re-run after fixes
- `reseed`: Reset and re-seed data

---

## Test Coverage

### Test Distribution
- **Total Test Files**: 175
- **Unit Tests**: Vitest (apps/api, apps/web, apps/pwa, packages/shared)
- **E2E Tests**: Playwright (apps/web), Cypress (apps/pwa)
- **Integration Tests**: Supabase RLS smoke tests (ops CLI)

### Coverage Gaps
- ❌ No coverage reports generated
- ❌ No coverage thresholds configured
- ❌ No contract tests (e.g., Pact for API)
- ⚠️ Some tests may fail on fresh clone (missing runtime dependencies)

### Test Commands
```bash
# Run all tests
pnpm test

# Workspace-specific
pnpm --filter @apps/api test
pnpm --filter @avocat-ai/web test
pnpm --filter @apps/pwa test

# E2E tests
pnpm --filter @avocat-ai/web test:e2e  # Playwright
pnpm --filter @apps/pwa cy:e2e         # Cypress
```

---

## License Summary

### Root License
- **Type**: Not specified in package.json
- **Recommendation**: Add LICENSE file (e.g., MIT, Apache 2.0, or proprietary)

### Dependency Licenses
- **Analysis**: Not performed in this audit
- **Tools**: Use `license-checker` or `@cyclonedx/cyclonedx-npm` for SBOM
- **Risky Licenses**: Check for AGPL, GPL in client-side dependencies
- **Action**: Run `pnpm dlx license-checker --summary` to generate report

### SBOM Generation
- ✅ Workflow exists: `.github/workflows/sbom.yml`
- Generates CycloneDX and SPDX formats
- Runs on push, PR, release, and workflow_dispatch

---

## Build Graph & Dependencies

### Dependency Flow
```
apps/api → packages/observability
         → packages/shared
         → packages/supabase

apps/web → packages/ui-plan-drawer
         → packages/supabase

apps/pwa → packages/ui-plan-drawer

apps/ops → packages/shared
         → packages/supabase

packages/observability → (external: OpenTelemetry)
packages/shared → (external: Zod, OpenAI)
packages/supabase → (generated types)
```

### Build Order
1. **Packages** (no internal deps): `shared`, `supabase`, `config`, `ui-plan-drawer`
2. **Packages** (with deps): `observability`, `compliance`, `api-clients`
3. **Apps**: Can build in parallel after packages

### Build Commands
```bash
# Build all workspaces
pnpm build

# Build specific workspace
pnpm --filter @apps/api build
pnpm --filter @avocat-ai/web build
pnpm --filter @apps/pwa build

# Parallel build (implicit with pnpm -r)
pnpm -r --if-present run build
```

---

## Scripts & Automation

### Root Scripts (package.json)
```json
{
  "preinstall": "check-package-manager.mjs",
  "build": "pnpm -r --if-present run build",
  "lint": "pnpm -r --if-present run lint",
  "lint:sql": "lint-sql.mjs",
  "typecheck": "pnpm -r --if-present run typecheck",
  "test": "pnpm -r --if-present run test",
  "check:migrations": "check-migrations.mjs",
  "check:binaries": "check-binaries.mjs",
  "env:validate": "validate-env-examples.mjs",
  "dev:api": "pnpm --filter @apps/api run dev",
  "dev:web": "pnpm --filter @avocat-ai/web run dev",
  "db:migrate": "pnpm --filter @apps/ops run migrate",
  "ops:*": "Various ops commands"
}
```

### Validation Scripts
- `check-migrations.mjs`: Validate migration naming, manifest, checksums
- `check-binaries.mjs`: Block binary assets (PNG, PDF, ZIP, etc.)
- `validate-env-examples.mjs`: Validate .env.example files
- `lint-sql.mjs`: SQL linting with sql-formatter
- `check-package-manager.mjs`: Enforce pnpm usage

### Deployment Scripts
- `apps/web/scripts/generate-icons.mjs`: Generate PWA icons
- `apps/web/scripts/prepare-sw.mjs`: Service worker preparation
- `scripts/deployment-preflight.mjs`: Production validation
- `scripts/generate-migration-manifest.mjs`: Update migration manifest

---

## CI/CD Workflows

### GitHub Actions (20 workflows)

#### Security & Scanning
1. `codeql.yml` - CodeQL security scan (daily + PR)
2. `codeql-analysis.yml` - Legacy CodeQL config
3. `container-scan.yml` - Docker image vulnerability scanning
4. `dependency-audit.yml` - NPM/PNPM audit
5. `secret-scan.yml` - Secret detection
6. `sbom.yml` - SBOM generation (CycloneDX + SPDX)

#### Build & Test
7. `ci.yml` - Main CI (typecheck, lint, test, build) on main/master
8. `monorepo-ci.yml` - Full CI on work branch with migration checks
9. `node.yml` - Node-specific tests
10. `test-coverage.yml` - Coverage reporting

#### Deployment
11. `deploy.yml` - Production deployment
12. `preview.yml` - Preview deployments
13. `preview-build.yml` - Build for preview
14. `vercel-preview-build.yml` - Vercel-specific preview
15. `staging-smoke-tests.yml` - Staging environment smoke tests
16. `supabase-migration-smoke.yml` - Migration smoke tests

#### Specialized
17. `export-agent.yml` - Export agent definitions
18. `nightly.yml` - Nightly builds and checks
19. `qa-signoff.yml` - QA approval workflow

### Required CI Checks
- ✅ Typecheck (pnpm typecheck)
- ✅ Lint (pnpm lint)
- ✅ Test (pnpm test)
- ✅ Build (pnpm build)
- ✅ Migration validation (ALLOW_SUPABASE_MIGRATIONS=1 pnpm check:migrations)
- ✅ Binary check (pnpm check:binaries)

### CI Configuration
- **Node Version**: 20 (via setup-node@v4)
- **PNPM Version**: 8.15.4 (via pnpm/action-setup@v4)
- **Cache**: pnpm cache enabled
- **Concurrency**: Cancel in-progress on new push
- **Timeout**: 360 minutes (CodeQL)

---

## Infrastructure as Code

### Docker
- **Dockerfiles**: `apps/web/Dockerfile`, `apps/api/` (assumed)
- **Docker Compose**: `docker-compose.yml`, `docker-compose.dev.yml`
- **Base Images**: `node:20-alpine`
- **Multi-stage**: ✅ Build stage + Runtime stage
- **Non-root user**: ✅ nextjs:nodejs (uid 1001, gid 1001)
- **Health checks**: Not configured in Dockerfiles

### Vercel
- **Config**: `apps/web/vercel.json`
- **Next.js Config**: `output: 'standalone'` for serverless
- **Deployment**: GitHub → Vercel integration

### Supabase
- **Config**: `supabase/config.toml`
- **Edge Functions**: 20+ functions in `apps/edge/`
- **CRON Jobs**: Configured in config.toml
- **Database**: Postgres with pgvector, pg_trgm extensions

---

## Documentation

### Root Documentation
- ✅ `README.md` - Comprehensive setup guide
- ✅ `CONTRIBUTING.md` - Contribution guidelines
- ✅ `SECURITY.md` - Security policy and reporting
- ✅ `SUPPORT.md` - Support channels
- ✅ `DEPLOYMENT_READINESS_REPORT.md` - Deployment status

### Docs Directory
- `docs/operations/` - Operational runbooks
- `docs/deployment/` - Deployment guides
- `docs/ops/` - Ops tooling documentation
- `docs/governance/` - Governance policies
- `docs/local-hosting.md` - Self-hosting guide

### Code Documentation
- **JSDoc/TSDoc**: Minimal usage
- **README per package**: Some packages have README.md
- **ADRs**: Not found (Architecture Decision Records)
- **API Documentation**: Not found (OpenAPI/Swagger spec)

---

## Developer Experience

### Setup Complexity
- **One-command setup**: ❌ (requires multiple steps)
- **Setup Time**: ~10-15 minutes (with good network)
- **Dependencies**: Corepack, Node 20, Supabase CLI

### Required Steps
```bash
# 1. Enable pnpm
corepack enable && corepack prepare pnpm@8.15.4 --activate

# 2. Install dependencies
pnpm install --no-frozen-lockfile

# 3. Copy environment file
cp .env.example .env.local

# 4. Apply migrations
pnpm db:migrate

# 5. Provision resources
pnpm ops:foundation

# 6. Seed data
pnpm seed

# 7. Start services
pnpm dev:api  # Terminal 1
pnpm dev:web  # Terminal 2
pnpm --filter @apps/pwa dev  # Terminal 3
```

### Pain Points
- ⚠️ No Makefile target for one-command setup
- ⚠️ Requires Supabase credentials before dev
- ⚠️ No local Supabase with Docker Compose
- ⚠️ Peer dependency warnings on install
- ⚠️ Cypress download may fail in restricted networks

### Improvements
- ✅ Excellent copilot instructions (`.github/copilot-instructions.md`)
- ✅ EditorConfig for consistent formatting
- ✅ Lefthook for git hooks
- ✅ Clear error messages for missing pnpm
- ⚠️ No Prettier config (should add)
- ⚠️ No VSCode workspace settings (should add)

---

## Key Metrics

| Metric | Value |
|--------|-------|
| Total Packages | 21 |
| Applications | 5 (api, web, pwa, ops, edge) |
| Shared Packages | 7 |
| Lines of Code | ~97,241 |
| Test Files | 175 |
| Database Migrations | 107 |
| CI/CD Workflows | 20 |
| Node Modules | ~1,459 packages (from lockfile) |
| Lockfile Size | 519 KB |

---

## Recommendations

### High Priority
1. **Resolve peer dependency warnings**: Standardize React versions
2. **Add Prettier config**: Consistent code formatting
3. **Generate coverage reports**: Track test coverage over time
4. **Add LICENSE file**: Clarify licensing
5. **Create ADRs**: Document architectural decisions

### Medium Priority
6. **Add VSCode workspace settings**: Recommended extensions and settings
7. **Simplify setup**: One-command setup with Makefile or script
8. **Local Supabase**: Docker Compose for local development
9. **Add OpenAPI spec**: Document API endpoints
10. **Improve JSDoc coverage**: Better code documentation

### Low Priority
11. **Upgrade deprecated dependencies**: eslint, workbox-window
12. **Clean up JB directory**: Remove JetBrains artifacts from git
13. **Add renovate/dependabot config**: Automated dependency updates (already has dependabot.yml)

---

**End of Repository Census**
