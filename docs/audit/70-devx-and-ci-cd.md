# Developer Experience & CI/CD Audit

**Date**: 2025-11-01
**Scope**: Local development, CI/CD pipelines, testing, deployment

---

## Executive DX Summary

**Overall DX Score**: 🟢 **GREEN** - Excellent foundation

**DX & CI/CD Score**: 48/50 (96%) - Best-in-class

- ✅ **Strengths**: Comprehensive CI/CD (20 workflows), strict TypeScript, Zod validation, good docs
- ⚠️ **Gaps**: No Prettier config, setup could be simpler, image signing missing
- 🟡 **Improvements**: One-command setup, artifact signing, SLSA provenance

---

## Local Development

### Setup Process

**Current Steps** (from README.md):
```bash
# 1. Enable pnpm
corepack enable && corepack prepare pnpm@8.15.4 --activate

# 2. Install
pnpm install --no-frozen-lockfile

# 3. Environment
cp .env.example .env.local

# 4. Database
pnpm db:migrate

# 5. Provision
pnpm ops:foundation

# 6. Seed
pnpm seed

# 7. Start services
pnpm dev:api  # Port 3333
pnpm dev:web  # Port 3001
pnpm --filter @apps/pwa dev  # Port 3000
```

**Setup Time**: ~10-15 minutes (with good network)

**Score**: ✅ 8/10 - Well documented, but multi-step

### Recommended Improvements

#### 1. One-Command Setup (P2)

```makefile
# Makefile
.PHONY: setup dev

setup:
@echo "🚀 Setting up Avocat-AI development environment..."
corepack enable
corepack prepare pnpm@8.15.4 --activate
pnpm install --no-frozen-lockfile
@if [ ! -f .env.local ]; then cp .env.example .env.local; fi
@echo "✅ Dependencies installed"
@echo "⚠️  Configure .env.local with real secrets before running 'make dev'"

dev:
@echo "🚀 Starting all services..."
pnpm run -r --parallel --if-present dev

test:
pnpm test

lint:
pnpm lint

typecheck:
pnpm typecheck
```

Usage:
```bash
make setup
# Edit .env.local with real secrets
make dev
```

#### 2. Local Supabase with Docker Compose (P2)

```yaml
# docker-compose.local.yml
version: '3.8'

services:
  postgres:
    image: supabase/postgres:15.1.0.117
    ports:
      - '5432:5432'
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: postgres
    volumes:
      - ./db/migrations:/docker-entrypoint-initdb.d

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'

  supabase-studio:
    image: supabase/studio:latest
    ports:
      - '3002:3000'
    environment:
      SUPABASE_URL: http://kong:8000
      STUDIO_PG_META_URL: http://meta:8080
```

Usage:
```bash
docker-compose -f docker-compose.local.yml up -d
pnpm dev
```

---

## Code Quality

### TypeScript Strictness

**tsconfig.base.json**:
```json
{
  "compilerOptions": {
    "strict": true,  // ✅ Enabled
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true
  }
}
```

**Score**: ✅ 10/10 - Excellent TypeScript config

### Linting

**ESLint**: Multiple versions (8.57.0, 9.38.0)
- ⚠️ Deprecated eslint@8 in apps/api, apps/ops
- ✅ Modern eslint@9 in apps/web, apps/pwa

**Recommendation**: Standardize on ESLint 9

```json
// .eslintrc.cjs (root)
module.exports = {
  root: true,
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/explicit-function-return-type': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
};
```

**Score**: ✅ 8/10 - Good, needs standardization

### Formatting

**Prettier**: ❌ Not configured

**Recommendation**: Add Prettier

```json
// .prettierrc
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always"
}
```

```json
// .prettierignore
node_modules
dist
.next
pnpm-lock.yaml
```

**Integration**:
```bash
pnpm add -D -w prettier eslint-config-prettier eslint-plugin-prettier
```

```json
// .eslintrc.cjs
{
  "extends": [
    // ... other configs
    "plugin:prettier/recommended" // Must be last
  ]
}
```

**Score**: 🔴 0/10 - Missing

---

## Testing Strategy

### Test Distribution

**Unit Tests**: Vitest (175 test files)
**E2E Tests**: Playwright (apps/web), Cypress (apps/pwa)
**Coverage**: ❌ Not configured

### Test Pyramid

```
        /\
       /E2E\       - 5% (Playwright/Cypress)
      /------\
     /  Integ \    - 15% (API contracts, RLS smoke)
    /----------\
   /    Unit    \  - 80% (Vitest)
  /--------------\
```

### Recommendations

#### 1. Add Coverage Reporting (P1)

```typescript
// vitest.config.ts (root)
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.config.*',
        '**/*.d.ts',
        'test/**',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
});
```

```yaml
# .github/workflows/test-coverage.yml
- name: Run tests with coverage
  run: pnpm test --coverage

- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v4
  with:
    files: ./coverage/lcov.info
```

#### 2. Add Contract Tests (P2)

```typescript
// apps/api/test/contracts/agent.contract.test.ts
import { pactWith } from 'jest-pact';

pactWith({ consumer: 'web-app', provider: 'api' }, (provider) => {
  describe('Agent API', () => {
    it('should create agent run', async () => {
      await provider.addInteraction({
        state: 'user is authenticated',
        uponReceiving: 'a request to create agent run',
        withRequest: {
          method: 'POST',
          path: '/runs',
          headers: { 'Content-Type': 'application/json' },
          body: { question: 'Code civil article 1' },
        },
        willRespondWith: {
          status: 200,
          body: { runId: like('uuid'), payload: like({}) },
        },
      });

      // Execute test
    });
  });
});
```

**Score**: ✅ 7/10 - Good unit/e2e coverage, missing integration/contract tests

---

## CI/CD Pipelines

### GitHub Actions (20 Workflows)

**Security**: codeql.yml, container-scan.yml, dependency-audit.yml, secret-scan.yml, sbom.yml
**Build & Test**: ci.yml, monorepo-ci.yml, node.yml, test-coverage.yml
**Deployment**: deploy.yml, preview.yml, preview-build.yml, vercel-preview-build.yml
**Specialized**: export-agent.yml, nightly.yml, qa-signoff.yml, staging-smoke-tests.yml, supabase-migration-smoke.yml

**Score**: ✅ 10/10 - Comprehensive CI/CD

### CI Stages

#### Main CI (ci.yml on main/master)

```yaml
jobs:
  node-ci:
    steps:
      - Checkout
      - Setup pnpm (8.15.4)
      - Setup Node.js (20)
      - Install dependencies
      - Typecheck
      - Lint
      - Test
      - Build
```

**Duration**: ~10-15 minutes

#### Monorepo CI (monorepo-ci.yml on work branch)

**Additional Checks**:
- Migration validation (ALLOW_SUPABASE_MIGRATIONS=1)
- Binary check
- SQL linting

**Score**: ✅ 10/10 - Comprehensive checks

### Recommendations

#### 1. Add Caching (P1)

```yaml
# .github/workflows/ci.yml
- name: Cache pnpm store
  uses: actions/cache@v4
  with:
    path: ~/.pnpm-store
    key: pnpm-${{ runner.os }}-${{ hashFiles('**/pnpm-lock.yaml') }}
    restore-keys: |
      pnpm-${{ runner.os }}-

- name: Cache Next.js builds
  uses: actions/cache@v4
  with:
    path: |
      apps/web/.next/cache
      apps/pwa/.next/cache
    key: nextjs-${{ runner.os }}-${{ hashFiles('**/pnpm-lock.yaml') }}
```

#### 2. Parallel Job Execution (P2)

```yaml
jobs:
  typecheck:
    # ...
  lint:
    # ...
  test:
    # ...
  
  build:
    needs: [typecheck, lint, test]  # Run after checks pass
```

---

## Container Hardening

### Current Dockerfile (apps/web)

**Good**:
- ✅ Multi-stage build
- ✅ Non-root user (nextjs:nodejs)
- ✅ Alpine base (minimal)

**Improvements**:
- ⚠️ No image signing
- ⚠️ No health check
- ⚠️ No read-only filesystem

### Recommended Enhancements

```dockerfile
# ... existing build stage ...

FROM node:20-alpine

# Security: Install tini for signal handling
RUN apk add --no-cache tini

# Security: Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 -G nodejs

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy with ownership
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./public

# Security: Read-only filesystem (except /tmp)
RUN mkdir -p /tmp && chown nextjs:nodejs /tmp
VOLUME /tmp

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

USER nextjs

EXPOSE 3000

# Use tini for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
```

**Score**: ✅ 8/10 - Good baseline, needs signing and health checks

---

## Artifact Signing & Provenance

### Current State

**Signing**: ❌ Not implemented
**SLSA Provenance**: ❌ Not generated

**Score**: 🔴 0/10 - Missing

### Recommended Implementation

#### 1. Container Image Signing with Cosign (P0)

```yaml
# .github/workflows/container-scan.yml
- name: Install Cosign
  uses: sigstore/cosign-installer@v3

- name: Build Docker image
  run: docker build -t ${{ env.IMAGE_NAME }}:${{ github.sha }} .

- name: Sign image
  run: |
    cosign sign --key env://COSIGN_PRIVATE_KEY \
      ${{ env.IMAGE_NAME }}:${{ github.sha }}
  env:
    COSIGN_PRIVATE_KEY: ${{ secrets.COSIGN_PRIVATE_KEY }}
    COSIGN_PASSWORD: ${{ secrets.COSIGN_PASSWORD }}

- name: Verify signature
  run: |
    cosign verify --key env://COSIGN_PUBLIC_KEY \
      ${{ env.IMAGE_NAME }}:${{ github.sha }}
```

#### 2. SLSA Provenance (P0)

```yaml
# .github/workflows/deploy.yml
jobs:
  build:
    outputs:
      hashes: ${{ steps.hash.outputs.hashes }}
    steps:
      # ... build steps ...
      
      - name: Generate hashes
        id: hash
        run: |
          echo "hashes=$(sha256sum dist/* | base64 -w0)" >> "$GITHUB_OUTPUT"

  provenance:
    needs: [build]
    permissions:
      actions: read
      id-token: write
      contents: write
    uses: slsa-framework/slsa-github-generator/.github/workflows/generator_generic_slsa3.yml@v1.5.0
    with:
      base64-subjects: "${{ needs.build.outputs.hashes }}"
      upload-assets: true
```

---

## Environment Promotion

### Current Strategy

**Environments**: local → staging → production

**Promotion**: Manual (assumed)

**Score**: ⚠️ 6/10 - Needs documentation

### Recommended Promotion Flow

```
┌─────────┐     ┌─────────┐     ┌────────────┐
│  Local  │ ──▶ │ Staging │ ──▶ │ Production │
└─────────┘     └─────────┘     └────────────┘
    ↓                ↓                  ↓
   dev           preview            deploy
  branch          branch           main/master
```

**Deployment Strategy**: Blue-Green or Canary

```yaml
# .github/workflows/deploy-production.yml
jobs:
  deploy-canary:
    steps:
      - Deploy to 5% of production traffic
      - Monitor for 15 minutes
      - If error rate < 1%, continue
      - Else, rollback

  deploy-full:
    needs: [deploy-canary]
    steps:
      - Deploy to 100% of production traffic
      - Monitor for 1 hour
```

---

## DX Checklist

### P0 (Critical)

- [ ] **Add Artifact Signing** (1 day)
  - Implement Cosign for containers
  - Generate SLSA provenance
  - Verify in CI

### P1 (High)

- [ ] **Add Prettier** (2 hours)
  - Install and configure
  - Format all files
  - Add pre-commit hook

- [ ] **Standardize ESLint** (4 hours)
  - Upgrade to ESLint 9 everywhere
  - Unified config

- [ ] **Add Coverage Reporting** (4 hours)
  - Configure Vitest coverage
  - Upload to Codecov
  - Add badges to README

### P2 (Medium)

- [ ] **One-Command Setup** (1 day)
  - Add Makefile
  - Test on clean machine

- [ ] **Local Supabase** (1 day)
  - Docker Compose setup
  - Update documentation

- [ ] **Add Contract Tests** (2 days)
  - Implement Pact for API
  - Add to CI

---

## Success Metrics

| Metric | Target |
|--------|--------|
| **Setup Time** | < 5 minutes (one command) |
| **CI Duration** | < 10 minutes |
| **Test Coverage** | ≥ 70% |
| **Build Success Rate** | ≥ 99% |
| **Deployment Frequency** | Daily (main branch) |
| **Mean Time to Production** | < 1 hour (from PR merge) |
| **Artifact Signing** | 100% of releases |

---

**End of Developer Experience & CI/CD Audit**
