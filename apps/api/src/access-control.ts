import { getPermissionsMatrix } from '@avocat-ai/shared';
import { createServiceClient } from '@avocat-ai/supabase';
import ipaddr from 'ipaddr.js';
import { env } from './config.js';

type OrgRole =
  | 'owner'
  | 'admin'
  | 'member'
  | 'reviewer'
  | 'viewer'
  | 'compliance_officer'
  | 'auditor';

type PolicyRecord = Record<string, unknown>;

type OrgPolicyFlags = {
  confidentialMode: boolean;
  franceJudgeAnalyticsBlocked: boolean;
  mfaRequired: boolean;
  ipAllowlistEnforced: boolean;
  consentVersion?: string | null;
  councilOfEuropeDisclosureVersion?: string | null;
  sensitiveTopicHitl: boolean;
  residencyZone?: string | null;
};

export type OrgAccessContext = {
  orgId: string;
  userId: string;
  role: OrgRole;
  policies: OrgPolicyFlags;
  rawPolicies: PolicyRecord;
  entitlements: Map<string, { canRead: boolean; canWrite: boolean }>;
  ipAllowlistCidrs: string[];
  consent: {
    requiredVersion?: string | null;
    latestAcceptedVersion?: string | null;
  };
  abac: {
    jurisdictionEntitlements: Map<string, { canRead: boolean; canWrite: boolean }>;
    confidentialMode: boolean;
    sensitiveTopicHitl: boolean;
    residencyZone?: string | null;
  };
};

type PermissionKey =
  | 'runs:execute'
  | 'metrics:view'
  | 'metrics:baseline'
  | 'metrics:slo'
  | 'governance:cepej'
  | 'governance:transparency'
  | 'governance:dispatch'
  | 'workspace:view'
  | 'citations:view'
  | 'cases:view'
  | 'cases:manage'
  | 'templates:view'
  | 'drafts:view'
  | 'drafts:create'
  | 'hitl:view'
  | 'hitl:act'
  | 'corpus:view'
  | 'corpus:manage'
  | 'search-local'
  | 'search-hybrid'
  | 'telemetry:record'
  | 'admin:manage'
  | 'admin:audit'
  | 'admin:security'
  | 'governance:red-team'
  | 'governance:go-no-go'
  | 'governance:go-no-go-signoff'
  | 'billing:manage'
  | 'audit:read'
  | 'allowlist:toggle'
  | 'residency:change'
  | 'people:manage'
  | 'data:export-delete';

const PERMISSIONS: Record<PermissionKey, OrgRole[]> = {
  'runs:execute': ['owner', 'admin', 'member', 'reviewer'],
  'metrics:view': ['owner', 'admin', 'compliance_officer', 'auditor'],
  'metrics:baseline': ['owner', 'admin', 'compliance_officer'],
  'metrics:slo': ['owner', 'admin', 'compliance_officer', 'auditor'],
  'workspace:view': ['owner', 'admin', 'member', 'reviewer', 'viewer', 'compliance_officer', 'auditor'],
  'citations:view': ['owner', 'admin', 'member', 'reviewer', 'viewer', 'compliance_officer', 'auditor'],
  'cases:view': ['owner', 'admin', 'member', 'reviewer', 'compliance_officer', 'auditor'],
  'cases:manage': ['owner', 'admin', 'member', 'reviewer'],
  'templates:view': ['owner', 'admin', 'member', 'reviewer'],
  'drafts:view': ['owner', 'admin', 'member', 'reviewer', 'viewer', 'compliance_officer', 'auditor'],
  'drafts:create': ['owner', 'admin', 'member', 'reviewer', 'compliance_officer'],
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
  'billing:manage': ['owner'],
  'audit:read': ['owner', 'admin', 'compliance_officer', 'auditor'],
  'allowlist:toggle': ['owner', 'admin'],
  'residency:change': ['owner'],
  'people:manage': ['owner', 'admin'],
  'data:export-delete': ['owner'],
};

const MANIFEST_PERMISSION_ALIASES: Record<string, PermissionKey> = {
  'research.run': 'runs:execute',
  'drafting.edit': 'drafts:create',
  'hitl.review': 'hitl:act',
  'corpus.manage': 'corpus:manage',
  'policies.manage': 'admin:manage',
  'billing.manage': 'billing:manage',
  'audit.read': 'audit:read',
  'allowlist.toggle': 'allowlist:toggle',
  'residency.change': 'residency:change',
  'people.manage': 'people:manage',
  'data.export_delete': 'data:export-delete',
};

const manifestPermissions = getPermissionsMatrix();
for (const [key, roles] of Object.entries(manifestPermissions)) {
  const permissionKey = MANIFEST_PERMISSION_ALIASES[key];
  if (!permissionKey) {
    continue;
  }
  PERMISSIONS[permissionKey] = roles as OrgRole[];
}

const supabase = createServiceClient({
  SUPABASE_URL: env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
});

async function fetchMembership(orgId: string, userId: string): Promise<OrgRole | null> {
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

  return data.role as OrgRole;
}

async function fetchPolicies(orgId: string): Promise<PolicyRecord> {
  const { data, error } = await supabase.from('org_policies').select('key, value').eq('org_id', orgId);

  if (error) {
    throw new Error(error.message);
  }

  const record: PolicyRecord = {};
  for (const row of data ?? []) {
    record[row.key] = row.value;
  }
  return record;
}

async function fetchEntitlements(orgId: string): Promise<Map<string, { canRead: boolean; canWrite: boolean }>> {
  const { data, error } = await supabase
    .from('jurisdiction_entitlements')
    .select('juris_code, can_read, can_write')
    .eq('org_id', orgId);

  if (error) {
    throw new Error(error.message);
  }

  const map = new Map<string, { canRead: boolean; canWrite: boolean }>();
  for (const row of data ?? []) {
    map.set(row.juris_code as string, {
      canRead: Boolean(row.can_read),
      canWrite: Boolean(row.can_write),
    });
  }
  return map;
}

async function fetchIpAllowlist(orgId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('ip_allowlist_entries')
    .select('cidr')
    .eq('org_id', orgId);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => row.cidr as string).filter((cidr) => typeof cidr === 'string' && cidr.length > 0);
}

async function fetchLatestConsent(orgId: string, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('consent_events')
    .select('version')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.version ?? null;
}

function resolvePolicyFlags(policyRecord: PolicyRecord): OrgPolicyFlags {
  const confidential = policyRecord['confidential_mode'];
  const franceBan = policyRecord['fr_judge_analytics_block'];
  const mfaRequired = policyRecord['mfa_required'];
  const ipAllowlist = policyRecord['ip_allowlist_enforced'];
  const consentVersion = policyRecord['ai_assist_consent_version'];
  const coeDisclosure = policyRecord['coe_ai_framework_version'];
  const sensitiveHitl = policyRecord['sensitive_topic_hitl'];
  const residencyZone = policyRecord['residency_zone'];

  return {
    confidentialMode: Boolean(confidential && typeof confidential === 'object' ? (confidential as { enabled?: boolean }).enabled : confidential),
    franceJudgeAnalyticsBlocked: franceBan === undefined
      ? true
      : Boolean(
          typeof franceBan === 'object' ? (franceBan as { enabled?: boolean }).enabled : franceBan,
        ),
    mfaRequired: Boolean(
      typeof mfaRequired === 'object' ? (mfaRequired as { enabled?: boolean }).enabled : mfaRequired,
    ),
    ipAllowlistEnforced: Boolean(
      typeof ipAllowlist === 'object' ? (ipAllowlist as { enabled?: boolean }).enabled : ipAllowlist,
    ),
    consentVersion:
      typeof consentVersion === 'object'
        ? (consentVersion as { version?: string }).version ?? null
        : (consentVersion as string | null | undefined) ?? null,
    councilOfEuropeDisclosureVersion:
      typeof coeDisclosure === 'object'
        ? (coeDisclosure as { version?: string }).version ?? null
        : (coeDisclosure as string | null | undefined) ?? null,
    sensitiveTopicHitl:
      sensitiveHitl === undefined
        ? true
        : Boolean(
            typeof sensitiveHitl === 'object'
              ? (sensitiveHitl as { enabled?: boolean }).enabled
              : sensitiveHitl,
          ),
    residencyZone:
      typeof residencyZone === 'object'
        ? ((residencyZone as { value?: string }).value ?? null)
        : (residencyZone as string | null | undefined) ?? null,
  };
}

export async function authorizeAction(
  action: PermissionKey,
  orgId: string,
  userId: string,
): Promise<OrgAccessContext> {
  const role = await fetchMembership(orgId, userId);
  if (!role) {
    const error = new Error('membership_not_found');
    (error as Error & { statusCode?: number }).statusCode = 403;
    throw error;
  }

  const allowedRoles = PERMISSIONS[action] ?? [];
  if (!allowedRoles.includes(role)) {
    const error = new Error('permission_denied');
    (error as Error & { statusCode?: number }).statusCode = 403;
    throw error;
  }

  const [policies, entitlements, ipAllowlistCidrs, latestConsent] = await Promise.all([
    fetchPolicies(orgId),
    fetchEntitlements(orgId),
    fetchIpAllowlist(orgId),
    fetchLatestConsent(orgId, userId),
  ]);
  const flags = resolvePolicyFlags(policies);
  const abac = {
    jurisdictionEntitlements: entitlements,
    confidentialMode: flags.confidentialMode,
    sensitiveTopicHitl: flags.sensitiveTopicHitl,
    residencyZone: flags.residencyZone ?? null,
  } as const;

  return {
    orgId,
    userId,
    role,
    policies: flags,
    rawPolicies: policies,
    entitlements,
    ipAllowlistCidrs,
    consent: {
      requiredVersion: flags.consentVersion ?? null,
      latestAcceptedVersion: latestConsent,
    },
    abac,
  };
}

export function isJurisdictionAllowed(
  entitlements: Map<string, { canRead: boolean; canWrite: boolean }>,
  jurisCode: string,
): boolean {
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

type RequestContext = {
  ip: string;
  headers: Record<string, unknown>;
};

function headerValue(headers: Record<string, unknown>, key: string): string | null {
  const value = headers[key] ?? headers[key.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return typeof value === 'string' ? value : null;
}

function isIpAllowed(ip: string, cidrs: string[]): boolean {
  if (!ip || cidrs.length === 0) {
    return true;
  }

  let parsedIp: ipaddr.IPv4 | ipaddr.IPv6;
  try {
    parsedIp = ipaddr.parse(ip);
  } catch {
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
    } catch {
      return false;
    }
  });
}

export function ensureOrgAccessCompliance(access: OrgAccessContext, request: RequestContext): void {
  const authStrength = (headerValue(request.headers, 'x-auth-strength') ?? '').toLowerCase();
  if (access.policies.mfaRequired && !['mfa', 'passkey'].includes(authStrength)) {
    const error = new Error('mfa_required');
    (error as Error & { statusCode?: number }).statusCode = 428;
    throw error;
  }

  if (access.policies.ipAllowlistEnforced) {
    if (access.ipAllowlistCidrs.length === 0) {
      const error = new Error('ip_allowlist_empty');
      (error as Error & { statusCode?: number }).statusCode = 428;
      throw error;
    }

    const clientIp = request.ip ?? '';
    if (!isIpAllowed(clientIp, access.ipAllowlistCidrs)) {
      const error = new Error('ip_not_allowed');
      (error as Error & { statusCode?: number }).statusCode = 403;
      throw error;
    }
  }

  const requiredConsent = access.consent.requiredVersion;
  if (requiredConsent && access.consent.latestAcceptedVersion !== requiredConsent) {
    const provided = headerValue(request.headers, 'x-consent-version');
    if (provided !== requiredConsent) {
      const error = new Error('consent_required');
      (error as Error & { statusCode?: number }).statusCode = 428;
      throw error;
    }
  }

  const requiredCoeDisclosure = access.policies.councilOfEuropeDisclosureVersion;
  if (requiredCoeDisclosure) {
    const ack = headerValue(request.headers, 'x-coe-disclosure-version');
    if (ack !== requiredCoeDisclosure) {
      const error = new Error('coe_disclosure_required');
      (error as Error & { statusCode?: number }).statusCode = 428;
      throw error;
    }
  }
}
