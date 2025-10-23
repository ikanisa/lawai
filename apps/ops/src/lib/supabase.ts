import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '@avocat-ai/supabase';
import { AuditLogger } from '@avocat-ai/compliance';
import ora from 'ora';
import { OFFICIAL_DOMAIN_ALLOWLIST, getJurisdictionsForDomain } from '@avocat-ai/shared';

type BucketListItem = {
  id: string;
  name: string;
};

export interface SupabaseServiceOptions {
  factory?: ServiceClientFactory;
  reuseExisting?: boolean;
  client?: SupabaseClient | null;
}

export function createSupabaseService(
  env: Record<string, string>,
  options: SupabaseServiceOptions = {},
): SupabaseClient {
  return createServiceClient(
    {
      SUPABASE_URL: env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
    },
    {
      factory: options.factory,
      reuseExisting: options.reuseExisting,
      client: options.client ?? null,
    },
  );
}

export async function ensureBucket(
  supabase: SupabaseClient,
  bucketId: string,
  spinner = ora(),
): Promise<void> {
  spinner.start(`Vérification du bucket ${bucketId}...`);

  const { data, error } = await supabase.storage.getBucket(bucketId);

  if (error && error.message && !error.message.includes('Object not found')) {
    spinner.fail(`Échec d'accès au bucket ${bucketId}: ${error.message}`);
    throw error;
  }

  if (data) {
    spinner.succeed(`Bucket ${bucketId} déjà configuré.`);
    return;
  }

  const creation = await supabase.storage.createBucket(bucketId, {
    public: false,
    fileSizeLimit: 52_428_800,
  });

  if (creation.error) {
    spinner.fail(`Impossible de créer le bucket ${bucketId}: ${creation.error.message}`);
    throw creation.error;
  }

  spinner.succeed(`Bucket ${bucketId} créé.`);
}

export async function syncAuthorityDomains(
  supabase: SupabaseClient,
  allowlist: readonly string[] = OFFICIAL_DOMAIN_ALLOWLIST,
  spinner = ora(),
): Promise<void> {
  spinner.start('Synchronisation des domaines officiels...');

  const records = allowlist.flatMap((host) => {
    const jurisdictions = getJurisdictionsForDomain(host);
    return jurisdictions.map((code) => ({ jurisdiction_code: code, host }));
  });

  const { error } = await supabase
    .from('authority_domains')
    .upsert(records, { onConflict: 'jurisdiction_code,host' });

  if (error) {
    spinner.fail(`Impossible de synchroniser les domaines: ${error.message}`);
    throw error;
  }

  spinner.succeed('Domaines officiels synchronisés.');
}

export async function syncResidencyZones(
  supabase: SupabaseClient,
  spinner = ora(),
): Promise<void> {
  spinner.start('Synchronisation des zones de résidence...');

  const zones: Array<{ code: string; description: string }> = [
    { code: 'eu', description: 'Union européenne / EEE' },
    { code: 'ohada', description: "OHADA - Afrique de l'Ouest et Centrale" },
    { code: 'ch', description: 'Suisse (cantons francophones)' },
    { code: 'ca', description: 'Canada / Québec' },
    { code: 'rw', description: 'Rwanda (gazette et justice)' },
    { code: 'maghreb', description: 'Maghreb francophone (Maroc, Tunisie, Algérie)' },
  ];

  const { error } = await supabase.from('residency_zones').upsert(zones, { onConflict: 'code' });

  if (error) {
    spinner.fail(`Impossible de synchroniser les zones de résidence: ${error.message}`);
    throw error;
  }

  spinner.succeed('Zones de résidence synchronisées.');
}

export async function getMissingBuckets(
  supabase: SupabaseClient,
  requiredBuckets: readonly string[],
): Promise<string[]> {
  const { data, error } = await supabase.storage.listBuckets();

  if (error) {
    throw error;
  }

  const existing = new Set((data as BucketListItem[] | null)?.map((bucket) => bucket.name) ?? []);
  return requiredBuckets.filter((bucket) => !existing.has(bucket));
}

export async function getMissingAuthorityDomains(
  supabase: SupabaseClient,
  allowlist: readonly string[] = OFFICIAL_DOMAIN_ALLOWLIST,
): Promise<string[]> {
  const { data, error } = await supabase
    .from('authority_domains')
    .select('host')
    .in('host', allowlist as string[]);

  if (error) {
    throw error;
  }

  const present = new Set((data ?? []).map((row) => row.host.toLowerCase()));
  return allowlist.filter((host) => !present.has(host.toLowerCase()));
}

export async function getMissingResidencyZones(
  supabase: SupabaseClient,
  requiredZones: readonly string[],
): Promise<string[]> {
  const { data, error } = await supabase.from('residency_zones').select('code');

  if (error) {
    throw error;
  }

  const existing = new Set((data ?? []).map((row) => row.code));
  return requiredZones.filter((zone) => !existing.has(zone));
}

export async function validateResidencyGuards(supabase: SupabaseClient): Promise<string[]> {
  const issues: string[] = [];

  const valid = await supabase.rpc('storage_residency_allowed', { code: 'eu' });
  if (valid.error) {
    issues.push(`storage_residency_allowed RPC inaccessible: ${valid.error.message}`);
  } else if (valid.data !== true) {
    issues.push('storage_residency_allowed(eu) devrait retourner true.');
  }

  const invalid = await supabase.rpc('storage_residency_allowed', { code: 'invalid-zone' });
  if (invalid.error) {
    issues.push(`storage_residency_allowed(invalid-zone) erreur: ${invalid.error.message}`);
  } else if (invalid.data !== false) {
    issues.push('storage_residency_allowed(invalid-zone) devrait retourner false.');
  }

  return issues;
}

export function createOpsAuditLogger(supabase: SupabaseClient) {
  return new AuditLogger(supabase);
}
