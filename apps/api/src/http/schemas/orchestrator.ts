import { defineSchema, z } from '../../core/schema/registry.js';

export const orchestratorCommandSchema = defineSchema(
  'orchestrator.command',
  z.object({
  orgId: z.string().min(1),
  sessionId: z.string().min(1).optional(),
  commandType: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).optional(),
  priority: z.number().int().min(1).max(1000).optional(),
  scheduledFor: z.string().datetime({ offset: true }).optional(),
  worker: z.enum(['director', 'safety', 'domain']).optional(),
  }),
);

export const orchestratorConnectorSchema = defineSchema(
  'orchestrator.connector',
  z.object({
  orgId: z.string().min(1),
  connectorType: z.enum(['erp', 'tax', 'accounting', 'compliance', 'analytics']),
  name: z.string().min(1),
  config: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(['inactive', 'pending', 'active', 'error']).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  }),
);

export const orchestratorJobClaimSchema = defineSchema(
  'orchestrator.jobClaim',
  z.object({
  orgId: z.string().min(1),
  worker: z.enum(['director', 'safety', 'domain']).default('director'),
  }),
);

export const orchestratorJobResultSchema = defineSchema(
  'orchestrator.jobResult',
  z.object({
  status: z.enum(['completed', 'failed', 'cancelled']),
  result: z.record(z.string(), z.unknown()).optional(),
  error: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  }),
);
