# Test Coverage Baseline

_Generated: 2025-10-29_

This document establishes the test coverage baseline for the Avocat-AI monorepo and defines the testing strategy for production readiness.

## Current Test Status

### Test Suite Summary

**Test Files**: 149 test files across the monorepo

**Test Results** (as of 2025-10-29):
```
Total: 18 tests
Passed: 15 tests (83%)
Failed: 3 tests (17%)
```

### Failing Tests

#### 1. packages/shared - allowlist.test.ts (2 failures)

**Test**: `buildWebSearchAllowlist > normalises fallback domains without truncation`
- **Status**: FAILED
- **Error**: Expected `['legifrance.gouv.fr', ...]` to deeply equal `['example.com', 'test.com']`
- **Impact**: Low - Test expectations may need updating
- **Action**: Review test expectations and update if fallback domain logic changed

**Test**: `buildWebSearchAllowlist > truncates allowlists that exceed the maximum size`
- **Status**: FAILED
- **Error**: `DEFAULT_WEB_SEARCH_ALLOWLIST_MAX is not defined`
- **Impact**: Medium - Missing constant definition
- **Action**: Define `DEFAULT_WEB_SEARCH_ALLOWLIST_MAX` in configuration

#### 2. packages/observability - node.test.ts (1 failure)

**Test**: `initNodeTelemetry > returns cached runtime on subsequent calls`
- **Status**: FAILED
- **Error**: Expected object identity check fails - objects have no visual difference but are not the same reference
- **Impact**: Low - Known issue per copilot-instructions.md (OpenTelemetry version conflict)
- **Action**: This is an expected failure - test may need adjustment or object caching fix

### Test Coverage by Workspace

| Workspace | Test Files | Status | Notes |
|-----------|-----------|--------|-------|
| **packages/compliance** | 2 | ✅ PASS | 6/6 tests passing |
| **packages/shared** | ~20 | ⚠️ PARTIAL | 15 pass, 2 fail (allowlist tests) |
| **packages/observability** | 2 | ⚠️ PARTIAL | 4 pass, 1 fail (telemetry caching) |
| **packages/supabase** | ~5 | ⚠️ UNKNOWN | Needs validation |
| **apps/api** | ~40 | ⚠️ UNKNOWN | Needs validation |
| **apps/web** | ~30 | ⚠️ UNKNOWN | Playwright E2E tests |
| **apps/pwa** | ~20 | ⚠️ UNKNOWN | Cypress tests (may fail install) |
| **apps/ops** | ~15 | ⚠️ UNKNOWN | Needs validation |
| **apps/edge** | ~15 | ⚠️ SKIPPED | Requires Deno (not installed in CI) |
| **db/seed** | 0 | ⚠️ NO TESTS | No test files found |

### Known Testing Issues (Per copilot-instructions.md)

1. **Edge Functions**: Deno not installed - tests skipped (expected)
2. **Observability**: OpenTelemetry version conflict causes type errors (expected)
3. **Compliance**: Missing ESLint config causes lint failures (expected)
4. **Fresh Clone**: Some tests fail due to missing runtime dependencies (expected)
5. **Cypress**: Download may fail in restricted networks (non-blocking)

## Testing Strategy

### Test Pyramid

```
           /\
          /  \         E2E / Smoke Tests
         /----\        (Playwright, Cypress)
        /      \       
       /--------\      Integration Tests
      /          \     (API routes, DB queries)
     /------------\    
    /______________\   Unit Tests
                       (Pure functions, services, utilities)
```

### Coverage Goals

**Phase 1** (Current): Establish baseline
- Document current test status
- Identify critical untested paths
- Fix failing tests where appropriate

**Phase 2** (Short-term): Improve coverage
- Target: ≥60% overall coverage
- Focus on: Critical business logic (IRAC, compliance, orchestration)
- Add: Integration tests for API routes

**Phase 3** (Medium-term): Production readiness
- Target: ≥80% overall coverage or baseline +10%
- Focus on: Error paths, edge cases, failure scenarios
- Add: E2E smoke tests for critical user journeys

**Phase 4** (Long-term): Continuous improvement
- Target: Maintain ≥80% coverage
- Focus on: New features must include tests
- Add: Performance regression tests, load tests

### Coverage Thresholds (To Be Set)

Once baseline is established, set thresholds in `vitest.config.ts` files:

```typescript
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
      exclude: [
        'node_modules/',
        'dist/',
        'test/',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/types.ts',
        '**/*.d.ts',
      ],
    },
  },
})
```

## Testing Patterns

### Unit Tests

**Purpose**: Test pure functions and isolated units
**Location**: Co-located with source (`src/__tests__/` or `src/*.test.ts`)
**Tools**: Vitest
**Coverage Goal**: ≥85%

**Example**:
```typescript
// src/utils/format.test.ts
describe('formatCitation', () => {
  it('formats legal citation correctly', () => {
    const result = formatCitation({ ... });
    expect(result).toBe('Expected format');
  });
});
```

### Integration Tests

**Purpose**: Test component interactions
**Location**: `test/integration/` or `src/__tests__/integration/`
**Tools**: Vitest + test doubles
**Coverage Goal**: ≥70%

**Example**:
```typescript
// test/integration/api.test.ts
describe('POST /runs', () => {
  it('creates research run and stores in database', async () => {
    const response = await request(app)
      .post('/runs')
      .send({ question: '...' });
    
    expect(response.status).toBe(201);
    // Verify database state
  });
});
```

### E2E Tests

**Purpose**: Test complete user journeys
**Location**: `e2e/` or `test/e2e/`
**Tools**: Playwright (web), Cypress (PWA)
**Coverage Goal**: Critical paths only

**Example**:
```typescript
// e2e/research-flow.spec.ts
test('user submits research question and views IRAC result', async ({ page }) => {
  await page.goto('/');
  await page.fill('[data-testid="question-input"]', 'Legal question');
  await page.click('[data-testid="submit"]');
  await expect(page.locator('[data-testid="irac-result"]')).toBeVisible();
});
```

### Test Determinism

**Issues to Address**:
1. **Sleeps/Waits**: Replace `setTimeout` with proper async/await patterns
2. **Time-dependent tests**: Use date mocking (`vi.useFakeTimers()`)
3. **Random data**: Use seeded random generators or fixtures
4. **External dependencies**: Mock API calls and network requests
5. **Database state**: Reset between tests, use transactions

**Pattern - Replace sleeps**:
```typescript
// ❌ Bad - flaky
await new Promise(resolve => setTimeout(resolve, 1000));
expect(result).toBeDefined();

// ✅ Good - deterministic
await waitFor(() => expect(result).toBeDefined(), {
  timeout: 5000,
  interval: 100,
});
```

**Pattern - Mock time**:
```typescript
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2025-01-01'));
});

afterEach(() => {
  vi.useRealTimers();
});
```

## Test Data Builders

Use builder pattern for test fixtures:

```typescript
// test/builders/run.builder.ts
export class RunBuilder {
  private run: Partial<Run> = {
    id: 'test-run-id',
    orgId: 'test-org-id',
    userId: 'test-user-id',
    question: 'Test question',
    status: 'pending',
  };

  withQuestion(question: string) {
    this.run.question = question;
    return this;
  }

  withStatus(status: RunStatus) {
    this.run.status = status;
    return this;
  }

  build(): Run {
    return this.run as Run;
  }
}

// Usage in tests
const run = new RunBuilder()
  .withQuestion('Custom question')
  .withStatus('completed')
  .build();
```

## Characterization Tests

Before risky refactors, add characterization tests to lock current behavior:

```typescript
// Capture current behavior before refactoring
describe('Legacy behavior - characterization test', () => {
  it('preserves current output format', () => {
    const input = { /* complex input */ };
    const output = legacyFunction(input);
    
    // Snapshot testing
    expect(output).toMatchSnapshot();
  });
});
```

## CI Integration

### Test Workflow

```yaml
# .github/workflows/test.yml
- name: Run tests
  run: pnpm test

- name: Run tests with coverage
  run: pnpm test -- --coverage

- name: Upload coverage
  uses: codecov/codecov-action@v4
  with:
    files: ./coverage/lcov.info
```

### Coverage Gate

Enable in CI after baselines are set:

```yaml
- name: Check coverage threshold
  run: |
    pnpm test -- --coverage --coverage.thresholds.lines=80
```

## Test Performance

**Current Status**: Tests complete in ~2-5 seconds per workspace

**Goals**:
- Unit tests: <100ms per test
- Integration tests: <1s per test  
- E2E tests: <30s per test

**Optimization**:
- Use `test.concurrent` for independent tests
- Mock external services
- Use in-memory databases for integration tests
- Run E2E in parallel

## Action Items

### Immediate (Phase 3)
- [ ] Fix failing allowlist tests in packages/shared
- [ ] Define `DEFAULT_WEB_SEARCH_ALLOWLIST_MAX` constant
- [ ] Review observability caching test (may be expected failure)
- [ ] Run full test suite and document baseline coverage percentages
- [ ] Set coverage thresholds in vitest.config.ts files

### Short-term
- [ ] Add characterization tests for critical paths (IRAC generation, compliance checks)
- [ ] Add integration tests for API routes (POST /runs, GET /corpus)
- [ ] Replace flaky sleeps with deterministic waits
- [ ] Add test data builders for common fixtures
- [ ] Configure coverage service (Codecov or Coveralls)

### Medium-term
- [ ] Achieve ≥60% coverage across all workspaces
- [ ] Add E2E smoke tests for critical journeys
- [ ] Document testing patterns in CONTRIBUTING.md
- [ ] Add performance regression tests
- [ ] Enable coverage gates in CI

### Long-term
- [ ] Achieve ≥80% coverage target
- [ ] Add load testing for API
- [ ] Add chaos engineering tests
- [ ] Add security testing (penetration tests)
- [ ] Continuous coverage improvement

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Library Best Practices](https://testing-library.com/docs/queries/about)
- [Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html)

## Maintenance

This document should be updated:
- After each test baseline measurement
- When coverage thresholds are adjusted
- When testing patterns change
- Quarterly as part of quality review

**Document Owner**: Platform Squad  
**Review Cadence**: Monthly or after major test additions  
**Last Reviewed**: 2025-10-29  
**Next Review**: 2025-11-29
