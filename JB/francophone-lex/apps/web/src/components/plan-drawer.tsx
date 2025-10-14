'use client';

import { useMemo } from 'react';
import { Sheet, SheetSection } from './ui/sheet';
import { Separator } from './ui/separator';

type AgentPlanStep = {
  id: string;
  name: string;
  description: string;
  startedAt: string;
  finishedAt: string;
  status: 'success' | 'skipped' | 'failed';
  attempts: number;
  detail?: Record<string, unknown> | null;
};

interface PlanDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  toolLogs?: Array<{ name: string; args: unknown; output: unknown }>;
  plan?: AgentPlanStep[];
  reused?: boolean;
  title: string;
  description: string;
}

export function PlanDrawer({ open, onOpenChange, toolLogs, plan, reused = false, title, description }: PlanDrawerProps) {
  const { hasPlan, planItems, logItems } = useMemo(() => {
    const cleanedPlan = Array.isArray(plan) ? plan : [];
    const cleanedLogs = Array.isArray(toolLogs) ? toolLogs : [];
    return {
      hasPlan: cleanedPlan.length > 0,
      planItems: cleanedPlan,
      logItems: cleanedLogs.map((log, index) => ({
        id: `${log.name}-${index}`,
        name: log.name,
        args: log.args,
        output: log.output,
      })),
    };
  }, [plan, toolLogs]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title} description={description}>
      <div className="space-y-4 text-sm text-slate-200/90">
        {reused && (
          <p className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-200">
            Résultat réutilisé : plan récupéré depuis l’exécution précédente.
          </p>
        )}

        {hasPlan ? (
          planItems.map((step, index) => (
            <SheetSection key={`${step.id}-${step.startedAt}-${index}`} className="space-y-3">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-400">
                  <span>Étape {index + 1}</span>
                  <span>{step.name}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span className="rounded-full border border-slate-700/60 px-2 py-0.5 text-[10px] uppercase">
                    Statut : {step.status}
                  </span>
                  <span>Tentatives : {step.attempts}</span>
                  <span>
                    Début : {new Date(step.startedAt).toLocaleString()} · Fin : {new Date(step.finishedAt).toLocaleString()}
                  </span>
                </div>
              </div>
              <Separator className="bg-slate-800/80" />
              <div className="space-y-2">
                <p className="text-xs text-slate-400">{step.description}</p>
                {step.detail && (
                  <pre className="max-h-40 overflow-auto rounded-xl bg-slate-950/60 p-3 text-xs text-slate-300/90">
                    {JSON.stringify(step.detail, null, 2)}
                  </pre>
                )}
              </div>
            </SheetSection>
          ))
        ) : logItems.length === 0 ? (
          <p>Aucun outil n’a encore été déclenché.</p>
        ) : (
          logItems.map((step, index) => (
            <SheetSection key={step.id} className="space-y-3">
              <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-400">
                <span>Étape {index + 1}</span>
                <span>{step.name}</span>
              </div>
              <Separator className="bg-slate-800/80" />
              <div className="space-y-2">
                <div>
                  <p className="text-xs font-semibold text-slate-300">Entrée</p>
                  <pre className="max-h-40 overflow-auto rounded-xl bg-slate-950/60 p-3 text-xs text-slate-300/90">
                    {JSON.stringify(step.args, null, 2)}
                  </pre>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-300">Sortie</p>
                  <pre className="max-h-40 overflow-auto rounded-xl bg-slate-950/60 p-3 text-xs text-slate-300/90">
                    {JSON.stringify(step.output, null, 2)}
                  </pre>
                </div>
              </div>
            </SheetSection>
          ))
        )}
      </div>
    </Sheet>
  );
}
