#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const denoExecutable = process.env.DENO_BIN ?? 'deno';
const rootDir = dirname(fileURLToPath(new URL('../', import.meta.url)));

const child = spawn(denoExecutable, ['run', '--allow-read', '--allow-run', 'scripts/typecheck.ts'], {
  cwd: rootDir,
  stdio: 'inherit',
});

child.on('error', (error) => {
  if (error.code === 'ENOENT') {
    console.warn('[edge] Deno is not installed; skipping edge function typecheck. Set DENO_BIN to override the executable path.');
    process.exit(0);
  }
  console.error('[edge] Failed to execute Deno typecheck:', error);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`[edge] Typecheck interrupted by signal ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 0);
});
