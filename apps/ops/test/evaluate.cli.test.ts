import { describe, expect, it, vi } from 'vitest';
import type { EvaluationDataSource, EvaluationResultRecord } from '../src/evaluate.js';
import { runEvaluation } from '../src/evaluate.js';

describe('runEvaluation', () => {
  const payload = {
    id: 'case-1',
    name: 'Test case',
    prompt: 'Quelle est la loi applicable ?',
    expected_contains: ['loi'],
  };

  const iracPayload = {
    issue: 'Issue',
    application: 'Application',
    conclusion: 'Conclusion',
    rules: [{ citation: 'R1', source_url: 'https://example.com/rule' }],
    citations: [
      {
        title: 'Loi',
        court_or_publisher: 'CN',
        url: 'https://legifrance.gouv.fr',
        note: null,
      },
    ],
    risk: { level: 'LOW', why: 'Test' },
    jurisdiction: { country: 'FR' },
  };

  it('evaluates cases and records results', async () => {
    const recorded: EvaluationResultRecord[] = [];
    const dataSource: EvaluationDataSource = {
      loadCases: vi.fn(async () => [payload]),
      recordResult: vi.fn(async (record) => {
        recorded.push(record);
      }),
      loadLinkHealth: vi.fn(async () => ({
        totalSources: 5,
        failedSources: 0,
        staleSources: 0,
        failureRatio: 0,
      })),
    };

    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({ runId: 'run-1', data: iracPayload }),
        { status: 200 },
      ),
    );

    const summary = await runEvaluation(
      {
        orgId: 'org',
        userId: 'user',
        apiBaseUrl: 'http://localhost:3000',
        limit: 1,
        dryRun: false,
        ciMode: true,
        benchmark: null,
      },
      {
        dataSource,
        fetchImpl,
        retries: 2,
        retryDelayMs: 10,
        logger: console,
      },
    );

    expect(summary.passed).toBe(1);
    expect(recorded).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalled();
  });

  it('retries transient failures', async () => {
    const dataSource: EvaluationDataSource = {
      loadCases: vi.fn(async () => [payload]),
      recordResult: vi.fn(async () => {}),
      loadLinkHealth: vi.fn(async () => null),
    };

    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ runId: 'run-1', data: iracPayload }), { status: 200 }),
      );

    const summary = await runEvaluation(
      {
        orgId: 'org',
        userId: 'user',
        apiBaseUrl: 'http://localhost:3000',
        limit: 1,
        dryRun: false,
        ciMode: true,
        benchmark: null,
      },
      {
        dataSource,
        fetchImpl,
        retries: 2,
        retryDelayMs: 0,
        logger: console,
        onRetry: vi.fn(),
      },
    );

    expect(summary.passed).toBe(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('captures API failures', async () => {
    const dataSource: EvaluationDataSource = {
      loadCases: vi.fn(async () => [payload]),
      recordResult: vi.fn(async () => {}),
      loadLinkHealth: vi.fn(async () => null),
    };

    const fetchImpl = vi.fn(async () => new Response(null, { status: 500 }));

    const summary = await runEvaluation(
      {
        orgId: 'org',
        userId: 'user',
        apiBaseUrl: 'http://localhost:3000',
        limit: 1,
        dryRun: false,
        ciMode: true,
        benchmark: null,
      },
      {
        dataSource,
        fetchImpl,
        retries: 1,
        retryDelayMs: 0,
        logger: console,
      },
    );

    expect(summary.failed).toBe(1);
    expect(summary.errors[0]).toContain('API 500');
  });
});
