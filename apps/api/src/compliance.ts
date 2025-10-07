import type { IRACPayload } from '@avocat-ai/shared';

interface JurisdictionFlag {
  country: string;
  eu: boolean;
  ohada: boolean;
}

interface DisclosureContext {
  requiredConsentVersion?: string | null;
  acknowledgedConsentVersion?: string | null;
  requiredCoeVersion?: string | null;
  acknowledgedCoeVersion?: string | null;
}

interface ComplianceInput {
  question: string;
  payload: IRACPayload;
  primaryJurisdiction: JurisdictionFlag | null;
  disclosures?: DisclosureContext | null;
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
  statute: {
    passed: boolean;
    violations: string[];
  };
  disclosures: {
    consentSatisfied: boolean;
    councilSatisfied: boolean;
    missing: string[];
    requiredConsentVersion: string | null;
    acknowledgedConsentVersion: string | null;
    requiredCoeVersion: string | null;
    acknowledgedCoeVersion: string | null;
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

function normaliseRuleKind(kind: unknown): 'statute' | 'case' | 'regulation' | 'treaty' | 'doctrine' {
  if (typeof kind !== 'string') {
    return 'statute';
  }
  const normalised = kind.toLowerCase();
  if (normalised === 'case' || normalised === 'regulation' || normalised === 'treaty' || normalised === 'doctrine') {
    return normalised;
  }
  return 'statute';
}

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

  const statuteViolations: string[] = [];
  const rules = Array.isArray(input.payload.rules) ? input.payload.rules : [];
  const firstRule = rules[0];
  if (!firstRule || firstRule.binding !== true) {
    statuteViolations.push('first_rule_not_binding');
  }
  if (!firstRule || normaliseRuleKind(firstRule.kind) !== 'statute') {
    statuteViolations.push('first_rule_not_statute');
  }

  const bindingStatutes = rules.filter(
    (rule) => rule.binding && normaliseRuleKind(rule.kind) === 'statute',
  );
  if (bindingStatutes.length === 0) {
    statuteViolations.push('no_binding_statute_rule');
  }

  const caseRules = rules.filter((rule) => normaliseRuleKind(rule.kind) === 'case');
  const statuteAlignments = Array.isArray(input.payload.provenance?.statute_alignments)
    ? input.payload.provenance?.statute_alignments
    : [];
  if (caseRules.length > 0 && statuteAlignments.length === 0) {
    statuteViolations.push('missing_case_statute_alignment');
  }

  const disclosuresMissing: string[] = [];
  const requiredConsent = input.disclosures?.requiredConsentVersion ?? null;
  const acknowledgedConsent =
    input.payload.provenance?.disclosures?.consent?.acknowledged ??
    input.disclosures?.acknowledgedConsentVersion ??
    null;
  const consentSatisfied = !requiredConsent || acknowledgedConsent === requiredConsent;
  if (!consentSatisfied && requiredConsent) {
    disclosuresMissing.push('consent');
  }

  const requiredCoe = input.disclosures?.requiredCoeVersion ?? null;
  const acknowledgedCoe =
    input.payload.provenance?.disclosures?.council_of_europe?.acknowledged ??
    input.disclosures?.acknowledgedCoeVersion ??
    null;
  const councilSatisfied = !requiredCoe || acknowledgedCoe === requiredCoe;
  if (!councilSatisfied && requiredCoe) {
    disclosuresMissing.push('council_of_europe');
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
    statute: {
      passed: statuteViolations.length === 0,
      violations: statuteViolations,
    },
    disclosures: {
      consentSatisfied,
      councilSatisfied,
      missing: disclosuresMissing,
      requiredConsentVersion: requiredConsent,
      acknowledgedConsentVersion: acknowledgedConsent,
      requiredCoeVersion: requiredCoe,
      acknowledgedCoeVersion: acknowledgedCoe,
    },
  };
}

export type { ComplianceAssessment };
