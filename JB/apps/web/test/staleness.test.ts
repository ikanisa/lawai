import { describe, expect, it } from 'vitest';
import { daysSince, isDateStale } from '../src/lib/staleness';

describe('staleness utilities', () => {
  const now = new Date('2024-06-01T00:00:00Z').getTime();

  it('flags values as stale when offline', () => {
    expect(isDateStale('2024-05-30', { offline: true, now })).toBe(true);
  });

  it('detects stale values beyond the threshold', () => {
    expect(isDateStale('2023-06-01', { thresholdDays: 30, now })).toBe(true);
  });

  it('keeps recent values as fresh', () => {
    expect(isDateStale('2024-05-25', { thresholdDays: 30, now })).toBe(false);
  });

  it('handles invalid dates as stale', () => {
    expect(isDateStale('invalid-date', { now })).toBe(true);
  });

  it('computes days since', () => {
    expect(daysSince('2024-05-01', now)).toBe(31);
    expect(daysSince('invalid', now)).toBeNull();
  });
});

