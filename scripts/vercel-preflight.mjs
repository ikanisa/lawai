#!/usr/bin/env node
import { execSync } from 'node:child_process';
import process from 'node:process';

const requiredEnv = new Map([
  [
    'apps/web',
    [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
    ],
  ],
  [
    'apps/api',
    [
      'OPENAI_API_KEY',
      'OPENAI_VECTOR_STORE_AUTHORITIES_ID',
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
    ],
  ],
  [
    'apps/ops',
    [
      'OPENAI_API_KEY',
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
    ],
  ],
]);

function run(cmd) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

function assertNodeVersion() {
  const version = process.versions.node;
  const major = Number(version.split('.')[0]);
  if (Number.isNaN(major) || major < 20) {
    throw new Error(`Node.js >=20 is required. Detected ${version}`);
  }
  console.log(`Node version OK (${version})`);
}

function checkEnv() {
  const missingByApp = [];
  for (const [app, keys] of requiredEnv.entries()) {
    const missing = keys.filter((key) => !process.env[key] || process.env[key]?.length === 0);
    if (missing.length > 0) {
      missingByApp.push({ app, missing });
    }
  }
  if (missingByApp.length > 0) {
    console.error('Missing environment variables:');
    for (const { app, missing } of missingByApp) {
      console.error(`  ${app}: ${missing.join(', ')}`);
    }
    throw new Error('Environment validation failed');
  }
  console.log('Environment variables OK');
}

async function main() {
  try {
    assertNodeVersion();
    checkEnv();
    run('npm --version');
    run('npm ci --prefer-offline');
    const previewToken = process.env.DEPLOY_PREVIEW_TOKEN;
    const token = previewToken ? ` --token=${previewToken}` : '';
    run(`npx vercel pull --yes --environment=preview${token}`);
    run(`npx vercel build${token}`);
    console.log('Preflight PASS');
  } catch (error) {
    console.error('\nPreflight FAILED');
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

main();
