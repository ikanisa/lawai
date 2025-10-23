import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SUPABASE_SCHEMA_HASH } from '../src/generated/database.types.js';

function computeHash(contents: string): string {
  return createHash('sha256').update(contents).digest('hex');
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..', '..');

test('generated Supabase types are in sync with schema.sql', () => {
  const schemaPath = resolve(repoRoot, 'supabase', 'schema.sql');
  const schema = readFileSync(schemaPath, 'utf8');
  const hash = computeHash(schema);
  expect(`sha256-${hash}`).toBe(SUPABASE_SCHEMA_HASH);
});
