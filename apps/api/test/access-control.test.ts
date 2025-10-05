import { describe, expect, it } from 'vitest';
import { ensureOrgAccessCompliance, type OrgAccessContext } from '../src/access-control.js';

type RequestContext = Parameters<typeof ensureOrgAccessCompliance>[1];

function buildAccess(overrides: Partial<OrgAccessContext> = {}): OrgAccessContext {
  return {
    orgId: 'org-1',
    userId: 'user-1',
    role: 'member',
    policies: {
      confidentialMode: false,
      franceJudgeAnalyticsBlocked: true,
      mfaRequired: false,
      ipAllowlistEnforced: false,
      consentVersion: null,
      councilOfEuropeDisclosureVersion: null,
      sensitiveTopicHitl: true,
      residencyZone: null,
    },
    rawPolicies: {},
    entitlements: new Map(),
    ipAllowlistCidrs: [],
    consent: {
      requiredVersion: null,
      latestAcceptedVersion: null,
    },
    abac: {
      jurisdictionEntitlements: new Map(),
      confidentialMode: false,
      sensitiveTopicHitl: true,
      residencyZone: null,
    },
    ...overrides,
  };
}

function buildRequest(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    ip: '203.0.113.10',
    headers: {},
    ...overrides,
  };
}

describe('ensureOrgAccessCompliance', () => {
  it('allows requests when no additional constraints apply', () => {
    expect(() => ensureOrgAccessCompliance(buildAccess(), buildRequest())).not.toThrow();
  });

  it('enforces MFA when policy requires it', () => {
    const access = buildAccess({
      policies: { ...buildAccess().policies, mfaRequired: true },
    });
    expect(() => ensureOrgAccessCompliance(access, buildRequest())).toThrowError('mfa_required');

    const compliantRequest = buildRequest({ headers: { 'x-auth-strength': 'MFA' } });
    expect(() => ensureOrgAccessCompliance(access, compliantRequest)).not.toThrow();
  });

  it('blocks non-allowlisted IPs when allowlist is enforced', () => {
    const access = buildAccess({
      policies: { ...buildAccess().policies, ipAllowlistEnforced: true },
      ipAllowlistCidrs: ['203.0.113.0/24'],
    });

    // allowed
    expect(() => ensureOrgAccessCompliance(access, buildRequest({ ip: '203.0.113.34' }))).not.toThrow();

    // denied
    expect(() => ensureOrgAccessCompliance(access, buildRequest({ ip: '198.51.100.5' }))).toThrowError(
      'ip_not_allowed',
    );
  });

  it('requires consent acknowledgement when mandated by policy', () => {
    const access = buildAccess({
      policies: { ...buildAccess().policies, consentVersion: 'v2' },
      consent: { requiredVersion: 'v2', latestAcceptedVersion: null },
    });

    expect(() => ensureOrgAccessCompliance(access, buildRequest())).toThrowError('consent_required');

    const request = buildRequest({ headers: { 'x-consent-version': 'v2' } });
    expect(() => ensureOrgAccessCompliance(access, request)).not.toThrow();
  });

  it('requires Council of Europe disclosure acknowledgement when mandated', () => {
    const access = buildAccess({
      policies: { ...buildAccess().policies, councilOfEuropeDisclosureVersion: '2024-03' },
    });

    expect(() => ensureOrgAccessCompliance(access, buildRequest())).toThrowError('coe_disclosure_required');

    const request = buildRequest({ headers: { 'x-coe-disclosure-version': '2024-03' } });
    expect(() => ensureOrgAccessCompliance(access, request)).not.toThrow();
  });

  it('fails when IP allowlist is enforced but empty', () => {
    const access = buildAccess({
      policies: { ...buildAccess().policies, ipAllowlistEnforced: true },
      ipAllowlistCidrs: [],
    });

    expect(() => ensureOrgAccessCompliance(access, buildRequest())).toThrowError('ip_allowlist_empty');
  });
});
