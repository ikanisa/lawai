import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const scriptPath = path.resolve(repoRoot, 'scripts', 'check-migrations.mjs');

describe('migration hygiene script', () => {
  it('runs without errors on current tree', () => {
    process.env.ALLOW_SUPABASE_MIGRATIONS = '1';
    const result = spawnSync('node', [scriptPath], {
      cwd: repoRoot,
      encoding: 'utf-8',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('migrations_check_ok');
    expect(result.stderr ?? '').toBe('');
  });
});
