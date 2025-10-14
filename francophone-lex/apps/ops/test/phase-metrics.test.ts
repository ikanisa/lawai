import { describe, expect, it } from 'vitest';
import { summariseAdapterFreshness, summariseJurisdictionCoverage } from '../src/lib/phase-metrics.js';

describe('summariseJurisdictionCoverage', () => {
  it('counts coverage and flags missing jurisdictions', () => {
    const rows = [
      { jurisdiction_code: 'FR' },
      { jurisdiction_code: 'fr' },
      { jurisdiction_code: 'OHADA' },
      { jurisdiction_code: null },
    ];
    const summary = summariseJurisdictionCoverage(rows, ['FR', 'OHADA', 'BE']);
    expect(summary.coverage.FR).toBe(2);
    expect(summary.coverage.OHADA).toBe(1);
    expect(summary.missing).toEqual(['BE']);
  });
});

describe('summariseAdapterFreshness', () => {
  it('detects missing adapters', () => {
    const summary = summariseAdapterFreshness([], ['alpha', 'beta'], 48);
    expect(summary.missing).toEqual(['alpha', 'beta']);
  });

  it('reports stale adapters when the last run is too old', () => {
    const runs = [
      { adapter_id: 'alpha', finished_at: '2024-01-05T00:00:00Z' },
      { adapter_id: 'alpha', finished_at: '2024-01-04T00:00:00Z' },
    ];
    const summary = summariseAdapterFreshness(runs, ['alpha'], 24);
    expect(summary.missing).toEqual([]);
    expect(summary.stale[0].adapterId).toBe('alpha');
    expect(summary.stale[0].lastRun).toBe('2024-01-05T00:00:00Z');
  });

  it('ignores adapters that have a fresh run', () => {
    const runs = [
      { adapter_id: 'alpha', finished_at: new Date().toISOString() },
    ];
    const summary = summariseAdapterFreshness(runs, ['alpha'], 72);
    expect(summary.missing).toEqual([]);
    expect(summary.stale).toHaveLength(0);
  });
});
