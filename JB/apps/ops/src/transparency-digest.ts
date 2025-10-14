#!/usr/bin/env node
import { format } from 'date-fns';

type TransparencyOperations = {
  totalRuns?: number | null;
  highRiskRuns?: number | null;
  confidentialRuns?: number | null;
  averageLatencyMs?: number | null;
  medianLatencyMs?: number | null;
  hitlTriggered?: number | null;
  hitl?: {
    total?: number | null;
    pending?: number | null;
    resolved?: number | null;
    medianResponseMinutes?: number | null;
  } | null;
};

type TransparencyCompliance = {
  friaRequiredRuns?: number | null;
  cepejPassRate?: number | null;
  cepejViolations?: Record<string, number> | null;
  assessedRuns?: number | null;
  violationRuns?: number | null;
} | null;

type TransparencyIngestion = {
  total?: number | null;
  succeeded?: number | null;
  failed?: number | null;
} | null;

type TransparencyEvaluations = {
  total?: number | null;
  passRate?: number | null;
} | null;

type TransparencyMetrics = {
  operations?: TransparencyOperations | null;
  compliance?: TransparencyCompliance;
  ingestion?: TransparencyIngestion;
  evaluations?: TransparencyEvaluations;
};

export interface TransparencyDigestRecord {
  id: string;
  org_id: string;
  period_start: string;
  period_end: string;
  generated_at: string;
  distribution_status?: string | null;
  metrics?: TransparencyMetrics | null;
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 'n/a';
  }
  const normalized = value > 1 ? value : value * 100;
  const formatter = new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  });
  return `${formatter.format(normalized)}%`;
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
  const formatter = new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  });
  return `${formatter.format(Math.max(minutes, 0))} min`;
}

function buildReportLink(record: TransparencyDigestRecord): string {
  return `https://docs.avocat-ai.example/transparency-reports/${record.org_id}/${record.id}`;
}

function summariseReport(record: TransparencyDigestRecord): string {
  const metrics = record.metrics ?? {};
  const operations = metrics.operations ?? {};
  const compliance = metrics.compliance ?? null;
  const ingestion = metrics.ingestion ?? null;
  const evaluations = metrics.evaluations ?? null;
  const hitl = operations.hitl ?? null;

  const period = `${record.period_start ?? 'N/A'} → ${record.period_end ?? 'N/A'}`;
  const runs = formatCount(operations.totalRuns ?? 0);
  const hitlCount = formatCount(operations.hitlTriggered ?? hitl?.total ?? 0);
  const hitlMedian = formatDuration(hitl?.medianResponseMinutes ?? null);
  const cepej = compliance?.cepejPassRate === null || compliance?.cepejPassRate === undefined
    ? 'n/a'
    : formatPercent(compliance.cepejPassRate);
  const evalRate = evaluations?.passRate === null || evaluations?.passRate === undefined
    ? 'n/a'
    : formatPercent(evaluations.passRate);
  const ingestionSummary = `${formatCount(ingestion?.succeeded ?? 0)}/${formatCount(ingestion?.total ?? 0)}`;
  const status = (record.distribution_status ?? 'draft').toLowerCase();
  const link = buildReportLink(record);

  const segments = [
    `- ${period}`,
    `runs ${runs} (HITL ${hitlCount}, délai ${hitlMedian})`,
    `CEPEJ ${cepej}`,
    `évaluations ${evalRate}`,
    `ingestion ${ingestionSummary}`,
    `statut ${status} [Rapport](${link})`,
  ];
  return segments.join(' · ');
}

export function formatTransparencyDigest(reference: Date, reports: TransparencyDigestRecord[]): {
  markdown: string;
  summary: string;
} {
  const header = `# Bulletin de transparence (${format(reference, 'yyyy-MM-dd')})`;
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

if (import.meta.url === `file://${process.argv[1]}`) {
  const now = new Date();
  console.log(formatTransparencyDigest(now, []));
}
