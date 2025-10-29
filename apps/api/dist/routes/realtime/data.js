import { randomUUID } from 'node:crypto';
import { VoiceSessionTokenSchema } from '@avocat-ai/shared';
export function createVoiceSessionToken() {
    const token = `voice_session_${randomUUID()}`;
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const payload = {
        token,
        expires_at: expiresAt,
        websocket_url: `wss://realtime.avocat-ai.test/session/${token}`,
        webrtc_url: `https://realtime.avocat-ai.test/webrtc/${token}`,
    };
    return VoiceSessionTokenSchema.parse(payload);
}
