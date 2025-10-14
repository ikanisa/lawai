/// <reference lib="deno.unstable" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.5';

type Env = {
  supabaseUrl?: string;
  supabaseServiceRole?: string;
  orgId?: string;
  days?: number;
};

type TransparencyMetrics = {
  operations?: {
    totalRuns?: number | null;
    hitlTriggered?: number | null;
    hitl?: { medianResponseMinutes?: number | null } | null;
  } | null;
  compliance?: { cepejPassRate?: number | null } | null;
  ingestion?: { total?: number | null; succeeded?: number | null } | null;
  evaluations?: { passRate?: number | null } | null;
} | null;

type TransparencyReportRow = {
  id: string;
  org_id: string;
  period_start: string;
  period_end: string;
  generated_at: string;
  distribution_status?: string | null;
  metrics: TransparencyMetrics;
};

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

async function listOrganisationIds(client: ReturnType<typeof createClient>, orgId?: string): Promise<string[]> {
  if (orgId) {
    return [orgId];
  }
  const { data, error } = await client.from('organizations').select('id');
  if (error) {
    console.warn('Unable to list organisations', error.message);
    return [];
  }
  return (data ?? []).map((row) => row.id as string);
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 'n/a';
  }
  const normalized = value > 1 ? value : value * 100;
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(normalized)}%`;
}

function formatCount(value: number | null | undefined): number {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.round(value));
}

function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || Number.isNaN(minutes)) {
    return 'n/a';
  }
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(Math.max(minutes, 0))} min`;
}

function buildReportLink(row: TransparencyReportRow): string {
  return `https://docs.avocat-ai.example/transparency-reports/${row.org_id}/${row.id}`;
}

function summariseReport(row: TransparencyReportRow): string {
  const metrics = row.metrics ?? {};
  const operations = metrics.operations ?? {};
  const compliance = metrics.compliance ?? {};
  const ingestion = metrics.ingestion ?? {};
  const evaluations = metrics.evaluations ?? {};
  const hitl = operations?.hitl ?? {};

  const period = `${row.period_start ?? 'N/A'} → ${row.period_end ?? 'N/A'}`;
  const runs = formatCount(operations?.totalRuns ?? 0);
  const hitlCount = formatCount(operations?.hitlTriggered ?? hitl?.total ?? 0);
  const hitlMedian = formatDuration(hitl?.medianResponseMinutes ?? null);
  const cepej = compliance && 'cepejPassRate' in compliance ? formatPercent(compliance?.cepejPassRate ?? null) : 'n/a';
  const evalRate = evaluations && 'passRate' in evaluations ? formatPercent(evaluations?.passRate ?? null) : 'n/a';
  const ingestionSummary = `${formatCount(ingestion?.succeeded ?? 0)}/${formatCount(ingestion?.total ?? 0)}`;
  const status = (row.distribution_status ?? 'draft').toLowerCase();
  const link = buildReportLink(row);

  return [
    `- ${period}`,
    `runs ${runs} (HITL ${hitlCount}, délai ${hitlMedian})`,
    `CEPEJ ${cepej}`,
    `évaluations ${evalRate}`,
    `ingestion ${ingestionSummary}`,
    `statut ${status} [Rapport](${link})`,
  ].join(' · ');
}

function buildDigest(reference: Date, reports: TransparencyReportRow[]): { markdown: string; summary: string } {
  const header = `# Bulletin de transparence (${reference.toISOString().slice(0, 10)})`;
  if (reports.length === 0) {
    return {
      markdown: `${header}\n\n_Aucun rapport de transparence généré durant la période demandée._\n`,
      summary: 'Aucun rapport de transparence généré durant la période couverte.',
    };
  }

  const lines = [header, ''];
  for (const report of reports) {
    lines.push(summariseReport(report));
  }
  const markdown = `${lines.join('\n')}\n`;
  const summary = `Synthèse de ${reports.length} rapport(s) de transparence.`;
  return { markdown, summary };
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

  const supabase = createClient(supabaseUrl, supabaseServiceRole);
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

      const reports = (data ?? []) as TransparencyReportRow[];
      const { markdown, summary } = buildDigest(reference, reports);
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
