import { describe, expect, it } from 'vitest';
import { summariseGoNoGo, evaluateGoNoGoReadiness } from '../src/lib/go-no-go.js';

describe('go-no-go helpers', () => {
  it('summarises evidence across sections', () => {
    const summary = summariseGoNoGo(
      [
        { section: 'A', status: 'satisfied', criterion: 'France ban evidence' },
        { section: 'B', status: 'pending', criterion: 'Allowlist review' },
        { section: 'B', status: 'satisfied', criterion: 'Vector store hash' },
        { section: 'C', status: 'pending', criterion: 'Case scoring rationale' },
      ],
      [
        { release_tag: 'v1.0', decision: 'go', decided_at: '2024-07-01T10:00:00Z', evidence_total: 2 },
        { release_tag: 'v1.0', decision: 'no-go', decided_at: '2024-06-01T09:00:00Z', evidence_total: 1 },
      ],
    );

    expect(summary.totalEvidence).toBe(4);
    expect(summary.satisfiedEvidence).toBe(2);
    const sectionB = summary.sections.find((item) => item.section === 'B');
    expect(sectionB).toMatchObject({ total: 2, satisfied: 1, pending: 1 });
    expect(summary.missingSections).toContain('C');
    expect(summary.signoffs[0]).toMatchObject({ releaseTag: 'v1.0', decision: 'go' });
  });

  it('evaluates readiness including decision requirements', () => {
    const allSections = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;
    const evidence = allSections.map((section, index) => ({
      section,
      status: 'satisfied',
      criterion: `Critère ${section}-${index}`,
    }));

    const summary = summariseGoNoGo(
      evidence,
      [{ release_tag: 'rc-1', decision: 'go', decided_at: '2024-07-05T12:00:00Z', evidence_total: evidence.length }],
    );

    const readiness = evaluateGoNoGoReadiness(summary, 'rc-1', true, [
      { release_tag: 'rc-1', validated: true },
    ]);
    expect(readiness.ready).toBe(true);
    expect(readiness.missingSections).toEqual(expect.not.arrayContaining(['A', 'B']));
    expect(readiness.decision).toEqual({ releaseTag: 'rc-1', decision: 'go' });

    const notReady = evaluateGoNoGoReadiness(summary, 'rc-2', true, [
      { release_tag: 'rc-1', validated: true },
    ]);
    expect(notReady.ready).toBe(false);
    expect(notReady.decision).toBeNull();
    expect(notReady.friaSatisfied).toBe(false);
  });

  it('fails readiness when FRIA artefacts are missing for requireGo', () => {
    const allSections = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;
    const evidence = allSections.map((section, index) => ({
      section,
      status: 'satisfied',
      criterion: `Critère ${section}-${index}`,
    }));

    const summary = summariseGoNoGo(
      evidence,
      [{ release_tag: 'rc-1', decision: 'go', decided_at: '2024-07-05T12:00:00Z', evidence_total: evidence.length }],
    );

    const readiness = evaluateGoNoGoReadiness(summary, 'rc-1', true, []);
    expect(readiness.ready).toBe(false);
    expect(readiness.friaSatisfied).toBe(false);
  });
});
