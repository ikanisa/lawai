/// <reference lib="deno.unstable" />

import { createEdgeClient, EdgeSupabaseClient, rowsAs } from '../lib/supabase.ts';

type Env = {
  supabaseUrl?: string;
  supabaseServiceRole?: string;
  orgId?: string;
  days?: number;
};

type DispatchRecord = {
  id: string;
  report_type?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  status?: string | null;
  payload_url?: string | null;
  metadata?: Record<string, unknown> | null;
};

type PublicationResult = {
  orgId: string;
  slug: string;
  inserted: boolean;
  dispatches: number;
  error?: string;
};

type OrganizationRow = { id: string | null };

async function listOrganisationIds(client: EdgeSupabaseClient, orgId?: string): Promise<string[]> {
  if (orgId) {
    return [orgId];
  }
  const { data, error } = await client.from('organizations').select('id');
  if (error) {
    console.warn('Impossible de lister les organisations:', error.message);
    return [];
  }
  const rows = rowsAs<OrganizationRow>(data);
  return rows
    .map((row) => row.id)
    .filter((value): value is string => typeof value === 'string' && value.length > 0);
}

function normaliseStatus(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return 'en préparation';
  }
  return value.trim().toLowerCase();
}

function summariseDispatch(record: DispatchRecord): string {
  const start = record.period_start ?? 'N/A';
  const end = record.period_end ?? 'N/A';
  const window = `${start} → ${end}`;
  const kind = record.report_type ?? 'rapport';
  const status = normaliseStatus(record.status);
  const regulator =
    typeof record.metadata?.regulator === 'string' && record.metadata.regulator.length > 0
      ? record.metadata.regulator
      : 'Regulateur non spécifié';
  const link = record.payload_url ? ` [Dossier](${record.payload_url})` : '';
  return `- ${window} · ${kind} · ${regulator} · ${status}${link}`;
}

function buildDigest(reference: Date, dispatches: DispatchRecord[]): { markdown: string; summary: string } {
  const isoDate = reference.toISOString().slice(0, 10);
  const header = `# Bulletin régulateur (${isoDate})`;
  if (dispatches.length === 0) {
    return {
      markdown: `${header}\n\n_Aucune notification envoyée durant la période demandée._\n`,
      summary: 'Aucune notification envoyée durant la période couverte.',
    };
  }

  const lines: string[] = [header, ''];
  for (const dispatch of dispatches) {
    lines.push(summariseDispatch(dispatch));
  }
  const summary = `Synthèse de ${dispatches.length} notification(s) régulatrices.`;
  return { markdown: `${lines.join('\n')}\n`, summary };
}

function resolveNumber(input: unknown, fallback: number): number {
  if (typeof input === 'number' && Number.isFinite(input) && input > 0) {
    return Math.floor(input);
  }
  if (typeof input === 'string') {
    const parsed = Number.parseInt(input, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return fallback;
}

Deno.serve(async (req) => {
  const payload: Env = {};
  if (req.method === 'POST') {
    const body = await req.json().catch(() => ({}));
    if (body && typeof body === 'object') {
      Object.assign(payload, body as Env);
    }
  }

  const url = new URL(req.url);
  if (!payload.orgId && url.searchParams.has('orgId')) {
    payload.orgId = url.searchParams.get('orgId') ?? undefined;
  }
  if (!payload.days && url.searchParams.has('days')) {
    const value = url.searchParams.get('days');
    payload.days = value ? Number(value) : undefined;
  }

  const supabaseUrl = payload.supabaseUrl ?? Deno.env.get('SUPABASE_URL');
  const supabaseServiceRole =
    payload.supabaseServiceRole ??
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
    Deno.env.get('SUPABASE_SERVICE_ROLE');

  if (!supabaseUrl || !supabaseServiceRole) {
    return new Response(JSON.stringify({ error: 'Missing Supabase credentials' }), { status: 400 });
  }

  const supabase = createEdgeClient(supabaseUrl, supabaseServiceRole);
  const targetDays = resolveNumber(payload.days ?? Deno.env.get('REGULATOR_DIGEST_DAYS'), 7);
  const reference = new Date();
  const periodStart = new Date(reference.getTime() - targetDays * 24 * 60 * 60 * 1000);
  const startIso = periodStart.toISOString().slice(0, 10);
  const endIso = reference.toISOString().slice(0, 10);

  const organisations = await listOrganisationIds(supabase, payload.orgId);
  if (organisations.length === 0) {
    return new Response(JSON.stringify({ publications: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const results: PublicationResult[] = [];

  for (const orgId of organisations) {
    try {
      const { data, error } = await supabase
        .from('regulator_dispatches')
        .select('id, report_type, period_start, period_end, status, payload_url, metadata')
        .eq('org_id', orgId)
        .gte('period_end', startIso)
        .order('period_end', { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      const dispatches = rowsAs<DispatchRecord>(data);
      const { markdown, summary } = buildDigest(reference, dispatches);
      const slug = `regulator-digest-${orgId}-${endIso}`;
      const docUrl = `https://docs.avocat-ai.example/regulator-digests/${orgId}/${endIso}`;

      const { error: upsertError } = await supabase.from('governance_publications').upsert(
        {
          slug,
          title: `Bulletin régulateur ${endIso}`,
          summary,
          doc_url: docUrl,
          category: 'regulator-digest',
          status: 'published',
          published_at: reference.toISOString(),
          metadata: {
            markdown,
            dispatchCount: dispatches.length,
            window: { start: startIso, end: endIso },
            dispatchIds: dispatches.map((item) => item.id),
          },
        },
        { onConflict: 'slug' },
      );

      if (upsertError) {
        throw new Error(upsertError.message);
      }

      results.push({ orgId, slug, inserted: true, dispatches: dispatches.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Impossible de générer le digest pour ${orgId}:`, message);
      results.push({ orgId, slug: 'n/a', inserted: false, dispatches: 0, error: message });
    }
  }

  return new Response(JSON.stringify({ publications: results }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
