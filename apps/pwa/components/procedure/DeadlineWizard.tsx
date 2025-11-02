"use client";

import { useMemo } from "react";
import { Timer } from "lucide-react";

import { Button } from '@avocat-ai/ui';
import type { DeadlineComputation } from "@/lib/data/procedure";
import { cn } from "@/lib/utils";

interface DeadlineWizardProps {
  deadlines: DeadlineComputation[];
  onCompute: (deadline: DeadlineComputation) => void;
  formatDate: (value: string) => string;
}

export function DeadlineWizard({ deadlines, onCompute, formatDate }: DeadlineWizardProps) {
  const sortedDeadlines = useMemo(() => {
    return [...deadlines].sort((a, b) => new Date(a.computedDate).getTime() - new Date(b.computedDate).getTime());
  }, [deadlines]);

  if (!sortedDeadlines.length) {
    return (
      <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-6 text-sm text-white/70" role="status">
        Aucun calcul d’échéance n’est disponible pour cette procédure.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5" aria-labelledby="deadline-wizard-heading">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">Agent procédure</p>
          <h2 id="deadline-wizard-heading" className="text-base font-semibold text-white">
            Deadlines calculés
          </h2>
          <p className="text-sm text-white/60">Synchronisés avec deadlineCalculator & calendar_emit.</p>
        </div>
        <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-white/70">
          {sortedDeadlines.length} échéance(s)
        </span>
      </header>
      <ol className="divide-y divide-white/10" role="list">
        {sortedDeadlines.map((deadline) => (
          <li
            key={deadline.id}
            className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between"
            aria-label={`Échéance ${deadline.label}`}
          >
            <div className="space-y-1 text-white">
              <p className="text-sm font-semibold">{deadline.label}</p>
              <p className="text-xs text-white/60">{deadline.rule}</p>
            </div>
            <dl className="grid gap-x-6 gap-y-1 text-sm text-white/70 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Base</dt>
                <dd>{formatDate(deadline.baseDate)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-white/50">Calcul</dt>
                <dd className="text-white">{formatDate(deadline.computedDate)}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase tracking-wide text-white/50">Temps restant</dt>
                <dd className={cn("font-medium", deadline.daysUntilDue <= 3 ? "text-amber-300" : "text-white/80")}> 
                  {deadline.daysUntilDue} jours
                </dd>
              </div>
            </dl>
            <Button
              variant="secondary"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs uppercase tracking-[0.28em]"
              onClick={() => onCompute(deadline)}
            >
              <Timer className="h-4 w-4" aria-hidden />
              Vérifier
            </Button>
          </li>
        ))}
      </ol>
    </div>
  );
}
