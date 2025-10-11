import { z } from 'zod';
export const IRACSchema = z.object({
    jurisdiction: z.object({
        country: z.string(),
        eu: z.boolean(),
        ohada: z.boolean(),
    }),
    issue: z.string(),
    rules: z.array(z.object({
        citation: z.string(),
        source_url: z.string().url(),
        binding: z.boolean(),
        effective_date: z.string(),
    })),
    application: z.string(),
    conclusion: z.string(),
    citations: z.array(z.object({
        title: z.string(),
        court_or_publisher: z.string(),
        date: z.string(),
        url: z.string().url(),
        note: z.string().optional().default(''),
    })),
    risk: z.object({
        level: z.enum(['LOW', 'MEDIUM', 'HIGH']),
        why: z.string(),
        hitl_required: z.boolean(),
    }),
});
