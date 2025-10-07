import { describe, expect, it } from 'vitest';
import type { OrgAccessContext } from '../src/access-control.js';
import { ensureOrgAccessCompliance } from '../src/access-control.js';

function makeAccess(overrides: Partial<OrgAccessContext> = {}): OrgAccessContext {
  return {
    orgId: 'org',
    userId: 'user',
    role: 'owner',
    policies: {
      confidentialMode: false,
      franceJudgeAnalyticsBlocked: true,
      mfaRequired: false,
      ipAllowlistEnforced: false,
      consentRequirement: null,
      councilOfEuropeRequirement: null,
    },
    rawPolicies: {},
    entitlements: new Map(),
    ipAllowlistCidrs: [],
    consent: { requirement: null, latest: null },
    councilOfEurope: { requirement: null, acknowledgedVersion: null },
    ...overrides,
    policies: {
      ...{
        confidentialMode: false,
        franceJudgeAnalyticsBlocked: true,
        mfaRequired: false,
        ipAllowlistEnforced: false,
        consentRequirement: null,
        councilOfEuropeRequirement: null,
      },
      ...(overrides.policies ?? {}),
    },
    consent: { ...{ requirement: null, latest: null }, ...(overrides.consent ?? {}) },
    councilOfEurope: {
      ...{ requirement: null, acknowledgedVersion: null },
      ...(overrides.councilOfEurope ?? {}),
    },
  };
}

describe('ensureOrgAccessCompliance', () => {
  it('allows compliant requests', () => {
    const access = makeAccess();
    expect(() =>
      ensureOrgAccessCompliance(access, { ip: '127.0.0.1', headers: {} }),
    ).not.toThrow();
  });

  it('enforces MFA when required', () => {
    const access = makeAccess({ policies: { mfaRequired: true } });
    expect(() =>
      ensureOrgAccessCompliance(access, { ip: '127.0.0.1', headers: {} }),
    ).toThrowError(/mfa_required/);

    expect(() =>
      ensureOrgAccessCompliance(access, { ip: '127.0.0.1', headers: { 'x-auth-strength': 'mfa' } }),
    ).not.toThrow();
  });

  it('enforces IP allowlists', () => {
    const access = makeAccess({
      policies: { ipAllowlistEnforced: true },
      ipAllowlistCidrs: ['127.0.0.1/32'],
    });

    expect(() =>
      ensureOrgAccessCompliance(access, { ip: '10.0.0.1', headers: {} }),
    ).toThrowError(/ip_not_allowed/);

    expect(() =>
      ensureOrgAccessCompliance(access, { ip: '127.0.0.1', headers: {} }),
    ).not.toThrow();
  });

  it('requires consent acknowledgement when version differs', () => {
    const access = makeAccess({
      policies: { consentRequirement: { type: 'ai_assist', version: '2024-09' } },
      consent: {
        requirement: { type: 'ai_assist', version: '2024-09' },
        latest: { type: 'ai_assist', version: '2024-08' },
      },
    });

    expect(() => ensureOrgAccessCompliance(access, { ip: '127.0.0.1', headers: {} })).toThrowError(
      /consent_required/,
    );

    const accepted = makeAccess({
      policies: { consentRequirement: { type: 'ai_assist', version: '2024-09' } },
      consent: {
        requirement: { type: 'ai_assist', version: '2024-09' },
        latest: { type: 'ai_assist', version: '2024-09' },
      },
    });

    expect(() => ensureOrgAccessCompliance(accepted, { ip: '127.0.0.1', headers: {} })).not.toThrow();
  });

  it('requires Council of Europe disclosure acknowledgement when configured', () => {
    const access = makeAccess({
      policies: { councilOfEuropeRequirement: { version: '1.0.0', documentUrl: null } },
      councilOfEurope: { requirement: { version: '1.0.0', documentUrl: null }, acknowledgedVersion: null },
    });

    expect(() => ensureOrgAccessCompliance(access, { ip: '127.0.0.1', headers: {} })).toThrowError(
      /coe_disclosure_required/,
    );

    const acknowledged = makeAccess({
      policies: { councilOfEuropeRequirement: { version: '1.0.0', documentUrl: null } },
      councilOfEurope: {
        requirement: { version: '1.0.0', documentUrl: null },
        acknowledgedVersion: '1.0.0',
      },
    });

    expect(() => ensureOrgAccessCompliance(acknowledged, { ip: '127.0.0.1', headers: {} })).not.toThrow();
  });
});
