import type { SupabaseClient } from '@supabase/supabase-js';
import type { FastifyRequest } from 'fastify';
import type { OrgAccessContext } from '../../access-control.js';
import { withRequestSpan } from '../../observability/spans.js';
import { incrementCounter } from '../../observability/metrics.js';
import { buildPhaseCProcessNavigator, buildPhaseCWorkspaceDesk } from '../../workspace.js';

export const COMPLIANCE_ACK_TYPES = {
  consent: 'ai_assist',
  councilOfEurope: 'council_of_europe_disclosure',
} as const;

export type AcknowledgementEvent = {
  type: string;
  version: string;
  created_at: string | null;
};

export type ConsentEventInsert = {
  org_id: string | null;
  user_id: string;
  consent_type: string;
  version: string;
};

const extractCountry = (value: unknown): string | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }
  if ('country' in value && typeof (value as { country?: unknown }).country === 'string') {
    const candidate = (value as { country?: string }).country;
    return candidate && candidate.trim().length > 0 ? candidate : null;
  }
  if ('country_code' in value && typeof (value as { country_code?: unknown }).country_code === 'string') {
    const candidate = (value as { country_code?: string }).country_code;
    return candidate && candidate.trim().length > 0 ? candidate : null;
  }
  return null;
};

export async function fetchAcknowledgementEvents(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
): Promise<AcknowledgementEvent[]> {
  const { data, error } = await supabase
    .from('consent_events')
    .select('consent_type, version, created_at, org_id')
    .eq('user_id', userId)
    .or(`org_id.eq.${orgId},org_id.is.null`)
    .in('consent_type', [COMPLIANCE_ACK_TYPES.consent, COMPLIANCE_ACK_TYPES.councilOfEurope])
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  const rows =
    (data ?? []) as Array<{ consent_type?: unknown; version?: unknown; created_at?: string | null }>;
  const events: AcknowledgementEvent[] = [];
  for (const row of rows) {
    if (typeof row.consent_type !== 'string' || typeof row.version !== 'string') {
      continue;
    }
    events.push({ type: row.consent_type, version: row.version, created_at: row.created_at ?? null });
  }
  return events;
}

export async function recordAcknowledgementEvents(
  request: FastifyRequest,
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  records: ConsentEventInsert[],
): Promise<void> {
  if (records.length === 0) {
    return;
  }

  await withRequestSpan(
    request,
    {
      name: 'compliance.acknowledgements.persist',
      attributes: { orgId, userId, recordCount: records.length },
    },
    async ({ logger, setAttribute }) => {
      const payload = records.map((record) => ({
        org_id: record.org_id,
        user_id: record.user_id,
        consent_type: record.consent_type,
        version: record.version,
      }));

      const { error } = await supabase.rpc('record_consent_events', { events: payload });

      if (error) {
        setAttribute('errorCode', error.code ?? 'unknown');
        logger.error({ err: error }, 'compliance_ack_persist_failed');
        throw error;
      }

      setAttribute('persisted', true);
      incrementCounter('compliance_acknowledgements.recorded', {
        consent_types: records
          .map((record) => record.consent_type)
          .sort()
          .join(',') || 'none',
      });
    },
  );
}

export function summariseAcknowledgements(access: OrgAccessContext, events: AcknowledgementEvent[]) {
  const latestByType = new Map<string, { version: string; created_at: string | null }>();
  for (const event of events) {
    if (!latestByType.has(event.type)) {
      latestByType.set(event.type, { version: event.version, created_at: event.created_at });
    }
  }

  const consentRequirement = access.consent.requirement;
  const councilRequirement = access.councilOfEurope.requirement;
  const consentAck = latestByType.get(COMPLIANCE_ACK_TYPES.consent);
  const councilAck = latestByType.get(COMPLIANCE_ACK_TYPES.councilOfEurope);

  const consentSatisfied =
    !consentRequirement ||
    consentAck?.version === consentRequirement.version ||
    access.consent.latest?.version === consentRequirement.version;
  const councilSatisfied =
    !councilRequirement?.version ||
    councilAck?.version === councilRequirement.version ||
    access.councilOfEurope.acknowledgedVersion === councilRequirement.version;

  return {
    consent: {
      requiredVersion: consentRequirement?.version ?? null,
      acknowledgedVersion: consentAck?.version ?? access.consent.latest?.version ?? null,
      acknowledgedAt: consentAck?.created_at ?? null,
      satisfied: consentSatisfied,
    },
    councilOfEurope: {
      requiredVersion: councilRequirement?.version ?? null,
      acknowledgedVersion: councilAck?.version ?? access.councilOfEurope.acknowledgedVersion ?? null,
      acknowledgedAt: councilAck?.created_at ?? null,
      satisfied: councilSatisfied,
    },
  } as const;
}

export type ComplianceAssessment = {
  fria: { required: boolean; reasons: string[] };
  cepej: { passed: boolean; violations: string[] };
  statute: { passed: boolean; violations: string[] };
  disclosures: {
    consentSatisfied: boolean;
    councilSatisfied: boolean;
    missing: string[];
    requiredConsentVersion: string | null;
    acknowledgedConsentVersion: string | null;
    requiredCoeVersion: string | null;
    acknowledgedCoeVersion: string | null;
  };
};

export function mergeDisclosuresWithAcknowledgements(
  assessment: ComplianceAssessment,
  acknowledgements: ReturnType<typeof summariseAcknowledgements>,
): ComplianceAssessment['disclosures'] {
  const missing = new Set(assessment.disclosures.missing);
  if (!acknowledgements.consent.satisfied) {
    missing.add('consent');
  }
  if (!acknowledgements.councilOfEurope.satisfied) {
    missing.add('council_of_europe');
  }

  return {
    ...assessment.disclosures,
    consentSatisfied: acknowledgements.consent.satisfied,
    councilSatisfied: acknowledgements.councilOfEurope.satisfied,
    missing: Array.from(missing),
    requiredConsentVersion: acknowledgements.consent.requiredVersion,
    acknowledgedConsentVersion: acknowledgements.consent.acknowledgedVersion,
    requiredCoeVersion: acknowledgements.councilOfEurope.requiredVersion,
    acknowledgedCoeVersion: acknowledgements.councilOfEurope.acknowledgedVersion,
  };
}

export interface WorkspaceOverview {
  jurisdictions: Array<{ code: string; name: string; eu: boolean; ohada: boolean; matterCount: number }>;
  matters: Array<{
    id: string;
    question: string;
    status: string | null;
    riskLevel: string | null;
    hitlRequired: boolean | null;
    startedAt: string | null;
    finishedAt: string | null;
    jurisdiction: string | null;
  }>;
  complianceWatch: Array<{
    id: string;
    title: string;
    publisher: string | null;
    url: string;
    jurisdiction: string | null;
    consolidated: boolean | null;
    effectiveDate: string | null;
    createdAt: string | null;
  }>;
  hitlInbox: {
    items: Array<{ id: string; runId: string; reason: string; status: string; createdAt: string | null }>;
    pendingCount: number;
  };
  desk: ReturnType<typeof buildPhaseCWorkspaceDesk>;
  navigator: ReturnType<typeof buildPhaseCProcessNavigator>;
}

export interface WorkspaceFetchErrors {
  jurisdictions?: unknown;
  matters?: unknown;
  compliance?: unknown;
  hitl?: unknown;
}

export async function fetchWorkspaceOverview(
  supabase: SupabaseClient,
  orgId: string,
): Promise<{ data: WorkspaceOverview; errors: WorkspaceFetchErrors }> {
  const [jurisdictionsResult, mattersResult, complianceResult, hitlResult] = await Promise.all([
    supabase.from('jurisdictions').select('code, name, eu, ohada').order('name', { ascending: true }),
    supabase
      .from('agent_runs')
      .select('id, question, risk_level, hitl_required, status, started_at, finished_at, jurisdiction_json')
      .eq('org_id', orgId)
      .order('started_at', { ascending: false })
      .limit(8),
    supabase
      .from('sources')
      .select('id, title, publisher, source_url, jurisdiction_code, consolidated, effective_date, created_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('hitl_queue')
      .select('id, run_id, reason, status, created_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(8),
  ]);

  const jurisdictionRows = jurisdictionsResult.data ?? [];
  const matterRows = mattersResult.data ?? [];
  const complianceRows = complianceResult.data ?? [];
  const hitlRows = hitlResult.data ?? [];

  const matterCounts = new Map<string, number>();
  for (const row of matterRows) {
    const jurisdiction = extractCountry((row as { jurisdiction_json?: unknown }).jurisdiction_json);
    const key = jurisdiction ?? 'UNK';
    matterCounts.set(key, (matterCounts.get(key) ?? 0) + 1);
  }

  const jurisdictions = jurisdictionRows.map((row) => ({
    code: (row as { code: string }).code,
    name: (row as { name: string }).name,
    eu: Boolean((row as { eu?: boolean }).eu),
    ohada: Boolean((row as { ohada?: boolean }).ohada),
    matterCount: matterCounts.get((row as { code: string }).code) ?? 0,
  }));

  const matters = matterRows.map((row) => ({
    id: (row as { id: string }).id,
    question: (row as { question: string }).question,
    status: (row as { status?: string | null }).status ?? null,
    riskLevel: (row as { risk_level?: string | null }).risk_level ?? null,
    hitlRequired: (row as { hitl_required?: boolean | null }).hitl_required ?? null,
    startedAt: (row as { started_at?: string | null }).started_at ?? null,
    finishedAt: (row as { finished_at?: string | null }).finished_at ?? null,
    jurisdiction: extractCountry((row as { jurisdiction_json?: unknown }).jurisdiction_json),
  }));

  const complianceWatch = complianceRows.map((row) => ({
    id: (row as { id: string }).id,
    title: (row as { title: string }).title,
    publisher: (row as { publisher?: string | null }).publisher ?? null,
    url: (row as { source_url: string }).source_url,
    jurisdiction: (row as { jurisdiction_code?: string | null }).jurisdiction_code ?? null,
    consolidated: (row as { consolidated?: boolean | null }).consolidated ?? null,
    effectiveDate: (row as { effective_date?: string | null }).effective_date ?? null,
    createdAt: (row as { created_at?: string | null }).created_at ?? null,
  }));

  const hitlItems = hitlRows.map((row) => ({
    id: (row as { id: string }).id,
    runId: (row as { run_id: string }).run_id,
    reason: (row as { reason: string }).reason,
    status: (row as { status: string }).status,
    createdAt: (row as { created_at?: string | null }).created_at ?? null,
  }));

  const pendingCount = hitlItems.filter((item) => item.status === 'pending').length;

  return {
    data: {
      jurisdictions,
      matters,
      complianceWatch,
      hitlInbox: {
        items: hitlItems,
        pendingCount,
      },
      desk: buildPhaseCWorkspaceDesk(),
      navigator: buildPhaseCProcessNavigator(),
    },
    errors: {
      jurisdictions: jurisdictionsResult.error ?? undefined,
      matters: mattersResult.error ?? undefined,
      compliance: complianceResult.error ?? undefined,
      hitl: hitlResult.error ?? undefined,
    },
  };
}

export function toStringArray(input: unknown): string[] {
  return Array.isArray(input)
    ? input.filter((value): value is string => typeof value === 'string')
    : [];
}
