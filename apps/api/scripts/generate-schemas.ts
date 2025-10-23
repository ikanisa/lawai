import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { generateSchemaTypes } from '../src/core/schema/registry.js';

// Ensure schemas are registered by importing schema modules.
import '../src/http/schemas/orchestrator.js';
import '../src/http/schemas/chatkit.js';
import '../src/domain/workspace/schemas.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const outputPath = join(__dirname, '..', 'src', 'core', 'schema', 'registry-types.d.ts');

generateSchemaTypes({ outputPath });
