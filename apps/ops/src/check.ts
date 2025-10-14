#!/usr/bin/env node
import ora from 'ora';
import { OFFICIAL_DOMAIN_ALLOWLIST } from '@avocat-ai/shared';
import { requireEnv } from './lib/env.js';
import {
  createSupabaseService,
  getMissingAuthorityDomains,
  getMissingBuckets,
  getMissingResidencyZones,
  validateResidencyGuards,
} from './lib/supabase.js';
import { validateVectorStore } from './lib/vector-store.js';
import { auditSecrets } from './lib/secrets.js';
import { listMissingExtensions } from './lib/postgres.js';

const REQUIRED_EXTENSIONS = ['pgvector', 'pg_trgm'];
const REQUIRED_BUCKETS = ['authorities', 'uploads', 'snapshots'];
const REQUIRED_RESIDENCY_ZONES = ['eu', 'ohada', 'ch', 'ca', 'rw', 'maghreb'];

async function main(): Promise<void> {
  const env = requireEnv([
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_DB_URL',
    'OPENAI_API_KEY',
    'OPENAI_VECTOR_STORE_AUTHORITIES_ID',
  ]);

  const supabase = createSupabaseService(env);

  let hasFailures = false;

  const dryRun = process.env.OPS_CHECK_DRY_RUN === '1';

  const secretIssues = auditSecrets(env);
  if (secretIssues.length > 0) {
    hasFailures = true;
    console.error('\n✗ Audit des secrets :');
    for (const issue of secretIssues) {
      console.error(`  - ${issue.key}: ${issue.reason}`);
    }
  } else {
    console.log('\n✓ Secrets essentiels présents.');
  }

  const extensionSpinner = ora('Vérification des extensions Postgres...').start();
  try {
    const missingExtensions = await listMissingExtensions(env.SUPABASE_DB_URL, REQUIRED_EXTENSIONS);
    if (missingExtensions.length === 0) {
      extensionSpinner.succeed('Extensions pgvector et pg_trgm disponibles.');
    } else {
      hasFailures = true;
      extensionSpinner.fail(`Extensions manquantes: ${missingExtensions.join(', ')}`);
    }
  } catch (error) {
    extensionSpinner.fail("Impossible de vérifier les extensions Postgres.");
    console.error(error instanceof Error ? error.message : error);
    hasFailures = true;
  }

  if (dryRun) {
    console.log('\n⧗ Mode simulation: vérifications Supabase (buckets, domaines, residency) ignorées.');
  } else {
    const bucketSpinner = ora('Vérification des buckets de stockage Supabase...').start();
    try {
      const missingBuckets = await getMissingBuckets(supabase, REQUIRED_BUCKETS);
      if (missingBuckets.length === 0) {
        bucketSpinner.succeed('Buckets authorities, uploads et snapshots configurés.');
      } else {
        hasFailures = true;
        bucketSpinner.fail(`Buckets manquants: ${missingBuckets.join(', ')}`);
      }
    } catch (error) {
      bucketSpinner.fail('Impossible de lister les buckets Supabase.');
      console.error(error instanceof Error ? error.message : error);
      hasFailures = true;
    }

    const residencySpinner = ora('Vérification des zones de résidence...').start();
    try {
      const missingZones = await getMissingResidencyZones(supabase, REQUIRED_RESIDENCY_ZONES);
      if (missingZones.length === 0) {
        residencySpinner.succeed('Toutes les zones de résidence requises sont synchronisées.');
      } else {
        hasFailures = true;
        residencySpinner.fail(`Zones de résidence manquantes: ${missingZones.join(', ')}`);
      }
    } catch (error) {
      residencySpinner.fail('Impossible de vérifier les zones de résidence.');
      console.error(error instanceof Error ? error.message : error);
      hasFailures = true;
    }

    const residencyGuardSpinner = ora('Validation des garde-fous de résidence...').start();
    try {
      const issues = await validateResidencyGuards(supabase);
      if (issues.length === 0) {
        residencyGuardSpinner.succeed('Fonctions de résidence vérifiées.');
      } else {
        hasFailures = true;
        residencyGuardSpinner.fail(`Problèmes détectés: ${issues.join('; ')}`);
      }
    } catch (error) {
      residencyGuardSpinner.fail('Impossible de valider storage_residency_allowed.');
      console.error(error instanceof Error ? error.message : error);
      hasFailures = true;
    }

    const domainSpinner = ora('Vérification de la table authority_domains...').start();
    try {
      const missingDomains = await getMissingAuthorityDomains(supabase, OFFICIAL_DOMAIN_ALLOWLIST);
      if (missingDomains.length === 0) {
        domainSpinner.succeed('Tous les domaines officiels de la allowlist sont synchronisés.');
      } else {
        hasFailures = true;
        domainSpinner.fail(`Domaines absents de authority_domains: ${missingDomains.join(', ')}`);
      }
    } catch (error) {
      domainSpinner.fail('Impossible de vérifier les domaines officiels.');
      console.error(error instanceof Error ? error.message : error);
      hasFailures = true;
    }
  }

  const vectorSpinner = ora('Validation du vector store OpenAI...').start();
  try {
    const exists = await validateVectorStore(env.OPENAI_API_KEY, env.OPENAI_VECTOR_STORE_AUTHORITIES_ID);
    if (exists) {
      vectorSpinner.succeed('Vector store OpenAI détecté et accessible.');
    } else {
      hasFailures = true;
      vectorSpinner.fail('Le vector store spécifié est introuvable.');
    }
  } catch (error) {
    vectorSpinner.fail('Impossible de valider le vector store OpenAI.');
    console.error(error instanceof Error ? error.message : error);
    hasFailures = true;
  }

  if (hasFailures) {
    process.exitCode = 1;
    console.error("\n✗ Vérification d'environnement incomplète. Voir les messages ci-dessus.");
  } else {
    console.log('\n✓ Environnement conforme au plan de production.');
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
