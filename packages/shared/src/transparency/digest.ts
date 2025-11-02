export interface TransparencyOperations {
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
}

export interface TransparencyCompliance {
  friaRequiredRuns?: number | null;
  cepejPassRate?: number | null;
  cepejViolations?: Record<string, number> | null;
  assessedRuns?: number | null;
  violationRuns?: number | null;
}

export interface TransparencyIngestion {
  total?: number | null;
  succeeded?: number | null;
  failed?: number | null;
}

export interface TransparencyEvaluations {
  total?: number | null;
  passRate?: number | null;
}

export interface TransparencyMetrics {
  operations?: TransparencyOperations | null;
  compliance?: TransparencyCompliance | null;
  ingestion?: TransparencyIngestion | null;
  evaluations?: TransparencyEvaluations | null;
  [key: string]: unknown;
}

export interface TransparencyDigestRecord {
  id: string;
  org_id: string;
  period_start: string | null;
  period_end: string | null;
  generated_at: string;
  distribution_status?: string | null;
  metrics?: TransparencyMetrics | null;
}

export interface TransparencyDigestResult {
  markdown: string;
  summary: string;
}

export interface FormatTransparencyDigestOptions {
  locale?: string;
  heading?: string;
  linkBuilder?: (record: TransparencyDigestRecord) => string;
}

const DEFAULT_LOCALE = 'fr-FR';

function createFormatter(locale: string, maximumFractionDigits: number): Intl.NumberFormat {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  });
}

export function formatPercent(value: number | null | undefined, locale = DEFAULT_LOCALE): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 'n/a';
  }
  const formatter = createFormatter(locale, 1);
  const normalized = value > 1 ? value : value * 100;
  return `${formatter.format(normalized)}%`;
}

export function formatCount(value: number | null | undefined): number {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.round(value));
}

export function formatDuration(value: number | null | undefined, locale = DEFAULT_LOCALE): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 'n/a';
  }
  const formatter = createFormatter(locale, 1);
  return `${formatter.format(Math.max(value, 0))} min`;
}

function defaultLink(record: TransparencyDigestRecord): string {
  return `https://docs.avocat-ai.example/transparency-reports/${record.org_id}/${record.id}`;
}

function resolveHeading(reference: Date, explicitHeading?: string): string {
  if (explicitHeading) {
    return explicitHeading;
  }
  return `# Bulletin de transparence (${reference.toISOString().slice(0, 10)})`;
}

export function summariseTransparencyReport(
  record: TransparencyDigestRecord,
  options: { locale?: string; linkBuilder?: (record: TransparencyDigestRecord) => string } = {},
): string {
  const metrics = record.metrics ?? {};
  const operations: TransparencyOperations = {
    ...(metrics.operations ?? {}),
  };
  const compliance = metrics.compliance ?? null;
  const ingestion = metrics.ingestion ?? null;
  const evaluations = metrics.evaluations ?? null;
  const hitl = operations.hitl ?? null;
  const locale = options.locale ?? DEFAULT_LOCALE;
  const linkBuilder = options.linkBuilder ?? defaultLink;

  const period = `${record.period_start ?? 'N/A'} → ${record.period_end ?? 'N/A'}`;
  const runs = formatCount(operations.totalRuns ?? 0);
  const hitlCount = formatCount(operations.hitlTriggered ?? hitl?.total ?? 0);
  const hitlMedian = formatDuration(hitl?.medianResponseMinutes ?? null, locale);
  const cepej = compliance?.cepejPassRate === null || compliance?.cepejPassRate === undefined
    ? 'n/a'
    : formatPercent(compliance.cepejPassRate, locale);
  const evalRate = evaluations?.passRate === null || evaluations?.passRate === undefined
    ? 'n/a'
    : formatPercent(evaluations.passRate, locale);
  const ingestionSummary = `${formatCount(ingestion?.succeeded ?? 0)}/${formatCount(ingestion?.total ?? 0)}`;
  const status = (record.distribution_status ?? 'draft').toLowerCase();
  const link = linkBuilder(record);

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

export function formatTransparencyDigest(
  reference: Date,
  reports: TransparencyDigestRecord[],
  options: FormatTransparencyDigestOptions = {},
): TransparencyDigestResult {
  const locale = options.locale ?? DEFAULT_LOCALE;
  const linkBuilder = options.linkBuilder ?? defaultLink;
  const heading = resolveHeading(reference, options.heading);

  if (reports.length === 0) {
    return {
      markdown: `${heading}\n\n_Aucun rapport de transparence généré durant la période demandée._\n`,
      summary: 'Aucun rapport de transparence généré durant la période couverte.',
    };
  }

  const lines = [heading, ''];
  for (const report of reports) {
    lines.push(summariseTransparencyReport(report, { locale, linkBuilder }));
  }

  const markdown = `${lines.join('\n')}\n`;
  const summary = `Synthèse de ${reports.length} rapport(s) de transparence.`;
  return { markdown, summary };
}
