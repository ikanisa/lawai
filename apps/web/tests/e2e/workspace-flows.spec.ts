import { test, expect } from '@playwright/test';

const workspaceOverviewPayload = {
  jurisdictions: [
    { code: 'FR', name: 'France', eu: true, ohada: false, matterCount: 12 },
    { code: 'OH', name: 'OHADA', eu: false, ohada: true, matterCount: 5 },
  ],
  matters: [
    {
      id: 'matter-fria',
      question: 'FRIA intake case 2024-09',
      status: 'in_progress',
      riskLevel: 'MEDIUM',
      hitlRequired: false,
      startedAt: '2024-09-18T09:20:00Z',
      finishedAt: null,
      jurisdiction: 'FR',
    },
  ],
  complianceWatch: [],
  hitlInbox: { items: [], pendingCount: 0 },
  desk: {
    playbooks: [
      {
        id: 'playbook-fria',
        title: 'FR civil intake triage',
        persona: 'Associate',
        jurisdiction: 'FR',
        mode: 'ask',
        summary: 'Guide the associate through FRIA civil intake with CEPEJ guardrails.',
        regulatoryFocus: ['CEPEJ charter capture', 'FRIA attestations logged'],
        steps: [
          { id: 'triage', name: 'Initial triage', description: 'Confirm FR civil scope & urgency.', status: 'success', attempts: 1 },
          { id: 'evidence', name: 'Evidence review', description: 'Collect attachments & validate signatures.', status: 'success', attempts: 1 },
        ],
        cta: { label: 'Launch research', mode: 'ask', question: 'Summarise CEPEJ compliance risk' },
      },
    ],
    quickActions: [
      {
        id: 'qa-hitl',
        label: 'Review HITL queue',
        description: 'Check escalations before sign-off.',
        mode: 'review',
        action: 'hitl',
        href: '/hitl',
      },
      {
        id: 'qa-plan',
        label: 'Open agent plan',
        description: 'Inspect tooling calls for FR civil desk.',
        mode: 'ask',
        action: 'plan',
      },
    ],
    personas: [
      {
        id: 'persona-reviewer',
        label: 'HITL reviewer',
        description: 'Escalated FRIA dossiers requiring review.',
        mode: 'review',
        focusAreas: ['High-risk CEPEJ findings', 'Pending attestations'],
        guardrails: ['Document evidence approvals'],
        href: '/hitl',
        agentCode: 'FR-HITL',
      },
    ],
    toolChips: [
      {
        id: 'tool-consent',
        label: 'Consent reconcilation',
        mode: 'do',
        status: 'ready',
        description: 'Sync CEPEJ consent records with intake queue.',
        action: 'trust',
        href: '/trust',
        ctaLabel: 'Review consent log',
      },
    ],
  },
  navigator: [
    {
      id: 'fria-intake',
      title: 'FR civil case intake',
      jurisdiction: 'France',
      persona: 'Associate',
      mode: 'ask',
      summary: 'FRIA intake with CEPEJ consent capture and OHADA override checks.',
      estimatedMinutes: 45,
      lastRunAt: '2024-09-16T08:30:00Z',
      alerts: ['Pending evidence sync'],
      telemetry: { runCount: 18, hitlEscalations: 2, pendingTasks: 1 },
      steps: [
        {
          id: 'capture',
          label: 'Capture claimant brief',
          description: 'Collect FR civil facts & attachments.',
          state: 'complete',
          guardrails: ['Consent recorded'],
          outputs: ['Intake dossier'],
        },
        {
          id: 'risk-screen',
          label: 'Risk screen & CEPEJ consent',
          description: 'Validate CEPEJ consent and risk overrides.',
          state: 'in_progress',
          guardrails: ['CEPEJ consent'],
          outputs: ['Consent certificate'],
          escalation: 'Escalate to HITL if consent missing',
        },
        {
          id: 'handoff',
          label: 'Handoff to drafting',
          description: 'Prepare drafting packet with authoritative sources.',
          state: 'blocked',
          guardrails: [],
          outputs: ['Drafting package'],
        },
      ],
    },
  ],
};

test.describe('Workspace navigator and agent desk', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/telemetry', (route) => route.fulfill({ status: 204, body: '' }));
    await page.route('**/workspace?orgId=*', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(workspaceOverviewPayload) });
    });
  });

  test('highlights FR civil case intake flow for associates', async ({ page }) => {
    await page.goto('/en/workspace');

    await expect(page.getByRole('heading', { name: 'FR civil case intake' })).toBeVisible();
    await expect(page.getByText('Capture claimant brief')).toBeVisible();
    await expect(page.getByText('Risk screen & CEPEJ consent')).toBeVisible();
    await expect(page.getByText('Escalate to HITL if consent missing')).toBeVisible();
  });

  test('exposes multi-agent quick actions for reviewers', async ({ page }) => {
    await page.goto('/en/workspace');

    await expect(page.getByRole('button', { name: /Review HITL queue/ })).toBeVisible();
    await expect(page.getByText('HITL reviewer')).toBeVisible();
    await expect(page.getByText('Consent reconcilation')).toBeVisible();
  });
});
