import { OpenAPIRegistry, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from '../../core/schema/registry.js';

extendZodWithOpenApi(z);

export const openApiRegistry = new OpenAPIRegistry();

export { z };
