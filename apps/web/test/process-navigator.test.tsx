import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ProcessNavigatorFlow } from '@avocat-ai/shared';
import { ProcessNavigator } from '@/features/workspace/components/process-navigator';
import { getMessages } from '@/lib/i18n';

const messages = getMessages('en');

const flows: ProcessNavigatorFlow[] = [
  {
    id: 'flow-a',
    title: 'Civil claim',
    jurisdiction: 'FR',
    persona: 'procedural_navigator',
    mode: 'ask',
    summary: 'Guides a French civil claim workflow.',
    estimatedMinutes: 40,
    lastRunAt: '2025-10-10T10:00:00.000Z',
    alerts: ['HITL escalation pending'],
    telemetry: {
      runCount: 5,
      hitlEscalations: 1,
      pendingTasks: 2,
    },
    steps: [
      {
        id: 'step-1',
        label: 'Collect FRIA dossier',
        description: 'Gather evidence and consent.',
        state: 'complete',
        guardrails: ['Consent logged'],
        outputs: ['fria.json'],
      },
      {
        id: 'step-2',
        label: 'Draft claim',
        description: 'Assemble the draft filing.',
        state: 'in_progress',
        guardrails: ['Statute-first'],
        outputs: ['draft.docx'],
        escalation: 'Awaiting reviewer',
      },
    ],
  },
  {
    id: 'flow-b',
    title: 'OHADA debt recovery',
    jurisdiction: 'OHADA',
    persona: 'negotiation_mediator',
    mode: 'do',
    summary: 'Prepares debt recovery packages.',
    estimatedMinutes: 25,
    lastRunAt: '2025-10-08T08:00:00.000Z',
    alerts: [],
    telemetry: {
      runCount: 3,
      hitlEscalations: 0,
      pendingTasks: 0,
    },
    steps: [
      {
        id: 'step-a',
        label: 'Analyse AUSCGIE',
        description: 'Check statutory citations.',
        state: 'blocked',
        guardrails: ['Official sources only'],
        outputs: ['alignment.pdf'],
      },
    ],
  },
];

describe('ProcessNavigator', () => {
  it('renders flows with telemetry and guardrails', () => {
    render(<ProcessNavigator flows={flows} messages={messages} locale="en" />);

    expect(screen.getByRole('heading', { name: /Guided process navigator/i })).toBeInTheDocument();
    expect(screen.getByText('Civil claim')).toBeInTheDocument();
    expect(screen.getByText('HITL escalation pending')).toBeInTheDocument();
    expect(screen.getByText(/Statute-first/)).toBeInTheDocument();
    expect(screen.getByText(/5 guided runs/)).toBeInTheDocument();
    expect(screen.getByText(/1 HITL escalations/)).toBeInTheDocument();
    expect(screen.getByText(/2 pending tasks/)).toBeInTheDocument();
    expect(screen.getByText('Awaiting reviewer')).toBeInTheDocument();
  });

  it('renders empty state when no flows are available', () => {
    render(<ProcessNavigator flows={[]} messages={messages} locale="en" />);
    expect(screen.getByText(/Navigator runs will appear/)).toBeInTheDocument();
  });
});
