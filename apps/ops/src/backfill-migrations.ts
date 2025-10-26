#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import { loadRequiredEnv } from './lib/env.js';

interface CliOptions {
  emitSqlPath?: string;
}

function parseCliArgs(): CliOptions {
  const options: CliOptions = {};

  for (let i = 2; i < process.argv.length; i += 1) {
    const arg = process.argv[i];
    if (arg === '--emit-sql') {
      const next = process.argv[i + 1];
      if (!next) {
        throw new Error('--emit-sql requires a file path');
      }
      options.emitSqlPath = next;
      i += 1;
    }
  }

  return options;
}

async function listMigrationFiles(): Promise<string[]> {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(moduleDir, '..', '..', '..');
  const migrationsDir = path.join(repoRoot, 'supabase', 'migrations');

  const entries = await fs.readdir(migrationsDir);
  return entries.filter((file) => file.endsWith('.sql')).sort((a, b) => a.localeCompare(b));
}

function buildInsertSql(files: string[]): string {
  const valueLines = files
    .map((file) => `  ('${file.replace(/'/g, "''")}', now())`)
    .join(',\n  ');

  return [
    'insert into supabase_migrations.schema_migrations (version, inserted_at) values',
    valueLines,
    'on conflict (version) do nothing;',
  ].join('\n');
}

async function main(): Promise<void> {
  const options = parseCliArgs();
  const files = await listMigrationFiles();

  if (options.emitSqlPath) {
    const sqlStatements = [
      'create schema if not exists supabase_migrations;',
      'create table if not exists supabase_migrations.schema_migrations (version text primary key, inserted_at timestamptz not null default now());',
      buildInsertSql(files),
    ].join('\n\n');

    await fs.writeFile(options.emitSqlPath, sqlStatements, 'utf8');
    console.log(`Script SQL généré dans ${options.emitSqlPath}`);
    return;
  }

  const { values, missing } = loadRequiredEnv(['SUPABASE_DB_URL']);
  if (missing.length > 0) {
    throw new Error(`Variables d'environnement manquantes: ${missing.join(', ')}`);
  }

  const client = new Client({ connectionString: values.SUPABASE_DB_URL });
  await client.connect();

  try {
    await client.query('create schema if not exists supabase_migrations');
    await client.query(
      'create table if not exists supabase_migrations.schema_migrations (version text primary key, inserted_at timestamptz not null default now())',
    );

    const applied = await client.query<{ version: string }>('select version from supabase_migrations.schema_migrations');
    const appliedVersions = new Set(applied.rows.map((row) => row.version));

    const inserted: string[] = [];
    for (const file of files) {
      if (appliedVersions.has(file)) {
        continue;
      }

      await client.query(
        'insert into supabase_migrations.schema_migrations (version, inserted_at) values ($1, now()) on conflict do nothing',
        [file],
      );
      inserted.push(file);
    }

    if (inserted.length === 0) {
      console.log("Aucune migration à enregistrer : toutes les entrées existent déjà.");
    } else {
      console.log('Migrations enregistrées dans supabase_migrations.schema_migrations :');
      for (const file of inserted) {
        console.log(`  - ${file}`);
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
