import type { OpenAPIObjectConfig } from '@asteasolutions/zod-to-openapi';
import { OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import { openApiRegistry } from './registry.js';

export interface GenerateOpenApiDocumentOptions {
  info: OpenAPIObjectConfig['info'];
  servers?: OpenAPIObjectConfig['servers'];
}

export function generateOpenApiDocument(options: GenerateOpenApiDocumentOptions) {
  const generator = new OpenApiGeneratorV31(openApiRegistry.definitions);
  return generator.generateDocument({
    openapi: '3.1.0',
    info: options.info,
    servers: options.servers ?? [],
  });
}
