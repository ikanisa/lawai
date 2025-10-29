import { authorizeRequestWithGuards } from '../authorization.js';
import { orchestratorCommandSchema, orchestratorConnectorSchema, orchestratorJobClaimSchema, orchestratorJobResultSchema } from '../schemas/orchestrator.js';
export function registerOrchestratorRoutes(app, ctx) {
    const controller = ctx.container.orchestrator;
    app.get('/agent/sessions/:id/commands', async (request, reply) => {
        const { id } = request.params;
        const { orgId, limit } = request.query;
        if (!orgId) {
            return reply.code(400).send({ error: 'orgId is required' });
        }
        const userHeader = request.headers['x-user-id'];
        if (!userHeader || typeof userHeader !== 'string') {
            return reply.code(400).send({ error: 'x-user-id header is required' });
        }
        try {
            await authorizeRequestWithGuards('orchestrator:command', orgId, userHeader, request);
        }
        catch (error) {
            if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
                return reply.code(error.statusCode).send({ error: error.message });
            }
            request.log.error({ err: error }, 'orchestrator command list authorization failed');
            return reply.code(403).send({ error: 'forbidden' });
        }
        try {
            const response = await controller.listSessionCommands({ sessionId: id, limit: limit ? Number(limit) : undefined });
            return reply.code(response.status).send(response.body);
        }
        catch (error) {
            request.log.error({ err: error }, 'list_orchestrator_commands_failed');
            return reply.code(500).send({ error: 'list_orchestrator_commands_failed' });
        }
    });
    app.post('/agent/commands', async (request, reply) => {
        const parsed = orchestratorCommandSchema.safeParse(request.body ?? {});
        if (!parsed.success) {
            return reply.code(400).send({ error: 'invalid_command_payload' });
        }
        const userHeader = request.headers['x-user-id'];
        if (!userHeader || typeof userHeader !== 'string') {
            return reply.code(400).send({ error: 'x-user-id header is required' });
        }
        try {
            await authorizeRequestWithGuards('orchestrator:command', parsed.data.orgId, userHeader, request);
        }
        catch (error) {
            if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
                return reply.code(error.statusCode).send({ error: error.message });
            }
            request.log.error({ err: error }, 'orchestrator command authorization failed');
            return reply.code(403).send({ error: 'forbidden' });
        }
        try {
            const response = await controller.createCommand({
                orgId: parsed.data.orgId,
                sessionId: parsed.data.sessionId ?? null,
                commandType: parsed.data.commandType,
                payload: parsed.data.payload ?? null,
                priority: parsed.data.priority,
                scheduledFor: parsed.data.scheduledFor ?? null,
                worker: parsed.data.worker ?? 'director',
                issuedBy: userHeader,
            }, request.log);
            return reply.code(response.status).send(response.body);
        }
        catch (error) {
            request.log.error({ err: error }, 'enqueue_orchestrator_command_failed');
            return reply.code(500).send({ error: 'orchestrator_command_failed' });
        }
    });
    app.get('/agent/capabilities', async (request, reply) => {
        const { orgId } = request.query;
        if (!orgId) {
            return reply.code(400).send({ error: 'orgId is required' });
        }
        const userHeader = request.headers['x-user-id'];
        if (!userHeader || typeof userHeader !== 'string') {
            return reply.code(400).send({ error: 'x-user-id header is required' });
        }
        try {
            await authorizeRequestWithGuards('orchestrator:command', orgId, userHeader, request);
        }
        catch (error) {
            if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
                return reply.code(error.statusCode).send({ error: error.message });
            }
            request.log.error({ err: error }, 'capabilities authorization failed');
            return reply.code(403).send({ error: 'forbidden' });
        }
        try {
            const response = await controller.getCapabilities(orgId);
            return reply.code(response.status).send(response.body);
        }
        catch (error) {
            request.log.error({ err: error }, 'fetch_capabilities_failed');
            return reply.code(500).send({ error: 'fetch_capabilities_failed' });
        }
    });
    app.post('/agent/connectors', async (request, reply) => {
        const parsed = orchestratorConnectorSchema.safeParse(request.body ?? {});
        if (!parsed.success) {
            return reply.code(400).send({ error: 'invalid_connector_payload' });
        }
        const userHeader = request.headers['x-user-id'];
        if (!userHeader || typeof userHeader !== 'string') {
            return reply.code(400).send({ error: 'x-user-id header is required' });
        }
        try {
            await authorizeRequestWithGuards('orchestrator:admin', parsed.data.orgId, userHeader, request);
        }
        catch (error) {
            if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
                return reply.code(error.statusCode).send({ error: error.message });
            }
            request.log.error({ err: error }, 'register connector authorization failed');
            return reply.code(403).send({ error: 'forbidden' });
        }
        try {
            const response = await controller.registerConnector({
                orgId: parsed.data.orgId,
                connectorType: parsed.data.connectorType,
                name: parsed.data.name,
                config: parsed.data.config,
                status: parsed.data.status,
                metadata: parsed.data.metadata,
                createdBy: userHeader,
            });
            return reply.code(response.status).send(response.body);
        }
        catch (error) {
            request.log.error({ err: error }, 'register_connector_failed');
            return reply.code(500).send({ error: 'register_connector_failed' });
        }
    });
    app.post('/agent/jobs/claim', async (request, reply) => {
        const parsed = orchestratorJobClaimSchema.safeParse(request.body ?? {});
        if (!parsed.success) {
            return reply.code(400).send({ error: 'invalid_job_claim_payload' });
        }
        const userHeader = request.headers['x-user-id'];
        if (!userHeader || typeof userHeader !== 'string') {
            return reply.code(400).send({ error: 'x-user-id header is required' });
        }
        try {
            await authorizeRequestWithGuards('orchestrator:command', parsed.data.orgId, userHeader, request);
        }
        catch (error) {
            if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
                return reply.code(error.statusCode).send({ error: error.message });
            }
            request.log.error({ err: error }, 'orchestrator job claim authorization failed');
            return reply.code(403).send({ error: 'forbidden' });
        }
        try {
            const response = await controller.claimJob({
                orgId: parsed.data.orgId,
                worker: parsed.data.worker,
                userId: userHeader,
            });
            if (response.status === 204) {
                return reply.code(204).send();
            }
            return reply.code(response.status).send(response.body);
        }
        catch (error) {
            request.log.error({ err: error }, 'orchestrator_job_claim_failed');
            return reply.code(500).send({ error: 'orchestrator_job_claim_failed' });
        }
    });
    app.post('/agent/jobs/:id/complete', async (request, reply) => {
        const { id } = request.params;
        const parsed = orchestratorJobResultSchema.safeParse(request.body ?? {});
        if (!parsed.success) {
            return reply.code(400).send({ error: 'invalid_job_result_payload' });
        }
        const userHeader = request.headers['x-user-id'];
        if (!userHeader || typeof userHeader !== 'string') {
            return reply.code(400).send({ error: 'x-user-id header is required' });
        }
        let job = null;
        try {
            job = await controller.getJob(id);
        }
        catch (error) {
            request.log.error({ err: error }, 'orchestrator_job_fetch_failed');
            return reply.code(500).send({ error: 'orchestrator_job_fetch_failed' });
        }
        if (!job) {
            return reply.code(404).send({ error: 'job_not_found' });
        }
        try {
            await authorizeRequestWithGuards('orchestrator:command', job.orgId, userHeader, request);
        }
        catch (error) {
            if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
                return reply.code(error.statusCode).send({ error: error.message });
            }
            request.log.error({ err: error }, 'orchestrator job complete authorization failed');
            return reply.code(403).send({ error: 'forbidden' });
        }
        try {
            const response = await controller.completeJob({
                job,
                status: parsed.data.status,
                result: parsed.data.result ?? null,
                error: parsed.data.error ?? null,
                userId: userHeader,
            });
            return reply.code(response.status).send(response.body);
        }
        catch (error) {
            request.log.error({ err: error }, 'orchestrator_job_complete_failed');
            return reply.code(500).send({ error: 'orchestrator_job_complete_failed' });
        }
    });
}
