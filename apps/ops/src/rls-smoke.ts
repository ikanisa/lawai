#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import process from 'node:process';
import { requireEnv } from './lib/env.js';

async function main(): Promise<void> {
  const env = requireEnv(['SUPABASE_DB_URL']);
  const client = new Client({ connectionString: env.SUPABASE_DB_URL });
  await client.connect();

  const orgId = randomUUID();
  const memberId = randomUUID();
  const outsiderId = randomUUID();

  try {
    await client.query('begin');
    await client.query('insert into public.organizations (id, name) values ($1, $2)', [orgId, 'RLS smoke test']);
    await client.query(
      'insert into public.org_members (org_id, user_id, role) values ($1, $2, $3)',
      [orgId, memberId, 'member'],
    );

    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [memberId]);
    const { rows: allowedRows } = await client.query<{ allowed: boolean }>('select public.is_org_member($1) as allowed', [
      orgId,
    ]);
    if (!allowedRows[0]?.allowed) {
      throw new Error('Expected member to pass is_org_member check.');
    }

    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [outsiderId]);
    const { rows: deniedRows } = await client.query<{ allowed: boolean }>('select public.is_org_member($1) as allowed', [
      orgId,
    ]);
    if (deniedRows[0]?.allowed) {
      throw new Error('Non-member unexpectedly passed is_org_member check.');
    }

    await client.query('rollback');
    console.log('✓ public.is_org_member enforces tenant boundaries.');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
