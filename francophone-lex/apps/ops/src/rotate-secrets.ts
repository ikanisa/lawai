#!/usr/bin/env node
import { randomBytes } from 'node:crypto';
import process from 'node:process';
import { requireEnv } from './lib/env.js';

const MANAGEMENT_BASE = process.env.SUPABASE_MANAGEMENT_API_URL ?? 'https://api.supabase.com/v1/projects';

function generateFallbackKey(): string {
  return randomBytes(48).toString('base64url');
}

async function rotateRemoteKey(projectRef: string, token: string, kind: 'service_role' | 'anon'): Promise<string | null> {
  const endpoint = `${MANAGEMENT_BASE}/${projectRef}/config/api-keys/${kind}/rotate`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ rotate_all: false }),
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Unable to rotate ${kind} key via Supabase API: ${message || response.statusText}`);
  }

  const payload = (await response.json()) as { keys?: { service_role?: string; anon?: string } };
  if (kind === 'service_role') {
    return payload.keys?.service_role ?? null;
  }
  return payload.keys?.anon ?? null;
}

async function main(): Promise<void> {
  const env = requireEnv(['SUPABASE_PROJECT_REF']);
  const projectRef = env.SUPABASE_PROJECT_REF;
  const managementToken = process.env.SUPABASE_ACCESS_TOKEN;
  const dryRun = process.argv.includes('--dry-run');

  const results: Record<string, string> = {};

  for (const kind of ['service_role', 'anon'] as const) {
    try {
      if (managementToken && !dryRun) {
        const rotated = await rotateRemoteKey(projectRef, managementToken, kind);
        if (rotated) {
          results[kind] = rotated;
          continue;
        }
      }
    } catch (error) {
      console.warn(`⚠️  API rotation for ${kind} key failed:`, error instanceof Error ? error.message : error);
      if (dryRun) {
        results[kind] = '<dry-run>'; 
        continue;
      }
    }

    results[kind] = generateFallbackKey();
  }

  console.log('\nRotation terminée. Mettez à jour vos secrets avec les valeurs suivantes :');
  for (const [kind, value] of Object.entries(results)) {
    console.log(`  ${kind.toUpperCase()}: ${value}`);
  }

  console.log('\nNote : les clés générées localement doivent être enregistrées dans votre gestionnaire de secrets.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
