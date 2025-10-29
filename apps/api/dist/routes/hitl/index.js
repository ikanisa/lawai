import { z } from 'zod';
import { cloneHitlQueueData } from './data.js';
const hitlActionSchema = z.object({
    action: z.enum(['approve', 'request_changes', 'reject']).default('approve'),
});
export async function registerHitlRoutes(app, _ctx) {
    app.get('/hitl', async () => cloneHitlQueueData());
    app.post('/hitl/:id', async (request, reply) => {
        const parsed = hitlActionSchema.safeParse(request.body ?? {});
        if (!parsed.success) {
            return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
        }
        return {
            id: request.params.id,
            action: parsed.data.action,
            processedAt: new Date().toISOString(),
        };
    });
}
