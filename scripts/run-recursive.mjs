#!/usr/bin/env node
import { spawn } from 'node:child_process';

const [, , scriptName, ...scriptArgs] = process.argv;

if (!scriptName) {
  console.error('Usage: node scripts/run-recursive.mjs <script> [...args]');
  process.exit(1);
}

const pnpmArgs = ['-r', '--if-present'];

const filters = new Set();
if (process.env.npm_config_filter && process.env.npm_config_filter.length > 0) {
  filters.add(process.env.npm_config_filter);
}

const forwardedArgs = [];
for (let index = 0; index < scriptArgs.length; index += 1) {
  const arg = scriptArgs[index];
  if (arg === '--filter') {
    const value = scriptArgs[index + 1];
    if (typeof value === 'string' && value.length > 0) {
      filters.add(value);
    }
    index += 1;
    continue;
  }
  if (typeof arg === 'string' && arg.startsWith('--filter=')) {
    const [, value] = arg.split('=');
    if (value && value.length > 0) {
      filters.add(value);
    }
    continue;
  }
  forwardedArgs.push(arg);
}

filters.forEach((value) => {
  pnpmArgs.push('--filter', value);
});

pnpmArgs.push('run', scriptName);

if (forwardedArgs.length > 0) {
  pnpmArgs.push('--', ...forwardedArgs);
}

const child = spawn('pnpm', pnpmArgs, {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

child.on('error', (error) => {
  console.error(error);
  process.exit(1);
});
