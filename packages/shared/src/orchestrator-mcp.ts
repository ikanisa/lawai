import { z } from 'zod';
import type { OrchestratorCommandEnvelope } from './orchestrator.js';

export const financeCommandIntentSchema = z.enum([
  'tax.prepare_filing',
  'tax.respond_audit',
  'tax.check_deadline',
  'ap.process_invoice',
  'ap.schedule_payment',
  'audit.prepare_walkthrough',
  'audit.update_pbc',
  'risk.update_register',
  'risk.assess_control',
  'cfo.generate_board_pack',
  'cfo.run_scenario',
  'regulatory.prepare_filing',
  'regulatory.track_deadline',
] as const);

export type FinanceCommandIntent = z.infer<typeof financeCommandIntentSchema>;

export const financeDomainKeySchema = z.enum([
  'tax_compliance',
  'accounts_payable',
  'audit_assurance',
  'cfo_strategy',
  'risk_controls',
  'regulatory_filings',
] as const);

export type FinanceDomainKey = z.infer<typeof financeDomainKeySchema>;

export const financeCommandPayloadSchema = z.object({
  intent: financeCommandIntentSchema,
  domain: financeDomainKeySchema,
  objective: z.string().min(3),
  inputs: z.record(z.string(), z.unknown()).default({}),
  guardrails: z.array(z.string()).default([]),
  telemetry: z.array(z.string()).default([]),
  connectors: z
    .record(
      z.string(),
      z.object({
        required: z.boolean().optional(),
        status: z.enum(['active', 'pending', 'inactive', 'error']).optional(),
      }),
    )
    .default({}),
  safety: z
    .object({
      riskLevel: z.enum(['low', 'medium', 'high']).default('low'),
      rationale: z.string().optional(),
      requiredMitigations: z.array(z.string()).optional(),
    })
    .optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type FinanceCommandPayload = z.infer<typeof financeCommandPayloadSchema>;

export const financeCommandResultSchema = z.object({
  status: z.enum(['completed', 'failed', 'needs_hitl']).optional(),
  output: z.record(z.string(), z.unknown()).optional(),
  notices: z.array(z.string()).default([]),
  followUps: z
    .array(
      financeCommandPayloadSchema.extend({
        intent: financeCommandIntentSchema,
      }),
    )
    .default([]),
  telemetry: z.record(z.string(), z.union([z.number(), z.string()])).optional(),
  errorCode: z.string().optional(),
  hitlReason: z.string().optional(),
});

export type FinanceCommandResult = z.infer<typeof financeCommandResultSchema>;

export interface FinanceWorkerEnvelope extends OrchestratorCommandEnvelope {
  command: OrchestratorCommandEnvelope['command'] & {
    payload: FinanceCommandPayload;
  };
}
