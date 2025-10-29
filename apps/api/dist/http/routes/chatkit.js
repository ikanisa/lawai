import { cancelChatSession, createChatSession, getChatSession, listSessionsForOrg, recordChatEvent, } from '../../chatkit.js';
import { authorizeRequestWithGuards } from '../authorization.js';
import { createChatSessionSchema, recordChatEventSchema } from '../schemas/chatkit.js';
import { withRequestSpan } from '../../observability/spans.js';
import { incrementCounter } from '../../observability/metrics.js';
function isAuthorizationError(error) {
    return error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number';
}
function parseIncludeSecret(value) {
    if (!value)
        return false;
    return value === '1' || value === 'true';
}
function toErrorResponse(error) {
    if (isAuthorizationError(error)) {
        return { statusCode: error.statusCode ?? 403, body: { error: error.message } };
    }
    return { statusCode: 403, body: { error: 'forbidden' } };
}
export function registerChatkitRoutes(app, { supabase }) {
    app.post('/chatkit/sessions', {
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
                required: ['orgId'],
                additionalProperties: true,
            },
            response: { 201: { type: 'object', additionalProperties: true } },
        },
    }, async (request, reply) => {
        const parsed = createChatSessionSchema.safeParse(request.body ?? {});
        if (!parsed.success) {
            return reply.code(400).send({ error: 'invalid_session_payload' });
        }
        const userHeader = request.headers['x-user-id'];
        if (!userHeader || typeof userHeader !== 'string') {
            return reply.code(400).send({ error: 'x-user-id header is required' });
        }
        const channel = parsed.data.channel ?? 'web';
        const agentName = parsed.data.agentName ?? 'avocat-francophone';
        const metadata = parsed.data.metadata ?? {};
        return withRequestSpan(request, {
            name: 'chatkit.sessions.create',
            attributes: { orgId: parsed.data.orgId, channel, agentName },
        }, async ({ logger, setAttribute }) => {
            try {
                await authorizeRequestWithGuards('runs:execute', parsed.data.orgId, userHeader, request);
                setAttribute('authorized', true);
            }
            catch (error) {
                const response = toErrorResponse(error);
                logger.warn({ err: error }, 'chatkit_session_authorization_failed');
                reply.code(response.statusCode);
                return response.body;
            }
            try {
                const session = await createChatSession(supabase, {
                    orgId: parsed.data.orgId,
                    userId: userHeader,
                    agentName,
                    channel,
                    metadata,
                }, logger);
                const chatkitSessionId = session.chatkit?.sessionId ?? session.chatkitSessionId ?? null;
                setAttribute('sessionId', session.id);
                setAttribute('chatkitSessionId', chatkitSessionId);
                incrementCounter('chatkit.sessions.created', {
                    channel: session.channel,
                    agent: session.agentName,
                });
                logger.info({
                    supabaseSessionId: session.id,
                    chatkitSessionId,
                    status: session.status,
                }, 'chatkit_session_created');
                reply.code(201);
                return session;
            }
            catch (error) {
                logger.error({ err: error }, 'chatkit_session_creation_failed');
                reply.code(500);
                return { error: 'chat_session_failed' };
            }
        });
    });
    app.get('/chatkit/sessions', async (request, reply) => {
        const { orgId, status } = request.query;
        if (!orgId) {
            return reply.code(400).send({ error: 'orgId is required' });
        }
        const userHeader = request.headers['x-user-id'];
        if (!userHeader || typeof userHeader !== 'string') {
            return reply.code(400).send({ error: 'x-user-id header is required' });
        }
        return withRequestSpan(request, {
            name: 'chatkit.sessions.list',
            attributes: { orgId, status: status ?? 'all' },
        }, async ({ logger, setAttribute }) => {
            try {
                await authorizeRequestWithGuards('runs:execute', orgId, userHeader, request);
                setAttribute('authorized', true);
            }
            catch (error) {
                const response = toErrorResponse(error);
                logger.warn({ err: error }, 'chatkit_session_list_authorization_failed');
                reply.code(response.statusCode);
                return response.body;
            }
            try {
                const sessions = await listSessionsForOrg(supabase, orgId, status);
                setAttribute('resultCount', sessions.length);
                incrementCounter('chatkit.sessions.listed', { status: status ?? 'all' });
                logger.info({ orgId, status, count: sessions.length }, 'chatkit_sessions_listed');
                return { sessions };
            }
            catch (error) {
                logger.error({ err: error }, 'chatkit_session_list_failed');
                reply.code(500);
                return { error: 'chat_session_list_failed' };
            }
        });
    });
    app.get('/chatkit/sessions/:id', async (request, reply) => {
        const { id } = request.params;
        const includeSecret = parseIncludeSecret(request.query?.includeSecret);
        const userHeader = request.headers['x-user-id'];
        if (!userHeader || typeof userHeader !== 'string') {
            return reply.code(400).send({ error: 'x-user-id header is required' });
        }
        return withRequestSpan(request, {
            name: 'chatkit.sessions.get',
            attributes: { sessionId: id, includeSecret },
        }, async ({ logger, setAttribute }) => {
            try {
                const session = await getChatSession(supabase, id, {
                    includeChatkit: true,
                    includeChatkitSecret: includeSecret,
                    logger,
                });
                if (!session) {
                    reply.code(404);
                    return { error: 'chat_session_not_found' };
                }
                await authorizeRequestWithGuards('runs:execute', session.orgId, userHeader, request);
                setAttribute('authorized', true);
                setAttribute('chatkitSessionId', session.chatkit?.sessionId ?? session.chatkitSessionId ?? null);
                incrementCounter('chatkit.sessions.viewed', {
                    status: session.status,
                    channel: session.channel,
                });
                logger.info({
                    sessionId: session.id,
                    chatkitSessionId: session.chatkit?.sessionId ?? session.chatkitSessionId ?? null,
                    status: session.status,
                }, 'chatkit_session_fetched');
                return session;
            }
            catch (error) {
                if (isAuthorizationError(error)) {
                    const response = toErrorResponse(error);
                    logger.warn({ err: error, sessionId: id }, 'chatkit_session_fetch_authorization_failed');
                    reply.code(response.statusCode);
                    return response.body;
                }
                logger.error({ err: error, sessionId: id }, 'chatkit_session_fetch_failed');
                reply.code(500);
                return { error: 'chat_session_fetch_failed' };
            }
        });
    });
    app.post('/chatkit/sessions/:id/cancel', {
        schema: {
            params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
            headers: { type: 'object', properties: { 'x-user-id': { type: 'string' } }, required: ['x-user-id'] },
        },
    }, async (request, reply) => {
        const { id } = request.params;
        const userHeader = request.headers['x-user-id'];
        if (!userHeader || typeof userHeader !== 'string') {
            return reply.code(400).send({ error: 'x-user-id header is required' });
        }
        return withRequestSpan(request, {
            name: 'chatkit.sessions.cancel',
            attributes: { sessionId: id },
        }, async ({ logger, setAttribute }) => {
            try {
                const session = await getChatSession(supabase, id, { logger });
                if (!session) {
                    reply.code(404);
                    return { error: 'chat_session_not_found' };
                }
                await authorizeRequestWithGuards('runs:execute', session.orgId, userHeader, request);
                setAttribute('authorized', true);
                const updated = await cancelChatSession(supabase, id, { logger });
                if (!updated) {
                    reply.code(404);
                    return { error: 'chat_session_not_found' };
                }
                await recordChatEvent(supabase, {
                    sessionId: id,
                    type: 'session.cancelled',
                    actorType: 'user',
                    actorId: userHeader,
                });
                incrementCounter('chatkit.sessions.cancelled', {
                    channel: updated.channel,
                    agent: updated.agentName,
                });
                logger.info({
                    sessionId: updated.id,
                    chatkitSessionId: updated.chatkit?.sessionId ?? updated.chatkitSessionId ?? null,
                    status: updated.status,
                }, 'chatkit_session_cancelled');
                return updated;
            }
            catch (error) {
                if (isAuthorizationError(error)) {
                    const response = toErrorResponse(error);
                    logger.warn({ err: error, sessionId: id }, 'chatkit_session_cancel_authorization_failed');
                    reply.code(response.statusCode);
                    return response.body;
                }
                logger.error({ err: error, sessionId: id }, 'chatkit_session_cancel_failed');
                reply.code(500);
                return { error: 'chat_session_cancel_failed' };
            }
        });
    });
    app.post('/chatkit/sessions/:id/events', {
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
    }, async (request, reply) => {
        const { id } = request.params;
        const parsed = recordChatEventSchema.safeParse(request.body ?? {});
        if (!parsed.success) {
            return reply.code(400).send({ error: 'invalid_event_payload' });
        }
        const userHeader = request.headers['x-user-id'];
        if (!userHeader || typeof userHeader !== 'string') {
            return reply.code(400).send({ error: 'x-user-id header is required' });
        }
        return withRequestSpan(request, {
            name: 'chatkit.sessions.event',
            attributes: { sessionId: id, eventType: parsed.data.type },
        }, async ({ logger, setAttribute }) => {
            try {
                const session = await getChatSession(supabase, id, { logger });
                if (!session) {
                    reply.code(404);
                    return { error: 'chat_session_not_found' };
                }
                await authorizeRequestWithGuards('runs:execute', session.orgId, userHeader, request);
                setAttribute('authorized', true);
                await recordChatEvent(supabase, {
                    sessionId: id,
                    type: parsed.data.type,
                    payload: parsed.data.payload,
                    actorType: parsed.data.actorType ?? 'user',
                    actorId: parsed.data.actorId ?? userHeader,
                });
                incrementCounter('chatkit.session.events.recorded', { type: parsed.data.type });
                logger.info({
                    sessionId: id,
                    eventType: parsed.data.type,
                }, 'chatkit_session_event_recorded');
                reply.code(202);
                return { status: 'accepted' };
            }
            catch (error) {
                if (isAuthorizationError(error)) {
                    const response = toErrorResponse(error);
                    logger.warn({ err: error, sessionId: id, eventType: parsed.data.type }, 'chatkit_event_authorization_failed');
                    reply.code(response.statusCode);
                    return response.body;
                }
                logger.error({ err: error, sessionId: id, eventType: parsed.data.type }, 'chatkit_event_record_failed');
                reply.code(500);
                return { error: 'chat_session_event_failed' };
            }
        });
    });
}
