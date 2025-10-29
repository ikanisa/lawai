import type { FastifySchema } from 'fastify';
import type { ZodTypeAny } from 'zod';
type ZodFastifySchemaOptions = {
    body?: ZodTypeAny;
    querystring?: ZodTypeAny;
    params?: ZodTypeAny;
    headers?: ZodTypeAny;
    response?: Record<number, ZodTypeAny>;
};
export declare function createFastifySchemaFromZod(options: ZodFastifySchemaOptions): FastifySchema;
export {};
//# sourceMappingURL=zod-fastify.d.ts.map