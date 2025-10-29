import { VoiceSessionTokenSchema } from '@avocat-ai/shared';
import { createVoiceSessionToken } from './data.js';
export async function registerRealtimeRoutes(app, _ctx) {
    const handler = async () => VoiceSessionTokenSchema.parse(createVoiceSessionToken());
    app.post('/realtime/session', handler);
    app.get('/realtime/session', handler);
}
