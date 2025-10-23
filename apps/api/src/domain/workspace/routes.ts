import { z } from 'zod';
import type { AppContext } from '../../types/context';
import type { AppFastifyInstance } from '../../types/fastify.js';

type WorkspaceServices = {
  fetchWorkspaceOverview: typeof defaultFetchWorkspaceOverview;
};

export async function registerWorkspaceRoutes(app: AppFastifyInstance, ctx: AppContext) {
  app.get<{ Querystring: z.infer<typeof workspaceQuerySchema> }>('/workspace', async (request, reply) => {
    const parse = workspaceQuerySchema.safeParse(request.query);
    if (!parse.success) {
      return reply.code(400).send({
        error: 'invalid_query_parameters',
        message: 'Invalid query parameters',
        details: parse.error.flatten(),
      });
    }
  } catch (error) {
    request.log.warn({ err: error }, 'workspace_rate_limit_failed');
  }
  return true;
}

export async function registerWorkspaceRoutes(app: FastifyInstance, ctx: AppContext) {
  app.get<{ Querystring: WorkspaceQuery }>(
    '/workspace',
    {
      schema: {
        headers: {
          type: 'object',
          properties: { 'x-user-id': { type: 'string' } },
          required: ['x-user-id'],
        },
        querystring: {
          type: 'object',
          properties: { orgId: { type: 'string' } },
          required: ['orgId'],
        },
        response: { 200: { type: 'object', additionalProperties: true } },
      },
    },
    async (request, reply) => {
      if (!enforceRateLimit(workspaceLimiter, request, reply)) {
        return;
      }

    try {
      const { data, errors } = await services.fetchWorkspaceOverview(supabase, orgId);

      const errorEntries = Object.entries(errors ?? {}).filter((entry): entry is [
        keyof WorkspaceFetchErrors,
        unknown,
      ] => Boolean(entry[1]));

      if (errorEntries.length === 0) {
        return {
          data,
          meta: {
            status: 'ok' as const,
            warnings: [] as string[],
            errors: {} as Record<string, never>,
          },
        };
      }

      const serializedErrors: Partial<Record<keyof WorkspaceFetchErrors, SerializedError>> = {};
      const warnings: string[] = [];

      for (const [section, error] of errorEntries) {
        serializedErrors[section] = serializeError(error);
        const label = SECTION_LABELS[section] ?? section;
        warnings.push(`Partial data: failed to load ${label}.`);
      }

      const allSectionsFailed = errorEntries.length === WORKSPACE_SECTIONS.length;
      const statusCode = allSectionsFailed ? 502 : 206;
      const status = allSectionsFailed ? 'error' : 'partial';
      const logMethod = allSectionsFailed ? request.log.error.bind(request.log) : request.log.warn.bind(request.log);

      logMethod({ errors: serializedErrors, orgId }, 'workspace_overview_incomplete');

      return reply.code(statusCode).send({
        data,
        meta: {
          status,
          warnings,
          errors: serializedErrors,
        },
      });
    } catch (error) {
      request.log.error({ err: error, orgId }, 'workspace_overview_fetch_failed');
      return reply.code(500).send({
        error: 'workspace_fetch_failed',
        message:
          error instanceof Error
            ? error.message
            : 'Unexpected error while fetching workspace overview.',
      });
    }
  });
}
