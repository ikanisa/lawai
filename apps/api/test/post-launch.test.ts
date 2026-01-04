import { beforeEach, describe, expect, it } from 'vitest';
import { __resetWebVitalsForTests, recordWebVital } from '../src/metrics';
import {
  __resetPostLaunchStateForTests,
  buildPhaseEReadiness,
  enqueueOfflineOutboxItem,
  listOfflineOutboxItems,
  updateOfflineOutboxStatus,
} from '../src/post-launch';
import { enqueueRegulatorDigest, __resetLaunchStateForTests } from '../src/launch';

const ORG_ID = 'org-phase-e';

function recordVital(id: string, rating: 'good' | 'needs-improvement' | 'poor') {
  recordWebVital({
    id,
    name: 'LCP',
    value: 2400,
    delta: 12,
    label: 'LCP',
    rating,
    page: '/research',
    locale: 'fr',
    navigationType: 'navigate',
    userAgent: 'vitest',
    orgId: ORG_ID,
    userId: 'user-1',
  });
}

describe('post-launch readiness', () => {
  beforeEach(() => {
    __resetWebVitalsForTests();
    __resetPostLaunchStateForTests();
    __resetLaunchStateForTests();
  });

  it('tracks offline outbox items and updates status', () => {
    const item = enqueueOfflineOutboxItem({
      orgId: ORG_ID,
      channel: 'export',
      label: 'Export décision 2024-01',
      locale: 'fr',
    });

    expect(listOfflineOutboxItems(ORG_ID)).toHaveLength(1);

    const updated = updateOfflineOutboxStatus(ORG_ID, item.id, 'syncing', '2024-02-02T00:00:00Z');
    expect(updated).not.toBeNull();
    expect(updated?.status).toBe('syncing');
    expect(updated?.lastAttemptAt).toBe('2024-02-02T00:00:00Z');
  });

  it('computes readiness with vitals, offline queue, and digests', () => {
    recordVital('vital-1', 'good');
    recordVital('vital-2', 'poor');

    enqueueOfflineOutboxItem({
      orgId: ORG_ID,
      channel: 'filing',
      label: 'Assignation offline',
      locale: 'fr',
    });

    enqueueRegulatorDigest({
      jurisdiction: 'FR',
      channel: 'email',
      frequency: 'weekly',
      recipients: ['ops@example.com'],
    });

    const readiness = buildPhaseEReadiness(ORG_ID);

    expect(readiness.orgId).toBe(ORG_ID);
    expect(readiness.vitals.total).toBe(2);
    expect(readiness.offlineOutbox.queued).toBe(1);
    expect(readiness.digests.weekly).toBeGreaterThanOrEqual(1);
    expect(readiness.actions.length).toBeGreaterThan(0);
    expect(readiness.notes.length).toBeGreaterThan(0);
  });
});
