import type { FastifyRequest } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';
import { withRequestSpan } from '../../observability/spans.js';
import { incrementCounter } from '../../observability/metrics.js';
import type { authorizeRequestWithGuards } from '../../http/authorization.js';

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

export interface ComplianceGuardAccess {
  consent: {
    requirement: { version: string } | null;
    latest?: { version: string | null } | null;
  };
  councilOfEurope: {
    requirement: { version: string | null } | null;
    acknowledgedVersion: string | null;
  };
}

export type AcknowledgementsSummary = {
  consent: {
    requiredVersion: string | null;
    acknowledgedVersion: string | null;
    acknowledgedAt: string | null;
    satisfied: boolean;
  };
  councilOfEurope: {
    requiredVersion: string | null;
    acknowledgedVersion: string | null;
    acknowledgedAt: string | null;
    satisfied: boolean;
  };
};

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

  const rows = (data ?? []) as Array<{ consent_type?: unknown; version?: unknown; created_at?: string | null }>;
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
  supabase: SupabaseClient,
  request: FastifyRequest,
  orgId: string,
  userId: string,
  records: ConsentEventInsert[],
) {
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

export function summariseAcknowledgements(
  access: Awaited<ReturnType<typeof authorizeRequestWithGuards>>,
  events: AcknowledgementEvent[],
): AcknowledgementsSummary {
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
    !consentRequirement || consentAck?.version === consentRequirement.version || access.consent.latest?.version === consentRequirement.version;
  const councilSatisfied =
    !councilRequirement?.version || councilAck?.version === councilRequirement.version || access.councilOfEurope.acknowledgedVersion === councilRequirement.version;

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
  };
}

export function mergeDisclosuresWithAcknowledgements(
  assessment: ComplianceAssessment,
  acknowledgements: AcknowledgementsSummary,
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
