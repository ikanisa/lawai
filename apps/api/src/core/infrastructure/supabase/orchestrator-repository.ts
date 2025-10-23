import type { SupabaseClient } from '@supabase/supabase-js';
import {
  enqueueDirectorCommand as enqueueDirectorCommandRpc,
  getCommandEnvelope as getCommandEnvelopeQuery,
  listCommandsForSession as listCommandsForSessionQuery,
  listOrgConnectors as listOrgConnectorsQuery,
  listPendingJobs as listPendingJobsQuery,
  registerConnector as registerConnectorRpc,
  updateCommandStatus as updateCommandStatusMutation,
  updateJobStatus as updateJobStatusMutation,
} from '../../../orchestrator.js';
import type { OrchestratorRepository } from '../../repositories/orchestrator-repository.js';
import type {
  DirectorCommandInput,
  OrchestratorCommandEnvelope,
  OrchestratorCommandRecord,
  OrchestratorCommandResponse,
  OrchestratorJobRecord,
  OrgConnectorRecord,
} from '@avocat-ai/shared';
import type { RegisterConnectorInput } from '../../../orchestrator.js';

function mapJobRow(row: Record<string, unknown>): OrchestratorJobRecord {
  return {
    id: String(row.id ?? ''),
    orgId: String(row.org_id ?? ''),
    commandId: String(row.command_id ?? ''),
    worker: (row.worker as OrchestratorJobRecord['worker']) ?? 'director',
    domainAgent: typeof row.domain_agent === 'string' ? row.domain_agent : null,
    status: (row.status as OrchestratorJobRecord['status']) ?? 'pending',
    attempts: Number(row.attempts ?? 0),
    scheduledAt: String(row.scheduled_at ?? ''),
    startedAt: row.started_at ? String(row.started_at) : null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
    failedAt: row.failed_at ? String(row.failed_at) : null,
    lastError: typeof row.last_error === 'string' ? row.last_error : null,
    metadata:
      row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {},
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

function mapCommandMetadataRow(row: Record<string, unknown>): { commandType: string; payload: Record<string, unknown> } {
  const payload =
    row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload)
      ? (row.payload as Record<string, unknown>)
      : {};
  return {
    commandType: typeof row.command_type === 'string' ? row.command_type : '',
    payload,
  };
}

export class SupabaseOrchestratorRepository implements OrchestratorRepository {
  constructor(private readonly client: SupabaseClient) {}

  listCommandsForSession(sessionId: string, limit: number): Promise<OrchestratorCommandRecord[]> {
    return listCommandsForSessionQuery(this.client, sessionId, limit);
  }

  enqueueDirectorCommand(input: DirectorCommandInput): Promise<OrchestratorCommandResponse> {
    return enqueueDirectorCommandRpc(this.client, input);
  }

  getCommandEnvelope(commandId: string): Promise<OrchestratorCommandEnvelope> {
    return getCommandEnvelopeQuery(this.client, commandId);
  }

  listPendingJobs(
    orgId: string,
    worker: OrchestratorJobRecord['worker'],
    limit: number,
  ): Promise<OrchestratorCommandEnvelope[]> {
    return listPendingJobsQuery(this.client, orgId, worker, limit);
  }

  updateJobStatus(
    jobId: string,
    status: OrchestratorJobRecord['status'],
    patch: Partial<{
      attempts: number;
      lastError: string | null;
      startedAt: string | null;
      completedAt: string | null;
      failedAt: string | null;
      metadata: Record<string, unknown>;
    }>,
  ): Promise<void> {
    return updateJobStatusMutation(this.client, jobId, status, patch);
  }

  updateCommandStatus(
    commandId: string,
    status: OrchestratorCommandRecord['status'],
    patch: Record<string, unknown>,
  ): Promise<void> {
    return updateCommandStatusMutation(this.client, commandId, status, patch);
  }

  listOrgConnectors(orgId: string): Promise<OrgConnectorRecord[]> {
    return listOrgConnectorsQuery(this.client, orgId);
  }

  registerConnector(input: RegisterConnectorInput): Promise<string> {
    return registerConnectorRpc(this.client, input);
  }

  async getJobById(jobId: string): Promise<OrchestratorJobRecord | null> {
    const query = await this.client
      .from('orchestrator_jobs')
      .select(
        'id, org_id, command_id, worker, domain_agent, status, attempts, scheduled_at, started_at, completed_at, failed_at, last_error, metadata, created_at, updated_at',
      )
      .eq('id', jobId)
      .maybeSingle();

    if (query.error) {
      throw new Error(query.error.message);
    }

    return query.data ? mapJobRow(query.data as Record<string, unknown>) : null;
  }

  async getCommandMetadata(
    commandId: string,
  ): Promise<{ commandType: string; payload: Record<string, unknown> } | null> {
    const query = await this.client
      .from('orchestrator_commands')
      .select('command_type, payload')
      .eq('id', commandId)
      .maybeSingle();

    if (query.error) {
      throw new Error(query.error.message);
    }

    return query.data ? mapCommandMetadataRow(query.data as Record<string, unknown>) : null;
  }
}
