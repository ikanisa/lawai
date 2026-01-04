import { describe, expect, it } from 'vitest';
import { buildPhaseCWorkspaceDesk } from '../src/workspace.js';

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
