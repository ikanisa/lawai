import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PlanDrawer } from '@/components/plan-drawer';
import type { AgentPlanStep } from '@avocat-ai/shared';

const plan: AgentPlanStep[] = [
  {
    id: 'step-1',
    name: 'Identifier la règle applicable',
    description: "Analyser les articles concernés.",
    startedAt: new Date('2024-01-01T10:00:00Z').toISOString(),
    finishedAt: new Date('2024-01-01T10:05:00Z').toISOString(),
    status: 'success',
    attempts: 1,
    detail: { summary: 'Étude des sources officielles.' }
  }
];

const toolLogs = [
  {
    name: 'file_search',
    args: { query: 'obligation' },
    output: { result: true }
  }
];

describe('PlanDrawer (web)', () => {
  it('renders plan notices, metadata and formatted tool logs', () => {
    render(
      <PlanDrawer
        open
        onOpenChange={vi.fn()}
        plan={plan}
        toolLogs={toolLogs}
        reused
        title="Plan d’action"
        description="Synthèse des étapes"
      />
    );

    expect(screen.getByText(/Résultat réutilisé/i)).toBeInTheDocument();
    expect(screen.getByText('Identifier la règle applicable')).toBeInTheDocument();
    expect(screen.getByText(/Tentatives: 1/)).toBeInTheDocument();
    expect(screen.getByText(/Étude des sources officielles/)).toBeInTheDocument();
    expect(screen.getByText(/"query": "obligation"/)).toBeInTheDocument();
    expect(screen.getByText(/"result": true/)).toBeInTheDocument();
  });
});
