'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { CalendarCheck, ChevronRight, Clock, ExternalLink, ShieldAlert, Bell } from 'lucide-react';
import {
  DEMO_ORG_ID,
  fetchWorkspaceOverview,
  type WorkspaceOverviewResponse,
} from '../../lib/api';
import type { Locale, Messages } from '../../lib/i18n';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { JurisdictionChip } from '../jurisdiction-chip';
import { usePlanDrawer } from '../../state/plan-drawer';
import { PlanDrawer } from '../plan-drawer';
import { useOnlineStatus } from '../../hooks/use-online-status';
import { useOutbox } from '../../hooks/use-outbox';
import { useDigest } from '../../hooks/use-digest';
import { toast } from 'sonner';

interface WorkspaceViewProps {
  messages: Messages;
  locale: Locale;
}

interface StatusMeta {
  tone: 'default' | 'outline' | 'success' | 'warning' | 'danger';
  label: string;
}

const STATUS_VARIANTS: Record<string, (messages: Messages) => StatusMeta> = {
  research: (messages) => ({ tone: 'default', label: messages.workspace.status.research }),
  drafting: (messages) => ({ tone: 'outline', label: messages.workspace.status.drafting }),
  hitl: (messages) => ({ tone: 'warning', label: messages.workspace.status.hitl }),
};

const RISK_VARIANTS: Record<string, { label: (messages: Messages) => string; tone: 'success' | 'warning' | 'danger' }> = {
  LOW: {
    label: (messages) => messages.research.riskLow,
    tone: 'success',
  },
  MEDIUM: {
    label: (messages) => messages.research.riskMedium,
    tone: 'warning',
  },
  HIGH: {
    label: (messages) => messages.research.riskHigh,
    tone: 'danger',
  },
};

function formatDate(value: string | null | undefined, locale: Locale): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date);
}

function useWorkspaceData(locale: Locale) {
  return useQuery<WorkspaceOverviewResponse>({
    queryKey: ['workspace-overview', locale],
    queryFn: () => fetchWorkspaceOverview(DEMO_ORG_ID),
  });
}

export function WorkspaceView({ messages, locale }: WorkspaceViewProps) {
  const router = useRouter();
  const { open, toggle } = usePlanDrawer();
  const [heroQuestion, setHeroQuestion] = useState('');
  const workspaceQuery = useWorkspaceData(locale);
  const online = useOnlineStatus();
  const { items: outboxItems } = useOutbox();
  const { enabled: digestEnabled, enable: enableDigest, loading: digestLoading } = useDigest();

  async function handleEnableDigest() {
    try {
      const granted = await enableDigest();
      if (granted) {
        toast.success(messages.workspace.digestEnabled);
      } else {
        toast.error(messages.workspace.digestError);
      }
    } catch (error) {
      console.error('digest_enable_failed', error);
      toast.error(messages.workspace.digestError);
    }
  }

  const matters = workspaceQuery.data?.matters ?? [];
  const complianceWatch = workspaceQuery.data?.complianceWatch ?? [];
  const hitlInbox = workspaceQuery.data?.hitlInbox ?? { items: [], pendingCount: 0 };

  const jurisdictionChips = useMemo(
    () => {
      const items = workspaceQuery.data?.jurisdictions ?? [];
      return items.map((item) => (
        <JurisdictionChip
          key={item.code}
          code={item.code}
          label={item.name}
          eu={item.eu}
          ohada={item.ohada}
          onClick={() => router.push(`/${locale}/research`)}
        />
      ));
    },
    [workspaceQuery.data?.jurisdictions, locale, router],
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!online) {
      toast.warning(messages.workspace.offlineNotice);
      return;
    }
    toggle(true);
    router.push(`/${locale}/research`);
  }

  return (
    <div className="space-y-10">
      <section className="space-y-6">
        <div className="glass-card overflow-hidden rounded-3xl border border-slate-800/70 shadow-2xl">
          <div className="grid gap-6 p-8 md:grid-cols-[minmax(0,1fr)_280px]">
            <form onSubmit={handleSubmit} className="space-y-4" aria-labelledby="workspace-hero-title">
              <div>
                <h1 id="workspace-hero-title" className="text-2xl font-semibold text-white">
                  {messages.workspace.heroTitle}
                </h1>
                <p className="mt-2 max-w-xl text-sm text-slate-300">{messages.workspace.heroSubtitle}</p>
              </div>
              <label className="sr-only" htmlFor="workspace-question">
                {messages.research.heroPlaceholder}
              </label>
              <Input
                id="workspace-question"
                value={heroQuestion}
                onChange={(event) => setHeroQuestion(event.target.value)}
                placeholder={messages.research.heroPlaceholder}
              />
              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" className="shadow-lg" disabled={!online}>
                  {messages.workspace.heroCta}
                </Button>
                <Badge variant="outline">{messages.workspace.keyboardHint}</Badge>
                <Badge variant="success">{messages.workspace.wcagBadge}</Badge>
                {digestEnabled ? (
                  <Badge variant="outline" className="gap-2 text-xs uppercase tracking-wide text-teal-200">
                    <Bell className="h-3 w-3" aria-hidden />
                    {messages.workspace.digestEnabledBadge}
                  </Badge>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2 border-slate-700/60 text-slate-200"
                    onClick={handleEnableDigest}
                    disabled={digestLoading}
                  >
                    <Bell className="h-3 w-3" aria-hidden />
                    {messages.workspace.enableDigest}
                  </Button>
                )}
              </div>
              {!online ? (
                <p className="text-xs text-amber-300">
                  {outboxItems.length > 0
                    ? messages.workspace.offlineQueued.replace('{count}', String(outboxItems.length))
                    : messages.workspace.offlineNotice}
                </p>
              ) : null}
            </form>
            <div className="rounded-3xl border border-slate-700/60 bg-slate-900/60 p-5 text-sm text-slate-200/90">
              <h2 className="text-xs uppercase tracking-wide text-slate-400">{messages.workspace.planTitle}</h2>
              <p className="mt-3 leading-relaxed">{messages.workspace.planDescription}</p>
              <Separator className="my-4 bg-slate-800/80" />
              <ul className="space-y-2 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-amber-400" aria-hidden />
                  {messages.workspace.planRisk}
                </li>
                <li className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-teal-300" aria-hidden />
                  {messages.workspace.planLatency}
                </li>
                <li className="flex items-center gap-2">
                  <CalendarCheck className="h-4 w-4 text-violet-300" aria-hidden />
                  {messages.workspace.planGovernance}
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              {messages.workspace.jurisdictions}
            </h2>
            <span className="text-xs text-slate-400">{messages.workspace.jurisdictionHint}</span>
          </div>
          <div className="flex flex-wrap gap-3" aria-label={messages.workspace.jurisdictions}>
            {workspaceQuery.isLoading ? (
              <SkeletonRow />
            ) : jurisdictionChips.length > 0 ? (
              jurisdictionChips
            ) : (
              <p className="text-sm text-slate-400">{messages.workspace.jurisdictionEmpty}</p>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="glass-card border border-slate-800/60">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{messages.workspace.recentMatters}</CardTitle>
            <div className="flex items-center gap-2">
              {digestEnabled ? (
                <Badge variant="outline" className="gap-1 text-xs text-teal-200">
                  <Bell className="h-3 w-3" aria-hidden />
                  {messages.workspace.digestEnabledBadge}
                </Badge>
              ) : null}
              <Badge variant="outline">{matters.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {workspaceQuery.isLoading ? (
              <SkeletonColumn rows={3} />
            ) : matters.length === 0 ? (
              <p className="text-sm text-slate-400">{messages.workspace.recentMattersEmpty}</p>
            ) : (
              matters.map((matter) => {
                const statusKey = matter.status ? matter.status.toLowerCase() : 'research';
                const statusMeta = STATUS_VARIANTS[statusKey]?.(messages) ?? STATUS_VARIANTS.research(messages);
                const riskKey = matter.riskLevel ?? 'LOW';
                const riskMeta = RISK_VARIANTS[riskKey] ?? RISK_VARIANTS.LOW;

                return (
                  <article key={matter.id} className="rounded-2xl border border-slate-800/50 bg-slate-900/40 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{matter.question}</p>
                        <p className="text-xs text-slate-400">
                          {messages.workspace.updated}{' '}
                          {formatDate(matter.finishedAt ?? matter.startedAt, locale) || messages.workspace.justNow}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge variant={statusMeta.tone}>{statusMeta.label}</Badge>
                        <Badge variant={riskMeta.tone}>{riskMeta.label(messages)}</Badge>
                      </div>
                    </div>
                    {matter.jurisdiction && (
                      <p className="mt-3 text-xs uppercase tracking-wide text-slate-500">
                        {messages.workspace.jurisdictionLabel}: {matter.jurisdiction}
                      </p>
                    )}
                    {matter.hitlRequired && (
                      <p className="mt-2 flex items-center gap-2 text-xs text-amber-300">
                        <ShieldAlert className="h-3 w-3" aria-hidden /> {messages.workspace.requiresHitl}
                      </p>
                    )}
                  </article>
                );
              })
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="glass-card border border-slate-800/60">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{messages.workspace.hitlInbox}</CardTitle>
              <Badge variant="warning">{hitlInbox.pendingCount}</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              {workspaceQuery.isLoading ? (
                <SkeletonColumn rows={2} />
              ) : hitlInbox.items.length === 0 ? (
                <p className="text-sm text-slate-400">{messages.workspace.hitlEmpty}</p>
              ) : (
                hitlInbox.items.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-4 text-sm text-slate-200">
                    <p className="font-semibold">{item.reason}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {messages.workspace.submitted}{' '}
                      {formatDate(item.createdAt, locale) || messages.workspace.justNow}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 inline-flex items-center gap-2"
                      onClick={() => router.push(`/${locale}/hitl`)}
                    >
                      {messages.workspace.reviewCta}
                      <ChevronRight className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="glass-card border border-slate-800/60">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{messages.workspace.complianceWatch}</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => router.push(`/${locale}/citations`)}>
                {messages.workspace.viewAll}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {workspaceQuery.isLoading ? (
                <SkeletonColumn rows={3} />
              ) : complianceWatch.length === 0 ? (
                <p className="text-sm text-slate-400">{messages.workspace.complianceEmpty}</p>
              ) : (
                complianceWatch.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-4 text-sm text-slate-200">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">{item.title}</p>
                        <p className="text-xs text-slate-400">{item.publisher}</p>
                      </div>
                      <Badge variant="outline">{item.jurisdiction ?? '—'}</Badge>
                    </div>
                    {Array.isArray(item.residency) && item.residency.length > 0 ? (
                      <div className="mt-3 space-y-1 text-xs text-slate-400">
                        {item.residency.map((entry: { zone: string; count: number }) => (
                          <p key={`${entry.zone}-${entry.count}`}>
                            {messages.research.trust.provenanceResidencyItem
                              .replace('{zone}', entry.zone)
                              .replace('{count}', entry.count.toString())}
                          </p>
                        ))}
                      </div>
                    ) : null}
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      {item.consolidated && <Badge variant="success">{messages.workspace.consolidated}</Badge>}
                      {item.effectiveDate && <span>{formatDate(item.effectiveDate, locale)}</span>}
                    </div>
                    <Button
                      variant="link"
                      size="sm"
                      className="mt-2 inline-flex items-center gap-2 px-0 text-emerald-300 hover:text-emerald-200"
                      asChild
                    >
                      <a href={item.url} target="_blank" rel="noreferrer">
                        {messages.workspace.openSource}
                        <ExternalLink className="h-4 w-4" aria-hidden />
                      </a>
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <PlanDrawer
        open={open}
        onOpenChange={toggle}
        toolLogs={[]}
        title={messages.workspace.planTitle}
        description={messages.workspace.planDescription}
      />
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex w-full gap-3">
      <span className="h-12 flex-1 rounded-full bg-slate-800/60 animate-pulse" aria-hidden />
      <span className="h-12 flex-1 rounded-full bg-slate-800/60 animate-pulse" aria-hidden />
      <span className="h-12 flex-1 rounded-full bg-slate-800/60 animate-pulse" aria-hidden />
    </div>
  );
}

function SkeletonColumn({ rows }: { rows: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-20 rounded-2xl bg-slate-800/60 animate-pulse" aria-hidden />
      ))}
    </div>
  );
}
