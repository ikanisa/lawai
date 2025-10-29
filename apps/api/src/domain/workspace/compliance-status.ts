import type { FastifyInstance, FastifyReply, FastifyRequest, FastifySchema } from 'fastify';
import { authorizeRequestWithGuards } from '../../http/authorization.js';
import type { AppContext } from '../../types/context.js';
import {
  fetchAcknowledgementEvents,
  mergeDisclosuresWithAcknowledgements,
  summariseAcknowledgements,
  toStringArray,
} from './compliance.js';

const errorResponseSchema = {
  type: 'object',
  required: ['error'],
  properties: {
    error: { type: 'string' },
  },
} as const;

const complianceHeadersSchema = {
  type: 'object',
  required: ['x-user-id', 'x-org-id'],
  properties: {
    'x-user-id': { type: 'string' },
    'x-org-id': { type: 'string' },
  },
} as const;

const complianceQuerySchema = {
  type: 'object',
  properties: {
    limit: { type: 'string' },
  },
} as const;

const complianceAssessmentSchema = {
  type: 'object',
  required: ['runId', 'createdAt', 'assessment'],
  properties: {
    runId: { type: ['string', 'null'] },
    createdAt: { type: ['string', 'null'] },
    assessment: {
      type: 'object',
      required: ['fria', 'cepej', 'statute', 'disclosures'],
      properties: {
        fria: {
          type: 'object',
          required: ['required', 'reasons'],
          properties: {
            required: { type: 'boolean' },
            reasons: { type: 'array', items: { type: 'string' } },
          },
        },
        cepej: {
          type: 'object',
          required: ['passed', 'violations'],
          properties: {
            passed: { type: 'boolean' },
            violations: { type: 'array', items: { type: 'string' } },
          },
        },
        statute: {
          type: 'object',
          required: ['passed', 'violations'],
          properties: {
            passed: { type: 'boolean' },
            violations: { type: 'array', items: { type: 'string' } },
          },
        },
        disclosures: {
          type: 'object',
          required: [
            'consentSatisfied',
            'councilSatisfied',
            'missing',
            'requiredConsentVersion',
            'acknowledgedConsentVersion',
            'requiredCoeVersion',
            'acknowledgedCoeVersion',
          ],
          properties: {
            consentSatisfied: { type: 'boolean' },
            councilSatisfied: { type: 'boolean' },
            missing: { type: 'array', items: { type: 'string' } },
            requiredConsentVersion: { type: ['string', 'null'] },
            acknowledgedConsentVersion: { type: ['string', 'null'] },
            requiredCoeVersion: { type: ['string', 'null'] },
            acknowledgedCoeVersion: { type: ['string', 'null'] },
          },
        },
      },
    },
  },
} as const;

const acknowledgementsResponseSchema = {
  type: 'object',
  required: ['consent', 'councilOfEurope'],
  properties: {
    consent: {
      type: 'object',
      required: ['requiredVersion', 'acknowledgedVersion', 'acknowledgedAt', 'satisfied'],
      properties: {
        requiredVersion: { type: ['string', 'null'] },
        acknowledgedVersion: { type: ['string', 'null'] },
        acknowledgedAt: { type: ['string', 'null'] },
        satisfied: { type: 'boolean' },
      },
    },
    councilOfEurope: {
      type: 'object',
      required: ['requiredVersion', 'acknowledgedVersion', 'acknowledgedAt', 'satisfied'],
      properties: {
        requiredVersion: { type: ['string', 'null'] },
        acknowledgedVersion: { type: ['string', 'null'] },
        acknowledgedAt: { type: ['string', 'null'] },
        satisfied: { type: 'boolean' },
      },
    },
  },
} as const;

const complianceStatusResponseSchema = {
  type: 'object',
  required: ['orgId', 'userId', 'acknowledgements', 'latest', 'history', 'totals'],
  properties: {
    orgId: { type: 'string' },
    userId: { type: 'string' },
    acknowledgements: acknowledgementsResponseSchema,
    latest: { anyOf: [complianceAssessmentSchema, { type: 'null' }] },
    history: {
      type: 'array',
      items: complianceAssessmentSchema,
    },
    totals: {
      type: 'object',
      required: ['total', 'friaRequired', 'cepejViolations', 'statuteViolations', 'disclosureGaps'],
      properties: {
        total: { type: 'number' },
        friaRequired: { type: 'number' },
        cepejViolations: { type: 'number' },
        statuteViolations: { type: 'number' },
        disclosureGaps: { type: 'number' },
      },
    },
  },
} as const;

const complianceStatusSchema: FastifySchema = {
  summary: 'Review recent compliance assessments',
  tags: ['workspace'],
  headers: complianceHeadersSchema,
  querystring: complianceQuerySchema,
  response: {
    200: complianceStatusResponseSchema,
    400: errorResponseSchema,
    401: errorResponseSchema,
    403: errorResponseSchema,
    429: errorResponseSchema,
    500: errorResponseSchema,
  },
};

export function registerComplianceStatusRoute(
  app: FastifyInstance,
  ctx: AppContext,
  onRequest?: (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>,
) {
  const { supabase } = ctx;

  app.get(
    '/compliance/status',
    { schema: complianceStatusSchema, onRequest },
    async (request, reply) => {
      const userHeader = request.headers['x-user-id'];
      if (!userHeader || typeof userHeader !== 'string') {
        return reply.code(401).send({ error: 'unauthorized' });
      }
      const orgHeader = request.headers['x-org-id'];
      if (!orgHeader || typeof orgHeader !== 'string') {
        return reply.code(400).send({ error: 'x-org-id header is required' });
      }

      let access;
      try {
        access = await authorizeRequestWithGuards('workspace:view', orgHeader, userHeader, request);
      } catch (error) {
        const status = (error as Error & { statusCode?: number }).statusCode ?? 403;
        return reply.code(status).send({ error: 'forbidden' });
      }

      const rawLimit = (request.query as { limit?: string }).limit ?? '5';
      const parsedLimit = Number.parseInt(rawLimit, 10);
      const limit = Number.isFinite(parsedLimit) ? Math.min(25, Math.max(1, Math.floor(parsedLimit))) : 5;

      const [assessmentsResult, events] = await Promise.all([
        supabase
          .from('compliance_assessments')
          .select(
            'run_id, created_at, fria_required, fria_reasons, cepej_passed, cepej_violations, statute_passed, statute_violations, disclosures_missing',
          )
          .eq('org_id', orgHeader)
          .order('created_at', { ascending: false })
          .limit(limit),
        fetchAcknowledgementEvents(supabase, orgHeader, userHeader),
      ]);

      if (assessmentsResult.error) {
        request.log.error({ err: assessmentsResult.error }, 'compliance_status_query_failed');
        return reply.code(500).send({ error: 'compliance_status_query_failed' });
      }

      const acknowledgements = summariseAcknowledgements(access, events);

      const history = (assessmentsResult.data ?? []).map((row) => {
        const missing = toStringArray((row as { disclosures_missing?: unknown }).disclosures_missing);
        const assessment = {
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
        orgId: orgHeader,
        userId: userHeader,
        acknowledgements,
        latest: history[0] ?? null,
        history,
        totals,
      });
    },
  );
}
