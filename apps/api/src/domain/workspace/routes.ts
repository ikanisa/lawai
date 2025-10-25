import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { authorizeRequestWithGuards } from '../../http/authorization.js';
import { enforceRateLimit, type RateLimiter } from '../../rate-limit.js';
import type { AppContext } from '../../types/context';
import type { AppFastifyInstance } from '../../types/fastify.js';
import {
  fetchWorkspaceOverview as defaultFetchWorkspaceOverview,
  type WorkspaceFetchErrors,
} from './services.js';
import { workspaceQuerySchema, type WorkspaceQuery } from './schemas.js';

const SECTION_LABELS: Record<keyof WorkspaceFetchErrors, string> = {
  jurisdictions: 'jurisdictions',
  matters: 'matters',
  compliance: 'compliance watch',
  hitl: 'HITL inbox',
};

const WORKSPACE_SECTIONS = Object.keys(SECTION_LABELS) as Array<keyof WorkspaceFetchErrors>;

type SerializedError = {
  name?: string;
  message: string;
  stack?: string;
  cause?: unknown;
  [key: string]: unknown;
};

const defaultServices = {
  fetchWorkspaceOverview: defaultFetchWorkspaceOverview,
  limiter: undefined as RateLimiter | undefined,
};

type WorkspaceServices = {
  fetchWorkspaceOverview: (
    supabase: SupabaseClient,
    orgId: string,
  ) => Promise<{ data: unknown; errors: WorkspaceFetchErrors }>;
  limiter?: RateLimiter;
};

function serializeUnknownError(error: unknown): SerializedError {
  if (error instanceof Error) {
    const serialized: SerializedError = {
      name: error.name,
      message: error.message,
    };
    if (error.stack) {
      serialized.stack = error.stack;
    }
    const cause = (error as Error & { cause?: unknown }).cause;
    if (cause !== undefined) {
      serialized.cause = cause;
    }
    return serialized;
  }

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    const message = typeof record.message === 'string' ? record.message : JSON.stringify(record);
    return { ...record, message } as SerializedError;
  }

  return {
    message: typeof error === 'string' ? error : JSON.stringify(error),
  } as SerializedError;
}

export async function registerWorkspaceRoutes(
  app: AppFastifyInstance,
  ctx: AppContext,
  services: Partial<WorkspaceServices> = {},
) {
  const { supabase } = ctx;
  const { fetchWorkspaceOverview, limiter } = { ...defaultServices, ...services };
  const guard = ctx.rateLimits.workspace;

  app.get<{ Querystring: WorkspaceQuery }>('/workspace', async (request, reply) => {
    const parsed = workspaceQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid_query_parameters',
        message: 'Invalid query parameters',
        details: parsed.error.flatten(),
      });
    }

    const { orgId } = parsed.data;
    const userHeader = request.headers['x-user-id'];

    if (!userHeader || typeof userHeader !== 'string') {
      return reply.code(400).send({ error: 'x-user-id header is required' });
    }

    if (limiter) {
      try {
        const allowed = await enforceRateLimit(limiter, request, reply, `workspace:${orgId}:${userHeader}`);
        if (!allowed) {
          return;
        }
      } catch (error) {
        request.log.warn({ err: error, orgId, userId: userHeader }, 'workspace_rate_limit_failed');
      }
    }

    if (guard) {
      try {
        const limited = await guard(request, reply, [orgId, userHeader]);
        if (limited) {
          return;
        }
      } catch (error) {
        request.log.warn({ err: error, orgId, userId: userHeader }, 'workspace_guard_failed');
      }
    }

    try {
      await authorizeRequestWithGuards('workspace:view', orgId, userHeader, request);

      const { data, errors } = await fetchWorkspaceOverview(supabase, orgId);

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
        serializedErrors[section] = serializeUnknownError(error);
        const label = SECTION_LABELS[section] ?? section;
        warnings.push(`Partial data: failed to load ${label}.`);
      }

      const allSectionsFailed = errorEntries.length === WORKSPACE_SECTIONS.length;
      const statusCode = allSectionsFailed ? 502 : 206;
      const status = allSectionsFailed ? 'error' : 'partial';
      const logMethod = allSectionsFailed
        ? request.log.error.bind(request.log)
        : request.log.warn.bind(request.log);

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
      request.log.error({ err: error }, 'workspace_overview_fetch_failed');
      const message = error instanceof Error ? error.message : 'Unexpected error while fetching workspace overview.';
      return reply.code(500).send({
        error: 'workspace_fetch_failed',
        message,
      });
    }
  });
}
