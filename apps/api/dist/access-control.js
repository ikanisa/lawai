import { createServiceClient } from '@avocat-ai/supabase';
import ipaddr from 'ipaddr.js';
import { env } from './config.js';
const PERMISSIONS = {
    'runs:execute': ['owner', 'admin', 'member', 'reviewer'],
    'metrics:view': ['owner', 'admin', 'compliance_officer', 'auditor'],
    'metrics:baseline': ['owner', 'admin', 'compliance_officer'],
    'metrics:slo': ['owner', 'admin', 'compliance_officer', 'auditor'],
    'workspace:view': ['owner', 'admin', 'member', 'reviewer', 'viewer', 'compliance_officer', 'auditor'],
    'citations:view': ['owner', 'admin', 'member', 'reviewer', 'viewer', 'compliance_officer', 'auditor'],
    'cases:view': ['owner', 'admin', 'member', 'reviewer', 'compliance_officer', 'auditor'],
    'templates:view': ['owner', 'admin', 'member', 'reviewer'],
    'hitl:view': ['owner', 'admin', 'reviewer', 'compliance_officer', 'auditor'],
    'hitl:act': ['owner', 'admin', 'reviewer'],
    'corpus:view': ['owner', 'admin', 'member', 'reviewer', 'compliance_officer'],
    'corpus:manage': ['owner', 'admin', 'compliance_officer'],
    'search-local': ['owner', 'admin', 'member', 'reviewer'],
    'search-hybrid': ['owner', 'admin', 'member', 'reviewer'],
    'telemetry:record': ['owner', 'admin', 'member', 'reviewer', 'viewer', 'compliance_officer', 'auditor'],
    'admin:manage': ['owner', 'admin', 'compliance_officer'],
    'admin:audit': ['owner', 'admin', 'compliance_officer', 'auditor'],
    'admin:security': ['owner', 'admin', 'compliance_officer'],
    'governance:red-team': ['owner', 'admin', 'compliance_officer', 'auditor'],
    'governance:cepej': ['owner', 'admin', 'compliance_officer', 'auditor'],
    'governance:transparency': ['owner', 'admin', 'compliance_officer'],
    'governance:dispatch': ['owner', 'admin', 'compliance_officer'],
    'governance:go-no-go': ['owner', 'admin', 'compliance_officer'],
    'governance:go-no-go-signoff': ['owner', 'compliance_officer'],
    'orchestrator:command': ['owner', 'admin', 'member', 'reviewer'],
    'orchestrator:admin': ['owner', 'admin', 'compliance_officer'],
};
const supabase = createServiceClient({
    SUPABASE_URL: env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
});
async function fetchMembership(orgId, userId) {
    const { data, error } = await supabase
        .from('org_members')
        .select('role')
        .eq('org_id', orgId)
        .eq('user_id', userId)
        .maybeSingle();
    if (error) {
        throw new Error(error.message);
    }
    if (!data) {
        return null;
    }
    return data.role;
}
async function fetchPolicies(orgId) {
    const { data, error } = await supabase.from('org_policies').select('key, value').eq('org_id', orgId);
    if (error) {
        throw new Error(error.message);
    }
    const record = {};
    for (const row of data ?? []) {
        record[row.key] = row.value;
    }
    return record;
}
async function fetchEntitlements(orgId) {
    const { data, error } = await supabase
        .from('jurisdiction_entitlements')
        .select('juris_code, can_read, can_write')
        .eq('org_id', orgId);
    if (error) {
        throw new Error(error.message);
    }
    const map = new Map();
    for (const row of data ?? []) {
        map.set(row.juris_code, {
            canRead: Boolean(row.can_read),
            canWrite: Boolean(row.can_write),
        });
    }
    return map;
}
async function fetchIpAllowlist(orgId) {
    const { data, error } = await supabase
        .from('ip_allowlist_entries')
        .select('cidr')
        .eq('org_id', orgId);
    if (error) {
        throw new Error(error.message);
    }
    return (data ?? [])
        .map((row) => String(row.cidr))
        .filter((cidr) => typeof cidr === 'string' && cidr.length > 0);
}
async function fetchLatestConsent(orgId, userId, consentType) {
    if (!consentType) {
        return null;
    }
    const { data, error } = await supabase
        .from('consent_events')
        .select('version, consent_type')
        .eq('org_id', orgId)
        .eq('user_id', userId)
        .eq('consent_type', consentType)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (error) {
        throw new Error(error.message);
    }
    if (!data?.version) {
        return null;
    }
    return {
        version: data.version,
        type: data.consent_type ?? consentType,
    };
}
function parseConsentPolicy(value) {
    if (typeof value === 'string') {
        return { type: 'ai_assist', version: value };
    }
    if (value && typeof value === 'object') {
        const record = value;
        const version = typeof record.version === 'string' ? record.version : null;
        const type = typeof record.type === 'string' ? record.type : 'ai_assist';
        return version ? { version, type } : null;
    }
    return null;
}
function parseCouncilPolicy(value) {
    if (typeof value === 'string') {
        return { version: value };
    }
    if (value && typeof value === 'object') {
        const record = value;
        const version = typeof record.version === 'string' ? record.version : null;
        const documentUrl = typeof record.document_url === 'string' ? record.document_url : null;
        return version ? { version, documentUrl } : null;
    }
    return null;
}
function resolvePolicyFlags(policyRecord) {
    const confidential = policyRecord['confidential_mode'];
    const franceBan = policyRecord['fr_judge_analytics_block'];
    const mfaRequired = policyRecord['mfa_required'];
    const ipAllowlist = policyRecord['ip_allowlist_enforced'];
    const consentRequirement = parseConsentPolicy(policyRecord['ai_assist_consent_version']);
    const coeDisclosure = parseCouncilPolicy(policyRecord['coe_ai_framework_version']);
    const sensitiveHitl = policyRecord['sensitive_topic_hitl'];
    const residencyValue = policyRecord['residency_zone'];
    const residencyCollector = new Set();
    const collectResidency = (input) => {
        if (!input) {
            return;
        }
        if (typeof input === 'string') {
            const normalized = input.trim().toLowerCase();
            if (normalized) {
                residencyCollector.add(normalized);
            }
            return;
        }
        if (Array.isArray(input)) {
            for (const item of input) {
                collectResidency(item);
            }
            return;
        }
        if (typeof input === 'object') {
            const record = input;
            if ('value' in record)
                collectResidency(record.value);
            if ('code' in record)
                collectResidency(record.code);
            if ('values' in record)
                collectResidency(record.values);
            if ('allowed' in record)
                collectResidency(record.allowed);
            if ('zones' in record)
                collectResidency(record.zones);
        }
    };
    collectResidency(residencyValue);
    const residencyZones = residencyCollector.size > 0 ? Array.from(residencyCollector) : null;
    const primaryResidencyZone = residencyZones?.[0] ?? null;
    return {
        confidentialMode: Boolean(confidential && typeof confidential === 'object' ? confidential.enabled : confidential),
        franceJudgeAnalyticsBlocked: franceBan === undefined
            ? true
            : Boolean(typeof franceBan === 'object' ? franceBan.enabled : franceBan),
        mfaRequired: Boolean(typeof mfaRequired === 'object' ? mfaRequired.enabled : mfaRequired),
        ipAllowlistEnforced: Boolean(typeof ipAllowlist === 'object' ? ipAllowlist.enabled : ipAllowlist),
        consentRequirement,
        councilOfEuropeRequirement: coeDisclosure,
        sensitiveTopicHitl: sensitiveHitl === undefined
            ? true
            : Boolean(typeof sensitiveHitl === 'object'
                ? sensitiveHitl.enabled
                : sensitiveHitl),
        residencyZone: primaryResidencyZone,
        residencyZones,
    };
}
export async function authorizeAction(action, orgId, userId) {
    const role = await fetchMembership(orgId, userId);
    if (!role) {
        const error = new Error('membership_not_found');
        error.statusCode = 403;
        throw error;
    }
    const allowedRoles = PERMISSIONS[action] ?? [];
    if (!allowedRoles.includes(role)) {
        const error = new Error('permission_denied');
        error.statusCode = 403;
        throw error;
    }
    const [policies, entitlements, ipAllowlistCidrs] = await Promise.all([
        fetchPolicies(orgId),
        fetchEntitlements(orgId),
        fetchIpAllowlist(orgId),
    ]);
    const flags = resolvePolicyFlags(policies);
    const consentRequirement = flags.consentRequirement;
    const councilRequirement = flags.councilOfEuropeRequirement;
    const [latestConsent, latestCouncil] = await Promise.all([
        consentRequirement ? fetchLatestConsent(orgId, userId, consentRequirement.type) : Promise.resolve(null),
        councilRequirement?.version ? fetchLatestConsent(orgId, userId, 'council_of_europe_disclosure') : Promise.resolve(null),
    ]);
    return {
        orgId,
        userId,
        role,
        policies: flags,
        rawPolicies: policies,
        entitlements,
        ipAllowlistCidrs,
        consent: {
            requirement: consentRequirement,
            latest: latestConsent,
        },
        councilOfEurope: {
            requirement: councilRequirement,
            acknowledgedVersion: latestCouncil?.version ?? null,
        },
    };
}
export function isJurisdictionAllowed(entitlements, jurisCode) {
    if (entitlements.size === 0) {
        return true;
    }
    const normalized = jurisCode.toUpperCase();
    const entry = entitlements.get(normalized) ?? entitlements.get('GLOBAL');
    if (entry) {
        return entry.canRead;
    }
    if (normalized === 'FR' || normalized === 'BE' || normalized === 'LU' || normalized === 'EU') {
        return entitlements.get('EU')?.canRead ?? entitlements.get('FR')?.canRead ?? false;
    }
    if (normalized === 'OHADA') {
        return entitlements.get('OHADA')?.canRead ?? false;
    }
    if (normalized === 'CA-QC') {
        return entitlements.get('CA-QC')?.canRead ?? entitlements.get('CA')?.canRead ?? false;
    }
    if (normalized === 'CH') {
        return entitlements.get('CH')?.canRead ?? false;
    }
    if (normalized === 'MA' || normalized === 'TN' || normalized === 'DZ') {
        return entitlements.get('MAGHREB')?.canRead ?? entitlements.get(normalized)?.canRead ?? false;
    }
    if (normalized === 'RW') {
        return entitlements.get('RW')?.canRead ?? false;
    }
    return true;
}
function headerValue(headers, key) {
    const value = headers[key] ?? headers[key.toLowerCase()];
    if (Array.isArray(value)) {
        return value[0] ?? null;
    }
    return typeof value === 'string' ? value : null;
}
function isIpAllowed(ip, cidrs) {
    if (!ip || cidrs.length === 0) {
        return true;
    }
    let parsedIp;
    try {
        parsedIp = ipaddr.parse(ip);
    }
    catch {
        return false;
    }
    return cidrs.some((cidr) => {
        try {
            const [range, bits] = cidr.split('/');
            const parsedRange = ipaddr.parse(range);
            const rangeKind = parsedRange.kind();
            if (parsedIp.kind() !== rangeKind) {
                return false;
            }
            return parsedIp.match(parsedRange, Number(bits ?? (rangeKind === 'ipv6' ? 128 : 32)));
        }
        catch {
            return false;
        }
    });
}
export function ensureOrgAccessCompliance(access, request) {
    const authStrength = (headerValue(request.headers, 'x-auth-strength') ?? '').toLowerCase();
    if (access.policies.mfaRequired && !['mfa', 'passkey'].includes(authStrength)) {
        const error = new Error('mfa_required');
        error.statusCode = 428;
        throw error;
    }
    if (access.policies.ipAllowlistEnforced) {
        if (access.ipAllowlistCidrs.length === 0) {
            const error = new Error('ip_allowlist_empty');
            error.statusCode = 428;
            throw error;
        }
        const clientIp = request.ip ?? '';
        if (!isIpAllowed(clientIp, access.ipAllowlistCidrs)) {
            const error = new Error('ip_not_allowed');
            error.statusCode = 403;
            throw error;
        }
    }
    const consentRequirement = access.consent.requirement;
    if (consentRequirement && (!access.consent.latest || access.consent.latest.version !== consentRequirement.version)) {
        const error = new Error('consent_required');
        error.statusCode = 428;
        throw error;
    }
    const councilRequirement = access.councilOfEurope.requirement;
    if (councilRequirement?.version && access.councilOfEurope.acknowledgedVersion !== councilRequirement.version) {
        const error = new Error('coe_disclosure_required');
        error.statusCode = 428;
        throw error;
    }
}
