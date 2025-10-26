"use client";

import { Fragment } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, CircleDashed, Loader2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ResearchPlan, ResearchPlanStep } from "@/lib/data/research";
import { useUIState } from "@/lib/state/ui-store";
import { cn } from "@/lib/utils";

import type { ToolLogEntry, ToolLogStatus } from "@/lib/research/types";

export type { ToolLogEntry, ToolLogStatus };

interface PlanDrawerProps {
  plan: ResearchPlan;
  toolLogs: ToolLogEntry[];
}

export function PlanDrawer({ plan, toolLogs }: PlanDrawerProps) {
  const open = useUIState((state) => state.planDrawerOpen);
  const setOpen = useUIState((state) => state.setPlanDrawerOpen);

  return (
    <AnimatePresence>
      {open ? (
        <Fragment>
          <motion.div
            aria-hidden
            key="plan-drawer-overlay"
            className="fixed inset-0 z-40 bg-[#050b1f]/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />
          <motion.aside
            key="plan-drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
            className="fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-md flex-col border-l border-white/10 bg-[#0B1220]/95 shadow-[0_16px_48px_rgba(3,6,23,0.45)] backdrop-blur-xl"
            role="dialog"
            aria-modal="true"
            aria-label="Plan d'investigation de l'agent"
          >
            <header className="flex items-start justify-between border-b border-white/10 px-6 py-5">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/60">Plan agent</p>
                <h2 className="mt-2 text-lg font-semibold text-white">{plan.title}</h2>
                <p className="mt-1 text-sm text-white/70">{plan.jurisdiction}</p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Fermer le plan"
                className="h-9 w-9 rounded-full border border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" aria-hidden />
              </Button>
            </header>
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <section aria-labelledby="risk-heading" className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 id="risk-heading" className="text-sm font-semibold text-white">
                      Risque : {plan.riskLevel === "LOW" ? "Faible" : plan.riskLevel === "MED" ? "Modéré" : "Élevé"}
                    </h3>
                    <p className="mt-1 text-sm text-white/70">{plan.riskSummary}</p>
                  </div>
                  <Badge className={cn("rounded-full px-3 py-1 text-xs", riskVariant(plan.riskLevel))}>
                    {plan.riskLevel}
                  </Badge>
                </div>
              </section>

              <section className="mt-6" aria-labelledby="steps-heading">
                <h3 id="steps-heading" className="text-sm font-semibold uppercase tracking-wide text-white/70">
                  Étapes du plan
                </h3>
                <ol className="mt-3 space-y-3" role="list">
                  {plan.steps.map((step: ResearchPlanStep) => (
                    <li key={step.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-start gap-3">
                        <StatusIcon status={step.status} />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-white">{step.title}</p>
                            <Badge variant="outline" className="rounded-full border-white/15 bg-white/10 text-[11px] text-white/70">
                              {step.tool}
                            </Badge>
                          </div>
                          <p className="mt-2 text-sm text-white/70">{step.summary}</p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>

              <section className="mt-6" aria-labelledby="tools-heading">
                <h3 id="tools-heading" className="text-sm font-semibold uppercase tracking-wide text-white/70">
                  Journal des outils
                </h3>
                <div className="mt-3 space-y-3">
                  {toolLogs.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-4 text-sm text-white/60">
                      Les outils utilisés par l’agent apparaîtront ici en temps réel.
                    </p>
                  ) : (
                    toolLogs.map((tool) => (
                      <article
                        key={tool.id}
                        className="rounded-2xl border border-white/10 bg-white/5 p-4"
                        aria-live="polite"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-white">{tool.name}</p>
                              <Badge className={cn("rounded-full px-2.5 py-0.5 text-[11px]", toolStatusVariant(tool.status))}>
                                {tool.status === "running"
                                  ? "En cours"
                                  : tool.status === "success"
                                  ? "Réussi"
                                  : "Erreur"}
                              </Badge>
                            </div>
                            <p className="mt-2 text-sm text-white/70">{tool.detail}</p>
                          </div>
                          <p className="text-xs text-white/50">{tool.startedAt}</p>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </section>
            </div>
          </motion.aside>
        </Fragment>
      ) : null}
    </AnimatePresence>
  );
}

function StatusIcon({ status }: { status: ResearchPlanStep["status"] }) {
  if (status === "done") {
    return <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-400" aria-hidden />;
  }
  if (status === "active") {
    return <Loader2 className="mt-0.5 h-5 w-5 animate-spin text-[#22D3EE]" aria-hidden />;
  }
  return <CircleDashed className="mt-0.5 h-5 w-5 text-white/40" aria-hidden />;
}

function riskVariant(level: ResearchPlan["riskLevel"]) {
  if (level === "LOW") return "bg-emerald-500/20 text-emerald-200";
  if (level === "HIGH") return "bg-red-500/20 text-red-200";
  return "bg-amber-500/20 text-amber-200";
}

function toolStatusVariant(status: ToolLogStatus) {
  if (status === "running") return "bg-sky-500/20 text-sky-200";
  if (status === "success") return "bg-emerald-500/20 text-emerald-200";
  return "bg-red-500/20 text-red-200";
}
