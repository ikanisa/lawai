import { z } from 'zod';

const workerEnum = z.enum(['director', 'domain', 'safety']);

export const FinanceHitlRequirementSchema = z
  .object({
    required: z.boolean(),
    reasons: z.array(z.string().min(1)).default([]),
    mitigations: z.array(z.string().min(1)).default([]),
    reviewer: z.string().min(1).optional(),
  })
  .strict();

export const FinanceCommandBudgetSchema = z
  .object({
    tokens: z.number().int().nonnegative().optional(),
    currency: z.string().min(1).optional(),
    amount: z.number().nonnegative().optional(),
    notes: z.string().min(1).optional(),
  })
  .strict();

export const FinanceCommandEnvelopeSchema = z
  .object({
    worker: workerEnum,
    commandType: z.string().min(1),
    title: z.string().min(1),
    description: z.string().min(1),
    domain: z.string().min(1).optional(),
    payload: z.record(z.string(), z.unknown()).default({}),
    successCriteria: z.array(z.string().min(1)).default([]),
    dependencies: z.array(z.string().min(1)).default([]),
    connectorDependencies: z.array(z.string().min(1)).default([]),
    telemetry: z.array(z.string().min(1)).default([]),
    guardrails: z
      .object({
        safetyPolicies: z.array(z.string().min(1)).default([]),
        residency: z.array(z.string().min(1)).default([]),
      })
      .strict()
      .default({ safetyPolicies: [], residency: [] }),
    hitl: FinanceHitlRequirementSchema.optional(),
    budget: FinanceCommandBudgetSchema.optional(),
  })
  .strict();

export const FinanceDirectorPlanStepSchema = z
  .object({
    id: z.string().min(1),
    status: z.enum(['pending', 'ready', 'in_progress', 'blocked', 'complete']),
    envelope: FinanceCommandEnvelopeSchema,
    notes: z.array(z.string().min(1)).default([]),
  })
  .strict();

export const FinanceDirectorPlanSchema = z
  .object({
    version: z.string().min(1),
    objective: z.string().min(1),
    summary: z.string().min(1),
    decisionLog: z.array(z.string().min(1)).default([]),
    steps: z.array(FinanceDirectorPlanStepSchema).min(1),
    globalHitl: FinanceHitlRequirementSchema.optional(),
  })
  .strict();

export const FinanceSafetyDecisionSchema = z
  .object({
    status: z.enum(['approved', 'needs_hitl', 'rejected']),
    reasons: z.array(z.string().min(1)).default([]),
    mitigations: z.array(z.string().min(1)).default([]),
    hitlRequired: z.boolean().default(false),
  })
  .strict();

export const FinanceSafetyReviewSchema = z
  .object({
    command: z
      .object({
        id: z.string().min(1),
        worker: workerEnum,
        commandType: z.string().min(1),
        payloadFingerprint: z.string().min(1),
        hitl: FinanceHitlRequirementSchema.optional(),
      })
      .strict(),
    envelope: z
      .object({
        sessionId: z.string().min(1),
        orgId: z.string().min(1),
        jobId: z.string().min(1).optional(),
      })
      .strict(),
    decision: FinanceSafetyDecisionSchema,
    refusal: z
      .object({
        reason: z.string().min(1),
        policy: z.string().min(1).optional(),
      })
      .strict()
      .optional(),
    audit: z
      .object({
        reviewer: z.string().min(1).optional(),
        reviewedAt: z.string().min(1).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type FinanceHitlRequirement = z.infer<typeof FinanceHitlRequirementSchema>;
export type FinanceCommandEnvelope = z.infer<typeof FinanceCommandEnvelopeSchema>;
export type FinanceDirectorPlanStep = z.infer<typeof FinanceDirectorPlanStepSchema>;
export type FinanceDirectorPlan = z.infer<typeof FinanceDirectorPlanSchema>;
export type FinanceSafetyDecision = z.infer<typeof FinanceSafetyDecisionSchema>;
export type FinanceSafetyReview = z.infer<typeof FinanceSafetyReviewSchema>;
