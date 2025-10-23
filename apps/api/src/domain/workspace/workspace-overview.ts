import type { FastifyInstance, FastifyReply, FastifyRequest, FastifySchema } from 'fastify';
import { authorizeRequestWithGuards } from '../../http/authorization.js';
import { buildPhaseCProcessNavigator, buildPhaseCWorkspaceDesk } from '../../workspace.js';
import type { AppContext } from '../../types/context';
import { extractCountry } from '../../utils/jurisdictions.js';

const errorResponseSchema = {
  type: 'object',
  required: ['error'],
  properties: {
    error: { type: 'string' },
  },
} as const;

const workspaceQuerySchema = {
  type: 'object',
  required: ['orgId'],
  properties: {
    orgId: { type: 'string', format: 'uuid' },
  },
} as const;

const workspaceHeadersSchema = {
  type: 'object',
  required: ['x-user-id'],
  properties: {
    'x-user-id': { type: 'string' },
  },
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
      },
    },
    matters: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'question', 'status', 'riskLevel', 'hitlRequired', 'startedAt', 'finishedAt', 'jurisdiction'],
        properties: {
          id: { type: 'string' },
          question: { type: ['string', 'null'] },
          status: { type: ['string', 'null'] },
          riskLevel: { type: ['string', 'null'] },
          hitlRequired: { type: ['boolean', 'null'] },
          startedAt: { type: ['string', 'null'] },
          finishedAt: { type: ['string', 'null'] },
          jurisdiction: { type: ['string', 'null'] },
        },
      },
    },
    complianceWatch: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'title', 'publisher', 'url', 'jurisdiction', 'consolidated', 'effectiveDate', 'createdAt'],
        properties: {
          id: { type: 'string' },
          title: { type: ['string', 'null'] },
          publisher: { type: ['string', 'null'] },
          url: { type: ['string', 'null'] },
          jurisdiction: { type: ['string', 'null'] },
          consolidated: { type: ['boolean', 'null'] },
          effectiveDate: { type: ['string', 'null'] },
          createdAt: { type: ['string', 'null'] },
        },
      },
    },
    hitlInbox: {
      type: 'object',
      required: ['items', 'pendingCount'],
      properties: {
        pendingCount: { type: 'number' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            required: ['id', 'runId', 'reason', 'status', 'createdAt'],
            properties: {
              id: { type: 'string' },
              runId: { type: ['string', 'null'] },
              reason: { type: ['string', 'null'] },
              status: { type: ['string', 'null'] },
              createdAt: { type: ['string', 'null'] },
            },
          },
        },
      },
    },
    desk: { type: 'object' },
    navigator: { type: 'object' },
  },
} as const;

const workspaceRouteSchema: FastifySchema = {
  summary: 'Workspace overview',
  tags: ['workspace'],
  querystring: workspaceQuerySchema,
  headers: workspaceHeadersSchema,
  response: {
    200: workspaceResponseSchema,
    400: errorResponseSchema,
    401: errorResponseSchema,
    403: errorResponseSchema,
    429: errorResponseSchema,
    500: errorResponseSchema,
  },
};

export function registerWorkspaceOverviewRoute(
  app: FastifyInstance,
  ctx: AppContext,
  onRequest?: (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>,
) {
  const { supabase } = ctx;

  app.get(
    '/workspace',
    {
      schema: workspaceRouteSchema,
      onRequest,
    },
    async (request, reply) => {
      const { orgId } = request.query as { orgId?: string };
      const userHeader = request.headers['x-user-id'];

      if (!orgId) {
        return reply.code(400).send({ error: 'orgId is required' });
      }

      if (!userHeader || typeof userHeader !== 'string') {
        return reply.code(400).send({ error: 'x-user-id header is required' });
      }

      try {
        await authorizeRequestWithGuards('workspace:view', orgId, userHeader, request);
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

        if (jurisdictionsResult.error) {
          request.log.error({ err: jurisdictionsResult.error }, 'workspace jurisdictions query failed');
        }
        if (mattersResult.error) {
          request.log.error({ err: mattersResult.error }, 'workspace matters query failed');
        }
        if (complianceResult.error) {
          request.log.error({ err: complianceResult.error }, 'workspace compliance query failed');
        }
        if (hitlResult.error) {
          request.log.error({ err: hitlResult.error }, 'workspace hitl query failed');
        }

        const matterCounts = new Map<string, number>();
        for (const row of matterRows as Array<{ jurisdiction_json?: unknown }>) {
          const jurisdiction = extractCountry(row.jurisdiction_json);
          const key = jurisdiction ?? 'UNK';
          matterCounts.set(key, (matterCounts.get(key) ?? 0) + 1);
        }

        const jurisdictions = (jurisdictionRows as Array<{
          code: string;
          name: string;
          eu: boolean;
          ohada: boolean;
        }>).map((row) => ({
          code: row.code,
          name: row.name,
          eu: row.eu,
          ohada: row.ohada,
          matterCount: matterCounts.get(row.code) ?? 0,
        }));

        const matters = (matterRows as Array<{
          id: string;
          question: string | null;
          risk_level: string | null;
          hitl_required: boolean | null;
          status: string | null;
          started_at: string | null;
          finished_at: string | null;
          jurisdiction_json?: unknown;
        }>).map((row) => ({
          id: row.id,
          question: row.question,
          status: row.status,
          riskLevel: row.risk_level,
          hitlRequired: row.hitl_required,
          startedAt: row.started_at,
          finishedAt: row.finished_at,
          jurisdiction: extractCountry(row.jurisdiction_json),
        }));

        const complianceWatch = (complianceRows as Array<{
          id: string;
          title: string | null;
          publisher: string | null;
          source_url: string | null;
          jurisdiction_code: string | null;
          consolidated: boolean | null;
          effective_date: string | null;
          created_at: string | null;
        }>).map((row) => ({
          id: row.id,
          title: row.title,
          publisher: row.publisher,
          url: row.source_url,
          jurisdiction: row.jurisdiction_code,
          consolidated: row.consolidated,
          effectiveDate: row.effective_date,
          createdAt: row.created_at,
        }));

        const hitlInbox = (hitlRows as Array<{
          id: string;
          run_id: string | null;
          reason: string | null;
          status: string | null;
          created_at: string | null;
        }>).map((row) => ({
          id: row.id,
          runId: row.run_id,
          reason: row.reason,
          status: row.status,
          createdAt: row.created_at,
        }));

        const pendingCount = hitlInbox.filter((item) => item.status === 'pending').length;

        return {
          jurisdictions,
          matters,
          complianceWatch,
          hitlInbox: {
            items: hitlInbox,
            pendingCount,
          },
          desk: buildPhaseCWorkspaceDesk(),
          navigator: buildPhaseCProcessNavigator(),
        };
      } catch (error) {
        if (error instanceof Error && 'statusCode' in error && typeof (error as any).statusCode === 'number') {
          return reply.code((error as any).statusCode).send({ error: error.message });
        }
        request.log.error({ err: error }, 'workspace overview failed');
        return reply.code(500).send({ error: 'workspace_failed' });
      }
    },
  );
}
