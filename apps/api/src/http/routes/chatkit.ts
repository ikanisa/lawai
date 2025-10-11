import type { FastifyInstance } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  cancelChatSession,
  createChatSession,
  getChatSession,
  listSessionsForOrg,
  recordChatEvent,
  type ChatSessionStatus,
} from '../../chatkit.js';
import { authorizeRequestWithGuards } from '../authorization.js';
import { createChatSessionSchema, recordChatEventSchema } from '../schemas/chatkit.js';

interface ChatkitRouteOptions {
  supabase: SupabaseClient;
}

export function registerChatkitRoutes(app: FastifyInstance, { supabase }: ChatkitRouteOptions): void {
  app.post<{ Body: unknown }>(
    '/chatkit/sessions',
    {
      schema: {
        headers: {
          type: 'object',
          properties: { 'x-user-id': { type: 'string' } },
          required: ['x-user-id'],
        },
        body: {
          type: 'object',
          properties: {
            orgId: { type: 'string' },
            agentName: { type: 'string' },
            channel: { type: 'string' },
            metadata: { type: ['object', 'null'] },
          },
          required: ['orgId', 'agentName', 'channel'],
          additionalProperties: true,
        },
        response: { 201: { type: 'object', additionalProperties: true } },
      },
    },
    async (request, reply) => {
    const parsed = createChatSessionSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_session_payload' });
    }

    const userHeader = request.headers['x-user-id'];
    if (!userHeader || typeof userHeader !== 'string') {
      return reply.code(400).send({ error: 'x-user-id header is required' });
    }

    try {
      await authorizeRequestWithGuards('runs:execute', parsed.data.orgId, userHeader, request);
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
        return reply.code(error.statusCode).send({ error: error.message });
      }
      request.log.error({ err: error }, 'chatkit session authorization failed');
      return reply.code(403).send({ error: 'forbidden' });
    }

    try {
      const session = await createChatSession(
        supabase,
        {
          orgId: parsed.data.orgId,
          userId: userHeader,
          agentName: parsed.data.agentName,
          channel: parsed.data.channel,
          metadata: parsed.data.metadata,
        },
        request.log,
      );
      return reply.code(201).send(session);
    } catch (error) {
      request.log.error({ err: error }, 'chatkit session creation failed');
      return reply.code(500).send({ error: 'chat_session_failed' });
    }
    },
  );

  app.get<{ Querystring: { orgId?: string; status?: ChatSessionStatus } }>(
    '/chatkit/sessions',
    async (request, reply) => {
      const { orgId, status } = request.query;
      if (!orgId) {
        return reply.code(400).send({ error: 'orgId is required' });
      }

      const userHeader = request.headers['x-user-id'];
      if (!userHeader || typeof userHeader !== 'string') {
        return reply.code(400).send({ error: 'x-user-id header is required' });
      }

      try {
        await authorizeRequestWithGuards('runs:execute', orgId, userHeader, request);
        const sessions = await listSessionsForOrg(supabase, orgId, status);
        return reply.send({ sessions });
      } catch (error) {
        if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
          return reply.code(error.statusCode).send({ error: error.message });
        }
        request.log.error({ err: error }, 'chatkit session list failed');
        return reply.code(500).send({ error: 'chat_session_list_failed' });
      }
    },
  );

  app.get<{ Params: { id: string } }>('/chatkit/sessions/:id', async (request, reply) => {
    const { id } = request.params;
    const userHeader = request.headers['x-user-id'];
    if (!userHeader || typeof userHeader !== 'string') {
      return reply.code(400).send({ error: 'x-user-id header is required' });
    }

    try {
      const session = await getChatSession(supabase, id, {
        includeChatkit: true,
        logger: request.log,
      });
      if (!session) {
        return reply.code(404).send({ error: 'chat_session_not_found' });
      }

      await authorizeRequestWithGuards('runs:execute', session.orgId, userHeader, request);
      return reply.send(session);
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
        return reply.code(error.statusCode).send({ error: error.message });
      }
      request.log.error({ err: error }, 'chatkit session fetch failed');
      return reply.code(500).send({ error: 'chat_session_fetch_failed' });
    }
  });

  app.post<{ Params: { id: string } }>(
    '/chatkit/sessions/:id/cancel',
    {
      schema: {
        params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
        headers: { type: 'object', properties: { 'x-user-id': { type: 'string' } }, required: ['x-user-id'] },
      },
    },
    async (request, reply) => {
    const { id } = request.params;
    const userHeader = request.headers['x-user-id'];
    if (!userHeader || typeof userHeader !== 'string') {
      return reply.code(400).send({ error: 'x-user-id header is required' });
    }

    try {
      const session = await getChatSession(supabase, id);
      if (!session) {
        return reply.code(404).send({ error: 'chat_session_not_found' });
      }

      await authorizeRequestWithGuards('runs:execute', session.orgId, userHeader, request);
      const updated = await cancelChatSession(supabase, id, { logger: request.log });
      if (!updated) {
        return reply.code(404).send({ error: 'chat_session_not_found' });
      }

      await recordChatEvent(supabase, {
        sessionId: id,
        type: 'session.cancelled',
        actorType: 'user',
        actorId: userHeader,
      });

      return reply.send(updated);
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
        return reply.code(error.statusCode).send({ error: error.message });
      }
      request.log.error({ err: error }, 'chatkit session cancel failed');
      return reply.code(500).send({ error: 'chat_session_cancel_failed' });
    }
    },
  );

  app.post<{ Params: { id: string }; Body: unknown }>(
    '/chatkit/sessions/:id/events',
    {
      schema: {
        params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
        headers: { type: 'object', properties: { 'x-user-id': { type: 'string' } }, required: ['x-user-id'] },
        body: {
          type: 'object',
          properties: {
            type: { type: 'string' },
            payload: { type: ['object', 'array', 'string', 'number', 'boolean', 'null'] },
            actorType: { type: ['string', 'null'] },
            actorId: { type: ['string', 'null'] },
          },
          required: ['type'],
          additionalProperties: true,
        },
        response: { 202: { type: 'object', additionalProperties: true } },
      },
    },
    async (request, reply) => {
    const { id } = request.params;
    const parsed = recordChatEventSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_event_payload' });
    }

    const userHeader = request.headers['x-user-id'];
    if (!userHeader || typeof userHeader !== 'string') {
      return reply.code(400).send({ error: 'x-user-id header is required' });
    }

    try {
      const session = await getChatSession(supabase, id);
      if (!session) {
        return reply.code(404).send({ error: 'chat_session_not_found' });
      }

      await authorizeRequestWithGuards('runs:execute', session.orgId, userHeader, request);
      await recordChatEvent(supabase, {
        sessionId: id,
        type: parsed.data.type,
        payload: parsed.data.payload,
        actorType: parsed.data.actorType ?? 'user',
        actorId: parsed.data.actorId ?? userHeader,
      });

      return reply.code(202).send({ status: 'accepted' });
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
        return reply.code(error.statusCode).send({ error: error.message });
      }
      request.log.error({ err: error }, 'chatkit event record failed');
      return reply.code(500).send({ error: 'chat_session_event_failed' });
    }
    },
  );
}
