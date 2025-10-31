#!/usr/bin/env node

/**
 * Enforces pnpm usage and prevents npm/yarn from running in this monorepo.
 * This script is invoked via the preinstall hook in package.json.
 */

// Check if pnpm is being used
const userAgent = process.env.npm_config_user_agent || '';

if (!userAgent.includes('pnpm')) {
  console.error('\x1b[31m%s\x1b[0m', '\n❌ Error: This repository requires pnpm');
  console.error('\x1b[33m%s\x1b[0m', '\nYou attempted to install dependencies with npm or yarn, but this is a pnpm-only monorepo.');
  console.error('\n\x1b[1m%s\x1b[0m', 'To set up this project:');
  console.error('  1. Enable corepack (comes with Node.js 16.9+):');
  console.error('     \x1b[36m%s\x1b[0m', 'corepack enable');
  console.error('  2. Activate pnpm 8.15.4:');
  console.error('     \x1b[36m%s\x1b[0m', 'corepack prepare pnpm@8.15.4 --activate');
  console.error('  3. Install dependencies:');
  console.error('     \x1b[36m%s\x1b[0m', 'pnpm install --no-frozen-lockfile');
  console.error('  4. Run development server:');
  console.error('     \x1b[36m%s\x1b[0m', 'pnpm dev:api  # or pnpm dev:web, pnpm --filter @apps/pwa dev');
  console.error('\n\x1b[2m%s\x1b[0m', 'See README.md for full setup instructions.');
  console.error('');
  process.exit(1);
}

// Success - pnpm is being used
console.log('\x1b[32m%s\x1b[0m', '✓ Using pnpm - proceeding with installation...');
