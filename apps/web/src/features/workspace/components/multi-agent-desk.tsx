'use client';

import { Fragment } from 'react';
import { ArrowRight, Play, Sparkles, Zap, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@avocat-ai/ui';
import { Button } from '@avocat-ai/ui';
import { Badge } from '@avocat-ai/ui';
import type { Messages } from '@/lib/i18n';
import type {
  WorkspaceDesk,
  WorkspaceDeskPlaybook,
  WorkspaceDeskQuickAction,
  WorkspaceDeskPersona,
  WorkspaceDeskToolChip,
  WorkspaceDeskMode,
} from '@avocat-ai/shared';

interface MultiAgentDeskProps {
  desk: WorkspaceDesk;
  messages: Messages;
  onLaunchPlaybook: (playbook: WorkspaceDeskPlaybook) => void;
  onQuickAction: (action: WorkspaceDeskQuickAction) => void;
  onPersonaSelect: (persona: WorkspaceDeskPersona) => void;
  onToolAction: (chip: WorkspaceDeskToolChip) => void;
}

function modeLabel(mode: WorkspaceDeskMode, messages: Messages) {
  const labels = messages.workspace.desk.modeLabels;
  switch (mode) {
    case 'ask':
      return labels.ask;
    case 'do':
      return labels.do;
    case 'review':
      return labels.review;
    case 'generate':
      return labels.generate;
    default:
      return mode;
  }
}

function statusBadge(status: WorkspaceDeskToolChip['status'], messages: Messages) {
  const copy = messages.workspace.desk.status;
  if (status === 'ready') {
    return { variant: 'success' as const, label: copy.ready };
  }
  if (status === 'requires_hitl') {
    return { variant: 'danger' as const, label: copy.requiresHitl };
  }
  return { variant: 'warning' as const, label: copy.monitoring };
}

export function MultiAgentDesk({
  desk,
  messages,
  onLaunchPlaybook,
  onQuickAction,
  onPersonaSelect,
  onToolAction,
}: MultiAgentDeskProps) {
  if (!desk) {
    return null;
  }

  const deskMessages = messages.workspace.desk;

  return (
    <section aria-labelledby="multi-agent-desk-title" className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 id="multi-agent-desk-title" className="text-xl font-semibold text-white">
            {deskMessages.title}
          </h2>
          <p className="text-sm text-slate-300">{deskMessages.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-slate-400">
          <Badge variant="outline" className="uppercase tracking-wide">
            {deskMessages.modeLabels.ask} · {deskMessages.modeLabels.do} · {deskMessages.modeLabels.review} ·{' '}
            {deskMessages.modeLabels.generate}
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="border-slate-800/60 bg-slate-950/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-white">
              <Sparkles className="h-5 w-5 text-emerald-300" aria-hidden />
              {deskMessages.playbooks.title}
            </CardTitle>
            <p className="text-sm text-slate-300">{deskMessages.playbooks.subtitle}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {desk.playbooks.map((playbook) => (
              <div key={playbook.id} className="rounded-2xl border border-slate-800/60 bg-slate-900/60 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <Badge variant="outline">{playbook.persona}</Badge>
                      <Badge variant="outline">{deskMessages.playbooks.jurisdiction.replace('{code}', playbook.jurisdiction)}</Badge>
                      <Badge variant="success">{modeLabel(playbook.mode, messages)}</Badge>
                    </div>
                    <h3 className="mt-2 text-lg font-semibold text-white">{playbook.title}</h3>
                    <p className="mt-2 text-sm text-slate-300">{playbook.summary}</p>
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-slate-400">
                      {playbook.regulatoryFocus.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 whitespace-nowrap border-emerald-400/50 text-emerald-200 hover:bg-emerald-500/10"
                    onClick={() => onLaunchPlaybook(playbook)}
                  >
                    <Play className="mr-2 h-4 w-4" aria-hidden />
                    {deskMessages.playbooks.launch}
                  </Button>
                </div>
                <div className="mt-4 space-y-2 rounded-2xl border border-slate-800/80 bg-slate-950/80 p-3">
                  {playbook.steps.map((step, index) => (
                    <Fragment key={step.id}>
                      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {deskMessages.playbooks.stepLabel.replace('{index}', String(index + 1))} – {step.name}
                          </p>
                          <p className="text-xs text-slate-400">{step.description}</p>
                        </div>
                        <Badge variant="outline" className="uppercase tracking-wide">
                          {deskMessages.playbooks.status[step.status] ?? step.status}
                        </Badge>
                      </div>
                      {step.detail ? (
                        <pre className="mt-2 max-h-32 overflow-auto rounded-xl bg-slate-950/80 p-3 text-xs text-slate-300/90">
                          {JSON.stringify(step.detail, null, 2)}
                        </pre>
                      ) : null}
                    </Fragment>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <ShieldCheck className="h-4 w-4 text-teal-300" aria-hidden />
                  <span>
                    {deskMessages.playbooks.ctaLabel}
                    {playbook.cta.question ? ` · ${playbook.cta.question}` : ''}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-slate-800/60 bg-slate-950/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-white">
                <Zap className="h-5 w-5 text-amber-300" aria-hidden />
                {deskMessages.quickActions.title}
              </CardTitle>
              <p className="text-sm text-slate-300">{deskMessages.quickActions.subtitle}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {desk.quickActions.map((action) => (
                <Button
                  key={action.id}
                  variant="ghost"
                  className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-800/60 bg-slate-900/40 px-4 py-3 text-left text-sm text-slate-200 hover:bg-slate-900/70"
                  onClick={() => onQuickAction(action)}
                >
                  <span>
                    <span className="block font-semibold text-white">{action.label}</span>
                    <span className="mt-1 block text-xs text-slate-400">{action.description}</span>
                  </span>
                  <Badge variant="outline" className="uppercase tracking-wide">
                    {modeLabel(action.mode, messages)}
                  </Badge>
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card className="border-slate-800/60 bg-slate-950/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-white">
                <Sparkles className="h-5 w-5 text-violet-300" aria-hidden />
                {deskMessages.personas.title}
              </CardTitle>
              <p className="text-sm text-slate-300">{deskMessages.personas.subtitle}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {desk.personas.map((persona) => (
                <div key={persona.id} className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <Badge variant="outline">{persona.agentCode}</Badge>
                        <Badge variant="outline">{modeLabel(persona.mode, messages)}</Badge>
                      </div>
                      <h3 className="mt-2 text-base font-semibold text-white">{persona.label}</h3>
                      <p className="text-sm text-slate-300">{persona.description}</p>
                      <div className="mt-3 grid gap-2 text-xs text-slate-400 md:grid-cols-2">
                        <div>
                          <p className="font-semibold uppercase tracking-wide text-slate-500">
                            {deskMessages.personas.focusAreas}
                          </p>
                          <ul className="mt-1 space-y-1">
                            {persona.focusAreas.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="font-semibold uppercase tracking-wide text-slate-500">
                            {deskMessages.personas.guardrails}
                          </p>
                          <ul className="mt-1 space-y-1">
                            {persona.guardrails.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => onPersonaSelect(persona)}>
                      {deskMessages.personas.launch}
                      <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-slate-800/60 bg-slate-950/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-white">
                <ShieldCheck className="h-5 w-5 text-teal-300" aria-hidden />
                {deskMessages.toolbelt.title}
              </CardTitle>
              <p className="text-sm text-slate-300">{deskMessages.toolbelt.subtitle}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {desk.toolChips.map((chip) => {
                const badge = statusBadge(chip.status, messages);
                return (
                  <div
                    key={chip.id}
                    className="flex flex-col gap-3 rounded-2xl border border-slate-800/60 bg-slate-900/60 p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <Badge variant="outline">{modeLabel(chip.mode, messages)}</Badge>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </div>
                      <h3 className="mt-2 text-sm font-semibold text-white">{chip.label}</h3>
                      <p className="text-xs text-slate-400">{chip.description}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => onToolAction(chip)}>
                      {chip.ctaLabel}
                    </Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
