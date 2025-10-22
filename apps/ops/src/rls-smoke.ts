#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import process from 'node:process';
import { requireEnv } from './lib/env.js';

async function assertTableExists(client: Client, table: `${string}.${string}`): Promise<void> {
  const [schema, name] = table.split('.');
  const { rows } = await client.query<{ exists: boolean }>(
    `select exists(
       select 1
       from pg_catalog.pg_class c
       join pg_catalog.pg_namespace n on n.oid = c.relnamespace
       where n.nspname = $1 and c.relname = $2
     ) as exists`,
    [schema, name],
  );
  if (!rows[0]?.exists) {
    throw new Error(`Expected table ${table} to exist.`);
  }
}

async function assertRlsEnabled(client: Client, table: `${string}.${string}`): Promise<void> {
  const [schema, name] = table.split('.');
  const { rows } = await client.query<{ relrowsecurity: boolean }>(
    `select c.relrowsecurity
       from pg_catalog.pg_class c
       join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = $1 and c.relname = $2`,
    [schema, name],
  );
  if (!rows[0]?.relrowsecurity) {
    throw new Error(`Expected RLS to be enabled on ${table}.`);
  }
}

async function assertExtensionInstalled(client: Client, extension: string): Promise<void> {
  const { rows } = await client.query<{ installed: boolean }>(
    'select exists(select 1 from pg_extension where extname = $1) as installed',
    [extension],
  );
  if (!rows[0]?.installed) {
    throw new Error(`Expected extension ${extension} to be installed.`);
  }
}

async function assertDocumentChunksEmbedding(client: Client): Promise<void> {
  const { rows } = await client.query<{ exists: boolean }>(
    `select exists(
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'document_chunks' and column_name = 'embedding'
     ) as exists`,
  );
  if (!rows[0]?.exists) {
    throw new Error('document_chunks.embedding column missing.');
  }
}

async function assertMatchChunksCallable(client: Client): Promise<void> {
  const { rows } = await client.query<{ count: string }>(
    `select count(*)::text as count
       from public.match_chunks(array_fill(0::float4, ARRAY[1536])::vector(1536), 0.1)`,
  );
  if (!rows || typeof rows[0]?.count === 'undefined') {
    throw new Error('match_chunks invocation returned no result.');
  }
}

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

    await assertTableExists(client, 'public.admin_policies');
    await assertRlsEnabled(client, 'public.admin_policies');
    await assertTableExists(client, 'public.admin_jobs');
    await assertRlsEnabled(client, 'public.admin_jobs');
    await assertTableExists(client, 'public.document_chunks');
    await assertDocumentChunksEmbedding(client);
    await assertExtensionInstalled(client, 'vector');
    await assertMatchChunksCallable(client);
    console.log('✓ Core admin tables and vector extension present.');

    await client.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ org_id: orgId, sub: memberId }),
    ]);
    const { rows: allowedRows } = await client.query<{ allowed: boolean }>('select public.is_org_member($1) as allowed', [
      orgId,
    ]);
    if (!allowedRows[0]?.allowed) {
      throw new Error('Expected member to pass is_org_member check.');
    }

    await client.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ org_id: outsiderId, sub: outsiderId }),
    ]);
    const { rows: deniedRows } = await client.query<{ allowed: boolean }>('select public.is_org_member($1) as allowed', [
      orgId,
    ]);
    if (deniedRows[0]?.allowed) {
      throw new Error('Non-member unexpectedly passed is_org_member check.');
    }

    await client.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ org_id: orgId, sub: memberId }),
    ]);
    await client.query(
      `insert into public.admin_policies (org_id, key, value, updated_by)
         values ($1, $2, $3::jsonb, $4)`,
      [orgId, 'smoke_policy', JSON.stringify({ allow: true }), memberId],
    );

    await client.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ org_id: outsiderId, sub: outsiderId }),
    ]);
    let outsiderBlocked = false;
    try {
      await client.query(
        `insert into public.admin_policies (org_id, key, value, updated_by)
           values ($1, $2, $3::jsonb, $4)`,
        [orgId, 'smoke_policy_outsider', JSON.stringify({ allow: false }), outsiderId],
      );
    } catch (policyError) {
      outsiderBlocked = true;
      if (policyError instanceof Error) {
        console.log(`✓ Outsider insert blocked by admin_policies RLS: ${policyError.message}`);
      }
    }
    if (!outsiderBlocked) {
      throw new Error('Expected outsider policy insert to fail RLS.');
    }

    await client.query('rollback');
    console.log('✓ public.is_org_member and admin policies enforce tenant boundaries.');
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
