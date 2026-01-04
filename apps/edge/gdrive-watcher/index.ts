/// <reference lib="deno.unstable" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.5';

interface GDriveWatcherRequest {
  orgId?: string;
  changes: Array<{
    fileId: string;
    driveFile?: {
      id?: string;
      name?: string;
      parents?: string[];
      mimeType?: string;
      properties?: Record<string, unknown>;
      webViewLink?: string;
    } | null;
    metadata?: Record<string, unknown>;
    errorReason?: string;
  }>;
}

const MAGHREB_CODES = new Set(['MA', 'TN', 'DZ']);

function determineReason(change: GDriveWatcherRequest['changes'][number]): string | null {
  if (change.errorReason) {
    return change.errorReason;
  }
  const meta = change.metadata ?? {};
  const juris = typeof meta.jurisdiction_code === 'string' ? meta.jurisdiction_code.toUpperCase() : null;
  const bindingLang = (meta.binding_language ?? meta.language_binding ?? '').toString().toLowerCase();
  if (juris && MAGHREB_CODES.has(juris) && !bindingLang) {
    return 'missing_binding_language';
  }
  if (meta.allowlisted === false) {
    return 'non_allowlisted_domain';
  }
  if (Array.isArray(meta.validation_errors) && meta.validation_errors.length > 0) {
    return String(meta.validation_errors[0]);
  }
  return null;
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseKey) {
    return new Response('missing_supabase_env', { status: 500 });
  }

  let payload: GDriveWatcherRequest;
  try {
    payload = (await request.json()) as GDriveWatcherRequest;
  } catch (_error) {
    return new Response('invalid_json', { status: 400 });
  }

  if (!payload.orgId) {
    return new Response('orgId_required', { status: 400 });
  }

  const entries = (payload.changes ?? []).map((change) => ({
    org_id: payload.orgId,
    adapter_id: 'gdrive-watcher',
    source_url: change.driveFile?.webViewLink ?? `gdrive:${change.fileId}`,
    canonical_url: change.metadata?.canonical_url?.toString() ?? null,
    reason: determineReason(change) ?? 'gdrive_watch_event',
    metadata: {
      change,
      receivedAt: new Date().toISOString(),
    },
  }));

  if (entries.length === 0) {
    return new Response(JSON.stringify({ inserted: 0 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await supabase.from('ingestion_quarantine').insert(entries, {
    onConflict: 'org_id,source_url,reason',
  });

  if (error) {
    console.error('gdrive_watcher_quarantine_failed', error);
    return new Response('insert_failed', { status: 500 });
  }

  return new Response(JSON.stringify({ inserted: entries.length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
