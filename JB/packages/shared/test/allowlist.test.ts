import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_WEB_SEARCH_ALLOWLIST_MAX,
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
