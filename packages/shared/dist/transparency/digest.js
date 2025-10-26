const DEFAULT_LOCALE = 'fr-FR';
function createFormatter(locale, maximumFractionDigits) {
    return new Intl.NumberFormat(locale, {
        maximumFractionDigits,
        minimumFractionDigits: 0,
    });
}
export function formatPercent(value, locale = DEFAULT_LOCALE) {
    if (value === null || value === undefined || Number.isNaN(value)) {
        return 'n/a';
    }
    const formatter = createFormatter(locale, 1);
    const normalized = value > 1 ? value : value * 100;
    return `${formatter.format(normalized)}%`;
}
export function formatCount(value) {
    if (value === null || value === undefined || Number.isNaN(value)) {
        return 0;
    }
    return Math.max(0, Math.round(value));
}
export function formatDuration(value, locale = DEFAULT_LOCALE) {
    if (value === null || value === undefined || Number.isNaN(value)) {
        return 'n/a';
    }
    const formatter = createFormatter(locale, 1);
    return `${formatter.format(Math.max(value, 0))} min`;
}
function defaultLink(record) {
    return `https://docs.avocat-ai.example/transparency-reports/${record.org_id}/${record.id}`;
}
function resolveHeading(reference, explicitHeading) {
    if (explicitHeading) {
        return explicitHeading;
    }
    return `# Bulletin de transparence (${reference.toISOString().slice(0, 10)})`;
}
export function summariseTransparencyReport(record, options = {}) {
    const metrics = record.metrics ?? {};
    const operations = (metrics.operations ?? {});
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
export function formatTransparencyDigest(reference, reports, options = {}) {
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
