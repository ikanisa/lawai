'use client';
// @ts-nocheck

import { LaunchOfflineOutboxItem, LaunchReadinessAction, LaunchReadinessSnapshot } from '@avocat-ai/shared';
import { Button } from '@avocat-ai/ui';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@avocat-ai/ui';
import { Badge } from '@avocat-ai/ui';
import { Separator } from '@avocat-ai/ui';
import type { Messages } from '@/lib/i18n';

function formatDate(input: string | null | undefined) {
  if (!input) return '—';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return input;
  return date.toLocaleString();
}

interface SectionProps {
  label: string;
  value: string;
  hint?: string;
}

function StatSection({ label, value, hint }: SectionProps) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-slate-700/60 bg-slate-900/50 px-4 py-3">
      <span className="text-xs uppercase tracking-wide text-slate-400">{label}</span>
      <span className="text-2xl font-semibold text-slate-50">{value}</span>
      {hint ? <span className="text-xs text-slate-400">{hint}</span> : null}
    </div>
  );
}

interface LaunchReadinessCardProps {
  readiness: LaunchReadinessSnapshot | null | undefined;
  offlineItems: LaunchOfflineOutboxItem[];
  isLoading: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
  onQueueOffline: () => void;
  messages: Messages;
}

function renderAction(action: LaunchReadinessAction) {
  const color =
    action.severity === 'critical'
      ? 'bg-red-500/10 text-red-200 border border-red-500/40'
      : action.severity === 'warning'
        ? 'bg-amber-500/10 text-amber-200 border border-amber-500/40'
        : 'bg-emerald-500/10 text-emerald-200 border border-emerald-500/40';
  return (
    <li key={action.id} className="flex flex-col gap-1 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-slate-100">{action.label}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>{action.severity.toUpperCase()}</span>
      </div>
      <p className="text-sm text-slate-300">{action.description}</p>
      {action.href ? (
        <a
          href={action.href}
          className="text-sm font-medium text-sky-300 transition hover:text-sky-200"
          target="_blank"
          rel="noreferrer"
        >
          {action.href}
        </a>
      ) : null}
    </li>
  );
}

function renderOfflineItem(item: LaunchOfflineOutboxItem) {
  return (
    <li key={item.id} className="flex flex-col gap-1 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-slate-100">{item.label}</span>
        <Badge variant="outline" className={item.status === 'queued' ? 'border-amber-500/40 text-amber-200' : 'border-sky-500/40 text-sky-200'}>
          {item.status === 'queued' ? 'Queued' : 'Syncing'}
        </Badge>
      </div>
      <span className="text-xs text-slate-400">{formatDate(item.queuedAt)}</span>
      {item.locale ? <span className="text-xs text-slate-500">{item.locale}</span> : null}
    </li>
  );
}

export function LaunchReadinessCard({
  readiness,
  offlineItems,
  isLoading,
  isRefreshing,
  onRefresh,
  onQueueOffline,
  messages,
}: LaunchReadinessCardProps) {
  const queued = readiness?.offlineOutbox.queued ?? 0;
  const syncing = readiness?.offlineOutbox.syncing ?? 0;
  const totalVitals = readiness?.vitals.total ?? 0;
  const goodVitals = readiness?.vitals.good ?? 0;
  const needsImprovement = readiness?.vitals.needsImprovement ?? 0;
  const poorVitals = readiness?.vitals.poor ?? 0;

  return (
    <Card className="border-slate-700/60 bg-slate-900/60">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="text-lg font-semibold text-slate-50">{messages.admin.launchReadinessTitle}</CardTitle>
          <p className="mt-1 text-sm text-slate-400">{messages.admin.launchReadinessSubtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onRefresh} disabled={isRefreshing || isLoading}>
            {messages.admin.launchReadinessRefresh}
          </Button>
          <Button variant="outline" size="sm" onClick={onQueueOffline} disabled={isLoading}>
            {messages.admin.launchReadinessAddOfflineSample}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="grid gap-4 md:grid-cols-4">
          <StatSection
            label={messages.admin.launchReadinessScoreLabel}
            value={isLoading ? '…' : `${readiness?.readinessScore ?? 0}`}
            hint={messages.admin.launchReadinessScoreHint}
          />
          <StatSection
            label={messages.admin.launchReadinessVitalsLabel}
            value={isLoading ? '…' : `${goodVitals}/${totalVitals}`}
            hint={messages.admin.launchReadinessVitalsHint
              .replace('{needs}', String(needsImprovement))
              .replace('{poor}', String(poorVitals))}
          />
          <StatSection
            label={messages.admin.launchReadinessOfflineLabel}
            value={`${queued} • ${syncing}`}
            hint={messages.admin.launchReadinessOfflineHint
              .replace('{queued}', String(queued))
              .replace('{syncing}', String(syncing))}
          />
          <StatSection
            label={messages.admin.launchReadinessDigestsLabel}
            value={isLoading ? '…' : `${readiness?.digests.total ?? 0}`}
            hint={messages.admin.launchReadinessDigestsHint.replace('{last}', formatDate(readiness?.digests.lastCreatedAt ?? null))}
          />
        </div>

        <Separator className="border-slate-800" />

        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              {messages.admin.launchReadinessActionsTitle}
            </h3>
            <ul className="flex flex-col gap-3">
              {readiness?.actions && readiness.actions.length > 0 ? (
                readiness.actions.map(renderAction)
              ) : (
                <li className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
                  {messages.admin.launchReadinessActionFallback}
                </li>
              )}
            </ul>
          </div>
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              {messages.admin.launchReadinessNotesTitle}
            </h3>
            <ul className="flex flex-col gap-2">
              {(readiness?.notes ?? []).map((note, index) => (
                <li key={`note-${index}`} className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-sm text-slate-200">
                  {note}
                </li>
              ))}
              {(readiness?.notes ?? []).length === 0 ? (
                <li className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-sm text-slate-400">
                  {messages.admin.launchReadinessNotesFallback}
                </li>
              ) : null}
            </ul>
          </div>
        </div>

        <Separator className="border-slate-800" />

        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            {messages.admin.launchReadinessOfflineSection}
          </h3>
          <ul className="grid gap-2 md:grid-cols-2">
            {offlineItems.slice(0, 4).map(renderOfflineItem)}
            {offlineItems.length === 0 ? (
              <li className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-sm text-slate-400">
                {messages.admin.launchReadinessOfflineEmpty}
              </li>
            ) : null}
          </ul>
        </div>
      </CardContent>
      <CardFooter className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
        <span>
          {messages.admin.launchReadinessCollateralLabel.replace(
            '{count}',
            String(readiness?.collateral.pilotOnboarding ?? 0),
          )}
        </span>
        <Badge variant="outline" className="border-slate-700/60 text-slate-200">
          {messages.admin.launchReadinessCollateralPricing.replace(
            '{count}',
            String(readiness?.collateral.pricingPacks ?? 0),
          )}
        </Badge>
        <Badge variant="outline" className="border-slate-700/60 text-slate-200">
          {messages.admin.launchReadinessCollateralTransparency.replace(
            '{count}',
            String(readiness?.collateral.transparency ?? 0),
          )}
        </Badge>
      </CardFooter>
    </Card>
  );
}
