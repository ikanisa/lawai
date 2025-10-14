import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';

export interface ApplyMigrationsOptions {
  migrationsDir?: string;
  report?: (event: { filename: string; status: 'pending' | 'success' | 'error'; error?: Error }) => void;
}

const DEFAULT_MIGRATIONS_DIR = path.resolve(process.cwd(), 'db', 'migrations');

async function ensureMigrationTable(client: Client): Promise<void> {
  await client.query('create schema if not exists supabase_migrations');
  await client.query(
    'create table if not exists supabase_migrations.schema_migrations (version text primary key, inserted_at timestamptz not null default now())',
  );
}

async function readAppliedMigrations(client: Client): Promise<Set<string>> {
  const result = await client.query<{ version: string }>('select version from supabase_migrations.schema_migrations');
  return new Set(result.rows.map((row) => row.version));
}

export async function applyMigrations(connectionString: string, options: ApplyMigrationsOptions = {}): Promise<void> {
  const migrationsDir = options.migrationsDir ?? DEFAULT_MIGRATIONS_DIR;
  const files = (await fs.readdir(migrationsDir))
    .filter((file) => file.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  const client = new Client({ connectionString });
  await client.connect();

  try {
    await ensureMigrationTable(client);
    const applied = await readAppliedMigrations(client);

    for (const file of files) {
      if (applied.has(file)) {
        continue;
      }

      const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
      options.report?.({ filename: file, status: 'pending' });

      try {
        await client.query(sql);
        await client.query('insert into supabase_migrations.schema_migrations (version) values ($1) on conflict do nothing', [
          file,
        ]);
        options.report?.({ filename: file, status: 'success' });
      } catch (error) {
        options.report?.({
          filename: file,
          status: 'error',
          error: error instanceof Error ? error : new Error(String(error)),
        });
        throw error;
      }
    }
  } finally {
    await client.end();
  }
}
