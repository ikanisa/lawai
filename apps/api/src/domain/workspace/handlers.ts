import { z } from 'zod';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { authorizeRequestWithGuards } from '../../http/authorization.js';
import { withRequestSpan } from '../../observability/spans.js';
import { InMemoryRateLimiter } from '../../rate-limit.js';
import type { AppContext } from '../../types/context.js';
import {
  COMPLIANCE_ACK_TYPES,
  type ComplianceAssessment,
  type ConsentEventInsert,
  fetchAcknowledgementEvents,
  fetchWorkspaceOverview,
  mergeDisclosuresWithAcknowledgements,
  recordAcknowledgementEvents,
  summariseAcknowledgements,
  toStringArray,
} from './service.js';

export const workspaceQuerySchema = z.object({
  orgId: z.string().min(1),
});

export const complianceAckSchema = z
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

export const complianceStatusQuerySchema = z
  .object({
    limit: z
      .string()
      .regex(/^[0-9]+$/)
      .optional(),
  })
  .passthrough();

const workspaceLimiter = new InMemoryRateLimiter({ limit: 30, windowMs: 60_000 });
const complianceStatusLimiter = new InMemoryRateLimiter({ limit: 30, windowMs: 60_000 });
const complianceWriteLimiter = new InMemoryRateLimiter({ limit: 12, windowMs: 60_000 });

function rateLimit(
  limiter: InMemoryRateLimiter,
  request: FastifyRequest,
  reply: FastifyReply,
): FastifyReply | null {
  try {
    const userId = typeof request.headers['x-user-id'] === 'string' ? request.headers['x-user-id'] : request.ip;
    const orgId = typeof request.headers['x-org-id'] === 'string' ? request.headers['x-org-id'] : 'anonymous';
    const key = `${orgId}:${userId}`;
    const hit = limiter.hit(key);
    if (!hit.allowed) {
      const retryAfter = Math.max(1, Math.ceil((hit.resetAt - Date.now()) / 1000));
      return reply.header('Retry-After', retryAfter).code(429).send({ error: 'rate_limited' });
    }
  } catch (error) {
    request.log.warn({ err: error }, 'workspace_rate_limit_failed');
  }
  return null;
}

function requireHeaderString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

export function buildWorkspaceHandlers(ctx: AppContext) {
  const { supabase } = ctx;

  return {
    async getWorkspace(request: FastifyRequest, reply: FastifyReply) {
      const limited = rateLimit(workspaceLimiter, request, reply);
      if (limited) {
        return limited;
      }

      const parsedQuery = workspaceQuerySchema.safeParse(request.query);
      if (!parsedQuery.success) {
        return reply.code(400).send({ error: 'invalid_query', details: parsedQuery.error.flatten() });
      }

      const orgId = parsedQuery.data.orgId;
      const userId = requireHeaderString(request.headers['x-user-id']);
      if (!userId) {
        return reply.code(400).send({ error: 'x-user-id header is required' });
      }

      try {
        await authorizeRequestWithGuards('workspace:view', orgId, userId, request);
      } catch (error) {
        const status = (error as Error & { statusCode?: number }).statusCode ?? 403;
        return reply.code(status).send({ error: 'forbidden' });
      }

      const { data, errors } = await fetchWorkspaceOverview(supabase, orgId);

      if (errors.jurisdictions) {
        request.log.error({ err: errors.jurisdictions }, 'workspace_jurisdictions_query_failed');
      }
      if (errors.matters) {
        request.log.error({ err: errors.matters }, 'workspace_matters_query_failed');
      }
      if (errors.compliance) {
        request.log.error({ err: errors.compliance }, 'workspace_compliance_query_failed');
      }
      if (errors.hitl) {
        request.log.error({ err: errors.hitl }, 'workspace_hitl_query_failed');
      }

      return {
        jurisdictions: data.jurisdictions,
        matters: data.matters,
        complianceWatch: data.complianceWatch,
        hitlInbox: data.hitlInbox,
        desk: data.desk,
        navigator: data.navigator,
      };
    },

    async getComplianceAcknowledgements(request: FastifyRequest, reply: FastifyReply) {
      const limited = rateLimit(complianceStatusLimiter, request, reply);
      if (limited) {
        return limited;
      }

      const userId = requireHeaderString(request.headers['x-user-id']);
      if (!userId) {
        return reply.code(401).send({ error: 'unauthorized' });
      }
      const orgId = requireHeaderString(request.headers['x-org-id']);
      if (!orgId) {
        return reply.code(400).send({ error: 'x-org-id header is required' });
      }

      let access: Awaited<ReturnType<typeof authorizeRequestWithGuards>>;
      try {
        access = await withRequestSpan(
          request,
          {
            name: 'compliance.acknowledgements.authorize',
            attributes: { orgId, userId },
          },
          async () => authorizeRequestWithGuards('workspace:view', orgId, userId, request),
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
            attributes: { orgId, userId },
          },
          async ({ setAttribute }) => {
            const result = await fetchAcknowledgementEvents(supabase, orgId, userId);
            setAttribute('eventCount', result.length);
            return result;
          },
        );

        const acknowledgements = summariseAcknowledgements(access, events);
        return reply.send({ orgId, userId, acknowledgements });
      } catch (error) {
        request.log.error({ err: error }, 'compliance_ack_fetch_failed');
        return reply.code(500).send({ error: 'compliance_ack_fetch_failed' });
      }
    },

    async postComplianceAcknowledgements(request: FastifyRequest, reply: FastifyReply) {
      const limited = rateLimit(complianceWriteLimiter, request, reply);
      if (limited) {
        return limited;
      }

      const userId = requireHeaderString(request.headers['x-user-id']);
      if (!userId) {
        return reply.code(401).send({ error: 'unauthorized' });
      }
      const orgId = requireHeaderString(request.headers['x-org-id']);
      if (!orgId) {
        return reply.code(400).send({ error: 'x-org-id header is required' });
      }

      const parsed = complianceAckSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_body', details: parsed.error.flatten() });
      }

      let access: Awaited<ReturnType<typeof authorizeRequestWithGuards>>;
      try {
        access = await withRequestSpan(
          request,
          {
            name: 'compliance.acknowledgements.authorize',
            attributes: { orgId, userId },
          },
          async () => authorizeRequestWithGuards('workspace:view', orgId, userId, request),
        );
      } catch (error) {
        const status = (error as Error & { statusCode?: number }).statusCode ?? 403;
        return reply.code(status).send({ error: 'forbidden' });
      }

      const records: ConsentEventInsert[] = [];
      if (parsed.data.consent) {
        records.push({
          user_id: userId,
          org_id: orgId,
          consent_type: parsed.data.consent.type,
          version: parsed.data.consent.version,
        });
      }
      if (parsed.data.councilOfEurope) {
        records.push({
          user_id: userId,
          org_id: orgId,
          consent_type: COMPLIANCE_ACK_TYPES.councilOfEurope,
          version: parsed.data.councilOfEurope.version,
        });
      }

      try {
        await recordAcknowledgementEvents(request, supabase, orgId, userId, records);
      } catch (error) {
        return reply.code(500).send({ error: 'compliance_ack_insert_failed' });
      }

      const events = await withRequestSpan(
        request,
        {
          name: 'compliance.acknowledgements.refresh',
          attributes: { orgId, userId },
        },
        async ({ setAttribute }) => {
          const result = await fetchAcknowledgementEvents(supabase, orgId, userId);
          setAttribute('eventCount', result.length);
          return result;
        },
      );

      const acknowledgements = summariseAcknowledgements(access, events);
      return reply.send({ orgId, userId, acknowledgements });
    },

    async getComplianceStatus(request: FastifyRequest, reply: FastifyReply) {
      const limited = rateLimit(complianceStatusLimiter, request, reply);
      if (limited) {
        return limited;
      }

      const userId = requireHeaderString(request.headers['x-user-id']);
      if (!userId) {
        return reply.code(401).send({ error: 'unauthorized' });
      }
      const orgId = requireHeaderString(request.headers['x-org-id']);
      if (!orgId) {
        return reply.code(400).send({ error: 'x-org-id header is required' });
      }

      let access: Awaited<ReturnType<typeof authorizeRequestWithGuards>>;
      try {
        access = await authorizeRequestWithGuards('workspace:view', orgId, userId, request);
      } catch (error) {
        const status = (error as Error & { statusCode?: number }).statusCode ?? 403;
        return reply.code(status).send({ error: 'forbidden' });
      }

      const parsedQuery = complianceStatusQuerySchema.safeParse(request.query ?? {});
      if (!parsedQuery.success) {
        return reply.code(400).send({ error: 'invalid_query', details: parsedQuery.error.flatten() });
      }
      const rawLimit = parsedQuery.data.limit ?? '5';
      const parsedLimit = Number.parseInt(rawLimit, 10);
      const limit = Number.isFinite(parsedLimit) ? Math.min(25, Math.max(1, Math.floor(parsedLimit))) : 5;

      const [assessmentsResult, events] = await Promise.all([
        supabase
          .from('compliance_assessments')
          .select(
            'run_id, created_at, fria_required, fria_reasons, cepej_passed, cepej_violations, statute_passed, statute_violations, disclosures_missing',
          )
          .eq('org_id', orgId)
          .order('created_at', { ascending: false })
          .limit(limit),
        fetchAcknowledgementEvents(supabase, orgId, userId),
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
            consentSatisfied: !missing.includes('consent'),
            councilSatisfied: !missing.includes('council_of_europe'),
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
          assessment,
        };
      });

      if (history.length > 0) {
        history[0].assessment = {
          ...history[0].assessment,
          disclosures: mergeDisclosuresWithAcknowledgements(history[0].assessment, acknowledgements),
        };
      }

      const totals = history.reduce(
        (acc, entry) => {
          if (entry.assessment.fria.required) acc.friaRequired += 1;
          if (!entry.assessment.cepej.passed) acc.cepejViolations += 1;
          if (!entry.assessment.statute.passed) acc.statuteViolations += 1;
          if (entry.assessment.disclosures.missing.length > 0) acc.disclosureGaps += 1;
          return acc;
        },
        { total: history.length, friaRequired: 0, cepejViolations: 0, statuteViolations: 0, disclosureGaps: 0 },
      );

      return reply.send({
        orgId,
        userId,
        acknowledgements,
        latest: history[0] ?? null,
        history,
        totals,
      });
    },
  };
}
