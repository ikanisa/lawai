import { randomUUID } from 'node:crypto';
import { VoiceSessionTokenSchema, type VoiceSessionToken } from '@avocat-ai/shared';

export function createVoiceSessionToken(): VoiceSessionToken {
  const token = `voice_session_${randomUUID()}`;
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  const payload = {
    token,
    expires_at: expiresAt,
    websocket_url: `wss://realtime.avocat-ai.test/session/${token}`,
    webrtc_url: `https://realtime.avocat-ai.test/webrtc/${token}`,
  } as const;

  return VoiceSessionTokenSchema.parse(payload);
}
