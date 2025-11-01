import { authorizeRequestWithGuards } from '../../http/authorization.js';
import type { AppFastifyInstance } from '../../types/fastify.js';
import type { AppContext } from '../../types/context.js';
import { fetchWorkspaceOverview as defaultFetchWorkspaceOverview } from './index.js';
import type { WorkspaceFetchErrors } from './overview.js';
import { parseWithSchema } from '../../http/validation.js';
import { sendErrorResponse } from '../../http/errors.js';
import { createRoleGuard } from '../../http/guards/roles.js';
import {
  WorkspaceHeadersSchema,
  WorkspaceQuerySchema,
  WorkspaceResponseSchema,
} from '../../modules/workspace/http/schema.js';
import type { OrgRole } from '../../access-control.js';

const WORKSPACE_ROLES: OrgRole[] = ['owner', 'admin', 'member', 'reviewer', 'viewer', 'compliance_officer', 'auditor'];

const ensureWorkspaceRole = createRoleGuard(WORKSPACE_ROLES, { onDeniedMessage: 'workspace_access_denied' });

type WorkspaceServices = {
  fetchWorkspaceOverview: typeof defaultFetchWorkspaceOverview;
};

const defaultServices: WorkspaceServices = {
  fetchWorkspaceOverview: defaultFetchWorkspaceOverview,
};

export async function registerWorkspaceRoutes(
  app: AppFastifyInstance,
  ctx: AppContext,
  services: Partial<WorkspaceServices> = {},
) {
  const { fetchWorkspaceOverview } = { ...defaultServices, ...services };
  const workspaceGuard = ctx.rateLimits.workspace;
  const { supabase } = ctx;

  app.get('/workspace', async (request, reply) => {
    try {
      const { orgId } = parseWithSchema(WorkspaceQuerySchema, request.query, 'query');
      const headers = parseWithSchema(WorkspaceHeadersSchema, request.headers, 'headers');
      const userId = headers['x-user-id'];

      if (workspaceGuard) {
        const blocked = await workspaceGuard(request, reply, ['workspace', orgId]);
        if (blocked) {
          return;
        }
      }

      const access = await authorizeRequestWithGuards('workspace:view', orgId, userId, request);
      if (!ensureWorkspaceRole(access, reply).allowed) {
        return;
      }

      const { data, errors } = await fetchWorkspaceOverview(supabase, orgId);

      logWorkspaceErrors(request, errors, orgId);

      const meta = buildWorkspaceMeta(errors);
      const statusCode = meta.status === 'partial' ? 206 : 200;
      const payload = WorkspaceResponseSchema.parse({ ...data, meta });

      return reply.code(statusCode).send(payload);
    } catch (error) {
      return sendErrorResponse(reply, error, request);
    }
  });
}

function buildWorkspaceMeta(errors: WorkspaceFetchErrors) {
  const warnings: string[] = [];
  const details: Record<string, unknown> = {};

  if (errors.jurisdictions) {
    warnings.push('Partial data: failed to load jurisdictions.');
    details.jurisdictions = errors.jurisdictions;
  }
  if (errors.matters) {
    warnings.push('Partial data: failed to load matters.');
    details.matters = errors.matters;
  }
  if (errors.compliance) {
    warnings.push('Partial data: failed to load compliance watch.');
    details.compliance = errors.compliance;
  }
  if (errors.hitl) {
    warnings.push('Partial data: failed to load HITL inbox.');
    details.hitl = errors.hitl;
  }

  return {
    status: warnings.length > 0 ? 'partial' : 'ok',
    warnings,
    errors: details,
  };
}

function logWorkspaceErrors(
  request: { log: AppFastifyInstance['log'] },
  errors: WorkspaceFetchErrors,
  orgId: string,
) {
  if (errors.jurisdictions) {
    request.log.error({ err: errors.jurisdictions, orgId }, 'workspace_jurisdictions_query_failed');
  }
  if (errors.matters) {
    request.log.error({ err: errors.matters, orgId }, 'workspace_matters_query_failed');
  }
  if (errors.compliance) {
    request.log.error({ err: errors.compliance, orgId }, 'workspace_compliance_query_failed');
  }
  if (errors.hitl) {
    request.log.error({ err: errors.hitl, orgId }, 'workspace_hitl_query_failed');
  }
}

