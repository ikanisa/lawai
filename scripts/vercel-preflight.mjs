#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

const envFiles = [
  '.env.local',
  '.env.development.local',
  '.env.preview.local',
  '.env.production.local',
  '.env',
  '.env.development',
  '.env.preview',
  '.env.production',
];

const candidateEnvFiles = [
  ...envFiles,
  ...envFiles.map((file) => `.vercel/${file}`),
];

function* parseEnvFile(contents) {
  for (const line of contents.split(/\r?\n/)) {
    if (!line || /^\s*[#;]/.test(line)) {
      continue;
    }
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?$/);
    if (!match) {
      continue;
    }
    const [, key, rawValue = ''] = match;
    let value = rawValue.trim();
    const singleQuoted = value.startsWith("'") && value.endsWith("'");
    const doubleQuoted = value.startsWith('"') && value.endsWith('"');
    if (singleQuoted || doubleQuoted) {
      value = value.slice(1, -1);
    } else {
      const commentMatch = value.match(/\s+#/);
      if (commentMatch?.index !== undefined) {
        value = value.slice(0, commentMatch.index).trimEnd();
      }
    }
    value = value.replaceAll('\\n', '\n');
    yield [key, value];
  }
}

function loadEnvFiles() {
  for (const file of candidateEnvFiles) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) {
      continue;
    }
    const pairs = [...parseEnvFile(readFileSync(path, 'utf8'))];
    if (pairs.length === 0) {
      continue;
    }
    for (const [key, value] of pairs) {
      process.env[key] = value;
    }
    console.log(`Loaded environment from ${file}`);
  }
}

async function main() {
  try {
    assertNodeVersion();
    run('npm --version');
    run('npm ci --prefer-offline');
    const token = process.env.VERCEL_TOKEN ? ` --token=${process.env.VERCEL_TOKEN}` : '';
    run(`npx vercel pull --yes --environment=preview${token}`);
    loadEnvFiles();
    checkEnv();
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
