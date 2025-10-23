import type {
  DirectorCommandInput,
  OrchestratorCommandEnvelope,
  OrchestratorCommandRecord,
  OrchestratorCommandResponse,
  OrchestratorJobRecord,
  OrgConnectorRecord,
  SafetyAssessmentResult,
} from '@avocat-ai/shared';
import { z } from '../schema/registry.js';
import { getFinanceCapabilityManifest } from '../../finance-manifest.js';
import type { OrchestratorLogger, RegisterConnectorInput } from '../../orchestrator.js';
import type {
  OrchestratorAIGateway,
  OrchestratorRepository,
} from '../repositories/orchestrator-repository.js';

interface CreateCommandInput extends Omit<DirectorCommandInput, 'issuedBy'> {
  issuedBy: string;
}

export type CommandCreationOutcome =
  | {
      kind: 'accepted';
      response: OrchestratorCommandResponse;
      safety: SafetyAssessmentResult;
    }
  | {
      kind: 'rejected';
      reasons: string[];
      mitigations: string[];
    };

export interface ClaimJobInput {
  orgId: string;
  worker: OrchestratorJobRecord['worker'];
  userId: string;
  limit?: number;
}

export type ClaimJobOutcome =
  | { kind: 'claimed'; envelope: OrchestratorCommandEnvelope }
  | { kind: 'none' };

export interface CompleteJobInput {
  job: OrchestratorJobRecord;
  status: OrchestratorJobRecord['status'];
  result?: Record<string, unknown> | null;
  error?: string | null;
  userId: string;
}

export type CompleteJobOutcome =
  | { kind: 'completed'; status: OrchestratorJobRecord['status'] }
  | { kind: 'command_not_found' }
  | { kind: 'invalid_finance_result'; message: string };

const financeCommandPayloadSchema = z.object({}).passthrough();
const financeCommandResultSchema = z.object({}).passthrough();

function mapConnectorCoverage(
  manifest: ReturnType<typeof getFinanceCapabilityManifest>,
  connectors: Array<Pick<OrgConnectorRecord, 'connectorType' | 'name' | 'status'>>,
) {
  const statusLookup = new Map<string, string>();
  for (const connector of connectors) {
    const key = `${connector.connectorType}:${connector.name}`;
    statusLookup.set(key, connector.status);
  }

  return manifest.domains.map((domain: any) => {
    const domainKey = domain.key as string;
    const coverage = (domain.connectors as Array<any>).map((req: any) => {
      const key = `${req.type}:${req.name}`;
      const status = statusLookup.get(key) ?? 'inactive';
      return {
        type: req.type,
        name: req.name,
        required: !req.optional,
        status,
        purpose: req.purpose,
      };
    });

    const missing = coverage
      .filter((entry) => entry.required && entry.status !== 'active')
      .map((entry) => entry.name);

    return { key: domainKey, connectors: coverage, missing };
  });
}

export class OrchestratorService {
  constructor(
    private readonly repository: OrchestratorRepository,
    private readonly aiGateway: OrchestratorAIGateway,
  ) {}

  listCommandsForSession(sessionId: string, limit = 50): Promise<OrchestratorCommandRecord[]> {
    return this.repository.listCommandsForSession(sessionId, limit);
  }

  async createCommand(input: CreateCommandInput, logger?: OrchestratorLogger): Promise<CommandCreationOutcome> {
    if (input.commandType === 'finance.domain' && input.payload) {
      const validation = financeCommandPayloadSchema.safeParse(input.payload);
      if (!validation.success) {
        throw new Error('invalid_finance_command_payload');
      }
      input.payload = validation.data;
    }

    const response = await this.repository.enqueueDirectorCommand({
      orgId: input.orgId,
      sessionId: input.sessionId,
      commandType: input.commandType,
      payload: input.payload,
      priority: input.priority,
      scheduledFor: input.scheduledFor,
      worker: input.worker,
      issuedBy: input.issuedBy,
    });

    const envelope = await this.repository.getCommandEnvelope(response.commandId);

    if ((input.worker ?? 'director') === 'safety') {
      return { kind: 'accepted', response, safety: { status: 'approved', reasons: [] } };
    }

    const safety = await this.aiGateway.runSafetyAssessment(envelope, logger);

    if (safety.status === 'rejected') {
      const now = new Date().toISOString();
      const reason = safety.reasons.join('; ') || 'safety_rejected';
      await this.repository.updateCommandStatus(envelope.command.id, 'cancelled', {
        failedAt: now,
        lastError: reason,
        result: null,
      });
      await this.repository.updateJobStatus(envelope.job.id, 'cancelled', {
        failedAt: now,
        lastError: reason,
      });
      return {
        kind: 'rejected',
        reasons: safety.reasons,
        mitigations: safety.mitigations ?? [],
      };
    }

    const metadata = {
      ...envelope.command.metadata,
      safety: {
        status: safety.status,
        reasons: safety.reasons,
        mitigations: safety.mitigations ?? [],
        reviewedAt: new Date().toISOString(),
        reviewer: 'safety-agent',
      },
    };

    await this.repository.updateCommandStatus(envelope.command.id, envelope.command.status, {
      metadata,
    });

    if (safety.status === 'needs_hitl') {
      await this.repository.updateJobStatus(envelope.job.id, 'pending', {
        metadata: {
          ...envelope.job.metadata,
          hitlRequired: true,
          safetyReasons: safety.reasons,
          safetyMitigations: safety.mitigations ?? [],
        },
      });
    }

    return { kind: 'accepted', response, safety };
  }

  async getCapabilities(orgId: string) {
    const manifest = getFinanceCapabilityManifest();
    const connectors = await this.repository.listOrgConnectors(orgId);
    const coverage = mapConnectorCoverage(manifest, connectors);

    return {
      manifest,
      connectors: {
        items: connectors,
        coverage,
      },
    };
  }

  registerConnector(input: RegisterConnectorInput): Promise<string> {
    return this.repository.registerConnector(input);
  }

  async claimJob(input: ClaimJobInput): Promise<ClaimJobOutcome> {
    const envelopes = await this.repository.listPendingJobs(input.orgId, input.worker, input.limit ?? 5);
    if (envelopes.length === 0) {
      return { kind: 'none' };
    }

    const envelope = envelopes[0];
    const now = new Date().toISOString();

    await this.repository.updateJobStatus(envelope.job.id, 'running', {
      startedAt: now,
      attempts: envelope.job.attempts + 1,
      metadata: {
        ...envelope.job.metadata,
        claimedBy: input.userId,
        claimedAt: now,
      },
    });

    if (envelope.command.status === 'queued') {
      await this.repository.updateCommandStatus(envelope.command.id, 'in_progress', {
        startedAt: now,
      });
      envelope.command.status = 'in_progress';
      envelope.command.startedAt = now;
    }

    envelope.job.status = 'running';
    envelope.job.startedAt = now;
    envelope.job.attempts += 1;

    return { kind: 'claimed', envelope };
  }

  getJob(jobId: string): Promise<OrchestratorJobRecord | null> {
    return this.repository.getJobById(jobId);
  }

  async completeJob(input: CompleteJobInput): Promise<CompleteJobOutcome> {
    const command = await this.repository.getCommandMetadata(input.job.commandId);
    if (!command) {
      return { kind: 'command_not_found' };
    }

    let finalResult = input.result ?? null;
    if (command.commandType === 'finance.domain' && finalResult) {
      const validation = financeCommandResultSchema.safeParse(finalResult);
      if (!validation.success) {
        return { kind: 'invalid_finance_result', message: 'invalid_finance_command_result' };
      }
      finalResult = validation.data;
    }

    const now = new Date().toISOString();
    const jobMetadata = {
      ...input.job.metadata,
      completedBy: input.userId,
      completedAt: now,
      lastResult: finalResult ?? null,
      lastError: input.error ?? null,
    };

    await this.repository.updateJobStatus(input.job.id, input.status, {
      completedAt: now,
      metadata: jobMetadata,
      lastError: input.error ?? null,
    });

    if (input.status === 'completed') {
      await this.repository.updateCommandStatus(input.job.commandId, 'completed', {
        completedAt: now,
        result: finalResult ?? {},
      });
    } else if (input.status === 'failed') {
      await this.repository.updateCommandStatus(input.job.commandId, 'failed', {
        failedAt: now,
        lastError: input.error ?? 'command_failed',
        result: finalResult ?? {},
      });
    } else {
      await this.repository.updateCommandStatus(input.job.commandId, 'cancelled', {
        failedAt: now,
        lastError: input.error ?? 'command_cancelled',
        result: finalResult ?? {},
      });
    }

    return { kind: 'completed', status: input.status };
  }
}
