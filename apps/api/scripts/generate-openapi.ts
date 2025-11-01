import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { generateOpenApiDocument } from '../src/http/openapi/generator.js';

// Ensure all route schemas are registered before generating the document.
import '../src/modules/workspace/http/schema.js';

const document = generateOpenApiDocument({
  info: {
    title: 'Avocat API',
    version: '1.0.0',
    description: 'Programmatic interface for the Avocat workspace and agents.',
  },
  servers: [
    { url: 'http://localhost:3000/api', description: 'Local development' },
  ],
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const outputPath = join(__dirname, '..', 'openapi.json');

writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`);
console.log(`OpenAPI specification written to ${outputPath}`);
