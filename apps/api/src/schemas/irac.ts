import { z } from 'zod';

export const IRACRuleSchema = z.object({
  citation: z.any(),
  source_url: z.string().url().optional(),
  binding: z.boolean().optional(),
  effective_date: z.string().optional(),
});

export const IRACPayloadSchema = z
  .object({
    question: z.string(),
    jurisdiction: z.any(),
    issue: z.string().optional(),
    rules: z.array(IRACRuleSchema).optional(),
    application: z.string().optional(),
    conclusion: z.string().optional(),
    citations: z.array(z.any()),
    risk: z.object({ level: z.any() }).passthrough(),
  })
  .passthrough();

export type IRACPayloadLike = z.infer<typeof IRACPayloadSchema>;

