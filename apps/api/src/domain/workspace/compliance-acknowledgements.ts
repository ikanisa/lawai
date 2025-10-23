import type { FastifyInstance, FastifyReply, FastifyRequest, FastifySchema } from 'fastify';
import { authorizeRequestWithGuards } from '../../http/authorization.js';
import type { AppContext } from '../../types/context';
import {
  COMPLIANCE_ACK_TYPES,
  type ConsentEventInsert,
  fetchAcknowledgementEvents,
  recordAcknowledgementEvents,
  summariseAcknowledgements,
} from './compliance';
import { withRequestSpan } from '../../observability/spans.js';

const errorResponseSchema = {
  type: 'object',
  required: ['error'],
  properties: {
    error: { type: 'string' },
  },
} as const;

const acknowledgementsResponseSchema = {
  type: 'object',
  required: ['orgId', 'userId', 'acknowledgements'],
  properties: {
    orgId: { type: 'string' },
    userId: { type: 'string' },
    acknowledgements: {
      type: 'object',
      required: ['consent', 'councilOfEurope'],
      properties: {
        consent: {
          type: 'object',
          required: ['requiredVersion', 'acknowledgedVersion', 'acknowledgedAt', 'satisfied'],
          properties: {
            requiredVersion: { type: ['string', 'null'] },
            acknowledgedVersion: { type: ['string', 'null'] },
            acknowledgedAt: { type: ['string', 'null'] },
            satisfied: { type: 'boolean' },
          },
        },
        councilOfEurope: {
          type: 'object',
          required: ['requiredVersion', 'acknowledgedVersion', 'acknowledgedAt', 'satisfied'],
          properties: {
            requiredVersion: { type: ['string', 'null'] },
            acknowledgedVersion: { type: ['string', 'null'] },
            acknowledgedAt: { type: ['string', 'null'] },
            satisfied: { type: 'boolean' },
          },
        },
      },
    },
  },
} as const;

const acknowledgementsHeadersSchema = {
  type: 'object',
  required: ['x-user-id', 'x-org-id'],
  properties: {
    'x-user-id': { type: 'string' },
    'x-org-id': { type: 'string' },
  },
} as const;

const acknowledgementBodySchema = {
  type: 'object',
  properties: {
    consent: {
      type: 'object',
      required: ['type', 'version'],
      properties: {
        type: { type: 'string' },
        version: { type: 'string' },
      },
      nullable: true,
    },
    councilOfEurope: {
      type: 'object',
      required: ['version'],
      properties: {
        version: { type: 'string' },
      },
      nullable: true,
    },
  },
  additionalProperties: false,
} as const;

const acknowledgementsGetSchema: FastifySchema = {
  summary: 'List compliance acknowledgements',
  tags: ['workspace'],
  headers: acknowledgementsHeadersSchema,
  response: {
    200: acknowledgementsResponseSchema,
    400: errorResponseSchema,
    401: errorResponseSchema,
    403: errorResponseSchema,
    429: errorResponseSchema,
    500: errorResponseSchema,
  },
};

const acknowledgementsPostSchema: FastifySchema = {
  summary: 'Record compliance acknowledgements',
  tags: ['workspace'],
  headers: acknowledgementsHeadersSchema,
  body: acknowledgementBodySchema,
  response: {
    200: acknowledgementsResponseSchema,
    400: errorResponseSchema,
    401: errorResponseSchema,
    403: errorResponseSchema,
    429: errorResponseSchema,
    500: errorResponseSchema,
  },
};

export function registerComplianceAcknowledgementsRoutes(
  app: FastifyInstance,
  ctx: AppContext,
  onRequest?: (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>,
) {
  const { supabase } = ctx;

  app.get(
    '/compliance/acknowledgements',
    { schema: acknowledgementsGetSchema, onRequest },
    async (request, reply) => {
      const userHeader = request.headers['x-user-id'];
      if (!userHeader || typeof userHeader !== 'string') {
        return reply.code(401).send({ error: 'unauthorized' });
      }
      const orgHeader = request.headers['x-org-id'];
      if (!orgHeader || typeof orgHeader !== 'string') {
        return reply.code(400).send({ error: 'x-org-id header is required' });
      }

      let access: Awaited<ReturnType<typeof authorizeRequestWithGuards>>;
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
            const result = await fetchAcknowledgementEvents(supabase, orgHeader, userHeader);
            setAttribute('eventCount', result.length);
            return result;
          },
        );

        const acknowledgements = summariseAcknowledgements(access, events);
        return reply.send({ orgId: orgHeader, userId: userHeader, acknowledgements });
      } catch (error) {
        request.log.error({ err: error }, 'compliance_ack_fetch_failed');
        return reply.code(500).send({ error: 'compliance_ack_fetch_failed' });
      }
    },
  );

  app.post(
    '/compliance/acknowledgements',
    { schema: acknowledgementsPostSchema, onRequest },
    async (request, reply) => {
      const userHeader = request.headers['x-user-id'];
      if (!userHeader || typeof userHeader !== 'string') {
        return reply.code(401).send({ error: 'unauthorized' });
      }
      const orgHeader = request.headers['x-org-id'];
      if (!orgHeader || typeof orgHeader !== 'string') {
        return reply.code(400).send({ error: 'x-org-id header is required' });
      }

      const body = request.body as {
        consent?: { type: string; version: string } | null;
        councilOfEurope?: { version: string } | null;
      } | null;

      if (!body?.consent && !body?.councilOfEurope) {
        return reply.code(400).send({ error: 'invalid_body' });
      }

      let access: Awaited<ReturnType<typeof authorizeRequestWithGuards>>;
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

      const records: ConsentEventInsert[] = [];
      if (body?.consent) {
        records.push({
          user_id: userHeader,
          org_id: orgHeader,
          consent_type: body.consent.type,
          version: body.consent.version,
        });
      }
      if (body?.councilOfEurope) {
        records.push({
          user_id: userHeader,
          org_id: orgHeader,
          consent_type: COMPLIANCE_ACK_TYPES.councilOfEurope,
          version: body.councilOfEurope.version,
        });
      }

      try {
        await recordAcknowledgementEvents(request, supabase, orgHeader, userHeader, records);
      } catch (error) {
        request.log.error({ err: error }, 'compliance_ack_insert_failed');
        return reply.code(500).send({ error: 'compliance_ack_insert_failed' });
      }

      const events = await withRequestSpan(
        request,
        {
          name: 'compliance.acknowledgements.refresh',
          attributes: { orgId: orgHeader, userId: userHeader },
        },
        async ({ setAttribute }) => {
          const result = await fetchAcknowledgementEvents(supabase, orgHeader, userHeader);
          setAttribute('eventCount', result.length);
          return result;
        },
      );

      const acknowledgements = summariseAcknowledgements(access, events);
      return reply.send({ orgId: orgHeader, userId: userHeader, acknowledgements });
    },
  );
}
