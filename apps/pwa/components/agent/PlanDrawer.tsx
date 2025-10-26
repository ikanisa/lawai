"use client";

import { Fragment, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { PlanDrawerPlan, PlanDrawerToolLogEntry } from "@avocat-ai/shared";
import { PlanDrawer as SharedPlanDrawer, usePlanDrawerState } from "@avocat-ai/ui-plan-drawer";

import type { ResearchPlan } from "@/lib/data/research";
import { useUIState } from "@/lib/state/ui-store";

interface PlanDrawerProps {
  plan: ResearchPlan;
  toolLogs: PlanDrawerToolLogEntry[];
}

export function PlanDrawer({ plan, toolLogs }: PlanDrawerProps) {
  const open = useUIState((state) => state.planDrawerOpen);
  const setOpen = useUIState((state) => state.setPlanDrawerOpen);
  const { open: isOpen, setOpen: handleOpen } = usePlanDrawerState({
    open,
    onOpenChange: setOpen
  });

  const sharedPlan = useMemo<PlanDrawerPlan | null>(() => {
    if (!plan) return null;
    return {
      id: plan.id,
      title: plan.title,
      subtitle: plan.jurisdiction,
      risk: {
        level: plan.riskLevel,
        summary: plan.riskSummary
      },
      steps: plan.steps.map((step) => ({
        id: step.id,
        title: step.title,
        status: step.status,
        summary: step.summary,
        tool: step.tool
      }))
    };
  }, [plan]);

  return (
    <AnimatePresence>
      {isOpen ? (
        <Fragment>
          <motion.div
            aria-hidden
            key="plan-drawer-overlay"
            className="fixed inset-0 z-40 bg-[#050b1f]/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => handleOpen(false)}
          />
          <motion.aside
            key="plan-drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
            className="fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-md flex-col border-l border-white/10"
            role="dialog"
            aria-modal="true"
            aria-label="Plan d'investigation de l'agent"
          >
            <SharedPlanDrawer
              plan={sharedPlan}
              toolLogs={toolLogs}
              onClose={() => handleOpen(false)}
              labels={{ close: "Fermer le plan" }}
              classNames={{
                root: "h-full bg-[#0B1220]/95 text-white shadow-[0_16px_48px_rgba(3,6,23,0.45)] backdrop-blur-xl",
                header: "border-white/10",
                content: "[&>section]:border-white/10 [&>section]:bg-white/5",
                section: "border-white/10 bg-white/5",
                step: "border-white/10 bg-white/5",
                toolLog: "border-white/10 bg-white/5"
              }}
            />
          </motion.aside>
        </Fragment>
      ) : null}
    </AnimatePresence>
  );
}
