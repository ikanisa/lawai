import { OFFICIAL_DOMAIN_ALLOWLIST } from '@avocat-ai/shared';
import { describe, expect, it, vi } from 'vitest';
import {
  MAX_DOMAIN_OVERRIDE_ENTRIES,
  resolveDomainAllowlistOverride,
} from '../src/allowlist-override.js';

describe('resolveDomainAllowlistOverride', () => {
  it('normalises, deduplicates, orders, and truncates override domains with telemetry', () => {
    const metric = vi.fn();
    const log = vi.fn();
    const telemetry = { metric, log } as const;

    const rawDomains = [
      'ohada.org',
      'eur-lex.europa.eu',
      'https://legifrance.gouv.fr/eli/code/123',
      'unknown.example.org',
      'OHADA.ORG',
      'cima-afrique.org',
      'oapi.int',
      'sgg.gov.ma',
      'fedlex.admin.ch',
      'legilux.public.lu',
      'https://canlii.org/en',
      'laws-lois.justice.gc.ca',
      'scc-csc.ca',
      'SCC-CSC.LEXUM.COM',
      'courdecassation.fr',
      'conseil-etat.fr',
      'moniteur.be',
      'justel.fgov.be',
      'https://ejustice.fgov.be',
      'iort.gov.tn',
      'joradp.dz',
      'legimonaco.mc',
      'legisquebec.gouv.qc.ca',
      'bger.ch',
    ];

    const result = resolveDomainAllowlistOverride(rawDomains, { telemetry });

    expect(result).toEqual(OFFICIAL_DOMAIN_ALLOWLIST.slice(0, MAX_DOMAIN_OVERRIDE_ENTRIES));
    expect(metric).toHaveBeenNthCalledWith(1, 'allowlist.override.duplicates_dropped', { count: 1 });
    expect(metric).toHaveBeenNthCalledWith(2, 'allowlist.override.unknown_dropped', { count: 1 });
    expect(metric).toHaveBeenNthCalledWith(3, 'allowlist.override.truncated', { count: 2 });
    expect(log).toHaveBeenCalledWith(
      'warn',
      'allowlist_override_pruned',
      expect.objectContaining({
        requested: rawDomains.length,
        accepted: MAX_DOMAIN_OVERRIDE_ENTRIES,
        duplicates: 1,
        unknown: 1,
        truncated: 2,
      }),
    );
  });

  it('returns null for non-array override payloads without telemetry', () => {
    const metric = vi.fn();
    const log = vi.fn();
    const telemetry = { metric, log } as const;

    expect(resolveDomainAllowlistOverride('not-an-array', { telemetry })).toBeNull();
    expect(metric).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });

  it('preserves canonical ordering without emitting telemetry when under the limit', () => {
    const metric = vi.fn();
    const log = vi.fn();
    const telemetry = { metric, log } as const;

    const subset = ['ohada.org', 'legifrance.gouv.fr', 'eur-lex.europa.eu'];
    const result = resolveDomainAllowlistOverride(subset, { telemetry });

    expect(result).toEqual([
      'legifrance.gouv.fr',
      'ohada.org',
      'eur-lex.europa.eu',
    ]);
    expect(metric).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });
});
