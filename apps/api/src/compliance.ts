import type { IRACPayload } from '@avocat-ai/shared';

interface JurisdictionFlag {
  country: string;
  eu: boolean;
  ohada: boolean;
}

interface ComplianceInput {
  question: string;
  payload: IRACPayload;
  primaryJurisdiction: JurisdictionFlag | null;
}

interface ComplianceAssessment {
  fria: {
    required: boolean;
    reasons: string[];
  };
  cepej: {
    passed: boolean;
    violations: string[];
  };
}

const EU_AI_ACT_JURISDICTIONS = new Set(['FR', 'BE', 'LU', 'EU']);

const HIGH_RISK_KEYWORDS: RegExp[] = [
  /tribunal/i,
  /proc[ée]dure/i,
  /contentieux/i,
  /litige/i,
  /sanction/i,
  /p[ée]nal/i,
  /condamnation/i,
  /assignation/i,
  /requ[ée]te/i,
  /appel/i,
  /cassation/i,
  /saisie/i,
  /garde\s+à\s+vue/i,
  /d[ée]tention/i,
  /expulsion/i,
];

const FUNDAMENTAL_RIGHTS_KEYWORDS: RegExp[] = [
  /discrimination/i,
  /harc[èe]lement/i,
  /donn[ée]es\s+personnelles/i,
  /vie\s+priv[ée]/i,
  /droits?\s+fondamentaux/i,
  /corruption/i,
];

const USER_CONTROL_KEYWORDS: RegExp[] = [
  /dépose[rz]?\s+(une\s+)?requ[êe]te/i,
  /introduire\s+une\s+instance/i,
  /audience/i,
  /plaidoirie/i,
];

function detectHighRiskReasons(input: ComplianceInput): string[] {
  const reasons: string[] = [];
  const normalizedQuestion = input.question.toLowerCase();

  if (input.primaryJurisdiction && EU_AI_ACT_JURISDICTIONS.has(input.primaryJurisdiction.country)) {
    for (const keyword of HIGH_RISK_KEYWORDS) {
      if (keyword.test(normalizedQuestion)) {
        reasons.push(`Mot-clé à haut risque détecté : "${keyword.source}".`);
        break;
      }
    }

    if (USER_CONTROL_KEYWORDS.some((pattern) => pattern.test(normalizedQuestion))) {
      reasons.push('La demande vise une action procédurale ou un dépôt d’instance.');
    }

    if (input.payload.risk.level === 'HIGH') {
      reasons.push('Le modèle a évalué la requête comme présentant un risque élevé.');
    }
  }

  return reasons;
}

export function evaluateCompliance(input: ComplianceInput): ComplianceAssessment {
  const friaReasons = detectHighRiskReasons(input);
  const normalizedQuestion = input.question.toLowerCase();

  const cepejViolations: string[] = [];

  if (input.payload.citations.length === 0) {
    cepejViolations.push('transparency');
  }

  if (!input.payload.rules || input.payload.rules.length === 0) {
    cepejViolations.push('quality_security');
  }

  if (
    FUNDAMENTAL_RIGHTS_KEYWORDS.some((pattern) => pattern.test(normalizedQuestion)) &&
    input.payload.risk.level === 'LOW'
  ) {
    cepejViolations.push('fundamental_rights_screening');
  }

  if (
    (input.payload.risk.level === 'HIGH' || friaReasons.length > 0) &&
    input.payload.risk.hitl_required === false
  ) {
    cepejViolations.push('user_control');
  }

  return {
    fria: {
      required: friaReasons.length > 0,
      reasons: friaReasons,
    },
    cepej: {
      passed: cepejViolations.length === 0,
      violations: cepejViolations,
    },
  };
}

export type { ComplianceAssessment };
