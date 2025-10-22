/// <reference lib="deno.unstable" />

import { createEdgeClient, rowsAs } from '../lib/supabase.ts';
import { instrumentEdgeHandler } from '../lib/telemetry.ts';

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

Deno.serve(
  instrumentEdgeHandler('drive-watcher', async (request) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  } as const;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
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
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
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
    // Attempt to alert Slack if configured
    try {
      const webhook = Deno.env.get('ALERTS_SLACK_WEBHOOK_URL');
      if (webhook) {
        const text = `drive-watcher: unable to persist manifest results (org: ${payload.orgId ?? 'unknown'})`;
        await fetch(webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        }).catch((err) => console.warn('slack_webhook_post_failed', err));
      }
    } catch (err) {
      console.warn('drive_manifest_insert_alert_failed', err);
    }
    return new Response('Unable to persist manifest results', { status: 500, headers: corsHeaders });
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

  // Forward failures to Slack/e-mail (if configured)
  try {
    if (errorCount > 0) {
      const webhook = Deno.env.get('ALERTS_SLACK_WEBHOOK_URL');
      if (webhook) {
        const name = payload.manifestName ?? 'manifest.jsonl';
        const link = payload.manifestUrl ? `\n${payload.manifestUrl}` : '';
        const summary = `drive-watcher: manifest validation failed for org ${payload.orgId ?? 'unknown'}\n` +
          `- File(s): ${validCount}/${manifestEntries.length} valid\n` +
          `- Warnings: ${warningCount}\n` +
          `- Errors: ${errorCount}\n` +
          `- Manifest: ${name}${link}`;
        await fetch(webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: summary }),
        }).catch((err) => console.warn('slack_webhook_post_failed', err));
      }
      // Optional: basic e-mail webhook (if an internal relay is provided)
      const emailWebhook = Deno.env.get('ALERTS_EMAIL_WEBHOOK_URL');
      if (emailWebhook) {
        const payloadEmail = {
          subject: 'Drive-watcher: manifest validation failed',
          body: {
            orgId: payload.orgId ?? null,
            manifestName: payload.manifestName ?? null,
            manifestUrl: payload.manifestUrl ?? null,
            totals: {
              files: manifestEntries.length,
              valid: validCount,
              warnings: warningCount,
              errors: errorCount,
            },
          },
        };
        await fetch(emailWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadEmail),
        }).catch((err) => console.warn('email_webhook_post_failed', err));
      }
    }
  } catch (err) {
    console.warn('drive_manifest_alerts_failed', err);
  }

  // Always-alert for selected manifest reasons (even if overall validation succeeded)
  try {
    const raw = Deno.env.get('ALERTS_MANIFEST_ALWAYS_REASONS');
    const defaults = ['non_allowlisted_domain', 'missing_binding_language'];
    const alwaysReasons = (raw && raw.trim().length > 0 ? raw.split(',') : defaults)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const alwaysSet = new Set(alwaysReasons);

    type ReasonKey = 'non_allowlisted_domain' | 'missing_binding_language' | 'binding_language_incorrect';

    const reasonCounts = new Map<ReasonKey, number>();
    const samples: string[] = [];
    let flaggedCount = 0;
    for (const v of validations) {
      const localReasons: ReasonKey[] = [];
      // non_allowlisted_domain when not allowlisted or explicit error string
      if (!v.allowlisted || (v.errors ?? []).some((e) => (e ?? '').toString().toLowerCase().includes('domaine non autorisé'))) {
        localReasons.push('non_allowlisted_domain');
      }
      // missing_binding_language warning text
      if ((v.warnings ?? []).some((w) => (w ?? '').toString().toLowerCase().includes('langue contraignante non renseignée'))) {
        localReasons.push('missing_binding_language');
      }
      // binding_language_incorrect warning text
      if ((v.warnings ?? []).some((w) => (w ?? '').toString().toLowerCase().includes('potentiellement incorrecte'))) {
        localReasons.push('binding_language_incorrect');
      }

      const matched = localReasons.filter((r) => alwaysSet.has(r));
      if (matched.length > 0) {
        flaggedCount += 1;
        for (const r of matched) {
          reasonCounts.set(r, (reasonCounts.get(r as ReasonKey) ?? 0) + 1);
        }
        if (samples.length < 3) {
          const src = v.entry.source_url ?? '';
          if (src) samples.push(src);
        }
      }
    }

    const thresholdStr = Deno.env.get('ALERTS_MANIFEST_THRESHOLD') ?? '1';
    const threshold = Number.isFinite(Number(thresholdStr)) ? Number(thresholdStr) : 1;
    if (reasonCounts.size > 0 && flaggedCount >= threshold) {
      const breakdown = Array.from(reasonCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([r, c]) => `- ${r}: ${c}`)
        .join('\n');
      const webhook = Deno.env.get('ALERTS_SLACK_WEBHOOK_URL');
      if (webhook) {
        const head = `drive-watcher: critical manifest issues for org ${payload.orgId ?? 'unknown'}`;
        const context = `File(s): ${validCount}/${manifestEntries.length} valid · warnings: ${warningCount} · errors: ${errorCount}`;
        const manifestLine = `Manifest: ${payload.manifestName ?? 'manifest.jsonl'}${payload.manifestUrl ? `\n${payload.manifestUrl}` : ''}`;
        const text = `${head}\n${context}\nFlagged: ${flaggedCount} (threshold ${threshold})\n${breakdown}\n${manifestLine}${samples.length ? `\nSamples:\n${samples.join('\n')}` : ''}`;
        await fetch(webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        }).catch((err) => console.warn('slack_webhook_post_failed', err));
      }
      const emailWebhook = Deno.env.get('ALERTS_EMAIL_WEBHOOK_URL');
      if (emailWebhook) {
        const payloadEmail = {
          subject: 'Drive-watcher: critical manifest issues detected',
          body: {
            orgId: payload.orgId ?? null,
            manifestName: payload.manifestName ?? null,
            manifestUrl: payload.manifestUrl ?? null,
            totals: {
              files: manifestEntries.length,
              valid: validCount,
              warnings: warningCount,
              errors: errorCount,
            },
            flagged: flaggedCount,
            threshold,
            reasons: Object.fromEntries(reasonCounts.entries()),
            samples,
          },
        };
        await fetch(emailWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadEmail),
        }).catch((err) => console.warn('email_webhook_post_failed', err));
      }
    }
  } catch (err) {
    console.warn('drive_manifest_always_alerts_failed', err);
  }

  return new Response(
    JSON.stringify({
      manifestId,
      fileCount: validations.length,
      validCount,
      warningCount,
      errorCount,
    }),
    { headers: { 'Content-Type': 'application/json', ...corsHeaders } },
  );
  }),
);
