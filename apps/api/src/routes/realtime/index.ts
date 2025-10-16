import type { FastifyInstance } from 'fastify';
import { VoiceSessionTokenSchema } from '@avocat-ai/shared';

import type { AppContext } from '../../types/context.js';
import { createVoiceSessionToken } from './data.js';

export async function registerRealtimeRoutes(app: FastifyInstance, _ctx: AppContext) {
  const handler = async () => VoiceSessionTokenSchema.parse(createVoiceSessionToken());

  app.post('/realtime/session', handler);
  app.get('/realtime/session', handler);
}
