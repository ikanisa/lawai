'use client';

import { useMemo } from 'react';
import {
  PlanDrawer as SharedPlanDrawer,
  usePlanDrawerState
} from '@avocat-ai/ui-plan-drawer';
import type {
  AgentPlanStep,
  PlanDrawerNotice,
  PlanDrawerPlan,
  PlanDrawerStepStatus,
  PlanDrawerToolLogEntry
} from '@avocat-ai/shared';

import { Sheet } from '@avocat-ai/ui';

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
  const { open: isOpen, setOpen } = usePlanDrawerState({ open, onOpenChange });

  const sharedPlan = useMemo<PlanDrawerPlan | null>(() => {
    const notices: PlanDrawerNotice[] = reused
      ? [
          {
            id: 'plan-reused',
            message: 'Résultat réutilisé : plan récupéré depuis l’exécution précédente.',
            tone: 'success'
          }
        ]
      : [];

    if (!plan || plan.length === 0) {
      if (notices.length === 0) {
        return null;
      }
      return {
        id: 'plan',
        title,
        subtitle: description,
        notices,
        steps: []
      };
    }

    return {
      id: plan[0]?.id ?? 'plan',
      title,
      subtitle: description,
      notices,
      steps: plan.map((step, index) => ({
        id: step.id ?? `step-${index}`,
        title: step.name,
        status: mapStepStatus(step.status),
        summary: step.description,
        metadata: filterMetadata([
          { label: 'Tentatives', value: step.attempts?.toString() ?? undefined },
          { label: 'Début', value: formatDateTime(step.startedAt) },
          { label: 'Fin', value: formatDateTime(step.finishedAt) }
        ]),
        detail: step.detail ? safeStringify(step.detail) : undefined
      }))
    };
  }, [plan, reused, title, description]);

  const sharedToolLogs = useMemo<PlanDrawerToolLogEntry[]>(() => {
    if (!toolLogs) return [];
    return toolLogs.map((log, index) => ({
      id: `${log.name}-${index}`,
      name: log.name,
      input: safeStringify(log.args),
      output: safeStringify(log.output)
    }));
  }, [toolLogs]);

  return (
    <Sheet open={isOpen} onOpenChange={setOpen} title={title} description={description}>
      <SharedPlanDrawer
        showHeader={false}
        plan={sharedPlan}
        toolLogs={sharedToolLogs}
        classNames={{
          root: 'text-card-foreground',
          content: '!px-0 !py-0 space-y-6',
          section: 'border-border/60 bg-secondary/50',
          step: 'border-border/60 bg-secondary/40',
          toolLog: 'border-border/60 bg-secondary/40'
        }}
        labels={{ tools: 'Journal des outils', emptyTools: 'Aucun outil n’a encore été déclenché.' }}
      />
    </Sheet>
  );
}

function mapStepStatus(status: AgentPlanStep['status']): PlanDrawerStepStatus {
  if (status === 'success') return 'success';
  if (status === 'failed') return 'failed';
  if (status === 'skipped') return 'skipped';
  return 'pending';
}

function formatDateTime(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleString();
}

function safeStringify(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  try {
    return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  } catch (error) {
    return String(value);
  }
}

function filterMetadata(
  entries: Array<{ label: string; value: string | undefined }>
): Array<{ label: string; value: string }> | undefined {
  const items = entries.filter((entry): entry is { label: string; value: string } => Boolean(entry.value));
  return items.length > 0 ? items : undefined;
}
