import type { FastifySchema } from 'fastify';
import type { ZodTypeAny } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

type ZodFastifySchemaOptions = {
  body?: ZodTypeAny;
  querystring?: ZodTypeAny;
  params?: ZodTypeAny;
  headers?: ZodTypeAny;
  response?: Record<number, ZodTypeAny>;
};

export function createFastifySchemaFromZod(options: ZodFastifySchemaOptions): FastifySchema {
  const schema: FastifySchema = {};

  if (options.body) {
    schema.body = zodToJsonSchema(options.body, 'requestBody');
  }

  if (options.querystring) {
    schema.querystring = zodToJsonSchema(options.querystring, 'querystring');
  }

  if (options.params) {
    schema.params = zodToJsonSchema(options.params, 'params');
  }

  if (options.headers) {
    schema.headers = zodToJsonSchema(options.headers, 'headers');
  }

  if (options.response) {
    schema.response = {};
    for (const [statusCode, zodSchema] of Object.entries(options.response)) {
      const code = Number(statusCode);
      (schema.response as Record<number, unknown>)[code] = zodToJsonSchema(
        zodSchema,
        `response_${statusCode}`,
      );
    }
  }

  return schema;
}
