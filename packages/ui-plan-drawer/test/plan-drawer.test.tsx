import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PlanDrawer } from '../src/plan-drawer.js';
import type { PlanDrawerPlan, PlanDrawerToolLogEntry } from '@avocat-ai/shared';

const plan: PlanDrawerPlan = {
  id: 'plan-1',
  title: 'Analyse IRAC complète',
  subtitle: 'FR',
  risk: {
    level: 'MED',
    summary: 'Vérifier la jurisprudence opposée avant de conclure'
  },
  notices: [
    { id: 'notice-1', message: 'Résultat réutilisé : plan récupéré.', tone: 'success' }
  ],
  steps: [
    {
      id: 'step-1',
      title: 'Identifier la règle applicable',
      tool: 'file_search',
      status: 'done',
      summary: "Les articles 1103 et 1104 du Code civil s'appliquent à l'obligation.",
      metadata: [
        { label: 'Tentatives', value: '1' }
      ]
    }
  ]
};

const toolLogs: PlanDrawerToolLogEntry[] = [
  {
    id: 'log-1',
    name: 'file_search',
    status: 'success',
    description: '3 passages consolidés alignés sur la requête',
    timestamp: '10:12',
    input: '{"query":"obligation"}',
    output: '{"result":true}'
  }
];

describe('PlanDrawer', () => {
  it('renders plan notices, risk summary, steps and tool logs', () => {
    render(
      <PlanDrawer
        plan={plan}
        toolLogs={toolLogs}
        labels={{ planHeading: 'Plan agent' }}
        classNames={{ root: 'bg-[#0B1220] text-white' }}
      />
    );

    expect(screen.getByText(/Plan agent/i)).toBeInTheDocument();
    expect(screen.getByText('Analyse IRAC complète')).toBeInTheDocument();
    expect(screen.getByText(/Résultat réutilisé/)).toBeInTheDocument();
    expect(screen.getByText(/Risque : Modéré/)).toBeInTheDocument();
    expect(screen.getAllByText('file_search')).toHaveLength(2);
    expect(screen.getByText(/Les articles 1103/)).toBeInTheDocument();
    expect(screen.getByText('10:12')).toBeInTheDocument();
    expect(screen.getByText('Entrée')).toBeInTheDocument();
    expect(screen.getByText('Sortie')).toBeInTheDocument();
  });
});
