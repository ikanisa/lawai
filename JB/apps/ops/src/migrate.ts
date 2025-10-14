#!/usr/bin/env node
import ora from 'ora';
import { applyMigrations } from './lib/migrations.js';
import { requireEnv } from './lib/env.js';

async function main(): Promise<void> {
  const env = requireEnv(['SUPABASE_DB_URL']);
  const spinner = ora('Application des migrations Supabase...').start();

  await applyMigrations(env.SUPABASE_DB_URL, {
    report: ({ filename, status, error }) => {
      if (status === 'pending') {
        spinner.text = `Migration ${filename}...`;
      } else if (status === 'success') {
        spinner.succeed(`Migration appliquée: ${filename}`);
        spinner.start('Application des migrations Supabase...');
      } else if (status === 'error') {
        spinner.fail(`Échec migration ${filename}: ${error?.message ?? 'erreur inconnue'}`);
      }
    },
  });

  spinner.succeed('Toutes les migrations sont appliquées.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
