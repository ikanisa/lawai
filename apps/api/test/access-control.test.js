import { describe, expect, it } from 'vitest';
import { ensureOrgAccessCompliance } from '../src/access-control.js';
function makeAccess(overrides = {}) {
    return {
        orgId: 'org',
        userId: 'user',
        role: 'owner',
        policies: {
            confidentialMode: false,
            franceJudgeAnalyticsBlocked: true,
            mfaRequired: false,
            ipAllowlistEnforced: false,
            consentVersion: null,
            councilOfEuropeDisclosureVersion: null,
        },
        rawPolicies: {},
        entitlements: new Map(),
        ipAllowlistCidrs: [],
        consent: { requiredVersion: null, latestAcceptedVersion: null },
        ...overrides,
        policies: { ...{ confidentialMode: false, franceJudgeAnalyticsBlocked: true, mfaRequired: false, ipAllowlistEnforced: false, consentVersion: null, councilOfEuropeDisclosureVersion: null }, ...(overrides.policies ?? {}) },
        consent: { ...{ requiredVersion: null, latestAcceptedVersion: null }, ...(overrides.consent ?? {}) },
    };
}
describe('ensureOrgAccessCompliance', () => {
    it('allows compliant requests', () => {
        const access = makeAccess();
        expect(() => ensureOrgAccessCompliance(access, { ip: '127.0.0.1', headers: {} })).not.toThrow();
    });
    it('enforces MFA when required', () => {
        const access = makeAccess({ policies: { mfaRequired: true } });
        expect(() => ensureOrgAccessCompliance(access, { ip: '127.0.0.1', headers: {} })).toThrowError(/mfa_required/);
        expect(() => ensureOrgAccessCompliance(access, { ip: '127.0.0.1', headers: { 'x-auth-strength': 'mfa' } })).not.toThrow();
    });
    it('enforces IP allowlists', () => {
        const access = makeAccess({
            policies: { ipAllowlistEnforced: true },
            ipAllowlistCidrs: ['127.0.0.1/32'],
        });
        expect(() => ensureOrgAccessCompliance(access, { ip: '10.0.0.1', headers: {} })).toThrowError(/ip_not_allowed/);
        expect(() => ensureOrgAccessCompliance(access, { ip: '127.0.0.1', headers: {} })).not.toThrow();
    });
    it('requires consent acknowledgement when version differs', () => {
        const access = makeAccess({
            policies: { consentVersion: '2024-09' },
            consent: { requiredVersion: '2024-09', latestAcceptedVersion: '2024-08' },
        });
        expect(() => ensureOrgAccessCompliance(access, { ip: '127.0.0.1', headers: {} })).toThrowError(/consent_required/);
        expect(() => ensureOrgAccessCompliance(access, {
            ip: '127.0.0.1',
            headers: { 'x-consent-version': '2024-09' },
        })).not.toThrow();
    });
    it('requires Council of Europe disclosure acknowledgement when configured', () => {
        const access = makeAccess({
            policies: { councilOfEuropeDisclosureVersion: '1.0.0' },
        });
        expect(() => ensureOrgAccessCompliance(access, { ip: '127.0.0.1', headers: {} })).toThrowError(/coe_disclosure_required/);
        expect(() => ensureOrgAccessCompliance(access, {
            ip: '127.0.0.1',
            headers: { 'x-coe-disclosure-version': '1.0.0' },
        })).not.toThrow();
    });
});
