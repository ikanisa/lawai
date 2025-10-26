#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const denoExecutable = process.env.DENO_BIN ?? 'deno';
const scriptDir = dirname(fileURLToPath(import.meta.url));
const edgeRoot = resolve(scriptDir, '..');
const repoRoot = resolve(edgeRoot, '..', '..');
const smokeTestPath = resolve(repoRoot, 'supabase/functions/tests/auth-smoke.ts');

function runDenoTask(args, options, skipMessage) {
  return new Promise((resolve, reject) => {
    const child = spawn(denoExecutable, args, options);

    child.on('error', (error) => {
      if (error.code === 'ENOENT') {
        console.warn(skipMessage);
        resolve(0);
        return;
      }
      reject(error);
    });

    child.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`Command exited via signal ${signal}`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`Command exited with code ${code}`));
        return;
      }
      resolve(0);
    });
  });
}

async function main() {
  await runDenoTask(
    ['run', '--allow-read', '--allow-run', 'scripts/typecheck.ts'],
    { cwd: edgeRoot, stdio: 'inherit' },
    '[edge] Deno is not installed; skipping edge function typecheck. Set DENO_BIN to override the executable path.',
  );

  const smokeEnv = { ...process.env };
  if (!smokeEnv.EDGE_SERVICE_SECRET) {
    smokeEnv.EDGE_SERVICE_SECRET = 'edge-test-secret';
  }

  await runDenoTask(
    ['run', '--allow-env', '--allow-run', '--allow-net', '--allow-read', smokeTestPath],
    { cwd: repoRoot, stdio: 'inherit', env: smokeEnv },
    '[edge] Deno is not installed; skipping Supabase smoke tests. Set DENO_BIN to override the executable path.',
  );
}

main().catch((error) => {
  console.error('[edge] Test suite failed:', error);
  process.exit(1);
});
