import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { authorizeRequestWithGuards } from '../../http/authorization.js';
import { withRequestSpan } from '../../observability/spans.js';
import { incrementCounter } from '../../observability/metrics.js';
import type { AppContext } from '../../types/context.js';

const COMPLIANCE_ACK_TYPES = {
  consent: 'ai_assist',
  councilOfEurope: 'council_of_europe_disclosure',
} as const;

type AcknowledgementEvent = {
  type: string;
  version: string;
  created_at: string | null;
};

type ConsentEventInsert = {
  org_id: string | null;
  user_id: string;
  consent_type: string;
  version: string;
};

type ComplianceAssessment = {
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

const complianceAckSchema = z
  .object({
    consent: z
      .object({
        type: z.string().min(1),
        version: z.string().min(1),
      })
      .nullable()
      .optional(),
    councilOfEurope: z
      .object({
        version: z.string().min(1),
      })
      .nullable()
      .optional(),
  })
  .refine((value) => Boolean(value.consent || value.councilOfEurope), {
    message: 'At least one acknowledgement must be provided.',
  });

const toStringArray = (input: unknown): string[] =>
  Array.isArray(input) ? input.filter((value): value is string => typeof value === 'string') : [];

type RequestAccess = Awaited<ReturnType<typeof authorizeRequestWithGuards>>;

async function fetchAcknowledgementEvents(ctx: AppContext, orgId: string, userId: string): Promise<AcknowledgementEvent[]> {
  const { supabase } = ctx;
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

async function recordAcknowledgementEvents(
  ctx: AppContext,
  request: FastifyRequest,
  orgId: string,
  userId: string,
  records: ConsentEventInsert[],
) {
  if (records.length === 0) {
    return;
  }

  const { supabase } = ctx;
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
        consent_types:
          records
            .map((record) => record.consent_type)
            .sort()
            .join(',') || 'none',
      });
    },
  );
}

function summariseAcknowledgements(access: RequestAccess, events: AcknowledgementEvent[]) {
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
  };
}

function mergeDisclosuresWithAcknowledgements(
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

type PreHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<unknown> | unknown;

interface ComplianceRouteOptions {
  rateLimiters?: {
    acknowledgements?: PreHandler;
    status?: PreHandler;
  };
}

export async function registerComplianceRoutes(
  app: FastifyInstance,
  ctx: AppContext,
  options: ComplianceRouteOptions = {},
) {
  const acknowledgementsLimiter = options.rateLimiters?.acknowledgements;
  const statusLimiter = options.rateLimiters?.status ?? acknowledgementsLimiter;

  app.get(
    '/compliance/acknowledgements',
    { preHandler: acknowledgementsLimiter ? [acknowledgementsLimiter] : undefined },
    async (request, reply) => {
      const userHeader = request.headers['x-user-id'];
      if (!userHeader || typeof userHeader !== 'string') {
        return reply.code(401).send({ error: 'unauthorized' });
      }
      const orgHeader = request.headers['x-org-id'];
      if (!orgHeader || typeof orgHeader !== 'string') {
        return reply.code(400).send({ error: 'x-org-id header is required' });
      }

      let access: RequestAccess;
      try {
        access = await withRequestSpan(
          request,
          {
            name: 'compliance.acknowledgements.authorize',
            attributes: { orgId: orgHeader, userId: userHeader },
          },
          async () => authorizeRequestWithGuards('workspace:view', orgHeader, userHeader, request),
        );
      } catch (error) {
        const status = (error as Error & { statusCode?: number }).statusCode ?? 403;
        return reply.code(status).send({ error: 'forbidden' });
      }

      try {
        const events = await withRequestSpan(
          request,
          {
            name: 'compliance.acknowledgements.fetch',
            attributes: { orgId: orgHeader, userId: userHeader },
          },
          async ({ setAttribute }) => {
            const result = await fetchAcknowledgementEvents(ctx, orgHeader, userHeader);
            setAttribute('eventCount', result.length);
            return result;
          },
        );

        const acknowledgements = summariseAcknowledgements(access, events);
        return reply.send({ orgId: orgHeader, userId: userHeader, acknowledgements });
      } catch (error) {
        request.log.error({ err: error }, 'compliance_ack_fetch_failed');
        return reply.code(500).send({ error: 'compliance_ack_fetch_failed' });
      }
    },
  );

  app.post<{ Body: z.infer<typeof complianceAckSchema> }>(
    '/compliance/acknowledgements',
    { preHandler: acknowledgementsLimiter ? [acknowledgementsLimiter] : undefined },
    async (request, reply) => {
      const userHeader = request.headers['x-user-id'];
      if (!userHeader || typeof userHeader !== 'string') {
        return reply.code(401).send({ error: 'unauthorized' });
      }
      const orgHeader = request.headers['x-org-id'];
      if (!orgHeader || typeof orgHeader !== 'string') {
        return reply.code(400).send({ error: 'x-org-id header is required' });
      }

      const parsed = complianceAckSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_body', details: parsed.error.flatten() });
      }

      let access: RequestAccess;
      try {
        access = await withRequestSpan(
          request,
          {
            name: 'compliance.acknowledgements.authorize',
            attributes: { orgId: orgHeader, userId: userHeader },
          },
          async () => authorizeRequestWithGuards('workspace:view', orgHeader, userHeader, request),
        );
      } catch (error) {
        const status = (error as Error & { statusCode?: number }).statusCode ?? 403;
        return reply.code(status).send({ error: 'forbidden' });
      }

      const records: ConsentEventInsert[] = [];
      if (parsed.data.consent) {
        records.push({
          user_id: userHeader,
          org_id: orgHeader,
          consent_type: parsed.data.consent.type,
          version: parsed.data.consent.version,
        });
      }
      if (parsed.data.councilOfEurope) {
        records.push({
          user_id: userHeader,
          org_id: orgHeader,
          consent_type: COMPLIANCE_ACK_TYPES.councilOfEurope,
          version: parsed.data.councilOfEurope.version,
        });
      }

      try {
        await recordAcknowledgementEvents(ctx, request, orgHeader, userHeader, records);
      } catch (error) {
        return reply.code(500).send({ error: 'compliance_ack_insert_failed' });
      }

      const events = await withRequestSpan(
        request,
        {
          name: 'compliance.acknowledgements.refresh',
          attributes: { orgId: orgHeader, userId: userHeader },
        },
        async ({ setAttribute }) => {
          const result = await fetchAcknowledgementEvents(ctx, orgHeader, userHeader);
          setAttribute('eventCount', result.length);
          return result;
        },
      );

      const acknowledgements = summariseAcknowledgements(access, events);
      return reply.send({ orgId: orgHeader, userId: userHeader, acknowledgements });
    },
  );

  app.get<{ Querystring: { limit?: string } }>(
    '/compliance/status',
    { preHandler: statusLimiter ? [statusLimiter] : undefined },
    async (request, reply) => {
      const userHeader = request.headers['x-user-id'];
      if (!userHeader || typeof userHeader !== 'string') {
        return reply.code(401).send({ error: 'unauthorized' });
      }
      const orgHeader = request.headers['x-org-id'];
      if (!orgHeader || typeof orgHeader !== 'string') {
        return reply.code(400).send({ error: 'x-org-id header is required' });
      }

      let access: RequestAccess;
      try {
        access = await authorizeRequestWithGuards('workspace:view', orgHeader, userHeader, request);
      } catch (error) {
        const status = (error as Error & { statusCode?: number }).statusCode ?? 403;
        return reply.code(status).send({ error: 'forbidden' });
      }

      const rawLimit = (request.query?.limit ?? '5') as string;
      const parsedLimit = Number.parseInt(rawLimit, 10);
      const limit = Number.isFinite(parsedLimit) ? Math.min(25, Math.max(1, Math.floor(parsedLimit))) : 5;

      const [assessmentsResult, events] = await Promise.all([
        ctx.supabase
          .from('compliance_assessments')
          .select(
            'run_id, created_at, fria_required, fria_reasons, cepej_passed, cepej_violations, statute_passed, statute_violations, disclosures_missing',
          )
          .eq('org_id', orgHeader)
          .order('created_at', { ascending: false })
          .limit(limit),
        fetchAcknowledgementEvents(ctx, orgHeader, userHeader),
      ]);

      if (assessmentsResult.error) {
        request.log.error({ err: assessmentsResult.error }, 'compliance_status_query_failed');
        return reply.code(500).send({ error: 'compliance_status_query_failed' });
      }

      const acknowledgements = summariseAcknowledgements(access, events);

      const history = (assessmentsResult.data ?? []).map((row) => {
        const missing = toStringArray((row as { disclosures_missing?: unknown }).disclosures_missing);
        const assessment: ComplianceAssessment = {
          fria: {
            required: Boolean((row as { fria_required?: boolean | null }).fria_required),
            reasons: toStringArray((row as { fria_reasons?: unknown }).fria_reasons),
          },
          cepej: {
            passed: (row as { cepej_passed?: boolean | null }).cepej_passed ?? true,
            violations: toStringArray((row as { cepej_violations?: unknown }).cepej_violations),
          },
          statute: {
            passed: (row as { statute_passed?: boolean | null }).statute_passed ?? true,
            violations: toStringArray((row as { statute_violations?: unknown }).statute_violations),
          },
          disclosures: {
            consentSatisfied: true,
            councilSatisfied: true,
            missing,
            requiredConsentVersion: null,
            acknowledgedConsentVersion: null,
            requiredCoeVersion: null,
            acknowledgedCoeVersion: null,
          },
        };

        return {
          runId: (row as { run_id?: string | null }).run_id ?? null,
          createdAt: (row as { created_at?: string | null }).created_at ?? null,
          assessment: {
            ...assessment,
            disclosures: mergeDisclosuresWithAcknowledgements(assessment, acknowledgements),
          },
        };
      });

      return reply.send({
        orgId: orgHeader,
        userId: userHeader,
        acknowledgements,
        history,
        disclosures: history.length > 0 ? history[0]?.assessment.disclosures ?? null : null,
      });
    },
  );
}

export { complianceAckSchema, summariseAcknowledgements };
