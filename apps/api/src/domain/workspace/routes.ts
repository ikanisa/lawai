import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { authorizeRequestWithGuards } from '../../http/authorization.js';
import { withRequestSpan } from '../../observability/spans.js';
import { InMemoryRateLimiter } from '../../rate-limit.js';
import type { AppContext } from '../../types/context';
import {
  complianceAcknowledgementBodySchema,
  complianceStatusQuerySchema,
  workspaceQuerySchema,
  type ComplianceAcknowledgementBody,
  type ComplianceStatusQuery,
  type WorkspaceQuery,
} from './schemas.js';
import {
  acknowledgeCompliance,
  fetchAcknowledgementEvents,
  getComplianceStatus,
  getWorkspaceOverview,
  summariseAcknowledgements,
  WorkspaceServiceError,
} from './service.js';

const workspaceLimiter = new InMemoryRateLimiter({ limit: 20, windowMs: 60_000 });
const complianceStatusLimiter = new InMemoryRateLimiter({ limit: 30, windowMs: 60_000 });
const complianceAckLimiter = new InMemoryRateLimiter({ limit: 15, windowMs: 60_000 });

function enforceRateLimit(
  limiter: InMemoryRateLimiter,
  request: FastifyRequest,
  reply: FastifyReply,
): boolean {
  try {
    const hit = limiter.hit(request.ip || 'unknown');
    if (!hit.allowed) {
      reply.header('Retry-After', Math.ceil((hit.resetAt - Date.now()) / 1000));
      void reply.code(429).send({ error: 'rate_limited' });
      return false;
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

      const parse = workspaceQuerySchema.safeParse(request.query);
      if (!parse.success) {
        return reply.code(400).send({ error: 'invalid_query', details: parse.error.flatten() });
      }

      const userHeader = request.headers['x-user-id'];
      if (!userHeader || typeof userHeader !== 'string') {
        return reply.code(400).send({ error: 'x-user-id header is required' });
      }

      try {
        await authorizeRequestWithGuards('workspace:view', parse.data.orgId, userHeader, request);
        const overview = await getWorkspaceOverview(ctx, { orgId: parse.data.orgId, logger: request.log });
        return reply.send(overview);
      } catch (error) {
        if (error instanceof WorkspaceServiceError) {
          return reply.code(error.statusCode).send({ error: error.message });
        }
        if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
          return reply.code(error.statusCode).send({ error: error.message });
        }
        request.log.error({ err: error }, 'workspace_overview_failed');
        return reply.code(500).send({ error: 'workspace_failed' });
      }
    },
  );

  app.get<{ Querystring: ComplianceStatusQuery }>(
    '/compliance/status',
    {
      schema: {
        headers: {
          type: 'object',
          properties: { 'x-user-id': { type: 'string' }, 'x-org-id': { type: 'string' } },
          required: ['x-user-id', 'x-org-id'],
        },
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', minimum: 1, maximum: 25 },
          },
        },
        response: { 200: { type: 'object', additionalProperties: true } },
      },
    },
    async (request, reply) => {
      if (!enforceRateLimit(complianceStatusLimiter, request, reply)) {
        return;
      }

      const userHeader = request.headers['x-user-id'];
      if (!userHeader || typeof userHeader !== 'string') {
        return reply.code(401).send({ error: 'unauthorized' });
      }
      const orgHeader = request.headers['x-org-id'];
      if (!orgHeader || typeof orgHeader !== 'string') {
        return reply.code(400).send({ error: 'x-org-id header is required' });
      }

      const parsed = complianceStatusQuerySchema.safeParse(request.query ?? {});
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_query', details: parsed.error.flatten() });
      }

      try {
        const access = await authorizeRequestWithGuards('workspace:view', orgHeader, userHeader, request);
        const result = await getComplianceStatus(ctx, {
          orgId: orgHeader,
          userId: userHeader,
          limit: parsed.data.limit ?? 5,
          access,
          logger: request.log,
        });
        return reply.send({
          orgId: orgHeader,
          userId: userHeader,
          ...result,
        });
      } catch (error) {
        if (error instanceof WorkspaceServiceError) {
          return reply.code(error.statusCode).send({ error: error.message });
        }
        if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
          return reply.code(error.statusCode).send({ error: error.message });
        }
        request.log.error({ err: error }, 'compliance_status_failed');
        return reply.code(500).send({ error: 'compliance_status_query_failed' });
      }
    },
  );

  app.get(
    '/compliance/acknowledgements',
    {
      schema: {
        headers: {
          type: 'object',
          properties: { 'x-user-id': { type: 'string' }, 'x-org-id': { type: 'string' } },
          required: ['x-user-id', 'x-org-id'],
        },
        response: { 200: { type: 'object', additionalProperties: true } },
      },
    },
    async (request, reply) => {
      if (!enforceRateLimit(complianceAckLimiter, request, reply)) {
        return;
      }

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
        access = await withRequestSpan(
          request,
          {
            name: 'compliance.acknowledgements.authorize',
            attributes: { orgId: orgHeader, userId: userHeader },
          },
          async () => authorizeRequestWithGuards('workspace:view', orgHeader, userHeader, request),
        );
      } catch (error) {
        const status = (error as Error & { statusCode?: number }).statusCode ?? 403;
        return reply.code(status).send({ error: 'forbidden' });
      }

      try {
        const events = await withRequestSpan(
          request,
          {
            name: 'compliance.acknowledgements.fetch',
            attributes: { orgId: orgHeader, userId: userHeader },
          },
          async ({ setAttribute }) => {
            const result = await fetchAcknowledgementEvents(ctx, orgHeader, userHeader);
            setAttribute('eventCount', result.length);
            return result;
          },
        );

        const acknowledgements = summariseAcknowledgements(access, events);
        return reply.send({ orgId: orgHeader, userId: userHeader, acknowledgements });
      } catch (error) {
        if (error instanceof WorkspaceServiceError) {
          return reply.code(error.statusCode).send({ error: error.message });
        }
        request.log.error({ err: error }, 'compliance_ack_fetch_failed');
        return reply.code(500).send({ error: 'compliance_ack_fetch_failed' });
      }
    },
  );

  app.post<{ Body: ComplianceAcknowledgementBody }>(
    '/compliance/acknowledgements',
    {
      schema: {
        headers: {
          type: 'object',
          properties: { 'x-user-id': { type: 'string' }, 'x-org-id': { type: 'string' } },
          required: ['x-user-id', 'x-org-id'],
        },
        body: { type: 'object', additionalProperties: true },
        response: { 200: { type: 'object', additionalProperties: true } },
      },
    },
    async (request, reply) => {
      if (!enforceRateLimit(complianceAckLimiter, request, reply)) {
        return;
      }

      const userHeader = request.headers['x-user-id'];
      if (!userHeader || typeof userHeader !== 'string') {
        return reply.code(401).send({ error: 'unauthorized' });
      }
      const orgHeader = request.headers['x-org-id'];
      if (!orgHeader || typeof orgHeader !== 'string') {
        return reply.code(400).send({ error: 'x-org-id header is required' });
      }

      const parsed = complianceAcknowledgementBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.code(400).send({ error: 'invalid_body', details: parsed.error.flatten() });
      }

      let access;
      try {
        access = await withRequestSpan(
          request,
          {
            name: 'compliance.acknowledgements.authorize',
            attributes: { orgId: orgHeader, userId: userHeader },
          },
          async () => authorizeRequestWithGuards('workspace:view', orgHeader, userHeader, request),
        );
      } catch (error) {
        const status = (error as Error & { statusCode?: number }).statusCode ?? 403;
        return reply.code(status).send({ error: 'forbidden' });
      }

      try {
        const acknowledgements = await acknowledgeCompliance(ctx, {
          request,
          orgId: orgHeader,
          userId: userHeader,
          access,
          payload: parsed.data,
        });
        return reply.send({ orgId: orgHeader, userId: userHeader, acknowledgements });
      } catch (error) {
        if (error instanceof WorkspaceServiceError) {
          return reply.code(error.statusCode).send({ error: error.message });
        }
        request.log.error({ err: error }, 'compliance_ack_insert_failed');
        return reply.code(500).send({ error: 'compliance_ack_insert_failed' });
      }
    },
  );
}
