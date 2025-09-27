#!/usr/bin/env node
import { requireEnv } from './lib/env.js';
import { createSupabaseService, ensureBucket, syncAuthorityDomains, syncResidencyZones } from './lib/supabase.js';

async function main() {
  const env = requireEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
  const supabase = createSupabaseService(env);

  await ensureBucket(supabase, 'authorities');
  await ensureBucket(supabase, 'uploads');
  await ensureBucket(supabase, 'snapshots');
  await syncResidencyZones(supabase);
  await syncAuthorityDomains(supabase);

  console.log('Bootstrap environnement terminé.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
