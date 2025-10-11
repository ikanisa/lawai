/// <reference lib="deno.unstable" />

import { createEdgeClient, rowsAs } from '../lib/supabase.ts';

type ManifestEntry = {
  file_id: string;
  juris_code: string;
  source_type: string;
  title?: string;
  publisher?: string;
  source_url: string;
  publication_date?: string;
  effective_date?: string;
  consolidation_status?: string;
  language_binding?: string;
  translation_notice?: string | null;
  hash_sha256?: string;
  allowlisted_domain?: boolean;
};

type ValidationResult = {
  entry: ManifestEntry;
  errors: string[];
  warnings: string[];
  allowlisted: boolean;
};

type DriveWatcherRequest = {
  orgId?: string;
  manifestName?: string;
  manifestUrl?: string;
  manifestContent?: string;
  entries?: ManifestEntry[];
};

const REQUIRED_FIELDS: Array<keyof ManifestEntry> = [
  'file_id',
  'juris_code',
  'source_type',
  'title',
  'publisher',
  'source_url',
];

const MAGHREB_CODES = new Set(['MA', 'TN', 'DZ']);

function parseManifestText(text: string | null | undefined): ManifestEntry[] {
  if (!text) {
    return [];
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed as ManifestEntry[];
    }
    if (typeof parsed === 'object' && parsed !== null) {
      return Object.values(parsed) as ManifestEntry[];
    }
  } catch (_error) {
    const lines = trimmed
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    const entries: ManifestEntry[] = [];
    for (const line of lines) {
      try {
        const row = JSON.parse(line) as ManifestEntry;
        entries.push(row);
      } catch (error) {
        console.warn('manifest_line_parse_error', error);
      }
    }
    if (entries.length > 0) {
      return entries;
    }
  }

  return [];
}

function extractHost(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.host.toLowerCase();
  } catch (_error) {
    return null;
  }
}

function validateEntry(entry: ManifestEntry, allowlist: Set<string>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const field of REQUIRED_FIELDS) {
    if (!entry[field]) {
      errors.push(`Champ obligatoire manquant: ${field}`);
    }
  }

  if (entry.hash_sha256 && entry.hash_sha256.length < 32) {
    warnings.push('Empreinte SHA-256 invalide ou tronquée.');
  }

  if (!entry.effective_date && entry.source_type !== 'gazette') {
    warnings.push("Date d'entrée en vigueur manquante.");
  }

  const host = entry.source_url ? extractHost(entry.source_url) : null;
  const allowlisted = Boolean(host && allowlist.has(host));
  if (!allowlisted) {
    errors.push('Domaine non autorisé: ' + (host ?? 'inconnu'));
  }

  if (MAGHREB_CODES.has(entry.juris_code)) {
    const bindingLang = entry.language_binding?.toLowerCase() ?? '';
    if (bindingLang && bindingLang !== 'ar' && bindingLang !== 'arabe') {
      warnings.push(
        "Langue contraignante potentiellement incorrecte pour le Maghreb (attendu: arabe).",
      );
    }
    if (!bindingLang) {
      warnings.push("Langue contraignante non renseignée pour une juridiction Maghreb.");
    }
  }

  return { entry, errors, warnings, allowlisted };
}

async function fetchManifestFromUrl(url: string | undefined): Promise<string | null> {
  if (!url) {
    return null;
  }
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.text();
  } catch (error) {
    console.error('manifest_fetch_failed', error);
    return null;
  }
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseKey) {
    return new Response('Supabase credentials missing', { status: 500 });
  }

  let payload: DriveWatcherRequest;
  try {
    payload = (await request.json()) as DriveWatcherRequest;
  } catch (_error) {
    return new Response('Invalid JSON body', { status: 400 });
  }

  const supabase = createEdgeClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const manifestText = payload.manifestContent ?? (await fetchManifestFromUrl(payload.manifestUrl));
  const manifestEntries = [
    ...(payload.entries ?? []),
    ...parseManifestText(manifestText),
  ];

  if (manifestEntries.length === 0) {
    return new Response(JSON.stringify({ error: 'Manifest vide ou introuvable.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const allowlistHosts = new Set<string>();
  const { data: domains } = await supabase
    .from('authority_domains')
    .select('host, active')
    .eq('active', true);
  const domainRows = rowsAs<{ host: string | null }>(domains);
  for (const domain of domainRows) {
    if (domain.host) {
      allowlistHosts.add(domain.host.toLowerCase());
    }
  }

  const validations = manifestEntries.map((entry) => validateEntry(entry, allowlistHosts));
  const validCount = validations.filter((entry) => entry.errors.length === 0).length;
  const warningCount = validations.filter((entry) => entry.warnings.length > 0).length;
  const errorCount = validations.length - validCount;

  const manifestInsert = await supabase
    .from('drive_manifests')
    .insert({
      org_id: payload.orgId ?? null,
      manifest_name: payload.manifestName ?? 'manifest.jsonl',
      manifest_url: payload.manifestUrl ?? null,
      file_count: validations.length,
      valid_count: validCount,
      warning_count: warningCount,
      error_count: errorCount,
      validated: errorCount === 0,
      errors: validations
        .filter((item) => item.errors.length > 0)
        .map((item) => ({ file_id: item.entry.file_id, errors: item.errors })),
      warnings: validations
        .filter((item) => item.warnings.length > 0)
        .map((item) => ({ file_id: item.entry.file_id, warnings: item.warnings })),
    })
    .select('id')
    .single();

  if (manifestInsert.error) {
    console.error('drive_manifest_insert_failed', manifestInsert.error);
    return new Response('Unable to persist manifest results', { status: 500 });
  }

  const manifestId = manifestInsert.data?.id as string | null;
  if (manifestId) {
    const items = validations.map((validation) => ({
      manifest_id: manifestId,
      file_id: validation.entry.file_id,
      juris_code: validation.entry.juris_code,
      source_type: validation.entry.source_type,
      source_url: validation.entry.source_url,
      allowlisted: validation.allowlisted,
      binding_language: validation.entry.language_binding ?? null,
      effective_date: validation.entry.effective_date ?? null,
      consolidation_status: validation.entry.consolidation_status ?? null,
      validation_errors: validation.errors.length > 0 ? validation.errors : null,
      validation_warnings: validation.warnings.length > 0 ? validation.warnings : null,
    }));

    if (items.length > 0) {
      const { error: itemError } = await supabase.from('drive_manifest_items').insert(items);
      if (itemError) {
        console.error('drive_manifest_items_insert_failed', itemError);
      }
    }

    if (payload.orgId) {
      await supabase.from('ingestion_runs').insert({
        org_id: payload.orgId,
        adapter_id: 'drive-watcher',
        status: errorCount === 0 ? 'completed' : 'failed',
        inserted_count: validCount,
        failed_count: errorCount,
        skipped_count: 0,
        finished_at: new Date().toISOString(),
        error_message: errorCount === 0 ? null : 'Manifest contains invalid entries',
      });
    }
  }

  return new Response(
    JSON.stringify({
      manifestId,
      fileCount: validations.length,
      validCount,
      warningCount,
      errorCount,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
