#!/usr/bin/env node
import process from 'node:process';
import { loadRequiredEnv } from './lib/env.js';

const FUNCTIONS = ['learning-collector', 'learning-diagnoser'];

async function callEdgeFunction(baseUrl: string, key: string, name: string): Promise<void> {
  const url = `${baseUrl.replace(/\/?$/, '')}/functions/v1/${name}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${name} failed: ${response.status} ${text}`);
  }
  const json = await response.text();
  console.log(`[${name}] ${json}`);
}

async function main() {
  const env = loadRequiredEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
  for (const fn of FUNCTIONS) {
    await callEdgeFunction(env.values.SUPABASE_URL, env.values.SUPABASE_SERVICE_ROLE_KEY, fn);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

