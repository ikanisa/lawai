import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createFastifySchemaFromZod } from '../../core/schema/zod-fastify.js';
import type { AppContext } from '../../types/context.js';

const workspaceQuerySchema = z
  .object({
    orgId: z.string().uuid(),
  })
  .strict();

const workspaceRunSchema = z
  .object({
    id: z.string(),
  })
  .strict();

const workspaceResponseSchema = z
  .object({
    runs: z.array(workspaceRunSchema),
  })
  .strict();

const workspaceRouteSchema = createFastifySchemaFromZod({
  querystring: workspaceQuerySchema,
  response: {
    200: workspaceResponseSchema,
  },
});

type WorkspaceQuery = z.infer<typeof workspaceQuerySchema>;
type WorkspaceResponse = z.infer<typeof workspaceResponseSchema>;

export async function registerWorkspaceRoutes(app: FastifyInstance, ctx: AppContext) {
  app.get<{ Querystring: WorkspaceQuery; Reply: WorkspaceResponse }>(
    '/workspace',
    {
      schema: workspaceRouteSchema,
    },
    async (request, reply) => {
      const { orgId } = request.query;
      const { supabase } = ctx;

      // TODO: move existing implementation from server.ts here.
      const { data, error } = await supabase
        .from('agent_runs')
        .select('id')
        .eq('org_id', orgId)
        .limit(1);

      if (error) {
        request.log.error({ err: error }, 'workspace query failed');
        return reply.code(500).send({ error: 'workspace_failed' });
      }

      const runs: WorkspaceResponse['runs'] = (data ?? []).map((row) =>
        workspaceRunSchema.parse(row),
      );

      return { runs };
    },
  );
}
