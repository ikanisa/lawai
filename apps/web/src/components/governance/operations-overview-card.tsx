'use client';

import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import type { Messages } from '../../lib/i18n';
import type { OperationsOverviewResponse } from '../../lib/api';

interface OperationsOverviewCardProps {
  messages: Messages;
  data: OperationsOverviewResponse | null;
  loading: boolean;
}

const dateTimeFormatter = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

const numberFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const decimalFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }
  return dateTimeFormatter.format(parsed);
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  return `${decimalFormatter.format(value)} %`;
}

function formatSeconds(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  return `${decimalFormatter.format(value)} s`;
}

function formatMinutes(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  return `${decimalFormatter.format(value)} min`;
}

export function OperationsOverviewCard({ messages, data, loading }: OperationsOverviewCardProps) {
  const operationsMessages = messages.admin.operations;
  const loadingText = messages.admin.loadingShort;

  const sloSummary = data?.slo.summary ?? null;
  const latestSlo = data?.slo.snapshots?.[0] ?? null;
  const latestIncident = data?.incidents.latest ?? null;
  const latestChange = data?.changeLog.latest ?? null;
  const goNoGoCriteria = data?.goNoGo.criteria ?? [];

  const hasIncidents = (data?.incidents.entries?.length ?? 0) > 0;
  const hasChangeLog = (data?.changeLog.entries?.length ?? 0) > 0;

  return (
    <Card className="glass-card border border-slate-800/60">
      <CardHeader>
        <CardTitle className="text-slate-100">{operationsMessages.title}</CardTitle>
        <p className="text-sm text-slate-400">{operationsMessages.description}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <section>
          <h4 className="font-semibold text-slate-100">{operationsMessages.sloHeading}</h4>
          {loading && !data ? (
            <p className="mt-2 text-sm text-slate-400">{loadingText}</p>
          ) : !sloSummary ? (
            <p className="mt-2 text-sm text-slate-400">{operationsMessages.sloEmpty}</p>
          ) : (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-400">
                  {operationsMessages.sloLatestCapture}
                </div>
                <div className="mt-1 text-lg font-semibold text-slate-100">
                  {formatDateTime(sloSummary.latestCapture)}
                </div>
                {latestSlo?.notes ? (
                  <p className="mt-2 text-sm text-slate-300">{latestSlo.notes}</p>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-800/60 bg-slate-900/40 p-4 text-sm text-slate-200">
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    {operationsMessages.sloUptime}
                  </div>
                  <div className="mt-1 font-medium text-slate-100">
                    {formatPercent(sloSummary.apiUptimeP95)}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    {operationsMessages.sloHitlP95}
                  </div>
                  <div className="mt-1 font-medium text-slate-100">
                    {formatMinutes(
                      sloSummary.hitlResponseP95Seconds === null
                        ? null
                        : sloSummary.hitlResponseP95Seconds / 60,
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    {operationsMessages.sloRetrievalP95}
                  </div>
                  <div className="mt-1 font-medium text-slate-100">
                    {formatSeconds(sloSummary.retrievalLatencyP95Seconds)}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    {operationsMessages.sloCitationP95}
                  </div>
                  <div className="mt-1 font-medium text-slate-100">
                    {formatPercent(sloSummary.citationPrecisionP95)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div>
            <h4 className="font-semibold text-slate-100">{operationsMessages.incidentsHeading}</h4>
            {loading && !data ? (
              <p className="mt-2 text-sm text-slate-400">{loadingText}</p>
            ) : !hasIncidents ? (
              <p className="mt-2 text-sm text-slate-400">{operationsMessages.incidentsEmpty}</p>
            ) : (
              <div className="mt-3 space-y-2">
                <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-4 text-sm text-slate-200">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-slate-500">
                        {operationsMessages.incidentLatest}
                      </div>
                      <div className="mt-1 font-medium text-slate-100">{latestIncident?.title}</div>
                    </div>
                    <span className="rounded-full bg-slate-800/70 px-3 py-1 text-xs text-slate-300">
                      {operationsMessages.incidentStatus
                        .replace('{status}', latestIncident?.status ?? '—')
                        .replace('{severity}', latestIncident?.severity ?? '—')}
                    </span>
                  </div>
                  <dl className="mt-3 grid gap-2 text-xs text-slate-400">
                    <div className="grid grid-cols-2 gap-2">
                      <dt>{operationsMessages.incidentOccurred}</dt>
                      <dd className="text-right text-slate-300">{formatDateTime(latestIncident?.occurredAt ?? null)}</dd>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <dt>{operationsMessages.incidentResolved}</dt>
                      <dd className="text-right text-slate-300">{formatDateTime(latestIncident?.resolvedAt ?? null)}</dd>
                    </div>
                  </dl>
                  {latestIncident?.summary ? (
                    <p className="mt-3 text-sm text-slate-300">{latestIncident.summary}</p>
                  ) : null}
                </div>
                <div className="text-xs text-slate-400">
                  {operationsMessages.incidentTotals
                    .replace('{total}', numberFormatter.format(data?.incidents.total ?? 0))
                    .replace('{open}', numberFormatter.format(data?.incidents.open ?? 0))}
                </div>
              </div>
            )}
          </div>

          <div>
            <h4 className="font-semibold text-slate-100">{operationsMessages.changeHeading}</h4>
            {loading && !data ? (
              <p className="mt-2 text-sm text-slate-400">{loadingText}</p>
            ) : !hasChangeLog ? (
              <p className="mt-2 text-sm text-slate-400">{operationsMessages.changeEmpty}</p>
            ) : (
              <div className="mt-3 space-y-2">
                <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-4 text-sm text-slate-200">
                  <div className="text-xs uppercase tracking-wide text-slate-500">
                    {operationsMessages.changeLatest}
                  </div>
                  <div className="mt-1 font-medium text-slate-100">{latestChange?.title}</div>
                  <div className="mt-1 text-xs text-slate-400">
                    {formatDateTime(latestChange?.recordedAt ?? latestChange?.entryDate ?? null)}
                  </div>
                  {latestChange?.summary ? (
                    <p className="mt-3 text-sm text-slate-300">{latestChange.summary}</p>
                  ) : null}
                </div>
                <div className="text-xs text-slate-400">
                  {operationsMessages.changeTotals.replace(
                    '{total}',
                    numberFormatter.format(data?.changeLog.total ?? 0),
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        <section>
          <h4 className="font-semibold text-slate-100">{operationsMessages.goNoGoHeading}</h4>
          {loading && !data ? (
            <p className="mt-2 text-sm text-slate-400">{loadingText}</p>
          ) : goNoGoCriteria.length === 0 ? (
            <p className="mt-2 text-sm text-slate-400">{operationsMessages.goNoGoEmpty}</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full table-fixed text-left text-sm text-slate-200">
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="w-1/2 pb-2 pr-3">{operationsMessages.goNoGoCriterion}</th>
                    <th className="pb-2 pr-3">{operationsMessages.goNoGoAuto}</th>
                    <th className="pb-2 pr-3">{operationsMessages.goNoGoRecorded}</th>
                    <th className="pb-2">{operationsMessages.goNoGoEvidence}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {goNoGoCriteria.map((criterion) => (
                    <tr key={criterion.criterion}>
                      <td className="py-3 pr-3 align-top font-medium text-slate-100">
                        {criterion.criterion}
                      </td>
                      <td className="py-3 pr-3 align-top text-sm text-slate-200">
                        {criterion.autoSatisfied ? operationsMessages.goNoGoYes : operationsMessages.goNoGoNo}
                      </td>
                      <td className="py-3 pr-3 align-top text-sm text-slate-200">
                        {operationsMessages.goNoGoStatus.replace('{status}', criterion.recordedStatus ?? 'pending')}
                      </td>
                      <td className="py-3 align-top text-sm text-slate-300">
                        {criterion.recordedEvidenceUrl ? (
                          <a
                            href={criterion.recordedEvidenceUrl}
                            className="text-sky-300 underline-offset-4 hover:underline"
                          >
                            {operationsMessages.goNoGoView}
                          </a>
                        ) : criterion.recommendedEvidenceUrl ? (
                          <a
                            href={criterion.recommendedEvidenceUrl}
                            className="text-slate-300 underline-offset-4 hover:underline"
                          >
                            {operationsMessages.goNoGoRecommend}
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
