'use client';

import { useMemo } from 'react';
import type { ProcessNavigatorFlow } from '@avocat-ai/shared';
import type { Locale, Messages } from '../../lib/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';

interface ProcessNavigatorProps {
  flows?: ProcessNavigatorFlow[];
  messages: Messages;
  locale: Locale;
}

const STATE_VARIANTS: Record<
  ProcessNavigatorFlow['steps'][number]['state'],
  { variant: 'success' | 'warning' | 'danger'; labelKey: keyof Messages['workspace']['navigator']['states'] }
> = {
  complete: { variant: 'success', labelKey: 'complete' },
  in_progress: { variant: 'warning', labelKey: 'inProgress' },
  blocked: { variant: 'danger', labelKey: 'blocked' },
};

function formatDate(value: string | null, locale: Locale): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function formatDuration(minutes: number, locale: Locale, copy: Messages['workspace']['navigator']) {
  const formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  return copy.estimated.replace('{minutes}', formatter.format(minutes));
}

export function ProcessNavigator({ flows = [], messages, locale }: ProcessNavigatorProps) {
  const navigatorCopy = messages.workspace.navigator;

  const sortedFlows = useMemo(() => {
    return [...flows].sort((a, b) => {
      if (!a.lastRunAt) return 1;
      if (!b.lastRunAt) return -1;
      return a.lastRunAt < b.lastRunAt ? 1 : -1;
    });
  }, [flows]);

  if (sortedFlows.length === 0) {
    return (
      <section aria-labelledby="process-navigator-title" className="space-y-2">
        <div>
          <h2 id="process-navigator-title" className="text-xl font-semibold text-white">
            {navigatorCopy.title}
          </h2>
          <p className="text-sm text-slate-300">{navigatorCopy.subtitle}</p>
        </div>
        <p className="rounded-2xl border border-slate-800/60 bg-slate-900/60 p-4 text-sm text-slate-300">
          {navigatorCopy.empty}
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="process-navigator-title" className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 id="process-navigator-title" className="text-xl font-semibold text-white">
            {navigatorCopy.title}
          </h2>
          <p className="text-sm text-slate-300">{navigatorCopy.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-slate-400">
          <Badge variant="outline" className="uppercase tracking-wide">
            {navigatorCopy.kpis.lastRunLabel}
          </Badge>
          <Badge variant="outline" className="uppercase tracking-wide">
            {navigatorCopy.kpis.telemetryLabel}
          </Badge>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {sortedFlows.map((flow) => {
          const completeSteps = flow.steps.filter((step) => step.state === 'complete').length;
          const totalSteps = flow.steps.length || 1;
          const progress = Math.round((completeSteps / totalSteps) * 100);

          return (
            <Card key={flow.id} className="border-slate-800/60 bg-slate-950/60">
              <CardHeader>
                <CardTitle className="flex flex-col gap-2 text-base text-white">
                  <span className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                    <Badge variant="outline">{flow.jurisdiction}</Badge>
                    <Badge variant="outline">{navigatorCopy.persona.replace('{persona}', flow.persona)}</Badge>
                    <Badge variant="outline">
                      {messages.workspace.desk.modeLabels[flow.mode] ?? flow.mode}
                    </Badge>
                  </span>
                  <span className="text-lg font-semibold text-white">{flow.title}</span>
                </CardTitle>
                <p className="text-sm text-slate-300">{flow.summary}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 text-xs text-slate-300 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-3">
                    <p className="font-semibold uppercase tracking-wide text-slate-400">
                      {navigatorCopy.kpis.progress}
                    </p>
                    <p className="mt-1 text-sm text-slate-100">
                      {navigatorCopy.progressSummary
                        .replace('{complete}', completeSteps.toString())
                        .replace('{total}', totalSteps.toString())}
                    </p>
                    <p className="text-xs text-slate-400">
                      {navigatorCopy.progressPercent.replace('{percent}', progress.toString())}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-3">
                    <p className="font-semibold uppercase tracking-wide text-slate-400">
                      {navigatorCopy.kpis.telemetryLabel}
                    </p>
                    <ul className="mt-1 space-y-1">
                      <li>
                        {navigatorCopy.runCount.replace('{count}', flow.telemetry.runCount.toString())}
                      </li>
                      <li>
                        {navigatorCopy.hitlEscalations.replace(
                          '{count}',
                          flow.telemetry.hitlEscalations.toString(),
                        )}
                      </li>
                      <li>
                        {navigatorCopy.pendingTasks.replace(
                          '{count}',
                          flow.telemetry.pendingTasks.toString(),
                        )}
                      </li>
                    </ul>
                  </div>
                </div>

                <Separator className="bg-slate-800/60" />

                <div className="grid gap-3 text-sm text-slate-200 sm:grid-cols-[minmax(0,1fr)_220px]">
                  <div className="space-y-3">
                    <p className="text-xs uppercase tracking-wide text-slate-400">
                      {navigatorCopy.stepsTitle}
                    </p>
                    <ol className="space-y-3">
                      {flow.steps.map((step) => {
                        const stateMeta = STATE_VARIANTS[step.state];
                        const stateLabel = navigatorCopy.states[stateMeta.labelKey];
                        return (
                          <li key={step.id} className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-3">
                            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                              <div>
                                <p className="text-sm font-semibold text-white">{step.label}</p>
                                <p className="text-xs text-slate-400">{step.description}</p>
                              </div>
                              <Badge variant={stateMeta.variant}>{stateLabel}</Badge>
                            </div>
                            {step.guardrails.length > 0 ? (
                              <p className="mt-2 text-xs text-slate-400">
                                {navigatorCopy.guardrailsLabel}: {step.guardrails.join(' · ')}
                              </p>
                            ) : null}
                            {step.outputs.length > 0 ? (
                              <p className="mt-1 text-xs text-slate-400">
                                {navigatorCopy.outputsLabel}: {step.outputs.join(', ')}
                              </p>
                            ) : null}
                            {step.escalation ? (
                              <p className="mt-1 text-xs text-amber-300">{step.escalation}</p>
                            ) : null}
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                  <aside className="space-y-3">
                    <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-3 text-xs text-slate-300">
                      <p className="font-semibold uppercase tracking-wide text-slate-400">
                        {navigatorCopy.lastRun}
                      </p>
                      <p className="mt-1 text-sm text-slate-100">{formatDate(flow.lastRunAt, locale)}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {formatDuration(flow.estimatedMinutes, locale, navigatorCopy)}
                      </p>
                    </div>
                    {flow.alerts.length > 0 ? (
                      <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 p-3 text-xs text-amber-100">
                        <p className="font-semibold uppercase tracking-wide text-amber-200">
                          {navigatorCopy.alertsTitle}
                        </p>
                        <ul className="mt-1 list-disc space-y-1 pl-4">
                          {flow.alerts.map((alert) => (
                            <li key={alert}>{alert}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </aside>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
