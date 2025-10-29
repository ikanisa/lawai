import { VoiceConsoleContextSchema, VoiceRunRequestSchema, VoiceRunResponseSchema, } from '@avocat-ai/shared';
import { buildVoiceRunResponse, cloneVoiceConsoleContext } from './data.js';
export async function registerVoiceRoutes(app, _ctx) {
    app.get('/voice/context', async () => VoiceConsoleContextSchema.parse(cloneVoiceConsoleContext()));
    app.post('/voice/run', async (request, reply) => {
        const parsed = VoiceRunRequestSchema.safeParse(request.body ?? {});
        if (!parsed.success) {
            return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
        }
        const response = buildVoiceRunResponse(parsed.data);
        return VoiceRunResponseSchema.parse(response);
    });
}
