import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createApp } from '../../src/app.js';
import { resetCounters, getCounterSnapshot } from '../../src/observability/metrics.js';
import type { WorkspaceRepository, WorkspaceRunSummary } from '../../src/core/repositories/workspace-repository.js';
import { createSupabaseTestClient } from '../doubles/supabase-client.js';

class WorkspaceRepositoryStub implements WorkspaceRepository {
  public readonly calls: Array<{ orgId: string; limit?: number }> = [];

  constructor(private readonly runs: WorkspaceRunSummary[]) {}

  async listRecentRuns(orgId: string, limit?: number): Promise<WorkspaceRunSummary[]> {
    this.calls.push({ orgId, limit });
    return this.runs;
  }
}

describe('workspace routes', () => {
  beforeEach(() => {
    resetCounters();
  });

  afterEach(() => {
    resetCounters();
  });

  it('rejects invalid query parameters', async () => {
    const { app } = await createApp({
      supabase: createSupabaseTestClient(),
      overrides: { workspaceRepository: new WorkspaceRepositoryStub([]) },
    });

    const response = await app.inject({ method: 'GET', url: '/workspace' });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('returns workspace snapshot through layered stack with observability headers', async () => {
    const repository = new WorkspaceRepositoryStub([{ id: 'run-1' }]);
    const { app } = await createApp({
      supabase: createSupabaseTestClient(),
      overrides: { workspaceRepository: repository },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/workspace',
      query: { orgId: '00000000-0000-0000-0000-000000000000' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers).toHaveProperty('x-trace-id');
    expect(response.json()).toEqual({ runs: [{ id: 'run-1' }] });
    expect(repository.calls).toHaveLength(1);
    expect(repository.calls[0]?.orgId).toBe('00000000-0000-0000-0000-000000000000');

    const counters = getCounterSnapshot();
    const httpCounter = counters.find((entry) => entry.key.includes('http_requests_total'));
    expect(httpCounter?.value).toBeGreaterThan(0);

    await app.close();
  });
});
