import { z } from 'zod';
export const workspaceQuerySchema = z
    .object({
    orgId: z.string().min(1),
})
    .strict();
export const complianceAcknowledgementBodySchema = z
    .object({
    consent: z
        .object({
        type: z.string().min(1),
        version: z.string().min(1),
    })
        .nullable()
        .optional(),
    councilOfEurope: z
        .object({
        version: z.string().min(1),
    })
        .nullable()
        .optional(),
})
    .refine((value) => Boolean(value.consent || value.councilOfEurope), {
    message: 'At least one acknowledgement must be provided.',
});
export const complianceStatusQuerySchema = z
    .object({
    limit: z.coerce.number().int().min(1).max(25).optional(),
})
    .strict();
