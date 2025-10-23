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

describe('buildWebSearchAllowlist', () => {
  it('normalises fallback domains without truncation', () => {
    const fallback = ['Example.com', 'Test.com', 'example.com'];
    const result = buildWebSearchAllowlist({ fallback });

    expect(result.allowlist).toEqual(['example.com', 'test.com']);
    expect(result.truncated).toBe(false);
    expect(result.truncatedCount).toBe(0);
    expect(result.source).toBe('fallback');
  });

  it('truncates allowlists that exceed the maximum size', () => {
    const fallback = Array.from({ length: DEFAULT_WEB_SEARCH_ALLOWLIST_MAX + 5 }, (_, index) => `domain${index}.example`);
    const onTruncate = vi.fn();

    const result = buildWebSearchAllowlist({ fallback, maxDomains: DEFAULT_WEB_SEARCH_ALLOWLIST_MAX, onTruncate });

    expect(result.allowlist).toHaveLength(DEFAULT_WEB_SEARCH_ALLOWLIST_MAX);
    expect(result.truncated).toBe(true);
    expect(result.truncatedCount).toBe(5);
    expect(result.totalDomains).toBe(DEFAULT_WEB_SEARCH_ALLOWLIST_MAX + 5);
    expect(onTruncate).toHaveBeenCalledWith({
      truncatedCount: 5,
      totalDomains: DEFAULT_WEB_SEARCH_ALLOWLIST_MAX + 5,
      maxDomains: DEFAULT_WEB_SEARCH_ALLOWLIST_MAX,
      source: 'fallback',
    });
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
