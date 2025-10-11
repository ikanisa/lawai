import type { FastifyInstance } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  enqueueDirectorCommand,
  getCommandEnvelope,
  listCommandsForSession,
  listPendingJobs,
  listOrgConnectors,
  registerConnector,
  runSafetyAssessment,
  updateCommandStatus,
  updateJobStatus,
} from '../../orchestrator.js';
import { z } from 'zod';
import { getFinanceCapabilityManifest } from '../../finance-manifest.js';
import { type OrgConnectorRecord } from '@avocat-ai/shared';
import { authorizeRequestWithGuards } from '../authorization.js';
import {
  orchestratorCommandSchema,
  orchestratorConnectorSchema,
  orchestratorJobClaimSchema,
  orchestratorJobResultSchema,
} from '../schemas/orchestrator.js';

interface OrchestratorRouteOptions {
  supabase: SupabaseClient;
}

function toRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

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

export function registerOrchestratorRoutes(app: FastifyInstance, { supabase }: OrchestratorRouteOptions): void {
  // List commands for a session
  app.get<{ Params: { id: string }; Querystring: { orgId?: string; limit?: string } }>(
    '/agent/sessions/:id/commands',
    async (request, reply) => {
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
      } catch (error) {
        if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
          return reply.code(error.statusCode).send({ error: error.message });
        }
        request.log.error({ err: error }, 'orchestrator command list authorization failed');
        return reply.code(403).send({ error: 'forbidden' });
      }

      try {
        const commands = await listCommandsForSession(supabase, id, limit ? Number(limit) : 50);
        return reply.send({ commands });
      } catch (error) {
        request.log.error({ err: error }, 'list_orchestrator_commands_failed');
        return reply.code(500).send({ error: 'list_orchestrator_commands_failed' });
      }
    },
  );
  app.post<{ Body: unknown }>(
    '/agent/commands',
    {
      schema: {
        headers: {
          type: 'object',
          properties: {
            'x-user-id': { type: 'string' },
          },
          required: ['x-user-id'],
        },
        body: {
          type: 'object',
          properties: {
            orgId: { type: 'string' },
            sessionId: { type: ['string', 'null'] },
            commandType: { type: 'string' },
            payload: { type: ['object', 'array', 'string', 'number', 'boolean', 'null'] },
            priority: { type: 'number' },
            scheduledFor: { type: ['string', 'null'] },
            worker: { type: 'string' },
          },
          required: ['orgId', 'commandType'],
          additionalProperties: true,
        },
        response: {
          202: { type: 'object', additionalProperties: true },
        },
      },
    },
    async (request, reply) => {
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
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
        return reply.code(error.statusCode).send({ error: error.message });
      }
      request.log.error({ err: error }, 'orchestrator command authorization failed');
      return reply.code(403).send({ error: 'forbidden' });
    }

    try {
      // Optional finance command validation
      let financePayload: Record<string, unknown> | null = null;
      if (parsed.data.commandType === 'finance.domain') {
        const financeCommandPayloadSchema = z.object({}).passthrough();
        const payloadValidation = financeCommandPayloadSchema.safeParse(parsed.data.payload ?? {});
        if (!payloadValidation.success) {
          request.log.warn({ issues: payloadValidation.error.flatten() }, 'finance domain command payload invalid');
          return reply.code(400).send({ error: 'invalid_finance_command_payload' });
        }
        financePayload = payloadValidation.data as Record<string, unknown>;
      }

      const response = await enqueueDirectorCommand(
        supabase,
        {
          orgId: parsed.data.orgId,
          sessionId: parsed.data.sessionId ?? null,
          commandType: parsed.data.commandType,
          payload: financePayload ?? parsed.data.payload ?? {},
          priority: parsed.data.priority,
          scheduledFor: parsed.data.scheduledFor,
          worker: parsed.data.worker ?? 'director',
          issuedBy: userHeader,
        },
        request.log,
      );

      const envelope = await getCommandEnvelope(supabase, response.commandId);

      let safety = null;
      if ((parsed.data.worker ?? 'director') !== 'safety') {
        safety = await runSafetyAssessment(supabase, envelope, request.log);

        if (safety.status === 'rejected') {
          const now = new Date().toISOString();
          const reason = safety.reasons.join('; ') || 'safety_rejected';
          await updateCommandStatus(supabase, envelope.command.id, 'cancelled', {
            failedAt: now,
            lastError: reason,
            result: null,
          });
          await updateJobStatus(supabase, envelope.job.id, 'cancelled', {
            failedAt: now,
            lastError: reason,
          });
          return reply.code(409).send({
            error: 'command_rejected',
            reasons: safety.reasons,
            mitigations: safety.mitigations ?? [],
          });
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

        await updateCommandStatus(supabase, envelope.command.id, envelope.command.status, metadata);

        if (safety.status === 'needs_hitl') {
          await updateJobStatus(supabase, envelope.job.id, 'pending', {
            metadata: {
              ...envelope.job.metadata,
              hitlRequired: true,
              safetyReasons: safety.reasons,
              safetyMitigations: safety.mitigations ?? [],
            },
          });
        }
      }

      return reply.code(202).send({
        commandId: response.commandId,
        jobId: response.jobId,
        sessionId: response.sessionId,
        status: response.status,
        scheduledFor: response.scheduledFor,
        safety: safety ?? { status: 'approved', reasons: [] },
      });
    } catch (error) {
      request.log.error({ err: error }, 'enqueue_orchestrator_command_failed');
      return reply.code(500).send({ error: 'orchestrator_command_failed' });
    }
  },
  );

  app.get<{ Querystring: { orgId?: string } }>('/agent/capabilities', async (request, reply) => {
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
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
        return reply.code(error.statusCode).send({ error: error.message });
      }
      request.log.error({ err: error }, 'capabilities authorization failed');
      return reply.code(403).send({ error: 'forbidden' });
    }

    try {
      const manifest = getFinanceCapabilityManifest();
      const connectors = await listOrgConnectors(supabase, orgId);
      const coverage = mapConnectorCoverage(manifest, connectors);

      return reply.send({
        manifest,
        connectors: {
          items: connectors,
          coverage,
        },
      });
    } catch (error) {
      request.log.error({ err: error }, 'fetch_capabilities_failed');
      return reply.code(500).send({ error: 'fetch_capabilities_failed' });
    }
  });

  app.post<{ Body: unknown }>('/agent/connectors', async (request, reply) => {
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
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
        return reply.code(error.statusCode).send({ error: error.message });
      }
      request.log.error({ err: error }, 'register connector authorization failed');
      return reply.code(403).send({ error: 'forbidden' });
    }

    try {
      const connectorId = await registerConnector(supabase, {
        orgId: parsed.data.orgId,
        connectorType: parsed.data.connectorType,
        name: parsed.data.name,
        config: parsed.data.config,
        status: parsed.data.status,
        metadata: parsed.data.metadata,
        createdBy: userHeader,
      });

      return reply.code(201).send({ connectorId });
    } catch (error) {
      request.log.error({ err: error }, 'register_connector_failed');
      return reply.code(500).send({ error: 'register_connector_failed' });
    }
  });

  app.post<{ Body: unknown }>('/agent/jobs/claim', async (request, reply) => {
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
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
        return reply.code(error.statusCode).send({ error: error.message });
      }
      request.log.error({ err: error }, 'orchestrator job claim authorization failed');
      return reply.code(403).send({ error: 'forbidden' });
    }

    try {
      const envelopes = await listPendingJobs(supabase, parsed.data.orgId, parsed.data.worker, 5);
      if (envelopes.length === 0) {
        return reply.code(204).send();
      }

      const envelope = envelopes[0];
      const now = new Date().toISOString();
      await updateJobStatus(supabase, envelope.job.id, 'running', {
        startedAt: now,
        attempts: envelope.job.attempts + 1,
        metadata: {
          ...envelope.job.metadata,
          claimedBy: userHeader,
          claimedAt: now,
        },
      });

      if (envelope.command.status === 'queued') {
        await updateCommandStatus(supabase, envelope.command.id, 'in_progress', {
          startedAt: now,
        });
        envelope.command.status = 'in_progress';
        envelope.command.startedAt = now;
      }

      envelope.job.status = 'running';
      envelope.job.startedAt = now;
      envelope.job.attempts += 1;

      return reply.send({ envelope });
    } catch (error) {
      request.log.error({ err: error }, 'orchestrator_job_claim_failed');
      return reply.code(500).send({ error: 'orchestrator_job_claim_failed' });
    }
  });

  app.post<{ Params: { id: string }; Body: unknown }>('/agent/jobs/:id/complete', async (request, reply) => {
    const { id } = request.params;
    const parsed = orchestratorJobResultSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_job_result_payload' });
    }

    const userHeader = request.headers['x-user-id'];
    if (!userHeader || typeof userHeader !== 'string') {
      return reply.code(400).send({ error: 'x-user-id header is required' });
    }

    const jobQuery = await supabase
      .from('orchestrator_jobs')
      .select('id, org_id, command_id, metadata, status')
      .eq('id', id)
      .maybeSingle();

    if (jobQuery.error) {
      request.log.error({ err: jobQuery.error }, 'orchestrator_job_fetch_failed');
      return reply.code(500).send({ error: 'orchestrator_job_fetch_failed' });
    }

    if (!jobQuery.data) {
      return reply.code(404).send({ error: 'job_not_found' });
    }

    const jobRow = jobQuery.data as Record<string, unknown>;
    const orgId = String(jobRow.org_id);

    try {
      await authorizeRequestWithGuards('orchestrator:command', orgId, userHeader, request);
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
        return reply.code(error.statusCode).send({ error: error.message });
      }
      request.log.error({ err: error }, 'orchestrator job complete authorization failed');
      return reply.code(403).send({ error: 'forbidden' });
    }

    const now = new Date().toISOString();
    const commandId = String(jobRow.command_id);
    const baseMetadata = toRecord(jobRow.metadata);

    const commandQuery = await supabase
      .from('orchestrator_commands')
      .select('command_type, payload')
      .eq('id', commandId)
      .maybeSingle();

    if (commandQuery.error) {
      request.log.error({ err: commandQuery.error }, 'orchestrator_command_fetch_failed');
      return reply.code(500).send({ error: 'orchestrator_command_fetch_failed' });
    }

    if (!commandQuery.data) {
      return reply.code(404).send({ error: 'command_not_found' });
    }

    const commandType = String(commandQuery.data.command_type ?? '');
    let financeResult: Record<string, unknown> | null = null;

    if (commandType === 'finance.domain') {
      const financeCommandResultSchema = z.object({}).passthrough();
      const validation = financeCommandResultSchema.safeParse(parsed.data.result ?? {});
      if (!validation.success) {
        request.log.warn({
          jobId: id,
          issues: validation.error.flatten(),
        }, 'finance domain command result invalid');
        return reply.code(400).send({ error: 'invalid_finance_command_result' });
      }
      financeResult = validation.data;
    }

    const finalStatus = parsed.data.status;
    const jobMetadata = {
      ...baseMetadata,
      completedBy: userHeader,
      completedAt: now,
      lastResult: parsed.data.result ?? null,
      lastError: parsed.data.error ?? null,
    };

    try {
      await updateJobStatus(supabase, id, finalStatus, {
        completedAt: now,
        metadata: jobMetadata,
        lastError: parsed.data.error ?? null,
      });

      if (finalStatus === 'completed') {
        await updateCommandStatus(supabase, commandId, 'completed', {
          completedAt: now,
          result: financeResult ?? parsed.data.result ?? {},
        });
      } else if (finalStatus === 'failed') {
        await updateCommandStatus(supabase, commandId, 'failed', {
          failedAt: now,
          lastError: parsed.data.error ?? 'command_failed',
          result: financeResult ?? parsed.data.result ?? {},
        });
      } else {
        await updateCommandStatus(supabase, commandId, 'cancelled', {
          failedAt: now,
          lastError: parsed.data.error ?? 'command_cancelled',
          result: financeResult ?? parsed.data.result ?? {},
        });
      }

      return reply.code(200).send({ status: finalStatus });
    } catch (error) {
      request.log.error({ err: error }, 'orchestrator_job_complete_failed');
      return reply.code(500).send({ error: 'orchestrator_job_complete_failed' });
    }
  });
}
