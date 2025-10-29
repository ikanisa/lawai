import { authorizeRequestWithGuards } from '../../http/authorization.js';
import { COMPLIANCE_ACK_TYPES, fetchAcknowledgementEvents, recordAcknowledgementEvents, summariseAcknowledgements, } from './compliance';
import { withRequestSpan } from '../../observability/spans.js';
const errorResponseSchema = {
    type: 'object',
    required: ['error'],
    properties: {
        error: { type: 'string' },
    },
};
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
};
const acknowledgementsHeadersSchema = {
    type: 'object',
    required: ['x-user-id', 'x-org-id'],
    properties: {
        'x-user-id': { type: 'string' },
        'x-org-id': { type: 'string' },
    },
};
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
};
const acknowledgementsGetSchema = {
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
const acknowledgementsPostSchema = {
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
export function registerComplianceAcknowledgementsRoutes(app, ctx, onRequest) {
    const { supabase } = ctx;
    app.get('/compliance/acknowledgements', { schema: acknowledgementsGetSchema, onRequest }, async (request, reply) => {
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
            access = await withRequestSpan(request, {
                name: 'compliance.acknowledgements.authorize',
                attributes: { orgId: orgHeader, userId: userHeader },
            }, async () => authorizeRequestWithGuards('workspace:view', orgHeader, userHeader, request));
        }
        catch (error) {
            const status = error.statusCode ?? 403;
            return reply.code(status).send({ error: 'forbidden' });
        }
        try {
            const events = await withRequestSpan(request, {
                name: 'compliance.acknowledgements.fetch',
                attributes: { orgId: orgHeader, userId: userHeader },
            }, async ({ setAttribute }) => {
                const result = await fetchAcknowledgementEvents(supabase, orgHeader, userHeader);
                setAttribute('eventCount', result.length);
                return result;
            });
            const acknowledgements = summariseAcknowledgements(access, events);
            return reply.send({ orgId: orgHeader, userId: userHeader, acknowledgements });
        }
        catch (error) {
            request.log.error({ err: error }, 'compliance_ack_fetch_failed');
            return reply.code(500).send({ error: 'compliance_ack_fetch_failed' });
        }
    });
    app.post('/compliance/acknowledgements', { schema: acknowledgementsPostSchema, onRequest }, async (request, reply) => {
        const userHeader = request.headers['x-user-id'];
        if (!userHeader || typeof userHeader !== 'string') {
            return reply.code(401).send({ error: 'unauthorized' });
        }
        const orgHeader = request.headers['x-org-id'];
        if (!orgHeader || typeof orgHeader !== 'string') {
            return reply.code(400).send({ error: 'x-org-id header is required' });
        }
        const body = request.body;
        if (!body?.consent && !body?.councilOfEurope) {
            return reply.code(400).send({ error: 'invalid_body' });
        }
        let access;
        try {
            access = await withRequestSpan(request, {
                name: 'compliance.acknowledgements.authorize',
                attributes: { orgId: orgHeader, userId: userHeader },
            }, async () => authorizeRequestWithGuards('workspace:view', orgHeader, userHeader, request));
        }
        catch (error) {
            const status = error.statusCode ?? 403;
            return reply.code(status).send({ error: 'forbidden' });
        }
        const records = [];
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
        }
        catch (error) {
            request.log.error({ err: error }, 'compliance_ack_insert_failed');
            return reply.code(500).send({ error: 'compliance_ack_insert_failed' });
        }
        const events = await withRequestSpan(request, {
            name: 'compliance.acknowledgements.refresh',
            attributes: { orgId: orgHeader, userId: userHeader },
        }, async ({ setAttribute }) => {
            const result = await fetchAcknowledgementEvents(supabase, orgHeader, userHeader);
            setAttribute('eventCount', result.length);
            return result;
        });
        const acknowledgements = summariseAcknowledgements(access, events);
        return reply.send({ orgId: orgHeader, userId: userHeader, acknowledgements });
    });
}
