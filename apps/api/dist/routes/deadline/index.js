import { z } from 'zod';
const DeadlineRequestSchema = z
    .object({
    start_date: z.coerce.date().optional(),
    jurisdiction: z.string().min(1).default('FR'),
    procedure: z.string().min(1),
    include_service: z.boolean().default(true),
})
    .strict();
const DeadlineEntrySchema = z
    .object({
    id: z.string(),
    label: z.string(),
    computedDate: z.string(),
    daysUntilDue: z.number(),
    rule: z.string(),
    tool: z.enum(['deadlineCalculator', 'calendar_emit']),
})
    .strict();
const DeadlineResponseSchema = z
    .object({
    baseDate: z.string(),
    jurisdiction: z.string(),
    procedure: z.string(),
    deadlines: z.array(DeadlineEntrySchema),
})
    .strict();
function addDays(base, days) {
    const copy = new Date(base.getTime());
    copy.setUTCDate(copy.getUTCDate() + days);
    return copy;
}
function diffInDays(from, to) {
    const msPerDay = 86_400_000;
    return Math.max(0, Math.ceil((to.getTime() - from.getTime()) / msPerDay));
}
export async function registerDeadlineRoutes(app, _ctx) {
    app.post('/deadline', async (request, reply) => {
        const parsed = DeadlineRequestSchema.safeParse(request.body ?? {});
        if (!parsed.success) {
            return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
        }
        const body = parsed.data;
        const baseDate = body.start_date ?? new Date();
        const now = new Date();
        const baseDeadlines = [
            {
                id: 'deadline_conclusions',
                label: 'Conclusions défendeur',
                offset: 10,
                rule: 'Article 763 CPC — délai de 10 jours avant audience',
                tool: 'deadlineCalculator',
            },
            {
                id: 'deadline_communication',
                label: 'Communication des pièces',
                offset: 5,
                rule: 'Protocole tribunal de commerce Paris — J-5',
                tool: 'calendar_emit',
            },
        ];
        if (body.include_service) {
            baseDeadlines.push({
                id: 'deadline_service',
                label: 'Signification huissier',
                offset: 3,
                rule: 'Décret 2023-912 — signification sous 72h',
                tool: 'deadlineCalculator',
            });
        }
        const deadlines = baseDeadlines.map((deadline) => {
            const computed = addDays(baseDate, deadline.offset);
            return DeadlineEntrySchema.parse({
                id: deadline.id,
                label: deadline.label,
                computedDate: computed.toISOString(),
                daysUntilDue: diffInDays(now, computed),
                rule: deadline.rule,
                tool: deadline.tool,
            });
        });
        return DeadlineResponseSchema.parse({
            baseDate: baseDate.toISOString(),
            jurisdiction: body.jurisdiction,
            procedure: body.procedure,
            deadlines,
        });
    });
}
