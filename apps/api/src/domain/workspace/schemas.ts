import type { FastifySchema } from 'fastify';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

/**
 * Workspace routes rely on Zod for domain modeling while Fastify enforces HTTP validation.
 * Use {@link buildRouteSchema} when adding new endpoints so JSON schemas stay aligned with
 * the Zod definitions exported from this module.
 */
export const workspaceQuerySchema = z
  .object({
    orgId: z.string().uuid(),
  })
  .strict();

export type WorkspaceQuerySchema = typeof workspaceQuerySchema;
export type WorkspaceQuery = z.infer<typeof workspaceQuerySchema>;

const schemaSegments = ['body', 'headers', 'params', 'querystring'] as const;

type SchemaSegment = (typeof schemaSegments)[number];

type SchemaMap = Partial<Record<SchemaSegment, z.ZodTypeAny>>;

export function buildRouteSchema(_routeName: string, schemas: SchemaMap): FastifySchema {
  const jsonSchemas: FastifySchema = {};

  for (const segment of schemaSegments) {
    const schema = schemas[segment];
    if (!schema) {
      continue;
    }
    jsonSchemas[segment] = zodToJsonSchema(schema, {
      $refStrategy: 'none',
    });
  }

  return jsonSchemas;
}

export const getWorkspaceSchema = buildRouteSchema('workspace.get', {
  querystring: workspaceQuerySchema,
});
