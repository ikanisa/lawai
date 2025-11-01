import { defineSchema } from '../../core/schema/registry.js';
import { openApiRegistry, z } from '../openapi/registry.js';

export const HttpErrorResponseSchema = defineSchema(
  'Http.ErrorResponse',
  openApiRegistry.register(
    'HttpErrorResponse',
    z
      .object({
        error: z.string().describe('Machine-readable error code'),
        message: z.string().optional().describe('Human-readable error message'),
        details: z.unknown().optional().describe('Additional context for debugging'),
      })
      .describe('Standard error response envelope'),
  ),
);

export type HttpErrorResponse = typeof HttpErrorResponseSchema['_output'];
