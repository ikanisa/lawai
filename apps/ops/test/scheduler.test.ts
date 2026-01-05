import { describe, expect, it, vi } from 'vitest';
import { buildOpsScheduler } from '../src/lib/scheduler.js';

describe('buildOpsScheduler', () => {
  it('registers ingestion, evaluation, and red-team tasks', () => {
    const scheduler = buildOpsScheduler({});
    const tasks = scheduler.list();
    const ids = tasks.map((task) => task.id).sort();
    expect(ids).toEqual(['evaluation-nightly', 'gdpr-retention-nightly', 'ingestion-hourly', 'red-team-weekly']);
  });

  it('triggers ingestion handler when endpoint set', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(new Response(null, { status: 200 })));
    const scheduler = buildOpsScheduler(
      { EDGE_PROCESS_LEARNING_URL: 'https://edge.test/process-learning' },
      { fetchImpl },
    );
    await scheduler.run('ingestion-hourly');
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://edge.test/process-learning?mode=hourly',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
