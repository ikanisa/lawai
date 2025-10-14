#!/usr/bin/env node
import { requireEnv } from './lib/env.js';
import { createSupabaseService, ensureBucket, syncAuthorityDomains, syncResidencyZones } from './lib/supabase.js';
import { ensureVectorStore } from './lib/vector-store.js';
import { applyMigrations } from './lib/migrations.js';

async function main(): Promise<void> {
  const env = requireEnv([
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_DB_URL',
    'OPENAI_API_KEY',
    'AGENT_MODEL',
    'EMBEDDING_MODEL',
  ]);

  const supabase = createSupabaseService(env);

  await applyMigrations(env.SUPABASE_DB_URL, {
    report: ({ filename, status, error }) => {
      if (status === 'pending') {
        console.log(`→ Migration ${filename} en cours...`);
      } else if (status === 'success') {
        console.log(`✓ Migration appliquée: ${filename}`);
      } else if (status === 'error') {
        console.error(`✗ Migration ${filename} échouée: ${error?.message ?? 'erreur inconnue'}`);
      }
    },
  });

  await ensureBucket(supabase, 'authorities');
  await ensureBucket(supabase, 'uploads');
  await ensureBucket(supabase, 'snapshots');
  await syncResidencyZones(supabase);
  await syncAuthorityDomains(supabase);

  const vectorStoreId = await ensureVectorStore(env.OPENAI_API_KEY, process.env.OPENAI_VECTOR_STORE_AUTHORITIES_ID);

  if (!process.env.OPENAI_VECTOR_STORE_AUTHORITIES_ID && vectorStoreId) {
    console.log('Vector store créé. Mettez à jour OPENAI_VECTOR_STORE_AUTHORITIES_ID avec:', vectorStoreId);
  }

  console.log('Provisioning terminé.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
