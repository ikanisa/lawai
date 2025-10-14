import { describe, expect, it } from 'vitest';
import { buildPhaseCProcessNavigator, buildPhaseCWorkspaceDesk } from '../src/workspace.ts';

describe('buildPhaseCWorkspaceDesk', () => {
  it('returns the phase C multi-agent desk scaffolding', () => {
    const desk = buildPhaseCWorkspaceDesk();

    expect(desk.playbooks).toHaveLength(2);
    const civilClaim = desk.playbooks.find((playbook) => playbook.id === 'fr-civil-claim');
    expect(civilClaim).toBeDefined();
    expect(civilClaim?.steps.some((step) => step.id === 'fria-intake')).toBe(true);

    const ohada = desk.playbooks.find((playbook) => playbook.id === 'ohada-debt-recovery');
    expect(ohada?.regulatoryFocus).toContain('AUSCGIE statute alignment');

    const quickActionIds = desk.quickActions.map((action) => action.id);
    expect(quickActionIds).toEqual(
      expect.arrayContaining(['open-plan', 'deadline-calculator', 'trust-dashboard']),
    );

    expect(desk.personas.some((persona) => persona.agentCode === 'bench_memo')).toBe(true);
    expect(desk.toolChips.some((chip) => chip.id === 'mode-trust')).toBe(true);
  });
});

describe('buildPhaseCProcessNavigator', () => {
  it('describes the process navigator flows with telemetry', () => {
    const flows = buildPhaseCProcessNavigator();
    expect(flows).toHaveLength(5);

    const civilClaim = flows.find((flow) => flow.id === 'fr-civil-claim');
    expect(civilClaim?.steps[0]?.guardrails).toContain('Consentement CEPEJ journalisé');
    expect(civilClaim?.telemetry.runCount).toBeGreaterThan(10);

    const rwanda = flows.find((flow) => flow.jurisdiction === 'RW');
    expect(rwanda?.alerts).toEqual(
      expect.arrayContaining(['Activer le mode confidentiel avant la diffusion du brouillon au client.']),
    );

    const blockedSteps = flows
      .flatMap((flow) => flow.steps)
      .filter((step) => step.state === 'blocked');
    expect(blockedSteps.some((step) => step.id === 'hitl-review')).toBe(true);
  });
});
