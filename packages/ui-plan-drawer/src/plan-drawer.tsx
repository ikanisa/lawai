import { clsx } from 'clsx';
import { CheckCircle2, CircleDashed, CircleX, Loader2 } from 'lucide-react';
import type {
  PlanDrawerNotice,
  PlanDrawerPlan,
  PlanDrawerRisk,
  PlanDrawerStepStatus,
  PlanDrawerToolLogEntry,
  PlanDrawerToolLogStatus
} from '@avocat-ai/shared';
import type { ReactNode } from 'react';

import { riskBadgeVariant, toolStatusBadgeVariant } from './styles.js';

const DEFAULT_LABELS = {
  planHeading: "Plan agent",
  close: "Fermer le plan",
  risk: "Risque",
  steps: "Étapes du plan",
  tools: "Journal des outils",
  emptyTools: "Les outils utilisés par l’agent apparaîtront ici en temps réel."
};

export interface PlanDrawerLabels {
  planHeading?: string;
  close?: string;
  risk?: string;
  steps?: string;
  tools?: string;
  emptyTools?: string;
}

export interface PlanDrawerClassNames {
  root?: string;
  header?: string;
  content?: string;
  section?: string;
  step?: string;
  toolLog?: string;
}

export interface SharedPlanDrawerProps {
  plan?: PlanDrawerPlan | null;
  toolLogs?: PlanDrawerToolLogEntry[];
  onClose?: () => void;
  labels?: PlanDrawerLabels;
  classNames?: PlanDrawerClassNames;
  footer?: ReactNode;
  showHeader?: boolean;
}

export function PlanDrawer({
  plan,
  toolLogs = [],
  onClose,
  labels: labelsProp,
  classNames,
  footer,
  showHeader = true
}: SharedPlanDrawerProps) {
  const labels = { ...DEFAULT_LABELS, ...labelsProp };
  const notices = plan?.notices ?? [];
  const hasSteps = Boolean(plan?.steps?.length);
  const hasToolLogs = toolLogs.length > 0;

  return (
    <div className={clsx('flex h-full flex-col', classNames?.root)}>
      {showHeader ? (
        <header className={clsx('flex items-start justify-between gap-4 border-b px-6 py-5', classNames?.header)}>
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.3em] opacity-70">{labels.planHeading}</p>
            {plan?.title ? <h2 className="text-lg font-semibold leading-tight">{plan.title}</h2> : null}
            {plan?.subtitle ? <p className="text-sm opacity-80">{plan.subtitle}</p> : null}
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border bg-transparent text-sm transition"
              aria-label={labels.close}
            >
              <span aria-hidden className="text-lg leading-none">×</span>
            </button>
          ) : null}
        </header>
      ) : null}
      <div className={clsx('flex-1 space-y-6 overflow-y-auto px-6 py-6', classNames?.content)}>
        {notices.length > 0 ? (
          <div className="space-y-2">
            {notices.map((notice) => (
              <p
                key={notice.id}
                className={clsx(
                  'rounded-2xl border px-4 py-3 text-sm',
                  noticeToneClasses(notice.tone)
                )}
              >
                {notice.message}
              </p>
            ))}
          </div>
        ) : null}

        {plan?.risk?.level || plan?.risk?.summary ? (
          <section className={clsx('rounded-2xl border p-4', classNames?.section)} aria-labelledby="plan-risk-heading">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h3 id="plan-risk-heading" className="text-sm font-semibold">
                  {labels.risk}
                  {plan?.risk?.level ? ` : ${formatRiskLabel(plan.risk.level)}` : ''}
                </h3>
                {plan?.risk?.summary ? <p className="text-sm opacity-80">{plan.risk.summary}</p> : null}
              </div>
              {plan?.risk?.level ? (
                <span className={clsx('rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide', riskBadgeVariant(plan.risk.level))}>
                  {plan.risk.label ?? plan.risk.level}
                </span>
              ) : null}
            </div>
          </section>
        ) : null}

        {hasSteps ? (
          <section className={clsx('space-y-3', classNames?.section)} aria-labelledby="plan-steps-heading">
            <h3 id="plan-steps-heading" className="text-sm font-semibold uppercase tracking-wide opacity-70">
              {labels.steps}
            </h3>
            <ol className="space-y-3" role="list">
              {plan.steps.map((step) => (
                <li key={step.id} className={clsx('rounded-2xl border p-4', classNames?.step)}>
                  <div className="flex items-start gap-3">
                    <StepStatusIcon status={step.status} />
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold leading-tight">{step.title}</p>
                        {step.tool ? (
                          <span className="rounded-full border px-2.5 py-0.5 text-[11px] uppercase tracking-wide opacity-80">
                            {step.tool}
                          </span>
                        ) : null}
                        {step.metadata?.length ? (
                          <div className="flex flex-wrap gap-2 text-xs opacity-70">
                            {step.metadata.map((item) => (
                              <span key={`${step.id}-${item.label}`} className="whitespace-nowrap">
                                {item.label}: {item.value}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      {step.summary ? <p className="text-sm leading-relaxed opacity-80">{step.summary}</p> : null}
                      {step.detail ? (
                        <pre className="max-h-48 overflow-auto rounded-xl bg-black/10 p-3 text-xs leading-relaxed">
                          {step.detail}
                        </pre>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        <section className={clsx('space-y-3', classNames?.section)} aria-labelledby="plan-tools-heading">
          <h3 id="plan-tools-heading" className="text-sm font-semibold uppercase tracking-wide opacity-70">
            {labels.tools}
          </h3>
          {hasToolLogs ? (
            <div className="space-y-3">
              {toolLogs.map((log) => (
                <article key={log.id} className={clsx('rounded-2xl border p-4', classNames?.toolLog)} aria-live="polite">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold leading-tight">{log.name}</p>
                        {log.status ? (
                          <span className={clsx('rounded-full px-2.5 py-0.5 text-[11px] uppercase tracking-wide', toolStatusBadgeVariant(log.status))}>
                            {formatToolStatus(log.status)}
                          </span>
                        ) : null}
                      </div>
                      {log.description ? <p className="text-sm leading-relaxed opacity-80">{log.description}</p> : null}
                      {log.detail ? (
                        <p className="text-xs leading-relaxed opacity-70 whitespace-pre-wrap">{log.detail}</p>
                      ) : null}
                      {log.input ? (
                        <div className="space-y-1 text-xs">
                          <p className="font-semibold">Entrée</p>
                          <pre className="max-h-48 overflow-auto rounded-xl bg-black/10 p-3 leading-relaxed">{log.input}</pre>
                        </div>
                      ) : null}
                      {log.output ? (
                        <div className="space-y-1 text-xs">
                          <p className="font-semibold">Sortie</p>
                          <pre className="max-h-48 overflow-auto rounded-xl bg-black/10 p-3 leading-relaxed">{log.output}</pre>
                        </div>
                      ) : null}
                    </div>
                    {log.timestamp ? <p className="text-xs opacity-60">{log.timestamp}</p> : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed p-4 text-sm opacity-70">{labels.emptyTools}</p>
          )}
        </section>
      </div>
      {footer ? <div className="border-t px-6 py-4">{footer}</div> : null}
    </div>
  );
}

function StepStatusIcon({ status }: { status: PlanDrawerStepStatus }) {
  switch (status) {
    case 'done':
    case 'success':
      return <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-400" aria-hidden />;
    case 'active':
      return <Loader2 className="mt-0.5 h-5 w-5 animate-spin text-sky-300" aria-hidden />;
    case 'failed':
      return <CircleX className="mt-0.5 h-5 w-5 text-red-400" aria-hidden />;
    case 'skipped':
      return <CircleDashed className="mt-0.5 h-5 w-5 text-amber-300/80" aria-hidden />;
    default:
      return <CircleDashed className="mt-0.5 h-5 w-5 opacity-40" aria-hidden />;
  }
}

function noticeToneClasses(tone: PlanDrawerNotice['tone']) {
  switch (tone) {
    case 'success':
      return 'border-emerald-500/40 bg-emerald-500/10';
    case 'warning':
      return 'border-amber-500/40 bg-amber-500/10';
    case 'danger':
      return 'border-red-500/40 bg-red-500/10';
    default:
      return 'border-slate-500/30 bg-slate-500/10';
  }
}

function formatRiskLabel(level: PlanDrawerRisk['level']) {
  if (typeof level !== 'string') return '';
  switch (level) {
    case 'LOW':
      return 'Faible';
    case 'MED':
      return 'Modéré';
    case 'HIGH':
      return 'Élevé';
    default:
      return level;
  }
}

function formatToolStatus(status: PlanDrawerToolLogStatus) {
  switch (status) {
    case 'running':
      return 'En cours';
    case 'success':
      return 'Réussi';
    case 'error':
      return 'Erreur';
    case 'pending':
      return 'En attente';
    default:
      return 'Info';
  }
}
