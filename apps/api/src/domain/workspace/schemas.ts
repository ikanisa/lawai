import { defineSchema, z } from '../../core/schema/registry.js';

export const workspaceQuerySchema = defineSchema(
  'workspace.query',
  z.object({
    orgId: z.string().uuid(),
  }),
);

export type WorkspaceQuery = z.infer<typeof workspaceQuerySchema>;
