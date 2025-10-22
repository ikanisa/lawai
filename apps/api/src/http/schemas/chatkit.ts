import { defineSchema, z } from '../../core/schema/registry.js';

export const createChatSessionSchema = defineSchema(
  'chatkit.createSession',
  z.object({
  orgId: z.string().min(1),
  userId: z.string().min(1).optional(),
  agentName: z.string().optional(),
  channel: z.enum(['web', 'voice']).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  }),
);

export const recordChatEventSchema = defineSchema(
  'chatkit.recordEvent',
  z.object({
  type: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).optional(),
  actorType: z.string().optional(),
  actorId: z.string().optional(),
  }),
);
