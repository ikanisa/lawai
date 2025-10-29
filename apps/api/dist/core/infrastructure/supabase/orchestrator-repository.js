import { enqueueDirectorCommand as enqueueDirectorCommandRpc, getCommandEnvelope as getCommandEnvelopeQuery, listCommandsForSession as listCommandsForSessionQuery, listOrgConnectors as listOrgConnectorsQuery, listPendingJobs as listPendingJobsQuery, registerConnector as registerConnectorRpc, updateCommandStatus as updateCommandStatusMutation, updateJobStatus as updateJobStatusMutation, } from '../../../orchestrator.js';
function mapJobRow(row) {
    return {
        id: String(row.id ?? ''),
        orgId: String(row.org_id ?? ''),
        commandId: String(row.command_id ?? ''),
        worker: row.worker ?? 'director',
        domainAgent: typeof row.domain_agent === 'string' ? row.domain_agent : null,
        status: row.status ?? 'pending',
        attempts: Number(row.attempts ?? 0),
        scheduledAt: String(row.scheduled_at ?? ''),
        startedAt: row.started_at ? String(row.started_at) : null,
        completedAt: row.completed_at ? String(row.completed_at) : null,
        failedAt: row.failed_at ? String(row.failed_at) : null,
        lastError: typeof row.last_error === 'string' ? row.last_error : null,
        metadata: row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
            ? row.metadata
            : {},
        createdAt: String(row.created_at ?? ''),
        updatedAt: String(row.updated_at ?? ''),
    };
}
function mapCommandMetadataRow(row) {
    const payload = row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload)
        ? row.payload
        : {};
    return {
        commandType: typeof row.command_type === 'string' ? row.command_type : '',
        payload,
    };
}
export class SupabaseOrchestratorRepository {
    client;
    constructor(client) {
        this.client = client;
    }
    listCommandsForSession(sessionId, limit) {
        return listCommandsForSessionQuery(this.client, sessionId, limit);
    }
    enqueueDirectorCommand(input) {
        return enqueueDirectorCommandRpc(this.client, input);
    }
    getCommandEnvelope(commandId) {
        return getCommandEnvelopeQuery(this.client, commandId);
    }
    listPendingJobs(orgId, worker, limit) {
        return listPendingJobsQuery(this.client, orgId, worker, limit);
    }
    updateJobStatus(jobId, status, patch) {
        return updateJobStatusMutation(this.client, jobId, status, patch);
    }
    updateCommandStatus(commandId, status, patch) {
        return updateCommandStatusMutation(this.client, commandId, status, patch);
    }
    listOrgConnectors(orgId) {
        return listOrgConnectorsQuery(this.client, orgId);
    }
    registerConnector(input) {
        return registerConnectorRpc(this.client, input);
    }
    async getJobById(jobId) {
        const query = await this.client
            .from('orchestrator_jobs')
            .select('id, org_id, command_id, worker, domain_agent, status, attempts, scheduled_at, started_at, completed_at, failed_at, last_error, metadata, created_at, updated_at')
            .eq('id', jobId)
            .maybeSingle();
        if (query.error) {
            throw new Error(query.error.message);
        }
        return query.data ? mapJobRow(query.data) : null;
    }
    async getCommandMetadata(commandId) {
        const query = await this.client
            .from('orchestrator_commands')
            .select('command_type, payload')
            .eq('id', commandId)
            .maybeSingle();
        if (query.error) {
            throw new Error(query.error.message);
        }
        return query.data ? mapCommandMetadataRow(query.data) : null;
    }
}
