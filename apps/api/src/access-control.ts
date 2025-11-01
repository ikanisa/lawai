import { createServiceClient } from '@avocat-ai/supabase';
import ipaddr from 'ipaddr.js';
import { env } from './config.js';

export type OrgRole =
  | 'owner'
  | 'admin'
  | 'member'
  | 'reviewer'
  | 'viewer'
  | 'compliance_officer'
  | 'auditor';

type PolicyRecord = Record<string, unknown>;

type ConsentRequirement = {
  type: string;
  version: string;
};

type CouncilOfEuropeRequirement = {
  version: string;
  documentUrl?: string | null;
};

type OrgPolicyFlags = {
  confidentialMode: boolean;
  franceJudgeAnalyticsBlocked: boolean;
  mfaRequired: boolean;
  ipAllowlistEnforced: boolean;
  consentRequirement: ConsentRequirement | null;
  councilOfEuropeRequirement: CouncilOfEuropeRequirement | null;
  sensitiveTopicHitl: boolean;
  residencyZone: string | null;
  residencyZones: string[] | null;
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
    requirement: ConsentRequirement | null;
    latest?: { type: string; version: string } | null;
  };
  councilOfEurope: {
    requirement: CouncilOfEuropeRequirement | null;
    acknowledgedVersion?: string | null;
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
  | 'templates:view'
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
  | 'orchestrator:command'
  | 'orchestrator:admin';

const PERMISSIONS: Record<PermissionKey, OrgRole[]> = {
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

  return (data ?? [])
    .map((row: any) => String(row.cidr))
    .filter((cidr: string) => typeof cidr === 'string' && cidr.length > 0);
}

async function fetchLatestConsent(
  orgId: string,
  userId: string,
  consentType: string,
): Promise<{ type: string; version: string } | null> {
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
    version: data.version as string,
    type: (data.consent_type as string) ?? consentType,
  };
}

function parseConsentPolicy(value: unknown): ConsentRequirement | null {
  if (typeof value === 'string') {
    return { type: 'ai_assist', version: value };
  }
  if (value && typeof value === 'object') {
    const record = value as { version?: unknown; type?: unknown };
    const version = typeof record.version === 'string' ? record.version : null;
    const type = typeof record.type === 'string' ? record.type : 'ai_assist';
    return version ? { version, type } : null;
  }
  return null;
}

function parseCouncilPolicy(value: unknown): CouncilOfEuropeRequirement | null {
  if (typeof value === 'string') {
    return { version: value };
  }
  if (value && typeof value === 'object') {
    const record = value as { version?: unknown; document_url?: unknown };
    const version = typeof record.version === 'string' ? record.version : null;
    const documentUrl = typeof record.document_url === 'string' ? record.document_url : null;
    return version ? { version, documentUrl } : null;
  }
  return null;
}

function resolvePolicyFlags(policyRecord: PolicyRecord): OrgPolicyFlags {
  const confidential = policyRecord['confidential_mode'];
  const franceBan = policyRecord['fr_judge_analytics_block'];
  const mfaRequired = policyRecord['mfa_required'];
  const ipAllowlist = policyRecord['ip_allowlist_enforced'];
  const consentRequirement = parseConsentPolicy(policyRecord['ai_assist_consent_version']);
  const coeDisclosure = parseCouncilPolicy(policyRecord['coe_ai_framework_version']);
  const sensitiveHitl = policyRecord['sensitive_topic_hitl'];
  const residencyValue = policyRecord['residency_zone'];

  const residencyCollector = new Set<string>();
  const collectResidency = (input: unknown) => {
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
      const record = input as Record<string, unknown>;
      if ('value' in record) collectResidency(record.value);
      if ('code' in record) collectResidency(record.code);
      if ('values' in record) collectResidency(record.values);
      if ('allowed' in record) collectResidency(record.allowed);
      if ('zones' in record) collectResidency(record.zones);
    }
  };

  collectResidency(residencyValue);
  const residencyZones = residencyCollector.size > 0 ? Array.from(residencyCollector) : null;
  const primaryResidencyZone = residencyZones?.[0] ?? null;

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
    consentRequirement,
    councilOfEuropeRequirement: coeDisclosure,
    sensitiveTopicHitl:
      sensitiveHitl === undefined
        ? true
        : Boolean(
            typeof sensitiveHitl === 'object'
              ? (sensitiveHitl as { enabled?: boolean }).enabled
              : sensitiveHitl,
          ),
    residencyZone: primaryResidencyZone,
    residencyZones,
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

  const consentRequirement = access.consent.requirement;
  if (consentRequirement && (!access.consent.latest || access.consent.latest.version !== consentRequirement.version)) {
    const error = new Error('consent_required');
    (error as Error & { statusCode?: number }).statusCode = 428;
    throw error;
  }

  const councilRequirement = access.councilOfEurope.requirement;
  if (councilRequirement?.version && access.councilOfEurope.acknowledgedVersion !== councilRequirement.version) {
    const error = new Error('coe_disclosure_required');
    (error as Error & { statusCode?: number }).statusCode = 428;
    throw error;
  }
}
