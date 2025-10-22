import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppContext } from '../../types/context';
import {
  fetchWorkspaceOverview as defaultFetchWorkspaceOverview,
  type WorkspaceFetchErrors,
} from './services.js';

type WorkspaceServices = {
  fetchWorkspaceOverview: typeof defaultFetchWorkspaceOverview;
};

const defaultServices: WorkspaceServices = {
  fetchWorkspaceOverview: defaultFetchWorkspaceOverview,
};

const workspaceQuerySchema = z.object({
  orgId: z.string().uuid(),
});

const WORKSPACE_SECTIONS: Array<keyof WorkspaceFetchErrors> = [
  'jurisdictions',
  'matters',
  'compliance',
  'hitl',
];

const SECTION_LABELS: Record<keyof WorkspaceFetchErrors, string> = {
  jurisdictions: 'jurisdictions',
  matters: 'matters',
  compliance: 'compliance watch',
  hitl: 'HITL inbox',
};

type SerializedError = {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
};

const serializeError = (input: unknown): SerializedError => {
  if (input && typeof input === 'object') {
    const candidate = input as Partial<SerializedError> & { message?: unknown };
    const message = typeof candidate.message === 'string' ? candidate.message : 'Unknown error';
    const code = typeof candidate.code === 'string' ? candidate.code : undefined;
    const details = typeof candidate.details === 'string' ? candidate.details : undefined;
    const hint = typeof candidate.hint === 'string' ? candidate.hint : undefined;
    return { message, code, details, hint };
  }
  return { message: 'Unknown error' };
};

export async function registerWorkspaceRoutes(
  app: FastifyInstance,
  ctx: AppContext,
  services: WorkspaceServices = defaultServices,
) {
  app.get<{ Querystring: z.infer<typeof workspaceQuerySchema> }>('/workspace', async (request, reply) => {
    const parse = workspaceQuerySchema.safeParse(request.query);
    if (!parse.success) {
      return reply.code(400).send({
        error: 'invalid_query_parameters',
        message: 'Invalid query parameters',
        details: parse.error.flatten(),
      });
    }

    const { orgId } = parse.data;
    const { supabase } = ctx;

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
