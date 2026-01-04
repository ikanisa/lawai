#!/usr/bin/env node
import ora from 'ora';
import { OFFICIAL_DOMAIN_ALLOWLIST } from '@avocat-ai/shared';
import { requireEnv } from './lib/env.js';
import { createSupabaseService } from './lib/supabase.js';

const spinner = ora('Initialisation du client Supabase...').start();

try {
  const env = requireEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
  const client = createSupabaseService(env);

  spinner.succeed('Client Supabase initialisé');
  const { data, error } = await client.from('jurisdictions').select('code, name').limit(5);

  if (error) {
    console.error('Impossible de récupérer les juridictions:', error.message);
    process.exitCode = 1;
  } else {
    console.table(data ?? []);
    console.log('Domaines officiels supportés (échantillon) :', OFFICIAL_DOMAIN_ALLOWLIST.slice(0, 5));
  }
} catch (error) {
  spinner.fail('Configuration invalide');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
