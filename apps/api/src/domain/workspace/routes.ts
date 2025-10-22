import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppContext } from '../../types/context.js';
import { authorizeRequestWithGuards } from '../../http/authorization.js';
import {
  fetchWorkspaceCaseScores,
  fetchWorkspaceCitations,
  fetchWorkspaceOverview,
} from './services.js';

const orgQuerySchema = z.object({
  orgId: z.string().min(1),
});

const caseScoresQuerySchema = z.object({
  orgId: z.string().min(1),
  sourceId: z.string().optional(),
});

const workspaceQuerystringSchema = {
  type: 'object',
  properties: {
    orgId: { type: 'string' },
  },
  required: ['orgId'],
  additionalProperties: false,
} as const;

const sharedErrorSchema = {
  type: 'object',
  required: ['error'],
  properties: {
    error: { type: 'string' },
  },
  additionalProperties: false,
} as const;

const workspaceResponseSchema = {
  type: 'object',
  required: ['jurisdictions', 'matters', 'complianceWatch', 'hitlInbox', 'desk', 'navigator'],
  properties: {
    jurisdictions: {
      type: 'array',
      items: {
        type: 'object',
        required: ['code', 'name', 'eu', 'ohada', 'matterCount'],
        properties: {
          code: { type: 'string' },
          name: { type: 'string' },
          eu: { type: 'boolean' },
          ohada: { type: 'boolean' },
          matterCount: { type: 'number' },
        },
        additionalProperties: false,
      },
    },
    matters: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'question', 'status', 'riskLevel', 'hitlRequired', 'startedAt', 'finishedAt', 'jurisdiction'],
        properties: {
          id: { type: 'string' },
          question: { type: 'string' },
          status: { type: ['string', 'null'] },
          riskLevel: { type: ['string', 'null'] },
          hitlRequired: { type: ['boolean', 'null'] },
          startedAt: { type: ['string', 'null'] },
          finishedAt: { type: ['string', 'null'] },
          jurisdiction: { type: ['string', 'null'] },
        },
        additionalProperties: false,
      },
    },
    complianceWatch: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'title', 'publisher', 'url', 'jurisdiction', 'consolidated', 'effectiveDate', 'createdAt'],
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          publisher: { type: ['string', 'null'] },
          url: { type: ['string', 'null'] },
          jurisdiction: { type: ['string', 'null'] },
          consolidated: { type: ['boolean', 'null'] },
          effectiveDate: { type: ['string', 'null'] },
          createdAt: { type: ['string', 'null'] },
        },
        additionalProperties: false,
      },
    },
    hitlInbox: {
      type: 'object',
      required: ['items', 'pendingCount'],
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            required: ['id', 'runId', 'reason', 'status', 'createdAt'],
            properties: {
              id: { type: 'string' },
              runId: { type: 'string' },
              reason: { type: 'string' },
              status: { type: 'string' },
              createdAt: { type: ['string', 'null'] },
            },
            additionalProperties: false,
          },
        },
        pendingCount: { type: 'number' },
      },
      additionalProperties: false,
    },
    desk: { type: 'object', additionalProperties: true },
    navigator: { type: 'array', items: { type: 'object', additionalProperties: true } },
  },
  additionalProperties: false,
} as const;

const citationsResponseSchema = {
  type: 'object',
  required: ['entries'],
  properties: {
    entries: {
      type: 'array',
      items: {
        type: 'object',
        required: [
          'id',
          'title',
          'sourceType',
          'jurisdiction',
          'url',
          'publisher',
          'bindingLanguage',
          'consolidated',
          'languageNote',
          'effectiveDate',
          'capturedAt',
          'checksum',
        ],
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          sourceType: { type: ['string', 'null'] },
          jurisdiction: { type: ['string', 'null'] },
          url: { type: ['string', 'null'] },
          publisher: { type: ['string', 'null'] },
          bindingLanguage: { type: ['string', 'null'] },
          consolidated: { type: ['boolean', 'null'] },
          languageNote: { type: ['string', 'null'] },
          effectiveDate: { type: ['string', 'null'] },
          capturedAt: { type: ['string', 'null'] },
          checksum: { type: ['string', 'null'] },
        },
        additionalProperties: false,
      },
    },
  },
  additionalProperties: false,
} as const;

const caseScoresQuerystringSchema = {
  type: 'object',
  properties: {
    orgId: { type: 'string' },
    sourceId: { type: 'string' },
  },
  required: ['orgId'],
  additionalProperties: false,
} as const;

const caseScoresResponseSchema = {
  type: 'object',
  required: ['scores'],
  properties: {
    scores: {
      type: 'array',
      items: {
        type: 'object',
        required: [
          'id',
          'sourceId',
          'jurisdiction',
          'score',
          'axes',
          'hardBlock',
          'version',
          'modelRef',
          'notes',
          'computedAt',
          'sourceTitle',
          'sourceUrl',
          'trustTier',
          'courtRank',
        ],
        properties: {
          id: { type: 'string' },
          sourceId: { type: 'string' },
          jurisdiction: { type: ['string', 'null'] },
          score: { type: ['number', 'null'] },
          axes: {
            anyOf: [
              { type: 'object', additionalProperties: true },
              { type: 'array', items: {} },
              { type: 'string' },
              { type: 'number' },
              { type: 'boolean' },
              { type: 'null' },
            ],
          },
          hardBlock: { type: ['boolean', 'null'] },
          version: { type: ['string', 'null'] },
          modelRef: { type: ['string', 'null'] },
          notes: { type: ['string', 'null'] },
          computedAt: { type: ['string', 'null'] },
          sourceTitle: { type: ['string', 'null'] },
          sourceUrl: { type: ['string', 'null'] },
          trustTier: { type: ['string', 'null'] },
          courtRank: { type: ['string', 'null'] },
        },
        additionalProperties: true,
      },
    },
  },
  additionalProperties: false,
} as const;

export async function registerWorkspaceRoutes(app: FastifyInstance, ctx: AppContext) {
  app.get<{ Querystring: z.infer<typeof orgQuerySchema> }>(
    '/workspace',
    {
      schema: {
        querystring: workspaceQuerystringSchema,
        response: {
          200: workspaceResponseSchema,
          400: sharedErrorSchema,
          403: sharedErrorSchema,
          500: sharedErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const parse = orgQuerySchema.safeParse(request.query);
      if (!parse.success) {
        return reply.code(400).send({ error: 'orgId is required' });
      }

      const userHeader = request.headers['x-user-id'];
      if (!userHeader || typeof userHeader !== 'string') {
        return reply.code(400).send({ error: 'x-user-id header is required' });
      }

      const { orgId } = parse.data;

      try {
        await authorizeRequestWithGuards('workspace:view', orgId, userHeader, request);
      } catch (error) {
        if (error instanceof Error && 'statusCode' in error && typeof (error as { statusCode?: number }).statusCode === 'number') {
          return reply
            .code((error as { statusCode: number }).statusCode)
            .send({ error: (error as Error).message });
        }
        request.log.error({ err: error }, 'workspace authorization failed');
        return reply.code(403).send({ error: 'forbidden' });
      }

      try {
        const { data, errors } = await fetchWorkspaceOverview(ctx.supabase, orgId);

        if (errors.jurisdictions) {
          request.log.error({ err: errors.jurisdictions }, 'workspace jurisdictions query failed');
        }
        if (errors.matters) {
          request.log.error({ err: errors.matters }, 'workspace matters query failed');
        }
        if (errors.compliance) {
          request.log.error({ err: errors.compliance }, 'workspace compliance query failed');
        }
        if (errors.hitl) {
          request.log.error({ err: errors.hitl }, 'workspace hitl query failed');
        }

        return data;
      } catch (error) {
        if (error instanceof Error && 'statusCode' in error && typeof (error as { statusCode?: number }).statusCode === 'number') {
          return reply
            .code((error as { statusCode: number }).statusCode)
            .send({ error: (error as Error).message });
        }
        request.log.error({ err: error }, 'workspace overview failed');
        return reply.code(500).send({ error: 'workspace_failed' });
      }
    },
  );

  app.get<{ Querystring: z.infer<typeof orgQuerySchema> }>(
    '/citations',
    {
      schema: {
        querystring: workspaceQuerystringSchema,
        response: {
          200: citationsResponseSchema,
          400: sharedErrorSchema,
          403: sharedErrorSchema,
          500: sharedErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const parse = orgQuerySchema.safeParse(request.query);
      if (!parse.success) {
        return reply.code(400).send({ error: 'orgId is required' });
      }

      const userHeader = request.headers['x-user-id'];
      if (!userHeader || typeof userHeader !== 'string') {
        return reply.code(400).send({ error: 'x-user-id header is required' });
      }

      const { orgId } = parse.data;

      try {
        await authorizeRequestWithGuards('citations:view', orgId, userHeader, request);
      } catch (error) {
        if (error instanceof Error && 'statusCode' in error && typeof (error as { statusCode?: number }).statusCode === 'number') {
          return reply
            .code((error as { statusCode: number }).statusCode)
            .send({ error: (error as Error).message });
        }
        request.log.error({ err: error }, 'citations authorization failed');
        return reply.code(403).send({ error: 'forbidden' });
      }

      const { data, error } = await fetchWorkspaceCitations(ctx.supabase, orgId);

      if (error) {
        request.log.error({ err: error }, 'citations query failed');
        return reply.code(500).send({ error: 'citations_failed' });
      }

      return data;
    },
  );

  app.get<{ Querystring: z.infer<typeof caseScoresQuerySchema> }>(
    '/case-scores',
    {
      schema: {
        querystring: caseScoresQuerystringSchema,
        response: {
          200: caseScoresResponseSchema,
          400: sharedErrorSchema,
          403: sharedErrorSchema,
          500: sharedErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const parse = caseScoresQuerySchema.safeParse(request.query);

      if (!parse.success) {
        return reply.code(400).send({ error: 'orgId is required' });
      }

      const userHeader = request.headers['x-user-id'];
      if (!userHeader || typeof userHeader !== 'string') {
        return reply.code(400).send({ error: 'x-user-id header is required' });
      }

      const { orgId, sourceId } = parse.data;

      try {
        await authorizeRequestWithGuards('cases:view', orgId, userHeader, request);
      } catch (error) {
        if (error instanceof Error && 'statusCode' in error && typeof (error as { statusCode?: number }).statusCode === 'number') {
          return reply
            .code((error as { statusCode: number }).statusCode)
            .send({ error: (error as Error).message });
        }
        request.log.error({ err: error }, 'case_scores authorization failed');
        return reply.code(403).send({ error: 'forbidden' });
      }

      const { data, error } = await fetchWorkspaceCaseScores(ctx.supabase, orgId, sourceId);

      if (error) {
        request.log.error({ err: error }, 'case_scores query failed');
        return reply.code(500).send({ error: 'case_scores_failed' });
      }

      return data;
    },
  );
}
