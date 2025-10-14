#!/usr/bin/env node
import ora from 'ora';
import { requireEnv } from './lib/env.js';
import { applyMigrations } from './lib/migrations.js';
import {
  createSupabaseService,
  ensureBucket,
  syncAuthorityDomains,
  syncResidencyZones,
  validateResidencyGuards,
} from './lib/supabase.js';
import { ensureVectorStore } from './lib/vector-store.js';
import { auditSecrets } from './lib/secrets.js';
import { listMissingExtensions } from './lib/postgres.js';

const REQUIRED_EXTENSIONS = ['pgvector', 'pg_trgm'] as const;
const REQUIRED_BUCKETS = ['authorities', 'uploads', 'snapshots'] as const;

async function runFoundationProvision(): Promise<void> {
  const env = requireEnv([
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_DB_URL',
    'OPENAI_API_KEY',
    'AGENT_MODEL',
    'EMBEDDING_MODEL',
  ]);

  const secretIssues = auditSecrets(env);
  if (secretIssues.length > 0) {
    const details = secretIssues.map((issue) => `${issue.key}: ${issue.reason}`).join('\n  - ');
    throw new Error(`Secrets incomplets ou faibles détectés:\n  - ${details}`);
  }

  const migrationsSpinner = ora('Application des migrations SQL...').start();
  try {
    await applyMigrations(env.SUPABASE_DB_URL, {
      report: ({ filename, status, error }) => {
        if (status === 'pending') {
          migrationsSpinner.text = `Application des migrations SQL... (${filename})`;
        } else if (status === 'success') {
          migrationsSpinner.text = `Migration appliquée: ${filename}`;
        } else if (status === 'error') {
          migrationsSpinner.fail(`Échec de la migration ${filename}: ${error?.message ?? 'erreur inconnue'}`);
        }
      },
    });
    migrationsSpinner.succeed('Migrations SQL appliquées.');
  } catch (error) {
    migrationsSpinner.fail('Impossible d\'appliquer les migrations SQL.');
    throw error;
  }

  const missingExtensions = await listMissingExtensions(env.SUPABASE_DB_URL, REQUIRED_EXTENSIONS);
  if (missingExtensions.length > 0) {
    throw new Error(`Extensions Postgres manquantes: ${missingExtensions.join(', ')}`);
  }

  const supabase = createSupabaseService(env);

  for (const bucket of REQUIRED_BUCKETS) {
    const bucketSpinner = ora(`Vérification du bucket ${bucket}...`).start();
    try {
      await ensureBucket(supabase, bucket, bucketSpinner);
    } catch (error) {
      bucketSpinner.fail(`Impossible de provisionner le bucket ${bucket}.`);
      throw error;
    }
  }

  const residencySpinner = ora('Synchronisation des zones de résidence...').start();
  try {
    await syncResidencyZones(supabase, residencySpinner);
    residencySpinner.succeed('Zones de résidence synchronisées.');
  } catch (error) {
    residencySpinner.fail('Impossible de synchroniser les zones de résidence.');
    throw error;
  }

  const domainsSpinner = ora('Synchronisation des domaines officiels...').start();
  try {
    await syncAuthorityDomains(supabase, undefined, domainsSpinner);
    domainsSpinner.succeed('Domaines officiels synchronisés.');
  } catch (error) {
    domainsSpinner.fail('Impossible de synchroniser les domaines officiels.');
    throw error;
  }

  const residencyGuardIssues = await validateResidencyGuards(supabase);
  if (residencyGuardIssues.length > 0) {
    throw new Error(`Garde-fous de résidence incomplets: ${residencyGuardIssues.join(', ')}`);
  }

  const vectorSpinner = ora('Vérification du vector store OpenAI...').start();
  try {
    const vectorStoreId = await ensureVectorStore(env.OPENAI_API_KEY, process.env.OPENAI_VECTOR_STORE_AUTHORITIES_ID);
    vectorSpinner.succeed('Vector store prêt.');
    if (!process.env.OPENAI_VECTOR_STORE_AUTHORITIES_ID && vectorStoreId) {
      console.log('\n🔐 Ajoutez OPENAI_VECTOR_STORE_AUTHORITIES_ID à votre gestionnaire de secrets :', vectorStoreId);
    }
  } catch (error) {
    vectorSpinner.fail('Impossible de vérifier ou créer le vector store.');
    throw error;
  }

  console.log('\nFondations opérationnelles : migrations, stockage, vector store et politiques sont en place.');
}

runFoundationProvision().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
