import type { OrchestratorCommandRecord, OrchestratorJobRecord } from '@avocat-ai/shared';
import type { OrchestratorLogger, RegisterConnectorInput } from '../../orchestrator.js';
import type { OrchestratorService } from '../services/orchestrator-service.js';
import type {
  ClaimJobOutcome,
  CommandCreationOutcome,
  CompleteJobOutcome,
} from '../services/orchestrator-service.js';

export interface ControllerResponse<T = unknown> {
  status: number;
  body?: T;
}

export class OrchestratorController {
  constructor(private readonly service: OrchestratorService) {}

  async listSessionCommands(params: {
    sessionId: string;
    limit?: number;
  }): Promise<ControllerResponse<{ commands: OrchestratorCommandRecord[] }>> {
    const commands = await this.service.listCommandsForSession(params.sessionId, params.limit ?? 50);
    return { status: 200, body: { commands } };
  }

  async createCommand(
    input: {
      orgId: string;
      sessionId?: string | null;
      commandType: string;
      payload?: Record<string, unknown> | null;
      priority?: number;
      scheduledFor?: string | null;
      worker?: 'director' | 'safety' | 'domain';
      issuedBy: string;
    },
    logger?: OrchestratorLogger,
  ): Promise<ControllerResponse> {
    let outcome: CommandCreationOutcome;
    try {
      outcome = await this.service.createCommand(
        {
          orgId: input.orgId,
          sessionId: input.sessionId ?? null,
          commandType: input.commandType,
          payload: input.payload ?? undefined,
          priority: input.priority,
          scheduledFor: input.scheduledFor ?? undefined,
          worker: input.worker ?? 'director',
          issuedBy: input.issuedBy,
        },
        logger,
      );
    } catch (error) {
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

  async getCapabilities(orgId: string): Promise<ControllerResponse> {
    const result = await this.service.getCapabilities(orgId);
    return { status: 200, body: result };
  }

  async registerConnector(input: RegisterConnectorInput): Promise<ControllerResponse> {
    const connectorId = await this.service.registerConnector(input);
    return { status: 201, body: { connectorId } };
  }

  async claimJob(input: {
    orgId: string;
    worker: OrchestratorJobRecord['worker'];
    userId: string;
    limit?: number;
  }): Promise<ControllerResponse> {
    const outcome: ClaimJobOutcome = await this.service.claimJob(input);

    if (outcome.kind === 'none') {
      return { status: 204 };
    }

    return { status: 200, body: { envelope: outcome.envelope } };
  }

  getJob(jobId: string): Promise<OrchestratorJobRecord | null> {
    return this.service.getJob(jobId);
  }

  async completeJob(
    input: {
      job: OrchestratorJobRecord;
      status: OrchestratorJobRecord['status'];
      result?: Record<string, unknown> | null;
      error?: string | null;
      userId: string;
    },
  ): Promise<ControllerResponse> {
    const outcome: CompleteJobOutcome = await this.service.completeJob({
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
