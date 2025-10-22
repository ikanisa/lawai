import { describe, expect, it } from 'vitest';
import {
  buildWebSearchAllowlist,
  getJurisdictionsForDomain,
  isDomainAllowlisted,
  OFFICIAL_DOMAIN_ALLOWLIST,
} from '../src/constants/allowlist.js';

describe('isDomainAllowlisted', () => {
  it('accepts allowlisted domain', () => {
    expect(isDomainAllowlisted('https://legifrance.gouv.fr/code')).toBe(true);
  });

  it('rejects unknown domain', () => {
    expect(isDomainAllowlisted('https://example.com')).toBe(false);
  });

  it('supports subdomains', () => {
    expect(isDomainAllowlisted('https://legislation.legifrance.gouv.fr')).toBe(true);
  });
});

describe('getJurisdictionsForDomain', () => {
  it('maps domains to jurisdictions', () => {
    expect(getJurisdictionsForDomain('legifrance.gouv.fr')).toEqual(['FR']);
    expect(getJurisdictionsForDomain('justice.justel.fgov.be')).toEqual(['BE']);
  });

  it('returns empty array for unknown domain', () => {
    expect(getJurisdictionsForDomain('example.com')).toEqual([]);
  });

  it('covers all allowlisted entries', () => {
    for (const domain of OFFICIAL_DOMAIN_ALLOWLIST) {
      expect(getJurisdictionsForDomain(domain).length).toBeGreaterThan(0);
    }
  });
});

describe('buildWebSearchAllowlist', () => {
  it('uses the base allowlist by default', () => {
    const result = buildWebSearchAllowlist();
    expect(result.allowlist.length).toBeGreaterThan(0);
    expect(result.source).toBe('base');
    expect(result.total).toBe(OFFICIAL_DOMAIN_ALLOWLIST.length);
  });

  it('prefers overrides when provided', () => {
    const override = ['example.com', 'https://sub.domain.test/path'];
    const result = buildWebSearchAllowlist({ override });
    expect(result.allowlist).toEqual(['example.com', 'sub.domain.test']);
    expect(result.source).toBe('override');
  });

  it('enforces the 20-domain limit and reports truncation', () => {
    const override = Array.from({ length: 25 }, (_, index) => `override-${index}.example.org`);
    const result = buildWebSearchAllowlist({ override, limit: 20 });
    expect(result.allowlist).toHaveLength(20);
    expect(result.truncated).toBe(true);
    expect(result.truncatedDomains).toEqual(override.slice(20));
    expect(result.total).toBe(25);
    expect(result.limit).toBe(20);
  });

  it('ignores invalid values and duplicates', () => {
    const override = [
      'valid.example',
      'VALID.example',
      '   valid.example   ',
      'https://valid.example/path',
      '',
      'nota host',
      42,
    ];
    const result = buildWebSearchAllowlist({ override: override as unknown[] });
    expect(result.allowlist).toEqual(['valid.example']);
    expect(result.truncated).toBe(false);
    expect(result.total).toBe(1);
  });
});
