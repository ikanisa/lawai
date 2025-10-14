'use client';

import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import type { Messages } from '../../lib/i18n';
import type { OperationsOverviewResponse } from '../../lib/api';

interface OperationsOverviewCardProps {
  messages: Messages;
  data: OperationsOverviewResponse | null;
  loading?: boolean;
  locale: string;
}

const ACCEPTANCE_THRESHOLDS = {
  citationsAllowlistedP95: 0.95,
  temporalValidityP95: 0.95,
  maghrebBindingBannerCoverage: 1,
  rwandaLanguageNoticeCoverage: 1,
  linkHealthFailureRatioMax: 0.05,
} as const;

function formatDate(value: string | null | undefined, locale: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${Math.round(value * 100)} %`;
}

function formatSeconds(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${Math.round(value)} s`;
}

function formatMinutes(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${Math.round(value)} min`;
}

export function OperationsOverviewCard({ messages, data, loading = false, locale }: OperationsOverviewCardProps) {
  const opsMessages = messages.admin.operations;
  const sloSummary = data?.slo.summary ?? null;
  const sloSnapshots = data?.slo.snapshots ?? [];
  const incidents = data?.incidents ?? null;
  const changeLog = data?.changeLog ?? null;
  const goNoGo = data?.goNoGo ?? null;
  const compliance = data?.compliance ?? null;
  const webVitals = data?.webVitals ?? null;

  const bindingCoverage = compliance?.bindingCoverage ?? null;
  const residencyCoverage = compliance?.residencyCoverage ?? null;
  const residencyTarget = 0.95;

  const complianceAlertMessages: Record<string, string> = {
    cepej_violation: opsMessages.complianceAlertCepej,
    fria_required: opsMessages.complianceAlertFria,
    maghreb_banner_low: opsMessages.complianceAlertMaghreb,
    rwanda_notice_low: opsMessages.complianceAlertRwanda,
    binding_coverage_low: opsMessages.complianceAlertBinding,
    residency_coverage_low: opsMessages.complianceAlertResidency,
  };

  const webVitalAlertMessages: Record<string, string> = {
    web_vitals_lcp: opsMessages.webVitalsAlertLcp,
    web_vitals_inp: opsMessages.webVitalsAlertInp,
    web_vitals_cls: opsMessages.webVitalsAlertCls,
  };

  return (
    <Card className="glass-card border border-slate-800/60">
      <CardHeader>
        <CardTitle className="text-slate-100">{opsMessages.title}</CardTitle>
        <p className="text-sm text-slate-400">{opsMessages.description}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="space-y-3">
          <h3 className="text-base font-semibold text-slate-100">{opsMessages.sloHeading}</h3>
          {loading && sloSnapshots.length === 0 ? (
            <p className="text-sm text-slate-400">…</p>
          ) : sloSnapshots.length === 0 ? (
            <p className="text-sm text-slate-400">{opsMessages.sloEmpty}</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-4">
                <p className="text-xs text-slate-400 uppercase">{opsMessages.sloLatestCapture}</p>
                <p className="text-sm text-slate-200">{formatDate(sloSummary?.latestCapture, locale)}</p>
              </div>
              <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-4">
                <p className="text-xs text-slate-400 uppercase">{opsMessages.sloUptime}</p>
                <p className="text-sm text-slate-200">{formatPercent(sloSummary?.apiUptimeP95)}</p>
              </div>
              <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-4">
                <p className="text-xs text-slate-400 uppercase">{opsMessages.sloHitlP95}</p>
                <p className="text-sm text-slate-200">{formatSeconds(sloSummary?.hitlResponseP95Seconds)}</p>
              </div>
              <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-4">
                <p className="text-xs text-slate-400 uppercase">{opsMessages.sloRetrievalP95}</p>
                <p className="text-sm text-slate-200">{formatSeconds(sloSummary?.retrievalLatencyP95Seconds)}</p>
              </div>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="text-base font-semibold text-slate-100">{opsMessages.complianceHeading}</h3>
          {loading && !compliance ? (
            <p className="text-sm text-slate-400">…</p>
          ) : !compliance ? (
            <p className="text-sm text-slate-400">{opsMessages.complianceEmpty}</p>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-4">
                  <p className="text-xs text-slate-400 uppercase">{opsMessages.cepejPassRate}</p>
                  <p className="text-sm text-slate-200">
                    {compliance.cepej.passRate === null
                      ? '—'
                      : `${Math.round((compliance.cepej.passRate ?? 0) * 100)} %`}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {opsMessages.cepejRuns
                      .replace('{assessed}', String(compliance.cepej.assessedRuns))
                      .replace('{violations}', String(compliance.cepej.violationRuns))}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-4">
                  <p className="text-xs text-slate-400 uppercase">{opsMessages.maghrebCoverage}</p>
                  <p className="text-sm text-slate-200">
                    {compliance.evaluationCoverage.maghrebBanner === null
                      ? '—'
                      : `${Math.round(compliance.evaluationCoverage.maghrebBanner * 100)} %`}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {opsMessages.maghrebBudget.replace(
                      '{target}',
                      `${Math.round(ACCEPTANCE_THRESHOLDS.maghrebBindingBannerCoverage * 100)} %`,
                    )}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-4">
                  <p className="text-xs text-slate-400 uppercase">{opsMessages.rwandaCoverage}</p>
                  <p className="text-sm text-slate-200">
                    {compliance.evaluationCoverage.rwandaNotice === null
                      ? '—'
                      : `${Math.round(compliance.evaluationCoverage.rwandaNotice * 100)} %`}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {opsMessages.rwandaBudget.replace(
                      '{target}',
                      `${Math.round(ACCEPTANCE_THRESHOLDS.rwandaLanguageNoticeCoverage * 100)} %`,
                    )}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-4">
                  <p className="text-xs text-slate-400 uppercase">{opsMessages.bindingCoverage}</p>
                  <p className="text-sm text-slate-200">{formatPercent(bindingCoverage)}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {opsMessages.bindingBudget.replace(
                      '{target}',
                      `${Math.round(ACCEPTANCE_THRESHOLDS.citationsAllowlistedP95 * 100)} %`,
                    )}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-4">
                  <p className="text-xs text-slate-400 uppercase">{opsMessages.residencyCoverage}</p>
                  <p className="text-sm text-slate-200">{formatPercent(residencyCoverage)}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {opsMessages.residencyBudget.replace('{target}', `${Math.round(residencyTarget * 100)} %`)}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-4">
                  <p className="text-xs text-slate-400 uppercase">{opsMessages.friaRuns}</p>
                  <p className="text-sm text-slate-200">{compliance.cepej.friaRequiredRuns}</p>
                  <p className="mt-1 text-xs text-slate-500">{opsMessages.friaDetail}</p>
                </div>
              </div>

              {compliance.alerts.length === 0 ? (
                <div className="rounded-2xl border border-emerald-600/40 bg-emerald-950/30 p-4 text-sm text-emerald-200">
                  {opsMessages.complianceNoAlerts}
                </div>
              ) : (
                <div className="space-y-2">
                  {compliance.alerts.map((alert) => (
                    <div
                      key={`${alert.code}-${alert.level}`}
                      className="rounded-2xl border border-amber-600/40 bg-amber-950/30 p-3 text-sm text-amber-200"
                    >
                      {complianceAlertMessages[alert.code] ?? alert.code}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="text-base font-semibold text-slate-100">{opsMessages.webVitalsHeading}</h3>
          {loading && !webVitals ? (
            <p className="text-sm text-slate-400">…</p>
          ) : !webVitals || webVitals.sampleCount === 0 ? (
            <p className="text-sm text-slate-400">{opsMessages.webVitalsEmpty}</p>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-4">
                  <p className="text-xs text-slate-400 uppercase">LCP p75</p>
                  <p className="text-sm text-slate-200">
                    {webVitals.metrics.LCP.p75 === null
                      ? '—'
                      : `${(webVitals.metrics.LCP.p75 / 1000).toFixed(2)} s`}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {opsMessages.webVitalsBudget.replace('{value}', '2.5 s')}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-4">
                  <p className="text-xs text-slate-400 uppercase">INP p75</p>
                  <p className="text-sm text-slate-200">
                    {webVitals.metrics.INP.p75 === null
                      ? '—'
                      : `${Math.round(webVitals.metrics.INP.p75)} ms`}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {opsMessages.webVitalsBudget.replace('{value}', '200 ms')}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-4">
                  <p className="text-xs text-slate-400 uppercase">CLS p75</p>
                  <p className="text-sm text-slate-200">
                    {webVitals.metrics.CLS.p75 === null
                      ? '—'
                      : webVitals.metrics.CLS.p75.toFixed(2)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {opsMessages.webVitalsBudget.replace('{value}', '0.10')}
                  </p>
                </div>
              </div>

              {webVitals.alerts.length === 0 ? (
                <div className="rounded-2xl border border-emerald-600/40 bg-emerald-950/30 p-4 text-sm text-emerald-200">
                  {opsMessages.webVitalsHealthy}
                </div>
              ) : (
                <div className="space-y-2">
                  {webVitals.alerts.map((alert) => (
                    <div
                      key={`${alert.code}-${alert.level}`}
                      className="rounded-2xl border border-amber-600/40 bg-amber-950/30 p-3 text-sm text-amber-200"
                    >
                      {webVitalAlertMessages[alert.code] ?? alert.code}
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-slate-500">
                {opsMessages.webVitalsSamples.replace('{count}', String(webVitals.sampleCount))}
              </p>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="text-base font-semibold text-slate-100">{opsMessages.incidentsHeading}</h3>
          {loading && !incidents ? (
            <p className="text-sm text-slate-400">…</p>
          ) : !incidents || incidents.entries.length === 0 ? (
            <p className="text-sm text-slate-400">{opsMessages.incidentsEmpty}</p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-300">
                {opsMessages.incidentTotals
                  .replace('{total}', String(incidents.total))
                  .replace('{open}', String(incidents.open))}
              </p>
              <div className="space-y-3">
                {incidents.entries.slice(0, 3).map((incident) => (
                  <article
                    key={incident.id}
                    className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-4 text-sm text-slate-200"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="font-medium text-slate-100">{incident.title}</h4>
                      <span className="text-xs text-slate-400">
                        {opsMessages.incidentStatus
                          .replace('{status}', incident.status)
                          .replace('{severity}', incident.severity)}
                      </span>
                    </div>
                    <p className="mt-2 text-slate-300">{incident.summary}</p>
                    <p className="mt-2 text-xs text-slate-400">
                      {opsMessages.incidentOccurred}: {formatDate(incident.detectedAt ?? incident.occurredAt, locale)} · {opsMessages.incidentResolved}:{' '}
                      {formatDate(incident.resolvedAt, locale)}
                    </p>
                    {incident.evidenceUrl ? (
                      <a
                        className="mt-3 inline-flex items-center text-sm text-sky-300 underline-offset-4 hover:underline"
                        href={incident.evidenceUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {opsMessages.goNoGoEvidence}
                      </a>
                    ) : null}
                  </article>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="text-base font-semibold text-slate-100">{opsMessages.changeHeading}</h3>
          {loading && !changeLog ? (
            <p className="text-sm text-slate-400">…</p>
          ) : !changeLog || changeLog.entries.length === 0 ? (
            <p className="text-sm text-slate-400">{opsMessages.changeEmpty}</p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-300">
                {opsMessages.changeTotals.replace('{total}', String(changeLog.total))}
              </p>
              {changeLog.entries.slice(0, 3).map((entry) => (
                <article
                  key={entry.id}
                  className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-4 text-sm text-slate-200"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="font-medium text-slate-100">{entry.title}</h4>
                    <span className="text-xs text-slate-400">{formatDate(entry.recordedAt, locale)}</span>
                  </div>
                  <p className="mt-2 text-slate-300">{entry.summary}</p>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="text-base font-semibold text-slate-100">{opsMessages.goNoGoHeading}</h3>
          {loading && (!goNoGo || goNoGo.criteria.length === 0) ? (
            <p className="text-sm text-slate-400">…</p>
          ) : !goNoGo || goNoGo.criteria.length === 0 ? (
            <p className="text-sm text-slate-400">{opsMessages.goNoGoEmpty}</p>
          ) : (
            <div className="space-y-3">
              {goNoGo.criteria.map((criterion) => (
                <article
                  key={criterion.criterion}
                  className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-4 text-sm text-slate-200"
                >
                  <h4 className="font-medium text-slate-100">{criterion.criterion}</h4>
                  <p className="mt-1 text-slate-300">
                    {opsMessages.goNoGoStatus.replace('{status}', criterion.recordedStatus)}
                  </p>
                  {criterion.recordedEvidenceUrl ? (
                    <a
                      className="mt-2 inline-flex items-center text-sm text-sky-300 underline-offset-4 hover:underline"
                      href={criterion.recordedEvidenceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {opsMessages.goNoGoView}
                    </a>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
