export type EvidenceRow = {
  section: string;
  status: string;
  criterion: string;
};

export type SignoffRow = {
  release_tag: string;
  decision: string;
  decided_at: string;
  evidence_total?: number | null;
};

export type FriaArtifactRow = {
  release_tag: string | null;
  validated: boolean | null;
};

export type SectionSummary = {
  section: string;
  total: number;
  satisfied: number;
  pending: number;
};

export type GoNoGoSummary = {
  sections: SectionSummary[];
  missingSections: string[];
  totalEvidence: number;
  satisfiedEvidence: number;
  signoffs: Array<{
    releaseTag: string;
    decision: string;
    decidedAt: string;
    evidenceTotal: number;
  }>;
};

const SECTION_CODES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;
const GO_DECISION = 'go';

export function summariseGoNoGo(
  evidence: EvidenceRow[] | null,
  signoffs: SignoffRow[] | null,
): GoNoGoSummary {
  const initial: Record<string, SectionSummary> = Object.fromEntries(
    SECTION_CODES.map((code) => [code, { section: code, total: 0, satisfied: 0, pending: 0 }]),
  );

  let totalEvidence = 0;
  let satisfiedEvidence = 0;

  for (const row of evidence ?? []) {
    const section = (row.section ?? '').toUpperCase();
    if (!SECTION_CODES.includes(section as (typeof SECTION_CODES)[number])) {
      continue;
    }
    const summary = initial[section];
    summary.total += 1;
    totalEvidence += 1;

    if (row.status === 'satisfied') {
      summary.satisfied += 1;
      satisfiedEvidence += 1;
    } else {
      summary.pending += 1;
    }
  }

  const sections = SECTION_CODES.map((code) => initial[code]);
  const missingSections = sections.filter((item) => item.satisfied === 0).map((item) => item.section);

  const signoffSummaries = (signoffs ?? []).map((row) => {
    const evidenceValue =
      typeof row.evidence_total === 'number' && Number.isFinite(row.evidence_total)
        ? row.evidence_total
        : 0;
    return {
      releaseTag: row.release_tag,
      decision: row.decision,
      decidedAt: row.decided_at,
      evidenceTotal: evidenceValue,
    };
  });

  return {
    sections,
    missingSections,
    totalEvidence,
    satisfiedEvidence,
    signoffs: signoffSummaries,
  };
}

export function evaluateGoNoGoReadiness(
  summary: GoNoGoSummary,
  releaseTag?: string,
  requireGoDecision = false,
  friaArtifacts?: FriaArtifactRow[] | null,
): {
  ready: boolean;
  missingSections: string[];
  decision?: { releaseTag: string; decision: string } | null;
  friaSatisfied: boolean;
} {
  const missingSections = summary.missingSections;
  const candidates = releaseTag
    ? summary.signoffs.filter((item) => item.releaseTag === releaseTag)
    : summary.signoffs;

  const latestDecision = candidates
    .slice()
    .sort((a, b) => new Date(b.decidedAt).getTime() - new Date(a.decidedAt).getTime())[0] ?? null;

  const hasGoDecision = latestDecision?.decision === GO_DECISION;
  const validatedArtifacts = (friaArtifacts ?? []).filter((artifact) => artifact?.validated === true);
  const hasGlobalFria = validatedArtifacts.some((artifact) => !artifact.release_tag);
  const hasReleaseSpecificFria = releaseTag
    ? validatedArtifacts.some((artifact) => artifact.release_tag === releaseTag)
    : false;
  const friaSatisfied = releaseTag
    ? hasReleaseSpecificFria || hasGlobalFria
    : validatedArtifacts.length > 0;

  const ready =
    missingSections.length === 0 && (!requireGoDecision || (hasGoDecision && friaSatisfied));

  return {
    ready,
    missingSections,
    decision: latestDecision ? { releaseTag: latestDecision.releaseTag, decision: latestDecision.decision } : null,
    friaSatisfied,
  };
}
