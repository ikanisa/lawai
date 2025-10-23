import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../../types/context.js';
import { getWorkspaceSchema, workspaceQuerySchema, type WorkspaceQuery } from './schemas.js';

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
          'source',
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
          source: {
            anyOf: [
              { type: 'null' },
              {
                type: 'object',
                required: ['title', 'url', 'trustTier', 'courtRank'],
                properties: {
                  title: { type: ['string', 'null'] },
                  url: { type: ['string', 'null'] },
                  trustTier: { type: ['string', 'null'] },
                  courtRank: { type: ['string', 'null'] },
                },
                additionalProperties: false,
              },
            ],
          },
        },
        additionalProperties: true,
      },
    },
  },
  additionalProperties: false,
} as const;

export async function registerWorkspaceRoutes(app: FastifyInstance, ctx: AppContext) {
  app.get<{ Querystring: WorkspaceQuery }>(
    '/workspace',
    { schema: getWorkspaceSchema },
    async (request, reply) => {
      const { orgId } = workspaceQuerySchema.parse(request.query);
      const { supabase } = ctx;

      // TODO: move existing implementation from server.ts here.
      const { data, error } = await supabase
        .from('agent_runs')
        .select('id')
        .eq('org_id', orgId)
        .limit(1);

      if (error) {
        request.log.error({ err: error }, 'workspace query failed');
        return reply.code(500).send({ error: 'workspace_failed' });
      }

      return { runs: data ?? [] };
    },
  );
}
