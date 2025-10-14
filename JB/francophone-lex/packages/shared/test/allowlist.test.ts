import { describe, expect, it } from 'vitest';
import { getJurisdictionsForDomain, isDomainAllowlisted, OFFICIAL_DOMAIN_ALLOWLIST } from '../src/constants/allowlist.js';

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
