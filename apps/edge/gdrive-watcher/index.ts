/// <reference lib="deno.unstable" />

import { createEdgeClient } from '../lib/supabase.ts';
import { serveEdgeFunction } from '../lib/serve.ts';

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

serveEdgeFunction(async (request) => {
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
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const supabase = createEdgeClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await supabase.from('ingestion_quarantine').upsert(entries, {
    onConflict: 'org_id,source_url,reason',
  });

  if (error) {
    console.error('gdrive_watcher_quarantine_failed', error);
    // Notify Slack/email on failure to persist quarantine entries
    try {
      const webhook = Deno.env.get('ALERTS_SLACK_WEBHOOK_URL');
      if (webhook) {
        const summary = `gdrive-watcher: failed to persist ${entries.length} quarantine entr${entries.length === 1 ? 'y' : 'ies'} for org ${payload.orgId}`;
        await fetch(webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: summary }),
        }).catch((err) => console.warn('slack_webhook_post_failed', err));
      }
      const emailWebhook = Deno.env.get('ALERTS_EMAIL_WEBHOOK_URL');
      if (emailWebhook) {
        const body = {
          subject: 'GDrive watcher: quarantine insert failed',
          body: {
            orgId: payload.orgId,
            entries: entries.length,
            sample: entries.slice(0, 3),
            error: error?.message ?? String(error),
          },
        };
        await fetch(emailWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }).catch((err) => console.warn('email_webhook_post_failed', err));
      }
    } catch (err) {
      console.warn('gdrive_watcher_alerts_failed', err);
    }
    return new Response('insert_failed', { status: 500, headers: corsHeaders });
  }

  // Optionally alert when batch quarantine volume exceeds a threshold
  try {
    const thresholdStr = Deno.env.get('ALERTS_QUARANTINE_THRESHOLD') ?? '5';
    const threshold = Number.isFinite(Number(thresholdStr)) ? Number(thresholdStr) : 5;
    const thresholdTriggered = entries.length >= threshold;
    if (thresholdTriggered) {
      const reasonCounts = new Map<string, number>();
      for (const e of entries) {
        const r = String((e as any).reason ?? 'unknown');
        reasonCounts.set(r, (reasonCounts.get(r) ?? 0) + 1);
      }
      const breakdown = Array.from(reasonCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([r, c]) => `- ${r}: ${c}`)
        .join('\n');

      const samples = entries
        .map((e) => String((e as any).source_url ?? ''))
        .filter((u) => u)
        .slice(0, 3);

      const webhook = Deno.env.get('ALERTS_SLACK_WEBHOOK_URL');
      if (webhook) {
        const text =
          `gdrive-watcher: quarantined ${entries.length} change(s) for org ${payload.orgId}\n` +
          `${breakdown}${samples.length ? `\nSamples:\n${samples.join('\n')}` : ''}`;
        await fetch(webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        }).catch((err) => console.warn('slack_webhook_post_failed', err));
      }
      const emailWebhook = Deno.env.get('ALERTS_EMAIL_WEBHOOK_URL');
      if (emailWebhook) {
        const payloadEmail = {
          subject: `GDrive watcher: ${entries.length} quarantined changes`,
          body: {
            orgId: payload.orgId,
            total: entries.length,
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

    // Always-alert for certain reasons even below threshold
    if (!thresholdTriggered) {
      const defaultAlways = ['missing_binding_language', 'non_allowlisted_domain'];
      const alwaysListCsv = Deno.env.get('ALERTS_QUARANTINE_ALWAYS_REASONS');
      const always = (alwaysListCsv && alwaysListCsv.trim().length > 0
        ? alwaysListCsv.split(',')
        : defaultAlways
      )
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      const alwaysSet = new Set(always);
      const flagged = entries.filter((e) => alwaysSet.has(String((e as any).reason ?? '')));
      if (flagged.length > 0) {
        const reasonCounts = new Map<string, number>();
        for (const e of flagged) {
          const r = String((e as any).reason ?? 'unknown');
          reasonCounts.set(r, (reasonCounts.get(r) ?? 0) + 1);
        }
        const breakdown = Array.from(reasonCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([r, c]) => `- ${r}: ${c}`)
          .join('\n');
        const samples = flagged
          .map((e) => String((e as any).source_url ?? ''))
          .filter((u) => u)
          .slice(0, 3);

        const webhook = Deno.env.get('ALERTS_SLACK_WEBHOOK_URL');
        if (webhook) {
          const text =
            `gdrive-watcher: flagged quarantines for critical reasons (org ${payload.orgId})\n` +
            `${breakdown}${samples.length ? `\nSamples:\n${samples.join('\n')}` : ''}`;
          await fetch(webhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
          }).catch((err) => console.warn('slack_webhook_post_failed', err));
        }
        const emailWebhook = Deno.env.get('ALERTS_EMAIL_WEBHOOK_URL');
        if (emailWebhook) {
          const payloadEmail = {
            subject: 'GDrive watcher: critical quarantine reasons detected',
            body: {
              orgId: payload.orgId,
              totalFlagged: flagged.length,
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
    }
  } catch (err) {
    console.warn('gdrive_watcher_threshold_alert_failed', err);
  }

  return new Response(JSON.stringify({ inserted: entries.length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
});
