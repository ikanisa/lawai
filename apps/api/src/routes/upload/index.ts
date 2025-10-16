import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { UploadResponseSchema } from '@avocat-ai/shared';

import type { AppContext } from '../../types/context.js';

const uploadRequestSchema = z
  .object({
    filename: z.string().min(1),
    jurisdiction: z.string().min(1),
    source_type: z.enum(['statute', 'case', 'doctrine', 'internal']).default('internal'),
    hash_sha256: z.string().regex(/^[a-f0-9]{64}$/i, 'hash must be sha256').optional(),
    allowlisted_domain: z.string().url().optional(),
  })
  .strict();

export async function registerUploadRoutes(app: FastifyInstance, _ctx: AppContext) {
  app.post('/upload', async (request, reply) => {
    const parsed = uploadRequestSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
    }

    const payload = UploadResponseSchema.parse({
      uploadId: `upload_${randomUUID()}`,
      status: 'queued',
      receivedAt: new Date().toISOString(),
    });

    return payload;
  });
}
