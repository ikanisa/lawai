import { z } from 'zod';

export const createChatSessionSchema = z.object({
  orgId: z.string().min(1),
  userId: z.string().min(1).optional(),
  agentName: z.string().optional(),
  channel: z.enum(['web', 'voice']).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const recordChatEventSchema = z.object({
  type: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).optional(),
  actorType: z.string().optional(),
  actorId: z.string().optional(),
});
