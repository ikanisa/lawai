import { describe, expect, it } from 'vitest';
import { summariseLearningResponse } from '../src/learning-worker.js';

describe('learning worker summary', () => {
  it('summarises processed jobs and highlights errors', () => {
    const summary = summariseLearningResponse({
      processed: ['job-1', 'job-2'],
      reports: [
        { orgId: 'org-1', drift: { inserted: true } },
        { orgId: 'org-2', error: 'timeout' },
        { orgId: 'org-4', fairness: { inserted: true } },
      ],
      queue: [
        { orgId: 'org-3', queue: { inserted: true } },
      ],
    });

    expect(summary).toContain('Jobs traités: 2');
    expect(summary).toContain('Rapports nocturnes: 2');
    expect(summary).toContain('Rapports équité: 1');
    expect(summary).toContain('Snapshots de file: 1');
    expect(summary).toContain('Erreurs: org-2: timeout');
  });
});
