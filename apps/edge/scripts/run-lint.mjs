#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const denoExecutable = process.env.DENO_BIN ?? 'deno';
const rootDir = dirname(fileURLToPath(new URL('../', import.meta.url)));

const child = spawn(denoExecutable, ['lint', '--config', 'deno.jsonc'], {
  cwd: rootDir,
  stdio: 'inherit',
});

child.on('error', (error) => {
  if (error.code === 'ENOENT') {
    console.warn('[edge] Deno is not installed; skipping edge lint. Set DENO_BIN to override the executable path.');
    process.exit(0);
  }
  console.error('[edge] Failed to execute Deno lint:', error);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`[edge] Lint interrupted by signal ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 0);
});
