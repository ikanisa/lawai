import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FullConfig } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function globalSetup(_config: FullConfig) {
  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`global-setup: missing required environment variable ${key}`);
    }
  }

  const scriptPath = path.resolve(__dirname, '../../../../scripts/seed-acknowledgements.mjs');
  execFileSync('node', [scriptPath], { stdio: 'inherit', env: process.env });
}
