export class OrchestratorController {
    service;
    constructor(service) {
        this.service = service;
    }
    async listSessionCommands(params) {
        const commands = await this.service.listCommandsForSession(params.sessionId, params.limit ?? 50);
        return { status: 200, body: { commands } };
    }
    async createCommand(input, logger) {
        let outcome;
        try {
            outcome = await this.service.createCommand({
                orgId: input.orgId,
                sessionId: input.sessionId ?? null,
                commandType: input.commandType,
                payload: input.payload ?? undefined,
                priority: input.priority,
                scheduledFor: input.scheduledFor ?? undefined,
                worker: input.worker ?? 'director',
                issuedBy: input.issuedBy,
            }, logger);
        }
        catch (error) {
            if (error instanceof Error && error.message === 'invalid_finance_command_payload') {
                return { status: 400, body: { error: 'invalid_finance_command_payload' } };
            }
            throw error;
        }
        if (outcome.kind === 'rejected') {
            return {
                status: 409,
                body: {
                    error: 'command_rejected',
                    reasons: outcome.reasons,
                    mitigations: outcome.mitigations,
                },
            };
        }
        return {
            status: 202,
            body: {
                commandId: outcome.response.commandId,
                jobId: outcome.response.jobId,
                sessionId: outcome.response.sessionId,
                status: outcome.response.status,
                scheduledFor: outcome.response.scheduledFor,
                safety: outcome.safety,
            },
        };
    }
    async getCapabilities(orgId) {
        const result = await this.service.getCapabilities(orgId);
        return { status: 200, body: result };
    }
    async registerConnector(input) {
        const connectorId = await this.service.registerConnector(input);
        return { status: 201, body: { connectorId } };
    }
    async claimJob(input) {
        const outcome = await this.service.claimJob(input);
        if (outcome.kind === 'none') {
            return { status: 204 };
        }
        return { status: 200, body: { envelope: outcome.envelope } };
    }
    getJob(jobId) {
        return this.service.getJob(jobId);
    }
    async completeJob(input) {
        const outcome = await this.service.completeJob({
            job: input.job,
            status: input.status,
            result: input.result ?? null,
            error: input.error ?? null,
            userId: input.userId,
        });
        if (outcome.kind === 'command_not_found') {
            return { status: 404, body: { error: 'command_not_found' } };
        }
        if (outcome.kind === 'invalid_finance_result') {
            return { status: 400, body: { error: outcome.message } };
        }
        return { status: 200, body: { status: outcome.status } };
    }
}
