import { z } from 'zod';
import { authorizeRequestWithGuards } from '../../http/authorization.js';
import { fetchWorkspaceOverview as defaultFetchWorkspaceOverview } from './services.js';
const workspaceQuerySchema = z.object({
    orgId: z.string().uuid('orgId must be a valid UUID'),
});
const workspaceHeadersSchema = z.object({
    'x-user-id': z.string().min(1, 'x-user-id header is required'),
});
const defaultServices = {
    fetchWorkspaceOverview: defaultFetchWorkspaceOverview,
};
export async function registerWorkspaceRoutes(app, ctx, services = {}) {
    const { fetchWorkspaceOverview } = { ...defaultServices, ...services };
    const workspaceGuard = ctx.rateLimits.workspace;
    const { supabase } = ctx;
    app.get('/workspace', async (request, reply) => {
        const parsedQuery = workspaceQuerySchema.safeParse(request.query);
        if (!parsedQuery.success) {
            return reply.code(400).send({
                error: 'invalid_query_parameters',
                message: 'Invalid query parameters',
                details: parsedQuery.error.flatten(),
            });
        }
        const parsedHeaders = workspaceHeadersSchema.safeParse(request.headers);
        if (!parsedHeaders.success) {
            const hasUserError = parsedHeaders.error.issues.some((issue) => issue.path?.[0] === 'x-user-id');
            if (hasUserError) {
                return reply.code(400).send({ error: 'x-user-id header is required' });
            }
            return reply.code(400).send({
                error: 'invalid_headers',
                message: 'Invalid headers',
                details: parsedHeaders.error.flatten(),
            });
        }
        const userId = parsedHeaders.data['x-user-id'];
        const orgId = parsedQuery.data.orgId;
        if (workspaceGuard) {
            const blocked = await workspaceGuard(request, reply, ['workspace', orgId]);
            if (blocked) {
                return;
            }
        }
        try {
            await authorizeRequestWithGuards('workspace:view', orgId, userId, request);
        }
        catch (error) {
            if (error instanceof Error &&
                'statusCode' in error &&
                typeof error.statusCode === 'number') {
                return reply.code(error.statusCode).send({ error: error.message });
            }
            request.log.error({ err: error }, 'workspace_overview_authorization_failed');
            return reply.code(403).send({ error: 'forbidden' });
        }
        try {
            const { data, errors } = await fetchWorkspaceOverview(supabase, orgId);
            logWorkspaceErrors(request, errors, orgId);
            const meta = buildWorkspaceMeta(errors);
            const statusCode = meta.status === 'partial' ? 206 : 200;
            return reply.code(statusCode).send({ ...data, meta });
        }
        catch (error) {
            if (isHttpError(error)) {
                throw error;
            }
            request.log.error({ err: error }, 'workspace_overview_fetch_failed');
            const message = error instanceof Error ? error.message : 'Unexpected error while fetching workspace overview.';
            return reply.code(500).send({
                error: 'workspace_fetch_failed',
                message,
            });
        }
    });
}
function buildWorkspaceMeta(errors) {
    const warnings = [];
    const details = {};
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
function logWorkspaceErrors(request, errors, orgId) {
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
function isHttpError(error) {
    return Boolean(error &&
        typeof error === 'object' &&
        'statusCode' in error &&
        typeof error.statusCode === 'number');
}
