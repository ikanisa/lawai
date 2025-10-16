import type { FastifyInstance } from 'fastify';
import {
  VoiceConsoleContextSchema,
  VoiceRunRequestSchema,
  VoiceRunResponseSchema,
} from '@avocat-ai/shared';

import type { AppContext } from '../../types/context.js';
import { buildVoiceRunResponse, cloneVoiceConsoleContext } from './data.js';

export async function registerVoiceRoutes(app: FastifyInstance, _ctx: AppContext) {
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
