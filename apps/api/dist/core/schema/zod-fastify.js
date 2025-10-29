import { zodToJsonSchema } from 'zod-to-json-schema';
export function createFastifySchemaFromZod(options) {
    const schema = {};
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
            schema.response[code] = zodToJsonSchema(zodSchema, `response_${statusCode}`);
        }
    }
    return schema;
}
