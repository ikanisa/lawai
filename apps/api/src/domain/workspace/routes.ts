import { z } from 'zod';
import type { AppFastifyInstance } from '../../types/fastify.js';
import type { AppContext } from '../../types/context.js';
import { fetchWorkspaceOverview as defaultFetchWorkspaceOverview } from './services.js';
import type { WorkspaceFetchErrors } from './overview.js';

type WorkspaceServices = {
  fetchWorkspaceOverview: typeof defaultFetchWorkspaceOverview;
};

const workspaceQuerySchema = z.object({
  orgId: z.string().uuid('orgId must be a valid UUID'),
});

type WorkspaceQuery = z.infer<typeof workspaceQuerySchema>;

const WORKSPACE_SECTIONS = ['jurisdictions', 'matters', 'compliance', 'hitl'] as const;

const SECTION_LABELS: Record<(typeof WORKSPACE_SECTIONS)[number], string> = {
  jurisdictions: 'jurisdictions',
  matters: 'matters',
  compliance: 'compliance watch',
  hitl: 'HITL inbox',
};

type SerializedError = {
  message?: string;
  name?: string;
  stack?: string;
  [key: string]: unknown;
};

function serializeError(error: unknown): SerializedError {
  if (!error) {
    return { message: 'Unknown error' };
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  if (typeof error === 'string') {
    return { message: error };
  }

  if (typeof error === 'object') {
    return { ...(error as Record<string, unknown>) };
  }

  return { message: String(error) };
}

export async function registerWorkspaceRoutes(
  app: AppFastifyInstance,
  ctx: AppContext,
  services: WorkspaceServices = { fetchWorkspaceOverview: defaultFetchWorkspaceOverview },
): Promise<void> {
  const { supabase } = ctx;
  const workspaceGuard = ctx.rateLimits.workspace;

  app.get<{ Querystring: WorkspaceQuery }>('/workspace', async (request, reply) => {
    const parsed = workspaceQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid_query_parameters',
        message: 'Invalid query parameters',
        details: parsed.error.flatten(),
      });
    }

    if (workspaceGuard) {
      const allowed = await workspaceGuard(request, reply, ['workspace', parsed.data.orgId]);
      if (!allowed) {
        return;
      }
    }

    try {
      const { data, errors } = await services.fetchWorkspaceOverview(supabase, parsed.data.orgId);

      const errorEntries = Object.entries(errors ?? {}).filter((entry): entry is [
        keyof WorkspaceFetchErrors,
        unknown,
      ] => Boolean(entry[1]));

      if (errorEntries.length === 0) {
        return reply.send({
          data,
          meta: {
            status: 'ok' as const,
            warnings: [] as string[],
            errors: {} as Record<string, never>,
          },
        });
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

      return reply.code(statusCode).send({
        data,
        meta: {
          status,
          warnings,
          errors: serializedErrors,
        },
      });
    } catch (error) {
      request.log.error({ err: error }, 'workspace_overview_fetch_failed');
      const message = error instanceof Error ? error.message : 'Unexpected error while fetching workspace overview.';
      return reply.code(500).send({
        error: 'workspace_fetch_failed',
        message,
      });
    }
  });
}
