#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error('SUPABASE_DB_URL environment variable is required to generate types.');
  process.exit(1);
}

const result = spawnSync(
  'npx',
  ['supabase', 'gen', 'types', 'typescript', '--db-url', dbUrl, '--schema', 'public'],
  { stdio: ['ignore', 'pipe', 'inherit'] },
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const banner = `/* eslint-disable */\n// This file is auto-generated via \`supabase gen types\`. Do not edit manually.\n// Instead, run \`npm run supabase:types\` from the repository root after updating the schema.\n\n`;

const outputPath = resolve('packages', 'supabase', 'src', 'generated', 'database.types.ts');
writeFileSync(outputPath, `${banner}${result.stdout.toString('utf8')}`);
console.log(`✅ Supabase types regenerated at ${outputPath}`);
