const DEFAULT_BASE_URL = 'https://docs.avocat-ai.example/transparency-reports';
const DEFAULT_LOCALE = 'fr-FR';
const DEFAULT_EMPTY_MESSAGE = '_Aucun rapport de transparence généré durant la période demandée._';
const DEFAULT_HEADER_LABEL = 'Bulletin de transparence';
export function formatPercent(value, locale = DEFAULT_LOCALE) {
    if (value === null || value === undefined || Number.isNaN(value)) {
        return 'n/a';
    }
    const normalized = value > 1 ? value : value * 100;
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(normalized)}%`;
}
export function formatCount(value) {
    if (value === null || value === undefined || Number.isNaN(value)) {
        return 0;
    }
    return Math.max(0, Math.round(value));
}
export function formatDuration(minutes, locale = DEFAULT_LOCALE) {
    if (minutes === null || minutes === undefined || Number.isNaN(minutes)) {
        return 'n/a';
    }
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(Math.max(minutes, 0))} min`;
}
export function buildReportLink(report, baseUrl = DEFAULT_BASE_URL) {
    const safeOrg = encodeURIComponent(report.org_id);
    const safeId = encodeURIComponent(report.id);
    return `${baseUrl}/${safeOrg}/${safeId}`;
}
export function summariseTransparencyReport(report, options = {}) {
    const locale = options.locale ?? DEFAULT_LOCALE;
    const metrics = report.metrics ?? {};
    const operations = metrics.operations ?? {};
    const compliance = metrics.compliance ?? {};
    const ingestion = metrics.ingestion ?? {};
    const evaluations = metrics.evaluations ?? {};
    const hitl = operations.hitl ?? {};
    const period = `${report.period_start ?? 'N/A'} → ${report.period_end ?? 'N/A'}`;
    const runs = formatCount(operations.totalRuns ?? operations.total_runs);
    const hitlTotalCandidate = operations.hitlTriggered ??
        hitl.total ??
        operations.hitl_total ??
        0;
    const hitlCount = formatCount(hitlTotalCandidate);
    const hitlMedian = formatDuration(hitl?.medianResponseMinutes ?? null, locale);
    const complianceRate = compliance && Object.prototype.hasOwnProperty.call(compliance, 'cepejPassRate')
        ? formatPercent(compliance.cepejPassRate ?? null, locale)
        : 'n/a';
    const evalRate = evaluations && Object.prototype.hasOwnProperty.call(evaluations, 'passRate')
        ? formatPercent(evaluations.passRate ?? null, locale)
        : 'n/a';
    const ingestionSummary = `${formatCount(ingestion.succeeded ?? 0)}/${formatCount(ingestion.total ?? 0)}`;
    const status = (report.distribution_status ?? 'draft').toLowerCase();
    const link = buildReportLink(report, options.baseUrl);
    return [
        `- ${period}`,
        `runs ${runs} (HITL ${hitlCount}, délai ${hitlMedian})`,
        `CEPEJ ${complianceRate}`,
        `évaluations ${evalRate}`,
        `ingestion ${ingestionSummary}`,
        `statut ${status} [Rapport](${link})`,
    ].join(' · ');
}
export function formatTransparencyDigest(reference, reports, options = {}) {
    const locale = options.locale ?? DEFAULT_LOCALE;
    const headerLabel = options.headerLabel ?? DEFAULT_HEADER_LABEL;
    const emptyMessage = options.emptyMessage ?? DEFAULT_EMPTY_MESSAGE;
    const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    const headerDate = reference.toISOString().slice(0, 10);
    const header = `# ${headerLabel} (${headerDate})`;
    if (reports.length === 0) {
        return {
            markdown: `${header}\n\n${emptyMessage}\n`,
            summary: 'Aucun rapport de transparence généré durant la période couverte.',
        };
    }
    const lines = [header, ''];
    for (const report of reports) {
        lines.push(summariseTransparencyReport(report, {
            baseUrl,
            locale,
        }));
    }
    return {
        markdown: `${lines.join('\n')}\n`,
        summary: `Synthèse de ${reports.length} rapport(s) de transparence.`,
    };
}
