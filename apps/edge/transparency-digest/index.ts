/// <reference lib="deno.unstable" />

import {
  formatTransparencyDigest,
  type TransparencyReport,
} from 'npm:@avocat-ai/shared/transparency';
import { createEdgeClient, EdgeSupabaseClient, rowsAs } from '../lib/supabase.ts';

type Env = {
  supabaseUrl?: string;
  supabaseServiceRole?: string;
  orgId?: string;
  days?: number;
};

type TransparencyReportRow = TransparencyReport;

type PublicationResult = {
  orgId: string;
  slug: string;
  inserted: boolean;
  reports: number;
  error?: string;
};

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

type OrganizationRow = { id: string | null };

async function listOrganisationIds(client: EdgeSupabaseClient, orgId?: string): Promise<string[]> {
  if (orgId) {
    return [orgId];
  }
  const { data, error } = await client.from('organizations').select('id');
  if (error) {
    console.warn('Unable to list organisations', error.message);
    return [];
  }
  const rows = rowsAs<OrganizationRow>(data);
  return rows
    .map((row) => row.id)
    .filter((value): value is string => typeof value === 'string' && value.length > 0);
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
  const targetDays = resolveNumber(payload.days ?? Deno.env.get('TRANSPARENCY_DIGEST_DAYS'), 30);
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
        .from('transparency_reports')
        .select('id, org_id, period_start, period_end, generated_at, distribution_status, metrics')
        .eq('org_id', orgId)
        .gte('period_end', startIso)
        .order('period_end', { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      const reports = rowsAs<TransparencyReportRow>(data);
      const { markdown, summary } = formatTransparencyDigest(reference, reports);
      const slug = `transparency-digest-${orgId}-${endIso}`;
      const docUrl = `https://docs.avocat-ai.example/transparency-digests/${orgId}/${endIso}`;

      const { error: upsertError } = await supabase.from('governance_publications').upsert(
        {
          slug,
          title: `Bulletin de transparence ${endIso}`,
          summary,
          doc_url: docUrl,
          category: 'transparency-digest',
          status: 'published',
          published_at: reference.toISOString(),
          metadata: {
            markdown,
            reportIds: reports.map((item) => item.id),
            window: { start: startIso, end: endIso },
            count: reports.length,
          },
        },
        { onConflict: 'slug' },
      );

      if (upsertError) {
        throw new Error(upsertError.message);
      }

      results.push({ orgId, slug, inserted: true, reports: reports.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Unable to generate transparency digest for ${orgId}:`, message);
      results.push({ orgId, slug: 'n/a', inserted: false, reports: 0, error: message });
    }
  }

  return new Response(JSON.stringify({ publications: results }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
