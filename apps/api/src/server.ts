import Fastify, { type FastifyBaseLogger, type FastifyReply, type FastifyRequest } from 'fastify';
import { diffWordsWithSpace } from 'diff';
import { createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { createServiceClient } from '@avocat-ai/supabase';
import {
  ACCEPTANCE_THRESHOLDS,
  type IRACPayload,
  getAutonomousSuiteManifest,
  listUserTypes,
  getUserType,
  OFFICIAL_DOMAIN_ALLOWLIST,
} from '@avocat-ai/shared';
import { env } from './config.js';
import { getHybridRetrievalContext, runLegalAgent } from './agent.js';
import type { AgentRunResult, TrustPanelPayload, VerificationResult } from './agent.js';
import type { ComplianceAssessment } from './compliance.js';
import {
  getServiceAccountAccessToken,
  getStartPageToken as gdriveGetStartPageToken,
  listChanges as gdriveListChanges,
  getFileMetadata as gdriveGetFileMetadata,
  downloadFile as gdriveDownloadFile,
  exportGoogleDoc as gdriveExportDoc,
  isGoogleDocMime,
} from './gdrive.js';
import { authorizeAction, ensureOrgAccessCompliance } from './access-control.js';
import type { OrgAccessContext } from './access-control.js';
import { summariseDocumentFromPayload } from './summarization.js';
import { evaluateCaseQuality } from './case-quality.js';
import {
  buildTransparencyReport,
  buildRetrievalMetricsResponse,
  buildEvaluationMetricsResponse,
  type RetrievalHostRow,
  type RetrievalOriginRow,
  type RetrievalSummaryRow,
  type EvaluationMetricsSummaryRow,
  type EvaluationJurisdictionRow,
  summariseCepej,
  summariseEvaluations,
  summariseHitl,
  summariseIngestion,
  summariseRuns,
  summariseSlo,
  mapLearningReports,
  type LearningReportRow,
  type CepejRecord,
  type EvaluationRecord,
  type HitlRecord,
  type IngestionRecord,
  type RunRecord,
  type SloSnapshotRecord,
} from './reports.js';
import {
  listSsoConnections,
  upsertSsoConnection,
  deleteSsoConnection,
  listScimTokens,
  createScimToken,
  deleteScimToken,
  listIpAllowlist,
  upsertIpAllowlist,
  deleteIpAllowlist,
} from './sso.js';
import { listScimUsers, createScimUser, patchScimUser, deleteScimUser } from './scim.js';
import { logAuditEvent } from './audit.js';
import { InMemoryRateLimiter } from './rate-limit.js';
import { generateOtp, hashOtp, verifyOtp, OTP_POLICY } from './otp.js';
import { createWhatsAppAdapter } from './whatsapp.js';
import { signC2PA, type C2PASignature } from './c2pa.js';
import { AUTONOMOUS_JUSTICE_SUITE } from '@avocat-ai/shared';
import { getLaunchCollateral, enqueueRegulatorDigest, listRegulatorDigests } from './launch.js';
import { recordWebVital, listWebVitals, type WebVitalRecord } from './metrics.js';
import {
  buildPhaseEReadiness,
  enqueueOfflineOutboxItem,
  listOfflineOutboxItems,
  updateOfflineOutboxStatus,
} from './post-launch.js';
import { buildPhaseCWorkspaceDesk } from './workspace.js';
import { registerAvocatPwaRoutes } from './avocat-pwa.js';

async function embedQuery(text: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.EMBEDDING_MODEL,
      input: text,
    }),
  });

  const json = await response.json();
  if (!response.ok) {
    const message = json?.error?.message ?? 'embedding_failed';
    throw new Error(message);
  }

  const data = Array.isArray(json?.data) ? json.data : [];
  if (data.length === 0 || !Array.isArray(data[0]?.embedding)) {
    throw new Error('embedding_empty');
  }

  return data[0].embedding as number[];
}

const app = Fastify({
  logger: true,
});

const supabase = createServiceClient({
  SUPABASE_URL: env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
});

const whatsappAdapter = createWhatsAppAdapter(app.log);

registerAvocatPwaRoutes(app);

const phoneRateLimiter = new InMemoryRateLimiter({ limit: 3, windowMs: 60_000 });
const ipRateLimiter = new InMemoryRateLimiter({ limit: 10, windowMs: 60_000 });

const ALLOWLIST_HOSTS = new Set<string>(OFFICIAL_DOMAIN_ALLOWLIST.map((host) => host.toLowerCase()));

const COMPLIANCE_ACK_TYPES = {
  consent: 'ai_assist_terms',
  councilOfEurope: 'council_of_europe_disclosure',
} as const;

const toStringArray = (input: unknown): string[] =>
  Array.isArray(input) ? input.filter((value): value is string => typeof value === 'string') : [];

function isAllowlistedUrl(url: string | null | undefined): boolean {
  if (!url) {
    return false;
  }
  try {
    const host = new URL(url).hostname.toLowerCase();
    const trimmed = host.startsWith('www.') ? host.slice(4) : host;
    return ALLOWLIST_HOSTS.has(host) || ALLOWLIST_HOSTS.has(trimmed);
  } catch (_error) {
    return false;
  }
}

type AcknowledgementEvent = {
  type: string;
  version: string;
  created_at: string | null;
};

async function fetchAcknowledgementEvents(orgId: string, userId: string): Promise<AcknowledgementEvent[]> {
  const { data, error } = await supabase
    .from('consent_events')
    .select('type, version, created_at, org_id')
    .eq('user_id', userId)
    .or(`org_id.eq.${orgId},org_id.is.null`)
    .in('type', [COMPLIANCE_ACK_TYPES.consent, COMPLIANCE_ACK_TYPES.councilOfEurope])
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as Array<{ type?: unknown; version?: unknown; created_at?: string | null }>;

  const events: AcknowledgementEvent[] = [];
  for (const row of rows) {
    if (typeof row.type !== 'string' || typeof row.version !== 'string') {
      continue;
    }
    events.push({ type: row.type, version: row.version, created_at: row.created_at ?? null });
  }
  return events;
}

function summariseAcknowledgements(
  access: OrgAccessContext,
  events: AcknowledgementEvent[],
): {
  consent: { requiredVersion: string | null; acknowledgedVersion: string | null; acknowledgedAt: string | null; satisfied: boolean };
  councilOfEurope: { requiredVersion: string | null; acknowledgedVersion: string | null; acknowledgedAt: string | null; satisfied: boolean };
} {
  const latestByType = new Map<string, { version: string; created_at: string | null }>();
  for (const event of events) {
    if (!latestByType.has(event.type)) {
      latestByType.set(event.type, { version: event.version, created_at: event.created_at });
    }
  }

  const consentRequired = access.policies.consentVersion ?? null;
  const coeRequired = access.policies.councilOfEuropeDisclosureVersion ?? null;
  const consentAck = latestByType.get(COMPLIANCE_ACK_TYPES.consent);
  const coeAck = latestByType.get(COMPLIANCE_ACK_TYPES.councilOfEurope);

  const consentSatisfied = !consentRequired || consentAck?.version === consentRequired;
  const councilSatisfied = !coeRequired || coeAck?.version === coeRequired;

  return {
    consent: {
      requiredVersion: consentRequired,
      acknowledgedVersion: consentAck?.version ?? access.consent.latestAcceptedVersion ?? null,
      acknowledgedAt: consentAck?.created_at ?? null,
      satisfied: consentSatisfied,
    },
    councilOfEurope: {
      requiredVersion: coeRequired,
      acknowledgedVersion: coeAck?.version ?? null,
      acknowledgedAt: coeAck?.created_at ?? null,
      satisfied: councilSatisfied,
    },
  };
}

function mergeDisclosuresWithAcknowledgements(
  assessment: ComplianceAssessment,
  acknowledgements: ReturnType<typeof summariseAcknowledgements>,
): ComplianceAssessment['disclosures'] {
  const missing = new Set(assessment.disclosures.missing);
  if (!acknowledgements.consent.satisfied) {
    missing.add('consent');
  }
  if (!acknowledgements.councilOfEurope.satisfied) {
    missing.add('council_of_europe');
  }

  return {
    ...assessment.disclosures,
    consentSatisfied: acknowledgements.consent.satisfied,
    councilSatisfied: acknowledgements.councilOfEurope.satisfied,
    missing: Array.from(missing),
    requiredConsentVersion: acknowledgements.consent.requiredVersion,
    acknowledgedConsentVersion: acknowledgements.consent.acknowledgedVersion,
    requiredCoeVersion: acknowledgements.councilOfEurope.requiredVersion,
    acknowledgedCoeVersion: acknowledgements.councilOfEurope.acknowledgedVersion,
  };
}

app.get('/manifest/autonomous-suite', async (_request, reply) => {
  return reply.send(getAutonomousSuiteManifest());
});

app.get('/manifest/autonomous-suite/user-types', async (_request, reply) => {
  return reply.send({ userTypes: listUserTypes() });
});

type StressEntry = { count: number; resetAt: number };
const phoneStressMap = new Map<string, StressEntry>();

function recordOtpStress(phone: string): { requireCaptcha: boolean; remaining: number } {
  const now = Date.now();
  const entry = phoneStressMap.get(phone);
  if (!entry || entry.resetAt <= now) {
    phoneStressMap.set(phone, { count: 1, resetAt: now + 5 * 60_000 });
    return { requireCaptcha: false, remaining: 2 };
  }
  entry.count += 1;
  return { requireCaptcha: entry.count > 3, remaining: Math.max(0, 3 - entry.count) };
}

function resetOtpStress(phone: string): void {
  phoneStressMap.delete(phone);
}

function normalizePhone(input: string): string {
  const trimmed = input.trim();
  if (!/^\+\d{8,15}$/.test(trimmed)) {
    throw new Error('invalid_phone');
  }
  return trimmed;
}

function deriveWhatsAppId(phoneE164: string): string {
  return `wa_${createHash('sha256').update(phoneE164).digest('hex').slice(0, 32)}`;
}

function signSessionToken(payload: { userId: string; phone: string; waId?: string | null }): string {
  return jwt.sign(
    {
      sub: payload.userId,
      phone: payload.phone,
      wa_id: payload.waId ?? null,
      iat: Math.floor(Date.now() / 1000),
    },
    env.JWT_SECRET,
    { expiresIn: '1h', issuer: 'avocat-ai-wa' },
  );
}

function withRequestContext<T extends OrgAccessContext>(access: T, request: FastifyRequest): T {
  ensureOrgAccessCompliance(access, {
    ip: request.ip,
    headers: request.headers as Record<string, unknown>,
  });
  return access;
}

async function authorizeRequestWithGuards(
  action: Parameters<typeof authorizeAction>[0],
  orgId: string,
  userId: string,
  request: FastifyRequest,
) : Promise<OrgAccessContext> {
  const access = await authorizeAction(action, orgId, userId);
  return withRequestContext(access, request);
}

const GO_NO_GO_SECTIONS = new Set(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
const GO_NO_GO_STATUSES = new Set(['pending', 'satisfied']);
const GO_NO_GO_DECISIONS = new Set(['go', 'no-go']);
const FRIA_CRITERION = 'EU AI Act (high-risk): FRIA completed';
const ORG_ROLES = new Set(['owner', 'admin', 'reviewer', 'member', 'viewer', 'compliance_officer', 'auditor']);
const LEARNING_METRIC_LIMIT = 200;
const JURISDICTION_RESIDENCY_MAP: Record<string, string> = {
  FR: 'eu',
  BE: 'eu',
  LU: 'eu',
  EU: 'eu',
  MC: 'eu',
  CH: 'ch',
  'CA-QC': 'ca',
  CA: 'ca',
  OHADA: 'ohada',
  MA: 'maghreb',
  TN: 'maghreb',
  DZ: 'maghreb',
  RW: 'rw',
};

function mapJurisdictionToResidency(code?: string | null): string | null {
  if (!code) return null;
  return JURISDICTION_RESIDENCY_MAP[code.toUpperCase()] ?? null;
}

type DraftCitation = {
  title: string;
  url: string;
  publisher?: string | null;
  jurisdiction?: string | null;
  binding: boolean;
  residencyZone?: string | null;
  note?: string | null;
};

type ClauseComparisonSource = {
  clauseId: string;
  title: string;
  rationale: string;
  baseline: string;
  proposed: string;
  recommendation: string;
  riskLevel: 'low' | 'medium' | 'high';
  citations: DraftCitation[];
};

type ClauseComparisonRecord = {
  clauseId: string;
  title: string;
  rationale: string;
  baseline: string;
  proposed: string;
  diff: {
    summary: { additions: number; deletions: number; net: number };
    changes: Array<{ type: 'added' | 'removed' | 'context'; text: string }>;
    recommendation: string;
  };
  riskLevel: 'low' | 'medium' | 'high';
  citations: DraftCitation[];
};

type DraftExportRecord = {
  format: string;
  status: 'ready' | 'pending' | 'failed';
  bucket?: string | null;
  storagePath?: string | null;
  bytes?: number | null;
  sha256?: string | null;
  c2pa?: {
    keyId: string;
    signedAt: string;
    algorithm: string;
    statementId: string;
  };
};

type DraftDataset = {
  summary: string;
  citations: DraftCitation[];
  clauses: ClauseComparisonSource[];
};

const DRAFTING_LIBRARY: Record<string, DraftDataset> = {
  FR: {
    summary:
      'Encadrer les obligations contractuelles en rappelant la bonne foi (art. 1104 C. civ.) et en proportionnant les penalites conformement a l article 1231-5.',
    citations: [
      {
        title: 'Code civil - Article 1104',
        url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032040720/',
        publisher: 'Legifrance',
        jurisdiction: 'FR',
        binding: true,
        residencyZone: 'eu',
      },
      {
        title: 'Code civil - Article 1231-5',
        url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032041184/',
        publisher: 'Legifrance',
        jurisdiction: 'FR',
        binding: true,
        residencyZone: 'eu',
      },
    ],
    clauses: [
      {
        clauseId: 'clause-penale-fr',
        title: 'Clause penale',
        rationale: 'Le juge peut moderer la penalite excessive selon l article 1231-5 du Code civil.',
        baseline:
          'En cas de manquement a ses obligations contractuelles, la Partie debitrice versera a la Partie creanciere une penalite forfaitaire de 5 000 euros par infraction constatee.',
        proposed:
          'En cas de manquement caracterise et notifie par ecrit, la Partie debitrice versera a la Partie creanciere une penalite de 12 000 euros par infraction constatee et prendra en charge les frais d expertise raisonnablement engages.',
        recommendation:
          'Verifier que l aggravation du montant est justifiee et proportionnee; prevoir une clause de moderation expresse si necessaire.',
        riskLevel: 'medium',
        citations: [
          {
            title: 'Code civil - Article 1231-5',
            url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032041184/',
            publisher: 'Legifrance',
            jurisdiction: 'FR',
            binding: true,
            residencyZone: 'eu',
          },
        ],
      },
      {
        clauseId: 'clause-confidentialite-fr',
        title: 'Clause de confidentialite',
        rationale: 'Les informations sensibles doivent rester protegees au-dela de la phase d execution, avec notification rapide en cas de fuite.',
        baseline:
          'Chaque Partie s engage a conserver strictement confidentielles les informations techniques et commerciales pendant une duree de trois (3) ans a compter de la signature.',
        proposed:
          'Chaque Partie conserve confidentielles les informations techniques, commerciales et personnelles pendant cinq (5) ans et notifie toute divulgation non autorisee dans les quarante-huit (48) heures.',
        recommendation:
          'La prolongation et l obligation de notification renforcent la protection mais augmentent la charge; verifier la compatibilite RGPD et les capacites operationnelles.',
        riskLevel: 'low',
        citations: [
          {
            title: 'Code civil - Article 1104',
            url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032040720/',
            publisher: 'Legifrance',
            jurisdiction: 'FR',
            binding: true,
            residencyZone: 'eu',
          },
        ],
      },
    ],
  },
  MA: {
    summary:
      'S assurer que la clause de non-concurrence reste proportionnee en matiere de duree, de perimetre et de contrepartie financiere (Code du travail 65-99).',
    citations: [
      {
        title: 'Code du travail marocain - Article 61 bis',
        url: 'https://www.sgg.gov.ma/Portals/1/lois/Loi_travail_65-99.pdf',
        publisher: 'Secretariat General du Gouvernement',
        jurisdiction: 'MA',
        binding: true,
        residencyZone: 'maghreb',
      },
      {
        title: 'Cour de cassation (MA) 2019-115',
        url: 'https://www.courdecassation.ma/jurisprudence/social/2019-115',
        publisher: 'Cour de cassation Marocaine',
        jurisdiction: 'MA',
        binding: true,
        residencyZone: 'maghreb',
      },
    ],
    clauses: [
      {
        clauseId: 'clause-noncompete-ma',
        title: 'Clause de non-concurrence',
        rationale: 'La validite est subordonnee a la protection d un interet legitime, une limitation raisonnable et une contrepartie adequate.',
        baseline:
          'Le salarie s engage a ne pas exercer d activites concurrentes pendant douze (12) mois dans un rayon de dix (10) kilometres apres la rupture du contrat.',
        proposed:
          'Le salarie s engage a ne pas exercer d activites concurrentes pendant vingt-quatre (24) mois sur le territoire marocain, moyennant une indemnisation mensuelle egale a 30% de la remuneration moyenne.',
        recommendation:
          'Verifier que la duree et l etendue geographique restent proportionnees et que l indemnisation couvre l effort exige.',
        riskLevel: 'medium',
        citations: [
          {
            title: 'Code du travail marocain - Article 61 bis',
            url: 'https://www.sgg.gov.ma/Portals/1/lois/Loi_travail_65-99.pdf',
            publisher: 'Secretariat General du Gouvernement',
            jurisdiction: 'MA',
            binding: true,
            residencyZone: 'maghreb',
          },
        ],
      },
      {
        clauseId: 'clause-confidentialite-hard-ma',
        title: 'Clause de confidentialite',
        rationale: 'Les donnees sensibles doivent rester protegees avec rappel du devoir de discretion post-contractuel.',
        baseline:
          'Le salarie respecte la confidentialite des informations de l employeur pendant le contrat et douze (12) mois apres sa cessation.',
        proposed:
          'Le salarie respecte la confidentialite pendant et apres le contrat, sans limitation de duree pour les secrets d affaires et avec restitution immediate des supports.',
        recommendation:
          'Confirmer la definition du secret d affaires et informer sur les sanctions en cas de violation.',
        riskLevel: 'low',
        citations: [
          {
            title: 'Loi 31-05 relative au secret d affaires',
            url: 'https://adala.justice.gov.ma/production/legislation/fr/2018/loi/2018-31-05.pdf',
            publisher: 'Ministere de la Justice',
            jurisdiction: 'MA',
            binding: true,
            residencyZone: 'maghreb',
          },
        ],
      },
    ],
  },
  OHADA: {
    summary:
      'Verifier la compatibilite des clauses contractuelles avec l AUSCGIE et les mecanismes d arbitrage CCJA pour anticiper les renegociations.',
    citations: [
      {
        title: 'AUSCGIE 2014 - Articles 10 et suivants',
        url: 'https://www.ohada.org/wp-content/uploads/2023/01/auscgie-2014.pdf',
        publisher: 'OHADA',
        jurisdiction: 'OHADA',
        binding: true,
        residencyZone: 'ohada',
      },
      {
        title: 'Reglement d arbitrage CCJA 2017',
        url: 'https://www.ohada.org/wp-content/uploads/2018/05/reglement-arbitrage-ccja-2017.pdf',
        publisher: 'OHADA',
        jurisdiction: 'OHADA',
        binding: true,
        residencyZone: 'ohada',
      },
    ],
    clauses: [
      {
        clauseId: 'clause-hardship-ohada',
        title: 'Clause de hardship',
        rationale: 'Prevoir une renegociation obligatoire en cas de bouleversement notable des circonstances, conforme a l AUSCGIE.',
        baseline:
          'Les Parties conviennent de renegocier de bonne foi le contrat en cas de changement economique majeur affectant l equilibre initial.',
        proposed:
          'Les Parties s engagent a renegocier dans les quinze (15) jours suivant la notification d un evenement qui bouleverse l equilibre economique; a defaut d accord, le litige est soumis a la CCJA.',
        recommendation:
          'Documenter les criteres declencheurs et prevoir un proces-verbal de desaccord pour relancer la CCJA.',
        riskLevel: 'medium',
        citations: [
          {
            title: 'AUSCGIE 2014 - Article 10',
            url: 'https://www.ohada.org/wp-content/uploads/2023/01/auscgie-2014.pdf',
            publisher: 'OHADA',
            jurisdiction: 'OHADA',
            binding: true,
            residencyZone: 'ohada',
          },
        ],
      },
      {
        clauseId: 'clause-competence-ohada',
        title: 'Clause compromissoire',
        rationale: 'Securiser le recours a l arbitrage CCJA en rappelant les formalismes de l article 3 du reglement.',
        baseline:
          'Tout litige sera tranche definitivement suivant le reglement d arbitrage de la CCJA par trois arbitres designes conformement audit reglement.',
        proposed:
          'Tout litige est tranche par la CCJA; la Partie demanderesse depose une requete conforme a l article 3 et les arbitres statuent dans un delai de 120 jours sauf prorogation motivee.',
        recommendation:
          'Verifier l information donnee aux parties sur les couts CCJA et les delais; prevoir un relais interne HITL pour suivre la procedure.',
        riskLevel: 'low',
        citations: [
          {
            title: 'Reglement d arbitrage CCJA 2017 - Article 3',
            url: 'https://www.ohada.org/wp-content/uploads/2018/05/reglement-arbitrage-ccja-2017.pdf',
            publisher: 'OHADA',
            jurisdiction: 'OHADA',
            binding: true,
            residencyZone: 'ohada',
          },
        ],
      },
    ],
  },
  DEFAULT: {
    summary:
      'Fournir un canevas generique integrant les obligations de bonne foi et une verification des penalites contractuelles.',
    citations: [
      {
        title: 'Guide generique - Clause de bonne foi',
        url: 'https://example.org/guides/bonne-foi',
        publisher: 'Avocat AI',
        jurisdiction: null,
        binding: false,
        residencyZone: null,
        note: 'Remplacer par une source officielle lors de la validation.',
      },
    ],
    clauses: [
      {
        clauseId: 'clause-generique-equilibre',
        title: 'Clause d equilibre contractuel',
        rationale: 'Rappeler l obligation d equilibre et de bonne foi entre les parties.',
        baseline:
          'Les Parties cooperent de bonne foi a l execution du present contrat et s abstiennent de toute action susceptible de porter atteinte a l equilibre contractuel.',
        proposed:
          'Les Parties cooperent de bonne foi, documentent les difficultés majeures et se reunissent sous quinze (15) jours pour proposer des mesures correctives preserveant l equilibre contractuel.',
        recommendation:
          'Orienter la revue juridique vers des references propres a la juridiction du dossier.',
        riskLevel: 'low',
        citations: [
          {
            title: 'Guide generique - Clause de bonne foi',
            url: 'https://example.org/guides/bonne-foi',
            publisher: 'Avocat AI',
            jurisdiction: null,
            binding: false,
            residencyZone: null,
            note: 'Remplacer par une source officielle lors de la validation.',
          },
        ],
      },
    ],
  },
};

function resolveDraftDatasetKey(jurisdiction?: string | null): string {
  if (!jurisdiction) {
    return 'DEFAULT';
  }
  const upper = jurisdiction.toUpperCase();
  if (DRAFTING_LIBRARY[upper]) {
    return upper;
  }
  if (['MA', 'TN', 'DZ'].includes(upper)) {
    return 'MA';
  }
  if (
    ['BJ', 'BF', 'CM', 'CF', 'CG', 'CI', 'GA', 'GN', 'GQ', 'GW', 'ML', 'NE', 'SN', 'TD', 'TG'].includes(
      upper,
    )
  ) {
    return 'OHADA';
  }
  if (upper.includes('-')) {
    const base = upper.split('-')[0];
    if (DRAFTING_LIBRARY[base]) {
      return base;
    }
  }
  return 'DEFAULT';
}

function selectDraftDataset(jurisdiction?: string | null): DraftDataset {
  return DRAFTING_LIBRARY[resolveDraftDatasetKey(jurisdiction)] ?? DRAFTING_LIBRARY.DEFAULT;
}

function buildClauseComparisons(sources: ClauseComparisonSource[]): ClauseComparisonRecord[] {
  return sources.map((source) => {
    const parts = diffWordsWithSpace(source.baseline, source.proposed);
    let additions = 0;
    let deletions = 0;
    const changes = parts.map((part) => {
      if (part.added) additions += part.value.length;
      if (part.removed) deletions += part.value.length;
      return {
        type: part.added ? 'added' : part.removed ? 'removed' : 'context',
        text: part.value,
      } as { type: 'added' | 'removed' | 'context'; text: string };
    });
    return {
      clauseId: source.clauseId,
      title: source.title,
      rationale: source.rationale,
      baseline: source.baseline,
      proposed: source.proposed,
      riskLevel: source.riskLevel,
      citations: source.citations,
      diff: {
        summary: { additions, deletions, net: additions - deletions },
        changes,
        recommendation: source.recommendation,
      },
    };
  });
}

type NormalisedTemplateSection = { heading: string; body: string };

function normaliseTemplateSections(
  sections?: Array<{ heading?: string | null; body?: string | null }> | null,
): NormalisedTemplateSection[] | null {
  if (!Array.isArray(sections)) {
    return null;
  }
  const normalised: NormalisedTemplateSection[] = [];
  for (const section of sections) {
    if (!section || typeof section !== 'object') {
      continue;
    }
    const heading = typeof section.heading === 'string' && section.heading.trim().length > 0
      ? section.heading.trim()
      : 'Section';
    const body = typeof section.body === 'string' && section.body.trim().length > 0
      ? section.body.trim()
      : 'Contenu à compléter.';
    normalised.push({ heading, body });
  }
  return normalised.length > 0 ? normalised : null;
}

function buildDraftFillIns(templateFillIns: unknown, provided?: string[]): string[] {
  const set = new Set<string>();
  const addValue = (input: unknown) => {
    if (typeof input === 'string') {
      const trimmed = input.trim();
      if (trimmed.length > 0) {
        set.add(trimmed);
      }
    }
  };
  if (Array.isArray(templateFillIns)) {
    for (const value of templateFillIns) {
      addValue(value);
    }
  }
  if (Array.isArray(provided)) {
    for (const value of provided) {
      addValue(value);
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'));
}

function deriveDraftCitationsFromPayload(payload: IRACPayload, residencyZone: string | null): DraftCitation[] {
  const ruleByUrl = new Map(payload.rules.map((rule) => [rule.source_url, rule]));
  return payload.citations.map((citation) => {
    const rule = ruleByUrl.get(citation.url);
    return {
      title: citation.title,
      url: citation.url,
      publisher: citation.court_or_publisher,
      jurisdiction: payload.jurisdiction.country,
      binding: rule ? rule.binding : true,
      residencyZone,
      note: citation.note ?? null,
    } satisfies DraftCitation;
  });
}

function mergeDraftCitations(primary: DraftCitation[], extras: DraftCitation[]): DraftCitation[] {
  const map = new Map<string, DraftCitation>();
  const add = (citation: DraftCitation) => {
    if (!citation.url) {
      return;
    }
    const key = citation.url.toLowerCase();
    if (!map.has(key)) {
      map.set(key, citation);
    }
  };
  primary.forEach(add);
  extras.forEach(add);
  return Array.from(map.values());
}

type RenderDraftMarkdownOptions = {
  title: string;
  prompt: string;
  generatedAt: string;
  payload: IRACPayload;
  datasetSummary: string;
  clauseComparisons: ClauseComparisonRecord[];
  fillIns: string[];
  templateSections: NormalisedTemplateSection[] | null;
  citations: DraftCitation[];
  plan: AgentRunResult['plan'];
  trustPanel: TrustPanelPayload | null;
  verification: VerificationResult | null | undefined;
  compliance: ComplianceAssessment | null;
};

function renderDraftMarkdown({
  title,
  prompt,
  generatedAt,
  payload,
  datasetSummary,
  clauseComparisons,
  fillIns,
  templateSections,
  citations,
  plan,
  trustPanel,
  verification,
  compliance,
}: RenderDraftMarkdownOptions): string {
  const lines: string[] = [];
  lines.push(`# ${title}`, '');
  lines.push(`> Juridiction : ${payload.jurisdiction.country.toUpperCase()}  `);
  lines.push(`> Généré : ${generatedAt}  `);
  lines.push(`> Prompt : ${prompt}`);
  lines.push('');

  lines.push('## Synthèse', '', datasetSummary, '');

  lines.push('## Analyse IRAC', '');
  lines.push('### Question', '', payload.issue, '');

  if (payload.rules.length > 0) {
    lines.push('### Règles', '');
    for (const rule of payload.rules) {
      const bindingLabel = rule.binding ? 'obligatoire' : 'indicative';
      lines.push(`- ${rule.citation} (${bindingLabel}, ${rule.effective_date}) \u2014 ${rule.source_url}`);
    }
    lines.push('');
  }

  lines.push('### Application', '', payload.application, '');
  lines.push('### Conclusion', '', payload.conclusion, '');

  lines.push('### Risque', '');
  lines.push(`- Niveau : ${payload.risk.level}`);
  lines.push(`- HITL requis : ${payload.risk.hitl_required ? 'oui' : 'non'}`);
  lines.push(`- Raison : ${payload.risk.why}`);
  lines.push('');

  if (compliance) {
    const cepejMessages: Record<string, string> = {
      transparency: 'Transparence : ajouter au moins une citation officielle.',
      quality_security: 'Qualité / sécurité : vérifier le bloc Règles et les contrôles.',
      fundamental_rights_screening: 'Droits fondamentaux : escalader et réviser le niveau de risque.',
      user_control: 'Contrôle utilisateur : activer la revue humaine obligatoire.',
    };
    const statuteMessages: Record<string, string> = {
      first_rule_not_binding: 'La première règle citée doit être contraignante.',
      first_rule_not_statute: 'La première règle doit référencer un texte législatif.',
      no_binding_statute_rule: 'Aucun texte législatif contraignant n’a été identifié.',
      missing_case_statute_alignment: 'Aligner la jurisprudence citée avec le texte législatif correspondant.',
    };
    const disclosureMessages: Record<string, string> = {
      consent: 'Consentement : collecter et enregistrer l’acceptation de la bannière.',
      council_of_europe: 'Conseil de l’Europe : afficher et valider la divulgation requise.',
    };

    lines.push('## Conformité', '');
    lines.push(`- FRIA requis : ${compliance.fria.required ? 'oui' : 'non'}`);
    if (compliance.fria.required && compliance.fria.reasons.length > 0) {
      lines.push('  - Raisons :');
      compliance.fria.reasons.forEach((reason) => {
        lines.push(`    - ${reason}`);
      });
    }
    lines.push(
      `- CEPEJ : ${compliance.cepej.passed ? 'aucune violation détectée' : 'violations à corriger'}`,
    );
    if (!compliance.cepej.passed && compliance.cepej.violations.length > 0) {
      compliance.cepej.violations.forEach((violation) => {
        const message = cepejMessages[violation] ?? violation;
        lines.push(`    - ${message}`);
      });
    }
    lines.push(
      `- Statute-first : ${compliance.statute.passed ? 'alignement respecté' : 'corrections nécessaires'}`,
    );
    if (!compliance.statute.passed && compliance.statute.violations.length > 0) {
      compliance.statute.violations.forEach((violation) => {
        const message = statuteMessages[violation] ?? violation;
        lines.push(`    - ${message}`);
      });
    }
    if (compliance.disclosures.missing.length > 0) {
      lines.push('- Divulgations manquantes :');
      compliance.disclosures.missing.forEach((item) => {
        const message = disclosureMessages[item] ?? item;
        lines.push(`    - ${message}`);
      });
    } else {
      lines.push('- Divulgations : consentement et Conseil de l’Europe validés.');
    }
    lines.push('');
  }

  if (verification) {
    lines.push('## Vérification', '');
    lines.push(`- Statut : ${verification.status}`);
    if (verification.notes && verification.notes.length > 0) {
      lines.push('### Notes');
      for (const note of verification.notes) {
        lines.push(`- (${note.severity}) ${note.code} — ${note.message}`);
      }
    }
    if (Array.isArray(verification.allowlistViolations) && verification.allowlistViolations.length > 0) {
      lines.push('### Violations d\'allowlist');
      for (const item of verification.allowlistViolations) {
        lines.push(`- ${item}`);
      }
    }
    lines.push('');
  }

  if (Array.isArray(plan) && plan.length > 0) {
    lines.push('## Plan analytique', '');
    plan.forEach((step, index) => {
      const record = (step ?? {}) as Record<string, unknown>;
      const name = typeof record.name === 'string' ? record.name : `Étape ${index + 1}`;
      const status = typeof record.status === 'string' ? record.status : 'inconnue';
      lines.push(`- ${name} (${status})`);
      if (typeof record.description === 'string' && record.description.trim().length > 0) {
        lines.push(`  - ${record.description.trim()}`);
      }
    });
    lines.push('');
  }

  if (trustPanel) {
    lines.push('## Confiance & provenance', '');
    if (trustPanel.risk) {
      lines.push(`- Risque global : ${trustPanel.risk.level}`);
      lines.push(`- HITL requis : ${trustPanel.risk.hitlRequired ? 'oui' : 'non'}`);
      lines.push(`- Motif : ${trustPanel.risk.reason}`);
    }
    if (trustPanel.citationSummary) {
      lines.push(
        `- Citations vérifiées : ${trustPanel.citationSummary.allowlisted}/${trustPanel.citationSummary.total}`,
      );
    }
    if (trustPanel.provenance) {
      lines.push(
        `- Provenance : ${trustPanel.provenance.residencyBreakdown
          .map((entry) => `${entry.zone}:${entry.count}`)
          .join(', ')}`,
      );
    }
    lines.push('');
  }

  if (fillIns.length > 0) {
    lines.push('## Données à renseigner', '');
    fillIns.forEach((item) => {
      lines.push(`- ${item}`);
    });
    lines.push('');
  }

  const defaultSections: NormalisedTemplateSection[] = [
    { heading: 'Faits', body: 'Présenter les faits essentiels et les pièces de référence.' },
    { heading: 'Discussion', body: 'Exposer les fondements juridiques en citant les sources officielles.' },
    { heading: 'Conclusions', body: 'Formuler les demandes et obligations recommandées.' },
  ];
  const sectionsToRender = templateSections && templateSections.length > 0 ? templateSections : defaultSections;
  sectionsToRender.forEach((section) => {
    lines.push(`## ${section.heading}`, '', section.body, '');
  });

  lines.push('## Clauses critiques', '');
  clauseComparisons.forEach((clause, index) => {
    lines.push(`### ${index + 1}. ${clause.title}`, '', clause.rationale, '');
    lines.push('**Version proposée**', '', clause.proposed, '');
    lines.push('**Analyse des changements**', '');
    lines.push(`- Ajouts : ${clause.diff.summary.additions}`);
    lines.push(`- Retraits : ${clause.diff.summary.deletions}`);
    lines.push(`- Recommandation : ${clause.diff.recommendation}`, '');
    if (clause.citations.length > 0) {
      lines.push('Citations associées :');
      clause.citations.forEach((citation) => {
        lines.push(`- ${citation.title} (${citation.url})`);
      });
      lines.push('');
    }
  });

  lines.push('## Citations vérifiées', '');
  citations.forEach((citation) => {
    const bindingLabel = citation.binding ? 'obligatoire' : 'à vérifier';
    const residencyLabel = citation.residencyZone ? ` — zone ${citation.residencyZone}` : '';
    lines.push(`- ${citation.title} (${bindingLabel}${residencyLabel}) — ${citation.url}`);
  });
  lines.push('');

  lines.push('---', '', `_Brouillon généré automatiquement le ${generatedAt}. Soumettre à revue HITL avant diffusion externe._`);

  return lines.join('\n');
}

function addDays(base: Date, days: number): Date {
  const result = new Date(base.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function addBusinessDays(base: Date, days: number): Date {
  const result = new Date(base.getTime());
  let remaining = Math.max(0, Math.floor(days));
  while (remaining > 0) {
    result.setUTCDate(result.getUTCDate() + 1);
    const day = result.getUTCDay();
    if (day !== 0 && day !== 6) {
      remaining -= 1;
    }
  }
  return result;
}

function formatIcsDate(date: Date): string {
  const pad = (value: number, length = 2) => value.toString().padStart(length, '0');
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hours = pad(date.getUTCHours());
  const minutes = pad(date.getUTCMinutes());
  const seconds = pad(date.getUTCSeconds());
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

function escapeIcsText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/[;,\n]/g, (match) => {
    switch (match) {
      case ';':
        return '\\;';
      case ',':
        return '\\,';
      case '\n':
        return '\\n';
      default:
        return match;
    }
  });
}

function computeMatterSchedule(options: {
  jurisdiction?: string | null;
  filingDate?: string | null;
  procedure?: string | null;
  calendarType?: 'calendar' | 'court';
  timezone?: string | null;
  method?: 'standard' | 'expedited' | 'extended';
} = {}): Array<{
  name: string;
  dueAt: string;
  ruleReference: string;
  notes: string;
}> {
  const base = (() => {
    if (options?.filingDate) {
      const parsed = new Date(options.filingDate);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }
    return new Date();
  })();

  const jurisdiction = options?.jurisdiction?.toUpperCase() ?? 'FR';
  const procedure = options?.procedure ?? 'general';
  const calendarType = options?.calendarType === 'court' ? 'court' : 'calendar';
  const method = options?.method === 'expedited' || options?.method === 'extended' ? options.method : 'standard';

  const addFn = calendarType === 'court' ? addBusinessDays : addDays;

  const jurisdictionOffsets = {
    first: jurisdiction === 'CA' ? 20 : 15,
    second: jurisdiction === 'OHADA' ? 35 : 30,
    third: procedure.includes('appeal') ? 60 : 45,
  };

  const methodDelta = method === 'expedited' ? -3 : method === 'extended' ? 5 : 0;

  const clampDays = (value: number) => Math.max(3, value);

  const first = addFn(base, clampDays(jurisdictionOffsets.first + methodDelta));
  const second = addFn(base, clampDays(jurisdictionOffsets.second + methodDelta));
  const third = addFn(base, clampDays(jurisdictionOffsets.third + methodDelta));

  return [
    {
      name: 'Initial response',
      dueAt: first.toISOString(),
      ruleReference: `${jurisdiction} • ${calendarType === 'court' ? 'Jours de cour' : 'Jours calendaires'}`,
      notes: 'Auto-généré – personnalisez selon la juridiction et la procédure.',
    },
    {
      name: 'Hearing preparation',
      dueAt: second.toISOString(),
      ruleReference: `${jurisdiction} • Préparation audience (${method})`,
      notes: 'Inclut la collecte de pièces, la revue HITL et la coordination interne.',
    },
    {
      name: 'Final submissions',
      dueAt: third.toISOString(),
      ruleReference: `${procedure} • Dépôt final`,
      notes: 'Mettre à jour avant transmission tribunal et confirmer la sign-off HITL.',
    },
  ];
}

function renderMatterCalendar(
  matter: {
    id: string;
    title: string;
    description?: string | null;
    jurisdiction_code?: string | null;
    procedure?: string | null;
  },
  deadlines: Array<{ id?: string; name: string; due_at: string; rule_reference?: string | null; notes?: string | null }>,
  options?: { timezone?: string | null },
): string {
  const lines: string[] = [];
  lines.push('BEGIN:VCALENDAR');
  lines.push('VERSION:2.0');
  lines.push('PRODID:-//Avocat-AI//Matters//FR');
  lines.push('CALSCALE:GREGORIAN');
  lines.push('METHOD:PUBLISH');
  if (options?.timezone && typeof options.timezone === 'string' && options.timezone.trim().length > 0) {
    lines.push(`X-WR-TIMEZONE:${escapeIcsText(options.timezone.trim())}`);
  }
  const now = new Date();

  for (const deadline of deadlines) {
    const due = new Date(deadline.due_at);
    if (Number.isNaN(due.getTime())) {
      continue;
    }
    const end = addDays(due, 1);
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${escapeIcsText(`${matter.id}-${deadline.id ?? deadline.name}`)}@avocat.ai`);
    lines.push(`DTSTAMP:${formatIcsDate(now)}`);
    lines.push(`SUMMARY:${escapeIcsText(`${deadline.name} – ${matter.title}`)}`);
    const descriptionPieces = [matter.procedure ?? '', deadline.rule_reference ?? '', deadline.notes ?? '']
      .filter((value) => value && value.length > 0)
      .join(' | ');
    if (descriptionPieces.length > 0) {
      lines.push(`DESCRIPTION:${escapeIcsText(descriptionPieces)}`);
    }
    lines.push(`DTSTART:${formatIcsDate(due)}`);
    lines.push(`DTEND:${formatIcsDate(end)}`);
    if (matter.jurisdiction_code) {
      lines.push(`LOCATION:${escapeIcsText(matter.jurisdiction_code)}`);
    }
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

type CalendarSettings = {
  type: 'calendar' | 'court';
  timezone: string;
  method: 'standard' | 'expedited' | 'extended';
};

function extractCalendarSettings(metadata: Record<string, unknown> | null | undefined): CalendarSettings {
  const defaultSettings: CalendarSettings = {
    type: 'calendar',
    timezone: 'Europe/Paris',
    method: 'standard',
  };

  if (!metadata || typeof metadata !== 'object') {
    return defaultSettings;
  }

  const raw = (metadata as Record<string, unknown>).calendar;
  if (!raw || typeof raw !== 'object') {
    return defaultSettings;
  }

  const object = raw as Record<string, unknown>;
  const type = object.type === 'court' ? 'court' : 'calendar';
  const timezone = typeof object.timezone === 'string' && object.timezone.trim().length > 0 ? object.timezone.trim() : defaultSettings.timezone;
  const method = object.method === 'expedited' || object.method === 'extended' ? object.method : 'standard';

  return { type, timezone, method } satisfies CalendarSettings;
}

function buildCalendarPath(orgId: string, matterId: string): string {
  return `${orgId}/matters/${matterId}.ics`;
}

async function persistMatterCalendar(options: {
  orgId: string;
  matter: { id: string; title: string; description?: string | null; jurisdiction_code?: string | null; procedure?: string | null };
  deadlines: Array<{ id?: string; name: string; due_at: string; rule_reference?: string | null; notes?: string | null }>;
  settings: CalendarSettings;
  logger: FastifyBaseLogger;
}): Promise<{ calendar: string; storagePath: string | null; signedUrl: string | null }> {
  const calendar = renderMatterCalendar(options.matter, options.deadlines, { timezone: options.settings.timezone });
  const path = buildCalendarPath(options.orgId, options.matter.id);
  const buffer = Buffer.from(calendar, 'utf-8');

  const upload = await supabase.storage
    .from('snapshots')
    .upload(path, buffer, { contentType: 'text/calendar', upsert: true });

  if (upload.error) {
    options.logger.warn({ err: upload.error, orgId: options.orgId, matterId: options.matter.id }, 'matter_calendar_upload_failed');
    return { calendar, storagePath: null, signedUrl: null };
  }

  const signed = await supabase.storage.from('snapshots').createSignedUrl(path, 600);
  if (signed.error) {
    options.logger.warn({ err: signed.error, orgId: options.orgId, matterId: options.matter.id }, 'matter_calendar_signed_url_failed');
    return { calendar, storagePath: path, signedUrl: null };
  }

  return { calendar, storagePath: path, signedUrl: signed.data?.signedUrl ?? null };
}

async function deleteMatterCalendar(orgId: string, matterId: string, logger: FastifyBaseLogger): Promise<void> {
  const path = buildCalendarPath(orgId, matterId);
  const { error } = await supabase.storage.from('snapshots').remove([path]);
  if (error) {
    logger.warn({ err: error, orgId, matterId }, 'matter_calendar_delete_failed');
  }
}

type CiteCheckSummary = {
  total: number;
  verified: number;
  pending: number;
  manual: number;
};

function summariseCiteCheckStatus(statuses: Array<string | null | undefined>): CiteCheckSummary {
  const summary: CiteCheckSummary = { total: 0, verified: 0, pending: 0, manual: 0 };
  for (const status of statuses) {
    summary.total += 1;
    if (!status) {
      summary.pending += 1;
      continue;
    }
    const normalized = status.toLowerCase();
    if (normalized === 'verified' || normalized === 'ok') {
      summary.verified += 1;
    } else if (normalized === 'manual') {
      summary.manual += 1;
    } else {
      summary.pending += 1;
    }
  }
  return summary;
}

async function loadMatterDetail(options: {
  orgId: string;
  matterId: string;
  logger: FastifyBaseLogger;
}): Promise<
  | {
      matter: {
        id: string;
        title: string;
        description: string | null;
        status: string;
        riskLevel: string | null;
        hitlRequired: boolean;
        jurisdiction: string | null;
        procedure: string | null;
        residencyZone: string | null;
        filingDate: string | null;
        decisionDate: string | null;
        createdAt: string;
        updatedAt: string;
        metadata: Record<string, unknown>;
        structuredPayload: unknown;
        agentRunId: string | null;
        primaryDocumentId: string | null;
      };
      deadlines: Array<{
        id: string;
        name: string;
        dueAt: string | null;
        ruleReference: string | null;
        notes: string | null;
        metadata: Record<string, unknown>;
      }>;
      documents: Array<{
        id: string;
        documentId: string | null;
        name: string | null;
        storagePath: string | null;
        bucket: string | null;
        mimeType: string | null;
        bytes: number | null;
        residencyZone: string | null;
        role: string | null;
        citeCheckStatus: string | null;
        metadata: Record<string, unknown>;
      }>;
      calendar: string;
      calendarUrl: string | null;
      calendarSettings: CalendarSettings;
      citeCheck: CiteCheckSummary;
    }
  | null
> {
  const matterResult = await supabase
    .from('matters')
    .select(
      'id, org_id, title, description, status, risk_level, hitl_required, jurisdiction_code, procedure, residency_zone, filing_date, decision_date, structured_payload, metadata, created_at, updated_at, agent_run_id, primary_document_id',
    )
    .eq('org_id', options.orgId)
    .eq('id', options.matterId)
    .maybeSingle();

  if (matterResult.error) {
    options.logger.error({ err: matterResult.error, orgId: options.orgId, matterId: options.matterId }, 'matter_detail_query_failed');
    throw new Error('matter_detail_query_failed');
  }

  if (!matterResult.data) {
    return null;
  }

  const matterRow = normaliseMatterRow(matterResult.data as Record<string, unknown>);

  const [deadlinesResult, documentsResult] = await Promise.all([
    supabase
      .from('matter_deadlines')
      .select('id, name, due_at, rule_reference, notes, metadata')
      .eq('matter_id', options.matterId)
      .order('due_at', { ascending: true }),
    supabase
      .from('matter_documents')
      .select(
        'id, role, cite_check_status, metadata, document:documents(id, name, storage_path, bucket_id, mime_type, bytes, residency_zone)',
      )
      .eq('matter_id', options.matterId),
  ]);

  if (deadlinesResult.error) {
    options.logger.warn({ err: deadlinesResult.error, matterId: options.matterId }, 'matter_deadlines_detail_query_failed');
  }

  if (documentsResult.error) {
    options.logger.warn({ err: documentsResult.error, matterId: options.matterId }, 'matter_documents_detail_query_failed');
  }

  const deadlines = (deadlinesResult.data ?? []).map((row) => ({
    id: String(row.id),
    name: typeof row.name === 'string' ? row.name : 'Deadline',
    dueAt: typeof row.due_at === 'string' ? row.due_at : null,
    ruleReference: typeof row.rule_reference === 'string' ? row.rule_reference : null,
    notes: typeof row.notes === 'string' ? row.notes : null,
    metadata:
      row.metadata && typeof row.metadata === 'object' ? (row.metadata as Record<string, unknown>) : ({} as Record<string, unknown>),
  }));

  const documents = (documentsResult.data ?? []).map((row) => {
    const document = (row as Record<string, unknown>).document as Record<string, unknown> | null;
    return {
      id: String(row.id),
      documentId: document && typeof document.id === 'string' ? document.id : null,
      name: document && typeof document.name === 'string' ? document.name : null,
      storagePath: document && typeof document.storage_path === 'string' ? document.storage_path : null,
      bucket: document && typeof document.bucket_id === 'string' ? document.bucket_id : null,
      mimeType: document && typeof document.mime_type === 'string' ? document.mime_type : null,
      bytes: document && typeof document.bytes === 'number' ? document.bytes : null,
      residencyZone: document && typeof document.residency_zone === 'string' ? document.residency_zone : null,
      role: typeof row.role === 'string' ? row.role : null,
      citeCheckStatus: typeof row.cite_check_status === 'string' ? row.cite_check_status : null,
      metadata:
        row.metadata && typeof row.metadata === 'object'
          ? (row.metadata as Record<string, unknown>)
          : ({} as Record<string, unknown>),
    };
  });

  const calendarSettings = extractCalendarSettings(matterRow.metadata);
  const calendarPayload = await persistMatterCalendar({
    orgId: options.orgId,
    matter: {
      id: matterRow.id,
      title: matterRow.title,
      description: matterRow.description,
      jurisdiction_code: matterRow.jurisdiction_code,
      procedure: matterRow.procedure,
    },
    deadlines: deadlines
      .filter((deadline) => Boolean(deadline.dueAt))
      .map((deadline) => ({
        id: deadline.id,
        name: deadline.name,
        due_at: deadline.dueAt!,
        rule_reference: deadline.ruleReference,
        notes: deadline.notes,
      })),
    settings: calendarSettings,
    logger: options.logger,
  });

  const citeCheck = summariseCiteCheckStatus(documents.map((doc) => doc.citeCheckStatus));

  return {
    matter: {
      id: matterRow.id,
      title: matterRow.title,
      description: matterRow.description,
      status: matterRow.status,
      riskLevel: matterRow.risk_level,
      hitlRequired: matterRow.hitl_required ?? false,
      jurisdiction: matterRow.jurisdiction_code,
      procedure: matterRow.procedure,
      residencyZone: matterRow.residency_zone,
      filingDate: matterRow.filing_date,
      decisionDate: matterRow.decision_date,
      createdAt: matterRow.created_at,
      updatedAt: matterRow.updated_at,
      metadata: matterRow.metadata ?? {},
      structuredPayload: matterRow.structured_payload,
      agentRunId: matterRow.agent_run_id,
      primaryDocumentId: matterRow.primary_document_id,
    },
    deadlines,
    documents,
    calendar: calendarPayload.calendar,
    calendarUrl: calendarPayload.signedUrl,
    calendarSettings,
    citeCheck,
  };
}

type MatterRow = {
  id: string;
  org_id: string;
  title: string;
  description: string | null;
  status: string;
  risk_level: string | null;
  hitl_required: boolean | null;
  jurisdiction_code: string | null;
  procedure: string | null;
  residency_zone: string | null;
  filing_date: string | null;
  decision_date: string | null;
  structured_payload: unknown;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  agent_run_id: string | null;
  primary_document_id: string | null;
};

function normaliseMatterRow(row: Record<string, unknown>): MatterRow {
  return {
    id: String(row.id),
    org_id: String(row.org_id),
    title: typeof row.title === 'string' ? row.title : 'Matter',
    description: typeof row.description === 'string' ? row.description : null,
    status: typeof row.status === 'string' ? row.status : 'open',
    risk_level: typeof row.risk_level === 'string' ? row.risk_level : null,
    hitl_required: typeof row.hitl_required === 'boolean' ? row.hitl_required : Boolean(row.hitl_required),
    jurisdiction_code: typeof row.jurisdiction_code === 'string' ? row.jurisdiction_code : null,
    procedure: typeof row.procedure === 'string' ? row.procedure : null,
    residency_zone: typeof row.residency_zone === 'string' ? row.residency_zone : null,
    filing_date: typeof row.filing_date === 'string' ? row.filing_date : null,
    decision_date: typeof row.decision_date === 'string' ? row.decision_date : null,
    structured_payload: row.structured_payload ?? null,
    metadata: (row.metadata && typeof row.metadata === 'object' ? (row.metadata as Record<string, unknown>) : null) ?? {},
    created_at: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : new Date().toISOString(),
    agent_run_id: typeof row.agent_run_id === 'string' ? row.agent_run_id : null,
    primary_document_id: typeof row.primary_document_id === 'string' ? row.primary_document_id : null,
  };
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toNumberRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') {
    return {};
  }
  const record: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const parsed = Number(raw);
    if (!Number.isNaN(parsed)) {
      record[key] = parsed;
    }
  }
  return record;
}

function deriveEliFromUrl(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter((segment) => segment.length > 0);
    const eliIndex = parts.indexOf('eli');
    if (eliIndex >= 0 && eliIndex + 1 < parts.length) {
      return parts.slice(eliIndex + 1).join('/');
    }
    if (parsed.hostname.includes('legisquebec.gouv.qc.ca') && parts.length >= 2) {
      return `legisquebec/${parts.slice(-2).join('/')}`;
    }
    if (parsed.hostname.includes('laws-lois.justice.gc.ca')) {
      return parts.join('/');
    }
  } catch (_error) {
    return null;
  }
  return null;
}

function deriveEcliFromUrl(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }
  if (/ECLI:/i.test(url)) {
    const match = url.match(/ECLI:([A-Z0-9:\-]+)/i);
    return match ? `ECLI:${match[1]}` : null;
  }
  if (/courdecassation\.be\/id\//i.test(url)) {
    const id = url.split('/id/')[1];
    return id ? `ECLI:BE:CSC:${id.toUpperCase()}` : null;
  }
  return null;
}

function minutesBetween(startIso: string | null | undefined, end: Date): number | null {
  if (!startIso) {
    return null;
  }
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) {
    return null;
  }
  const diffMs = end.getTime() - start.getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) {
    return null;
  }
  return diffMs / (1000 * 60);
}

function bucketResolution(minutes: number | null): string | null {
  if (minutes === null || Number.isNaN(minutes)) {
    return null;
  }
  if (minutes <= 30) {
    return 'under_30m';
  }
  if (minutes <= 120) {
    return 'under_2h';
  }
  if (minutes <= 480) {
    return 'under_8h';
  }
  if (minutes <= 1440) {
    return 'under_24h';
  }
  return 'over_24h';
}

function parseEvidenceNotes(value: unknown): Record<string, unknown> | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value === 'string') {
    return { message: value };
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new Error('invalid_notes');
}

async function refreshFriaEvidence(orgId: string, actorId: string): Promise<void> {
  const { data, error } = await supabase
    .from('fria_artifacts')
    .select('release_tag, evidence_url, submitted_by, submitted_at, validated')
    .eq('org_id', orgId)
    .order('submitted_at', { ascending: false });

  if (error) {
    app.log.error({ err: error, orgId }, 'fria artifact fetch failed');
    return;
  }

  const artifacts = (data ?? []).filter((item) => item.validated === true);
  const status = artifacts.length > 0 ? 'satisfied' : 'pending';
  const releases = Array.from(
    new Set(
      artifacts
        .map((item) => item.release_tag)
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
    ),
  );

  const notes: Record<string, unknown> = {
    validatedCount: artifacts.length,
  };
  if (releases.length > 0) {
    notes.releases = releases;
  }

  const evidenceUrl = artifacts[0]?.evidence_url ?? null;
  const recordedBy = artifacts[0]?.submitted_by ?? actorId;
  const recordedAt = artifacts[0]?.submitted_at ?? new Date().toISOString();

  const { error: upsertError } = await supabase.from('go_no_go_evidence').upsert(
    {
      org_id: orgId,
      section: 'A',
      criterion: FRIA_CRITERION,
      status,
      evidence_url: evidenceUrl,
      notes,
      recorded_by: recordedBy,
      recorded_at: recordedAt,
    },
    { onConflict: 'org_id,section,criterion' },
  );

  if (upsertError) {
    app.log.error({ err: upsertError, orgId }, 'fria evidence upsert failed');
  }
}

const extractCountry = (value: unknown): string | null => {
  if (value && typeof value === 'object' && 'country' in (value as Record<string, unknown>)) {
    const country = (value as { country?: unknown }).country;
    return typeof country === 'string' ? country : null;
  }
  return null;
};

function resolveDateRange(startParam?: string, endParam?: string): { start: string; end: string } {
  const now = new Date();
  const end = endParam ? new Date(endParam) : now;
  if (Number.isNaN(end.getTime())) {
    throw new Error('invalid_end_date');
  }
  const defaultStart = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  const start = startParam ? new Date(startParam) : defaultStart;
  if (Number.isNaN(start.getTime())) {
    throw new Error('invalid_start_date');
  }
  if (start.getTime() > end.getTime()) {
    throw new Error('start_after_end');
  }
  const startIso = new Date(start).toISOString();
  const endIso = new Date(end).toISOString();
  return { start: startIso, end: endIso };
}

app.get('/healthz', async () => ({ status: 'ok' }));

// WhatsApp OTP authentication
const whatsappStartSchema = z.object({
  phone_e164: z.string(),
  org_hint: z.string().uuid().optional(),
  captchaToken: z.string().optional(),
});

const whatsappVerifySchema = z.object({
  phone_e164: z.string(),
  otp: z.string().min(4).max(8),
  invite_token: z.string().uuid().optional(),
  org_hint: z.string().uuid().optional(),
});

const whatsappLinkSchema = z.object({
  phone_e164: z.string(),
  otp: z.string().min(4).max(8),
});

async function deleteExistingOtp(phone: string) {
  await supabase.from('wa_otp').delete().eq('phone_e164', phone);
}

app.post<{ Body: z.infer<typeof whatsappStartSchema> }>('/auth/wa/start', async (request, reply) => {
  const parsed = whatsappStartSchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    return reply.code(400).send({ error: 'invalid_body', details: parsed.error.flatten() });
  }

  let phone: string;
  try {
    phone = normalizePhone(parsed.data.phone_e164);
  } catch (error) {
    return reply.code(400).send({ error: (error as Error).message });
  }

  const ipKey = request.ip ?? 'unknown';
  const ipHit = ipRateLimiter.hit(ipKey);
  if (!ipHit.allowed) {
    return reply.code(429).send({ error: 'rate_limited_ip', retry_after: ipHit.resetAt });
  }

  const phoneHit = phoneRateLimiter.hit(phone);
  if (!phoneHit.allowed) {
    return reply.code(429).send({ error: 'rate_limited_phone', retry_after: phoneHit.resetAt });
  }

  const stress = recordOtpStress(phone);
  if (stress.requireCaptcha && !parsed.data.captchaToken) {
    return reply.code(428).send({ error: 'captcha_required' });
  }

  const otp = generateOtp(OTP_POLICY.length);
  const hash = await hashOtp(otp);
  const expiresAt = new Date(Date.now() + OTP_POLICY.ttlMinutes * 60_000);

  try {
    await deleteExistingOtp(phone);
    const { error } = await supabase.from('wa_otp').insert({
      phone_e164: phone,
      otp_hash: hash,
      expires_at: expiresAt.toISOString(),
      attempts: 0,
    });
    if (error) {
      request.log.error({ err: error.message }, 'wa_otp_store_failed');
      return reply.code(500).send({ error: 'otp_store_failed' });
    }
  } catch (error) {
    request.log.error({ err: error }, 'wa_otp_store_failed');
    return reply.code(500).send({ error: 'otp_store_failed' });
  }

  try {
    await whatsappAdapter.sendOtp({ phoneE164: phone, code: otp });
  } catch (error) {
    request.log.error({ err: error }, 'wa_send_failed');
    return reply.code(502).send({ error: 'wa_send_failed' });
  }

  if (parsed.data.org_hint) {
    try {
      await logAuditEvent({
        orgId: parsed.data.org_hint,
        actorId: null,
        kind: 'wa_otp_sent',
        object: phone,
        after: { phone },
      });
    } catch (error) {
      request.log.warn({ err: error }, 'audit_wa_otp_failed');
    }
  }

  return reply.send({ sent: true, expires_at: expiresAt.toISOString(), remaining: phoneHit.remaining });
});

async function consumeOtp(phone: string): Promise<{ id: string; otp_hash: string; expires_at: string; attempts: number } | null> {
  const { data, error } = await supabase
    .from('wa_otp')
    .select('id, otp_hash, expires_at, attempts')
    .eq('phone_e164', phone)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as any;
}

async function incrementOtpAttempts(id: string, attempts: number): Promise<void> {
  await supabase
    .from('wa_otp')
    .update({ attempts })
    .eq('id', id);
}

async function removeOtp(id: string): Promise<void> {
  await supabase
    .from('wa_otp')
    .delete()
    .eq('id', id);
}

async function upsertProfile(userId: string, phone: string): Promise<{ needsProfile: boolean; profile: Record<string, unknown> | null }> {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, full_name, verified, locale, phone_e164, email, professional_type, bar_number')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    const insert = await supabase
      .from('profiles')
      .insert({ user_id: userId, phone_e164: phone, locale: 'fr' })
      .select('user_id, full_name, verified, locale, phone_e164, email, professional_type, bar_number')
      .maybeSingle();
    if (insert.error) {
      throw new Error(insert.error.message);
    }
    return { needsProfile: true, profile: insert.data as Record<string, unknown> };
  }

  if (data.phone_e164 !== phone) {
    await supabase
      .from('profiles')
      .update({ phone_e164: phone })
      .eq('user_id', userId);
  }

  const needsProfile = !data.full_name;
  return { needsProfile, profile: data as Record<string, unknown> };
}

async function listOrgMemberships(userId: string): Promise<Array<{ org_id: string; role: string }>> {
  const { data, error } = await supabase
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', userId);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Array<{ org_id: string; role: string }>;
}

async function ensureMembership(orgId: string, userId: string, role: string): Promise<void> {
  const { error } = await supabase
    .from('org_members')
    .upsert({ org_id: orgId, user_id: userId, role }, { onConflict: 'org_id,user_id' });

  if (error) {
    throw new Error(error.message);
  }
}

app.post<{ Body: z.infer<typeof whatsappVerifySchema> }>('/auth/wa/verify', async (request, reply) => {
  const parsed = whatsappVerifySchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    return reply.code(400).send({ error: 'invalid_body', details: parsed.error.flatten() });
  }

  let phone: string;
  try {
    phone = normalizePhone(parsed.data.phone_e164);
  } catch (error) {
    return reply.code(400).send({ error: (error as Error).message });
  }

  const otpRecord = await consumeOtp(phone);
  if (!otpRecord) {
    return reply.code(400).send({ error: 'otp_not_found' });
  }

  if (new Date(otpRecord.expires_at).getTime() < Date.now()) {
    await removeOtp(otpRecord.id);
    return reply.code(400).send({ error: 'otp_expired' });
  }

  const nextAttempts = otpRecord.attempts + 1;
  if (!(await verifyOtp(parsed.data.otp, otpRecord.otp_hash))) {
    await incrementOtpAttempts(otpRecord.id, nextAttempts);
    if (nextAttempts >= OTP_POLICY.maxAttempts) {
      await removeOtp(otpRecord.id);
      return reply.code(423).send({ error: 'otp_locked' });
    }
    return reply.code(400).send({ error: 'otp_invalid', attempts_remaining: OTP_POLICY.maxAttempts - nextAttempts });
  }

  await removeOtp(otpRecord.id);
  resetOtpStress(phone);

  let waIdentity = null as { wa_id: string; user_id: string | null } | null;
  const existingIdentity = await supabase
    .from('wa_identities')
    .select('wa_id, user_id, phone_e164')
    .eq('phone_e164', phone)
    .maybeSingle();
  if (existingIdentity.error) {
    request.log.error({ err: existingIdentity.error }, 'wa_identity_lookup_failed');
    return reply.code(500).send({ error: 'wa_identity_failed' });
  }
  if (existingIdentity.data) {
    waIdentity = existingIdentity.data as { wa_id: string; user_id: string | null };
  }

  let userId = waIdentity?.user_id ?? null;
  let waId = waIdentity?.wa_id ?? deriveWhatsAppId(phone);
  let isNewUser = false;

  if (!userId) {
    const created = await supabase.auth.admin.createUser({
      phone,
      phone_confirm: true,
      email_confirm: false,
      user_metadata: { locale: 'fr' },
    });
    if (created.error || !created.data?.user) {
      request.log.error({ err: created.error?.message }, 'auth_user_create_failed');
      return reply.code(500).send({ error: 'user_create_failed' });
    }
    userId = created.data.user.id;
    isNewUser = true;

    const { error } = await supabase
      .from('wa_identities')
      .upsert({ wa_id: waId, phone_e164: phone, user_id: userId })
      .eq('wa_id', waId);
    if (error) {
      request.log.error({ err: error }, 'wa_identity_upsert_failed');
      return reply.code(500).send({ error: 'wa_identity_failed' });
    }
  } else {
    waId = waIdentity!.wa_id;
  }

  const profileState = await upsertProfile(userId, phone);
  const memberships = await listOrgMemberships(userId);

  if (!waIdentity?.user_id) {
    const { error } = await supabase
      .from('wa_identities')
      .upsert({ wa_id: waId, phone_e164: phone, user_id: userId }, { onConflict: 'wa_id' });
    if (error) {
      request.log.warn({ err: error }, 'wa_identity_link_failed');
    }
  }

  let inviteAcceptedOrg: string | null = null;

  if (parsed.data.invite_token) {
    const invitation = await supabase
      .from('invitations')
      .select('org_id, role, expires_at, accepted_by')
      .eq('token', parsed.data.invite_token)
      .maybeSingle();
    if (invitation.error) {
      request.log.error({ err: invitation.error }, 'invite_lookup_failed');
      return reply.code(500).send({ error: 'invite_lookup_failed' });
    }
    if (!invitation.data) {
      return reply.code(404).send({ error: 'invite_not_found' });
    }
    if (invitation.data.accepted_by && invitation.data.accepted_by !== userId) {
      return reply.code(409).send({ error: 'invite_already_used' });
    }
    if (new Date(invitation.data.expires_at).getTime() < Date.now()) {
      return reply.code(410).send({ error: 'invite_expired' });
    }

    await ensureMembership(invitation.data.org_id as string, userId, invitation.data.role as string);
    await supabase
      .from('invitations')
      .update({ accepted_by: userId })
      .eq('token', parsed.data.invite_token);
    memberships.push({ org_id: invitation.data.org_id as string, role: invitation.data.role as string });
    inviteAcceptedOrg = invitation.data.org_id as string;

    try {
      await logAuditEvent({
        orgId: invitation.data.org_id as string,
        actorId: userId,
        kind: 'invite.accepted',
        object: parsed.data.invite_token,
        after: { role: invitation.data.role, user_id: userId },
      });
    } catch (error) {
      request.log.warn({ err: error }, 'audit_invite_accept_failed');
    }
  }

  if (parsed.data.org_hint && !memberships.some((m) => m.org_id === parsed.data.org_hint)) {
    try {
      await ensureMembership(parsed.data.org_hint, userId, 'viewer');
      memberships.push({ org_id: parsed.data.org_hint, role: 'viewer' });
    } catch (error) {
      request.log.warn({ err: error }, 'org_hint_membership_failed');
    }
  }

  const jwtToken = signSessionToken({ userId, phone, waId });
  const needsOrg = memberships.length === 0;

  if (memberships.length > 0) {
    const targetOrg = inviteAcceptedOrg ?? memberships[0]?.org_id;
    if (targetOrg) {
      try {
        await logAuditEvent({
          orgId: targetOrg,
          actorId: userId,
          kind: 'wa_login_success',
          object: userId,
          after: { phone },
        });
      } catch (error) {
        request.log.warn({ err: error }, 'audit_wa_login_failed');
      }
    }
  }

  return reply.send({
    login: true,
    user_id: userId,
    session_token: jwtToken,
    wa_id: waId,
    needs_profile: profileState.needsProfile,
    needs_org: needsOrg,
    is_new_user: isNewUser,
    memberships,
  });
});

// Draft generation endpoint: builds content, persists metadata, and stores clause comparisons.
// Body: { orgId, userId?, prompt, title?, jurisdiction?, matterType?, templateId?, fillIns? }
app.post<{
  Body: {
    orgId?: string;
    userId?: string;
    prompt?: string;
    title?: string;
    jurisdiction?: string;
    matterType?: string;
    templateId?: string;
    fillIns?: string[];
    context?: string;
  };
}>('/drafts', async (request, reply) => {
  const body = request.body ?? {};
  const rawOrgId = typeof body.orgId === 'string' ? body.orgId : undefined;
  const headerOrgId = typeof request.headers['x-org-id'] === 'string' ? (request.headers['x-org-id'] as string) : undefined;
  const orgId = rawOrgId && rawOrgId.trim().length > 0 ? rawOrgId : headerOrgId;
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';

  if (!orgId || prompt.length === 0) {
    return reply.code(400).send({ error: 'orgId and prompt are required' });
  }

  const rawUserId = typeof body.userId === 'string' ? body.userId : undefined;
  const headerUserId = typeof request.headers['x-user-id'] === 'string' ? (request.headers['x-user-id'] as string) : undefined;
  const actor = rawUserId && rawUserId.trim().length > 0 ? rawUserId : headerUserId;

  if (!actor) {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  let access: OrgAccessContext;
  try {
    access = await authorizeRequestWithGuards('drafts:create', orgId, actor, request);
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof (error as any).statusCode === 'number') {
      return reply.code((error as any).statusCode).send({ error: (error as Error).message });
    }
    request.log.warn({ err: error, orgId, actor }, 'draft_authorization_failed');
    return reply.code(403).send({ error: 'forbidden' });
  }

  type TemplateRow = {
    id: string;
    title?: string | null;
    sections?: Array<{ heading?: string; body?: string }> | null;
    locale?: string | null;
    jurisdiction_code?: string | null;
    matter_type?: string | null;
    summary?: string | null;
    fill_ins?: unknown;
  } | null;

  let template: TemplateRow = null;
  try {
    let tplQuery = supabase
      .from('pleading_templates')
      .select('id, title, sections, locale, jurisdiction_code, matter_type, summary, fill_ins')
      .or(`org_id.eq.${orgId},org_id.is.null`)
      .limit(1);
    if (body.templateId) {
      tplQuery = tplQuery.eq('id', body.templateId);
    } else {
      if (body.jurisdiction) {
        tplQuery = tplQuery.eq('jurisdiction_code', body.jurisdiction);
      }
      if (body.matterType) {
        tplQuery = tplQuery.eq('matter_type', body.matterType);
      }
    }
    const res = await tplQuery.maybeSingle();
    if (!res.error) {
      template = (res.data as TemplateRow) ?? null;
    } else if (res.error) {
      request.log.warn({ err: res.error, orgId }, 'draft_template_lookup_failed');
    }
  } catch (error) {
    request.log.warn({ err: error, orgId }, 'draft_template_lookup_failed');
  }

  const templateSections = normaliseTemplateSections(template?.sections);
  const fillInList = buildDraftFillIns(template?.fill_ins, body.fillIns);

  const contextPieces: string[] = [];
  if (typeof body.context === 'string' && body.context.trim().length > 0) {
    contextPieces.push(body.context.trim());
  }
  if (typeof template?.summary === 'string' && template.summary.trim().length > 0) {
    contextPieces.push(template.summary.trim());
  }
  if (fillInList.length > 0) {
    contextPieces.push(`Champs à renseigner : ${fillInList.join(', ')}`);
  }

  let agentResult: AgentRunResult;
  try {
    agentResult = await runLegalAgent(
      {
        question: prompt,
        context: contextPieces.length > 0 ? contextPieces.join('\n\n') : undefined,
        orgId,
        userId: actor,
        confidentialMode: access.policies.confidentialMode,
      },
      access,
    );
  } catch (error) {
    request.log.error({ err: error, orgId, actor }, 'draft_agent_run_failed');
    const status = error instanceof Error && 'statusCode' in error && typeof (error as any).statusCode === 'number'
      ? (error as any).statusCode
      : 502;
    return reply.code(status).send({ error: 'draft_generation_failed', message: (error as Error)?.message ?? 'agent_failed' });
  }

  const payload = agentResult.payload;
  const resolvedJurisdiction = (payload?.jurisdiction?.country ?? body.jurisdiction ?? template?.jurisdiction_code ?? 'FR').toUpperCase();
  const resolvedMatterType = body.matterType ?? template?.matter_type ?? 'general';
  const dataset = selectDraftDataset(resolvedJurisdiction);

  const residencyZone = mapJurisdictionToResidency(resolvedJurisdiction);
  const agentCitations = deriveDraftCitationsFromPayload(payload, residencyZone);
  const datasetCitations = dataset.citations.map((citation) => ({
    ...citation,
    residencyZone:
      citation.residencyZone ?? (citation.jurisdiction ? mapJurisdictionToResidency(citation.jurisdiction) : residencyZone),
    binding: citation.binding ?? true,
  }));
  const citations = mergeDraftCitations(agentCitations, datasetCitations);

  const clauseComparisons = buildClauseComparisons(dataset.clauses);
  const generatedAt = new Date();
  const generatedIso = generatedAt.toISOString();
  const draftTitle = body.title ?? template?.title ?? 'Projet de document';

  const markdown = renderDraftMarkdown({
    title: draftTitle,
    prompt,
    generatedAt: generatedIso,
    payload,
    datasetSummary: dataset.summary,
    clauseComparisons,
    fillIns: fillInList,
    templateSections,
    citations,
    plan: agentResult.plan ?? [],
    trustPanel: agentResult.trustPanel ?? null,
    verification: agentResult.verification ?? null,
    compliance: agentResult.compliance ?? null,
  });

  const safeTitle = draftTitle
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
  const name = `${safeTitle || 'draft'}.md`;
  const storagePath = makeStoragePath(orgId, name);
  const bucket = 'uploads';

  const buffer = Buffer.from(markdown, 'utf8');
  const contentSha = createHash('sha256').update(buffer).digest('hex');
  const signature: C2PASignature = signC2PA({ orgId, userId: actor, contentSha256: contentSha, filename: name });

  const uploadResult = await supabase.storage
    .from(bucket)
    .upload(storagePath, new Blob([buffer], { type: 'text/markdown' }), {
      upsert: true,
      contentType: 'text/markdown',
    });
  if (uploadResult.error) {
    request.log.error({ err: uploadResult.error, orgId }, 'draft_upload_failed');
    return reply.code(500).send({ error: 'draft_upload_failed' });
  }

  const documentInsert = await supabase
    .from('documents')
    .insert({
      org_id: orgId,
      source_id: null,
      name,
      storage_path: storagePath,
      bucket_id: bucket,
      mime_type: 'text/markdown',
      bytes: buffer.byteLength,
      vector_store_status: 'pending',
      summary_status: 'pending',
      chunk_count: 0,
      residency_zone: residencyZone,
    })
    .select('id')
    .single();
  if (documentInsert.error || !documentInsert.data) {
    request.log.error({ err: documentInsert.error, orgId }, 'draft_document_insert_failed');
    return reply.code(500).send({ error: 'draft_insert_failed' });
  }

  const documentId = (documentInsert.data as { id: string }).id;

  const exportsMeta: DraftExportRecord[] = [
    {
      format: 'markdown',
      status: 'ready',
      bucket,
      storagePath,
      bytes: buffer.byteLength,
      sha256: contentSha,
      c2pa: {
        keyId: signature.keyId,
        signedAt: signature.signedAt,
        algorithm: signature.algorithm,
        statementId: signature.statementId,
      },
    },
    { format: 'pdf', status: 'pending' },
    { format: 'docx', status: 'pending' },
  ];

  const draftInsert = await supabase
    .from('drafts')
    .insert({
      org_id: orgId,
      document_id: documentId,
      agent_run_id: agentResult.runId,
      created_by: actor,
      prompt,
      title: draftTitle,
      status: agentResult.verification?.status === 'hitl_escalated' ? 'review_required' : 'draft',
      jurisdiction_code: resolvedJurisdiction,
      matter_type: resolvedMatterType,
      body: markdown,
      structured_payload: payload as Record<string, unknown>,
      citations,
      clause_comparisons: clauseComparisons,
      exports: exportsMeta,
      plan: agentResult.plan ?? [],
      trust_panel: agentResult.trustPanel ?? null,
      verification: agentResult.verification ?? null,
      fill_ins: fillInList,
      metadata: {
        templateId: template?.id ?? null,
        datasetKey: resolvedJurisdiction,
        reusedAgentRun: Boolean(agentResult.reused),
      },
      residency_zone: residencyZone,
      content_sha256: contentSha,
      signature_manifest: signature as unknown as Record<string, unknown>,
    })
    .select('id')
    .single();

  if (draftInsert.error || !draftInsert.data) {
    request.log.error({ err: draftInsert.error, orgId }, 'draft_metadata_insert_failed');
    return reply.code(500).send({ error: 'draft_metadata_failed' });
  }

  const draftId = (draftInsert.data as { id: string }).id;

  try {
    await logAuditEvent({
      orgId,
      actorId: actor,
      kind: 'draft.created',
      object: draftId,
      after: {
        documentId,
        agentRunId: agentResult.runId,
        jurisdiction: resolvedJurisdiction,
        matterType: resolvedMatterType,
        exports: exportsMeta.map((entry) => ({ format: entry.format, status: entry.status })),
      },
    });
  } catch (error) {
    request.log.warn({ err: error, orgId, draftId }, 'draft_audit_failed');
  }

  return reply.send({
    draftId,
    documentId,
    agentRunId: agentResult.runId,
    title: draftTitle,
    jurisdiction: resolvedJurisdiction,
    matterType: resolvedMatterType,
    bucket,
    storagePath,
    bytes: buffer.byteLength,
    preview: markdown.slice(0, 400),
    citations,
    clauseComparisons,
    exports: exportsMeta,
    signature,
    contentSha256: contentSha,
    fillIns: fillInList,
    risk: payload.risk,
    verification: agentResult.verification ?? null,
    structuredPayload: payload,
    trustPanel: agentResult.trustPanel ?? null,
    plan: agentResult.plan ?? [],
    reused: Boolean(agentResult.reused),
  });
});

app.get<{
  Querystring: { orgId?: string; documentId?: string };
}>('/drafts/preview', async (request, reply) => {
  const { orgId, documentId } = request.query;
  if (!orgId || !documentId) {
    return reply.code(400).send({ error: 'orgId and documentId are required' });
  }
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('drafts:view', orgId, userHeader, request);
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof (error as any).statusCode === 'number') {
      return reply.code((error as any).statusCode).send({ error: (error as Error).message });
    }
    return reply.code(403).send({ error: 'forbidden' });
  }

  const document = await supabase
    .from('documents')
    .select('id, bucket_id, storage_path, mime_type, bytes, created_at, summary_status, chunk_count')
    .eq('org_id', orgId)
    .eq('id', documentId)
    .maybeSingle();
  if (document.error) {
    request.log.error({ err: document.error }, 'draft_lookup_failed');
    return reply.code(500).send({ error: 'draft_lookup_failed' });
  }
  if (!document.data) {
    return reply.code(404).send({ error: 'draft_not_found' });
  }

  const draftRecordPromise = supabase
    .from('drafts')
    .select(
      'id, title, status, jurisdiction_code, matter_type, citations, clause_comparisons, exports, signature_manifest, content_sha256, fill_ins, structured_payload, plan, trust_panel, verification',
    )
    .eq('org_id', orgId)
    .eq('document_id', documentId)
    .maybeSingle();

  const { data: blob, error: downloadError } = await supabase.storage
    .from(document.data.bucket_id ?? 'uploads')
    .download(document.data.storage_path);
  if (downloadError || !blob) {
    request.log.error({ err: downloadError }, 'draft_download_failed');
    return reply.code(500).send({ error: 'draft_download_failed' });
  }

  const draftRecord = await draftRecordPromise;
  if (draftRecord.error) {
    request.log.error({ err: draftRecord.error }, 'draft_metadata_lookup_failed');
  }

  const text = await blob.text();
  return reply.send({
    documentId,
    draftId: draftRecord.data?.id ?? null,
    title: (draftRecord.data as { title?: string } | null)?.title ?? null,
    jurisdiction: (draftRecord.data as { jurisdiction_code?: string } | null)?.jurisdiction_code ?? null,
    matterType: (draftRecord.data as { matter_type?: string } | null)?.matter_type ?? null,
    content: text,
    mimeType: document.data.mime_type ?? 'text/markdown',
    bytes: document.data.bytes ?? text.length,
    createdAt: document.data.created_at,
    summaryStatus: document.data.summary_status ?? null,
    chunkCount: document.data.chunk_count ?? 0,
    citations: (draftRecord.data as { citations?: unknown } | null)?.citations ?? [],
    clauseComparisons: (draftRecord.data as { clause_comparisons?: unknown } | null)?.clause_comparisons ?? [],
    exports: (draftRecord.data as { exports?: unknown } | null)?.exports ?? [],
    signature: (draftRecord.data as { signature_manifest?: unknown } | null)?.signature_manifest ?? null,
    contentSha256: (draftRecord.data as { content_sha256?: string } | null)?.content_sha256 ?? null,
    status: (draftRecord.data as { status?: string } | null)?.status ?? null,
    fillIns: (draftRecord.data as { fill_ins?: unknown } | null)?.fill_ins ?? [],
    structuredPayload: (draftRecord.data as { structured_payload?: unknown } | null)?.structured_payload ?? null,
    plan: (draftRecord.data as { plan?: unknown } | null)?.plan ?? [],
    trustPanel: (draftRecord.data as { trust_panel?: unknown } | null)?.trust_panel ?? null,
    verification: (draftRecord.data as { verification?: unknown } | null)?.verification ?? null,
  });
});

app.post<{ Body: z.infer<typeof whatsappLinkSchema> }>('/auth/wa/link', async (request, reply) => {
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(401).send({ error: 'unauthorized' });
  }

  const parsed = whatsappLinkSchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    return reply.code(400).send({ error: 'invalid_body', details: parsed.error.flatten() });
  }

  let phone: string;
  try {
    phone = normalizePhone(parsed.data.phone_e164);
  } catch (error) {
    return reply.code(400).send({ error: (error as Error).message });
  }

  const otpRecord = await consumeOtp(phone);
  if (!otpRecord) {
    return reply.code(400).send({ error: 'otp_not_found' });
  }

  if (new Date(otpRecord.expires_at).getTime() < Date.now()) {
    await removeOtp(otpRecord.id);
    return reply.code(400).send({ error: 'otp_expired' });
  }

  const nextAttempts = otpRecord.attempts + 1;
  if (!(await verifyOtp(parsed.data.otp, otpRecord.otp_hash))) {
    await incrementOtpAttempts(otpRecord.id, nextAttempts);
    if (nextAttempts >= OTP_POLICY.maxAttempts) {
      await removeOtp(otpRecord.id);
      return reply.code(423).send({ error: 'otp_locked' });
    }
    return reply.code(400).send({ error: 'otp_invalid' });
  }

  await removeOtp(otpRecord.id);
  resetOtpStress(phone);

  const lookup = await supabase
    .from('wa_identities')
    .select('wa_id, user_id')
    .eq('phone_e164', phone)
    .maybeSingle();
  if (lookup.error) {
    request.log.error({ err: lookup.error }, 'wa_identity_link_lookup_failed');
    return reply.code(500).send({ error: 'wa_identity_failed' });
  }
  if (lookup.data && lookup.data.user_id && lookup.data.user_id !== userHeader) {
    return reply.code(409).send({ error: 'phone_in_use' });
  }

  const waId = lookup.data?.wa_id ?? deriveWhatsAppId(phone);
  const { error: upsertError } = await supabase
    .from('wa_identities')
    .upsert({ wa_id: waId, phone_e164: phone, user_id: userHeader }, { onConflict: 'wa_id' });
  if (upsertError) {
    request.log.error({ err: upsertError }, 'wa_identity_upsert_failed');
    return reply.code(500).send({ error: 'wa_identity_failed' });
  }

  await supabase.from('profiles').update({ phone_e164: phone }).eq('user_id', userHeader);

  const orgId = request.headers['x-org-id'];
  if (typeof orgId === 'string' && orgId) {
    try {
      await logAuditEvent({
        orgId,
        actorId: userHeader,
        kind: 'wa_linked',
        object: waId,
        after: { phone },
      });
    } catch (error) {
      request.log.warn({ err: error }, 'audit_wa_link_failed');
    }
  }

  return reply.send({ linked: true, wa_id: waId });
});

app.post('/auth/wa/unlink', async (request, reply) => {
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(401).send({ error: 'unauthorized' });
  }

  await supabase.from('wa_identities').delete().eq('user_id', userHeader);

  const orgId = request.headers['x-org-id'];
  if (typeof orgId === 'string' && orgId) {
    try {
      await logAuditEvent({
        orgId,
        actorId: userHeader,
        kind: 'wa_unlinked',
        object: userHeader,
      });
    } catch (error) {
      request.log.warn({ err: error }, 'audit_wa_unlink_failed');
    }
  }

  return reply.send({ unlinked: true });
});

app.get('/wa/webhook', async (request, reply) => {
  const token = env.WA_WEBHOOK_VERIFY_TOKEN;
  const challenge = (request.query as Record<string, string>)?.['hub.challenge'];
  const verifyToken = (request.query as Record<string, string>)?.['hub.verify_token'];

  if (!token || verifyToken !== token || !challenge) {
    return reply.code(403).send({ error: 'forbidden' });
  }

  return reply.send(challenge);
});

app.post('/wa/webhook', async (request, reply) => {
  const token = env.WA_WEBHOOK_VERIFY_TOKEN;
  const receivedToken = (request.query as Record<string, string>)?.['hub.verify_token'];
  if (token && receivedToken && token !== receivedToken) {
    return reply.code(403).send({ error: 'forbidden' });
  }

  request.log.info({ body: request.body }, 'wa_webhook_received');
  return reply.send({ ok: true });
});

// Admin: members and invitations
const inviteSchema = z.object({
  email: z.string().email(),
  role: z.string().refine((role) => ORG_ROLES.has(role), { message: 'invalid_role' }),
  expires_in_hours: z.coerce.number().min(1).max(24 * 14).optional(),
});

const memberRoleSchema = z.object({
  role: z.string().refine((role) => ORG_ROLES.has(role), { message: 'invalid_role' }),
});

app.get<{ Querystring: { orgId?: string } }>('/admin/org/members', async (request, reply) => {
  const { orgId } = request.query;
  if (!orgId) return reply.code(400).send({ error: 'orgId is required' });
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('admin:manage', orgId, userHeader, request);
  } catch (error) {
    return reply.code(403).send({ error: 'forbidden' });
  }

  const { data, error } = await supabase
    .from('org_members')
    .select('user_id, role, created_at, profiles(full_name, email, phone_e164, locale, verified)')
    .eq('org_id', orgId)
    .order('created_at', { ascending: true });

  if (error) {
    request.log.error({ err: error }, 'members_list_failed');
    return reply.code(500).send({ error: 'members_list_failed' });
  }

  const members = (data ?? []).map((row) => ({
    user_id: row.user_id,
    role: row.role,
    created_at: row.created_at,
    profile: row.profiles ?? null,
  }));

  return reply.send({ members });
});

app.post<{ Body: z.infer<typeof inviteSchema> }>('/admin/org/invite', async (request, reply) => {
  const orgId = request.headers['x-org-id'];
  if (typeof orgId !== 'string' || orgId.length === 0) {
    return reply.code(400).send({ error: 'x-org-id header is required' });
  }
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  const parsed = inviteSchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    return reply.code(400).send({ error: 'invalid_body', details: parsed.error.flatten() });
  }

  try {
    await authorizeRequestWithGuards('admin:manage', orgId, userHeader, request);
  } catch (error) {
    return reply.code(403).send({ error: 'forbidden' });
  }

  const expires = new Date(Date.now() + (parsed.data.expires_in_hours ?? 72) * 60 * 60 * 1000);
  const { data, error } = await supabase
    .from('invitations')
    .insert({
      org_id: orgId,
      email: parsed.data.email,
      role: parsed.data.role,
      expires_at: expires.toISOString(),
    })
    .select('token, expires_at')
    .maybeSingle();

  if (error || !data) {
    request.log.error({ err: error }, 'invite_create_failed');
    return reply.code(500).send({ error: 'invite_create_failed' });
  }

  try {
    await logAuditEvent({
      orgId,
      actorId: userHeader,
      kind: 'invite.created',
      object: parsed.data.email,
      after: { role: parsed.data.role },
    });
  } catch (auditError) {
    request.log.warn({ err: auditError }, 'audit_invite_failed');
  }

  return reply.code(201).send({ token: data.token, expires_at: data.expires_at });
});

app.post<{ Params: { userId: string }; Body: z.infer<typeof memberRoleSchema> }>('/admin/org/members/:userId/role', async (request, reply) => {
  const orgId = request.headers['x-org-id'];
  if (typeof orgId !== 'string' || orgId.length === 0) {
    return reply.code(400).send({ error: 'x-org-id header is required' });
  }
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  const parsed = memberRoleSchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    return reply.code(400).send({ error: 'invalid_body', details: parsed.error.flatten() });
  }

  try {
    await authorizeRequestWithGuards('admin:manage', orgId, userHeader, request);
  } catch (error) {
    return reply.code(403).send({ error: 'forbidden' });
  }

  const { data, error } = await supabase
    .from('org_members')
    .update({ role: parsed.data.role })
    .eq('org_id', orgId)
    .eq('user_id', request.params.userId)
    .select('user_id, role')
    .maybeSingle();

  if (error) {
    request.log.error({ err: error }, 'member_role_update_failed');
    return reply.code(500).send({ error: 'member_role_update_failed' });
  }
  if (!data) {
    return reply.code(404).send({ error: 'member_not_found' });
  }

  try {
    await logAuditEvent({
      orgId,
      actorId: userHeader,
      kind: 'member.role_changed',
      object: request.params.userId,
      after: { role: parsed.data.role },
    });
  } catch (auditError) {
    request.log.warn({ err: auditError }, 'audit_member_role_failed');
  }

  return reply.send({ updated: true });
});

const jurisdictionSchema = z.array(
  z.object({
    juris_code: z.string().trim().min(1),
    can_read: z.boolean(),
    can_write: z.boolean(),
  }),
);

app.get<{ Querystring: { orgId?: string } }>('/admin/org/jurisdictions', async (request, reply) => {
  const { orgId } = request.query;
  if (!orgId) return reply.code(400).send({ error: 'orgId is required' });
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('admin:manage', orgId, userHeader, request);
  } catch (error) {
    return reply.code(403).send({ error: 'forbidden' });
  }

  const { data, error } = await supabase
    .from('jurisdiction_entitlements')
    .select('juris_code, can_read, can_write')
    .eq('org_id', orgId)
    .order('juris_code', { ascending: true });

  if (error) {
    request.log.error({ err: error }, 'jurisdictions_fetch_failed');
    return reply.code(500).send({ error: 'jurisdictions_fetch_failed' });
  }

  return reply.send({ entitlements: data ?? [] });
});

app.post('/admin/org/jurisdictions', async (request, reply) => {
  const orgId = request.headers['x-org-id'];
  if (typeof orgId !== 'string' || orgId.length === 0) {
    return reply.code(400).send({ error: 'x-org-id header is required' });
  }
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  const parsed = jurisdictionSchema.safeParse(request.body ?? []);
  if (!parsed.success) {
    return reply.code(400).send({ error: 'invalid_body', details: parsed.error.flatten() });
  }

  try {
    await authorizeRequestWithGuards('admin:manage', orgId, userHeader, request);
  } catch (error) {
    return reply.code(403).send({ error: 'forbidden' });
  }

  const rows = parsed.data.map((entry) => ({
    org_id: orgId,
    juris_code: entry.juris_code.toUpperCase(),
    can_read: entry.can_read,
    can_write: entry.can_write,
  }));

  const { error } = await supabase
    .from('jurisdiction_entitlements')
    .upsert(rows, { onConflict: 'org_id,juris_code' });

  if (error) {
    request.log.error({ err: error }, 'jurisdictions_update_failed');
    return reply.code(500).send({ error: 'jurisdictions_update_failed' });
  }

  for (const entry of rows) {
    try {
      await logAuditEvent({
        orgId,
        actorId: userHeader,
        kind: 'jurisdiction.updated',
        object: entry.juris_code,
        after: { can_read: entry.can_read, can_write: entry.can_write },
      });
    } catch (auditError) {
      request.log.warn({ err: auditError }, 'audit_jurisdiction_failed');
    }
  }

  return reply.send({ updated: true });
});

app.get<{ Querystring: { orgId?: string; limit?: string } }>('/admin/audit', async (request, reply) => {
  const { orgId, limit } = request.query;
  if (!orgId) return reply.code(400).send({ error: 'orgId is required' });
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('admin:audit', orgId, userHeader, request);
  } catch (error) {
    return reply.code(403).send({ error: 'forbidden' });
  }

  const max = Math.min(200, Math.max(1, Number(limit ?? 100)));
  const { data, error } = await supabase
    .from('audit_events')
    .select('id, org_id, actor_user_id, kind, object, before_state, after_state, metadata, ts')
    .eq('org_id', orgId)
    .order('ts', { ascending: false })
    .limit(max);

  if (error) {
    request.log.error({ err: error }, 'audit_list_failed');
    return reply.code(500).send({ error: 'audit_list_failed' });
  }

  return reply.send({ events: data ?? [] });
});

const consentSchema = z.object({
  org_id: z.string().uuid().optional(),
  type: z.string().min(1),
  version: z.string().min(1),
});

app.get('/compliance/acknowledgements', async (request, reply) => {
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(401).send({ error: 'unauthorized' });
  }
  const orgHeader = request.headers['x-org-id'];
  if (!orgHeader || typeof orgHeader !== 'string') {
    return reply.code(400).send({ error: 'x-org-id header is required' });
  }

  let access: OrgAccessContext;
  try {
    access = await authorizeRequestWithGuards('workspace:view', orgHeader, userHeader, request);
  } catch (error) {
    const status = (error as Error & { statusCode?: number }).statusCode ?? 403;
    return reply.code(status).send({ error: 'forbidden' });
  }

  try {
    const events = await fetchAcknowledgementEvents(orgHeader, userHeader);
    const acknowledgements = summariseAcknowledgements(access, events);
    return reply.send({
      orgId: orgHeader,
      userId: userHeader,
      acknowledgements,
    });
  } catch (error) {
    request.log.error({ err: error }, 'compliance_ack_fetch_failed');
    return reply.code(500).send({ error: 'compliance_ack_fetch_failed' });
  }
});

app.get<{
  Querystring: { limit?: string };
}>('/compliance/status', async (request, reply) => {
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(401).send({ error: 'unauthorized' });
  }
  const orgHeader = request.headers['x-org-id'];
  if (!orgHeader || typeof orgHeader !== 'string') {
    return reply.code(400).send({ error: 'x-org-id header is required' });
  }

  let access: OrgAccessContext;
  try {
    access = await authorizeRequestWithGuards('workspace:view', orgHeader, userHeader, request);
  } catch (error) {
    const status = (error as Error & { statusCode?: number }).statusCode ?? 403;
    return reply.code(status).send({ error: 'forbidden' });
  }

  const rawLimit = (request.query?.limit ?? '5') as string;
  const parsedLimit = Number(rawLimit);
  const limit = Number.isFinite(parsedLimit) ? Math.min(25, Math.max(1, Math.floor(parsedLimit))) : 5;

  try {
    const [assessmentsResult, events] = await Promise.all([
      supabase
        .from('compliance_assessments')
        .select(
          'run_id, created_at, fria_required, fria_reasons, cepej_passed, cepej_violations, statute_passed, statute_violations, disclosures_missing',
        )
        .eq('org_id', orgHeader)
        .order('created_at', { ascending: false })
        .limit(limit),
      fetchAcknowledgementEvents(orgHeader, userHeader),
    ]);

    if (assessmentsResult.error) {
      request.log.error({ err: assessmentsResult.error }, 'compliance_status_query_failed');
      return reply.code(500).send({ error: 'compliance_status_query_failed' });
    }

    const acknowledgements = summariseAcknowledgements(access, events);

    const history = (assessmentsResult.data ?? []).map((row) => {
      const missing = toStringArray((row as { disclosures_missing?: unknown }).disclosures_missing);
      const assessment: ComplianceAssessment = {
        fria: {
          required: Boolean((row as { fria_required?: boolean | null }).fria_required),
          reasons: toStringArray((row as { fria_reasons?: unknown }).fria_reasons),
        },
        cepej: {
          passed: (row as { cepej_passed?: boolean | null }).cepej_passed ?? true,
          violations: toStringArray((row as { cepej_violations?: unknown }).cepej_violations),
        },
        statute: {
          passed: (row as { statute_passed?: boolean | null }).statute_passed ?? true,
          violations: toStringArray((row as { statute_violations?: unknown }).statute_violations),
        },
        disclosures: {
          consentSatisfied: !missing.includes('consent'),
          councilSatisfied: !missing.includes('council_of_europe'),
          missing,
          requiredConsentVersion: null,
          acknowledgedConsentVersion: null,
          requiredCoeVersion: null,
          acknowledgedCoeVersion: null,
        },
      };

      return {
        runId: (row as { run_id?: string | null }).run_id ?? null,
        createdAt: (row as { created_at?: string | null }).created_at ?? null,
        assessment,
      };
    });

    if (history.length > 0) {
      history[0].assessment = {
        ...history[0].assessment,
        disclosures: mergeDisclosuresWithAcknowledgements(history[0].assessment, acknowledgements),
      };
    }

    const totals = history.reduce(
      (acc, entry) => {
        if (entry.assessment.fria.required) acc.friaRequired += 1;
        if (!entry.assessment.cepej.passed) acc.cepejViolations += 1;
        if (!entry.assessment.statute.passed) acc.statuteViolations += 1;
        if (entry.assessment.disclosures.missing.length > 0) acc.disclosureGaps += 1;
        return acc;
      },
      { total: history.length, friaRequired: 0, cepejViolations: 0, statuteViolations: 0, disclosureGaps: 0 },
    );

    return reply.send({
      orgId: orgHeader,
      userId: userHeader,
      acknowledgements,
      latest: history[0] ?? null,
      history,
      totals,
    });
  } catch (error) {
    request.log.error({ err: error }, 'compliance_status_fetch_failed');
    return reply.code(500).send({ error: 'compliance_status_fetch_failed' });
  }
});

const learningFeedbackSchema = z.object({
  run_id: z.string().uuid(),
  rating: z.enum(['up', 'down']),
  reason_code: z.string().max(64).optional(),
  free_text: z.string().max(500).optional(),
});

app.post<{ Body: z.infer<typeof consentSchema> }>('/consent', async (request, reply) => {
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(401).send({ error: 'unauthorized' });
  }

  const parsed = consentSchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    return reply.code(400).send({ error: 'invalid_body', details: parsed.error.flatten() });
  }

  const insert = await supabase
    .from('consent_events')
    .insert({
      user_id: userHeader,
      org_id: parsed.data.org_id ?? null,
      type: parsed.data.type,
      version: parsed.data.version,
    })
    .select('user_id, org_id, type, version, created_at')
    .maybeSingle();

  if (insert.error || !insert.data) {
    request.log.error({ err: insert.error }, 'consent_write_failed');
    return reply.code(500).send({ error: 'consent_write_failed' });
  }

  return reply.send({ recorded: true, event: insert.data });
});

app.post<{ Body: z.infer<typeof learningFeedbackSchema> }>('/learning/feedback', async (request, reply) => {
  const userHeader = request.headers['x-user-id'];
  const orgHeader = request.headers['x-org-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(401).send({ error: 'unauthorized' });
  }
  if (!orgHeader || typeof orgHeader !== 'string') {
    return reply.code(400).send({ error: 'x-org-id header is required' });
  }

  const parsed = learningFeedbackSchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    return reply.code(400).send({ error: 'invalid_body', details: parsed.error.flatten() });
  }

  try {
    await authorizeRequestWithGuards('workspace:view', orgHeader, userHeader, request);
  } catch (error) {
    return reply.code(403).send({ error: 'forbidden' });
  }

  const payload = {
    org_id: orgHeader,
    run_id: parsed.data.run_id,
    source: 'user',
    kind: parsed.data.rating,
    payload: {
      reason_code: parsed.data.reason_code ?? null,
      free_text: parsed.data.free_text ?? null,
      user_id: userHeader,
    },
  };

  const { error } = await supabase.from('learning_signals').insert(payload, { returning: 'minimal' });
  if (error) {
    request.log.error({ err: error }, 'learning_feedback_failed');
    return reply.code(500).send({ error: 'feedback_failed' });
  }

  return reply.send({ recorded: true });
});

app.get<{ Querystring: { metric?: string; window?: string; limit?: string } }>('/learning/metrics', async (request, reply) => {
  const { metric, window, limit } = request.query;
  const max = Math.min(LEARNING_METRIC_LIMIT, Math.max(1, Number(limit ?? 50)));

  let query = supabase
    .from('learning_metrics')
    .select('id, window, metric, value, dims, computed_at')
    .order('computed_at', { ascending: false })
    .limit(max);

  if (metric) {
    query = query.eq('metric', metric);
  }
  if (window) {
    query = query.eq('window', window);
  }

  const { data, error } = await query;
  if (error) {
    request.log.error({ err: error }, 'learning_metrics_failed');
    return reply.code(500).send({ error: 'learning_metrics_failed' });
  }

  return reply.send({ metrics: data ?? [] });
});

app.get<{ Querystring: { orgId?: string; limit?: string } }>('/learning/signals', async (request, reply) => {
  const { orgId, limit } = request.query;
  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('admin:manage', orgId, userHeader, request);
  } catch (error) {
    return reply.code(403).send({ error: 'forbidden' });
  }

  const max = Math.min(200, Math.max(1, Number(limit ?? 100)));
  const { data, error } = await supabase
    .from('learning_signals')
    .select('id, run_id, source, kind, payload, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(max);

  if (error) {
    request.log.error({ err: error }, 'learning_signals_fetch_failed');
    return reply.code(500).send({ error: 'learning_signals_failed' });
  }

  return reply.send({ signals: data ?? [] });
});

app.get('/launch/collateral', async (_request, reply) => {
  return reply.send(getLaunchCollateral());
});

app.get('/launch/digests', async (_request, reply) => {
  return reply.send({ digests: listRegulatorDigests() });
});

const regulatorDigestSchema = z.object({
  jurisdiction: z.string().min(2),
  channel: z.enum(['email', 'slack', 'teams']),
  frequency: z.enum(['weekly', 'monthly']),
  recipients: z.array(z.string().min(3)).min(1),
  topics: z.array(z.string().min(2)).max(10).optional(),
  sloSnapshots: z
    .array(
      z.object({
        captured_at: z.string().min(4),
        api_uptime_percent: z.number().optional(),
        hitl_response_p95_seconds: z.number().optional(),
        retrieval_latency_p95_seconds: z.number().optional(),
        citation_precision_p95: z.number().nullable().optional(),
        notes: z.string().nullable().optional(),
      }),
    )
    .optional(),
});

const offlineOutboxCreateSchema = z.object({
  orgId: z.string().min(2),
  channel: z.enum(['export', 'filing', 'message']),
  label: z.string().min(2),
  locale: z.string().min(2).max(10).optional(),
  status: z.enum(['queued', 'syncing']).optional(),
  queuedAt: z.string().optional(),
  lastAttemptAt: z.string().optional(),
});

const offlineOutboxUpdateSchema = z.object({
  orgId: z.string().min(2),
  status: z.enum(['queued', 'syncing']),
  lastAttemptAt: z.string().optional(),
});

app.get<{ Querystring: { orgId?: string } }>('/launch/readiness', async (request, reply) => {
  const { orgId } = request.query;
  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }

  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('admin:manage', orgId, userHeader, request);
    return reply.send(buildPhaseEReadiness(orgId));
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'launch readiness failed');
    return reply.code(500).send({ error: 'launch_readiness_failed' });
  }
});

app.get<{ Querystring: { orgId?: string } }>('/launch/offline-outbox', async (request, reply) => {
  const { orgId } = request.query;
  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }

  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('admin:manage', orgId, userHeader, request);
    const items = listOfflineOutboxItems(orgId);
    return reply.send({ items });
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'offline outbox list failed');
    return reply.code(500).send({ error: 'offline_outbox_failed' });
  }
});

app.post<{ Body: z.input<typeof offlineOutboxCreateSchema> }>('/launch/offline-outbox', async (request, reply) => {
  const parsed = offlineOutboxCreateSchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    return reply.code(400).send({ error: 'invalid_payload', details: parsed.error.flatten() });
  }

  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  const { orgId } = parsed.data;

  try {
    await authorizeRequestWithGuards('admin:manage', orgId, userHeader, request);
    const item = enqueueOfflineOutboxItem({
      orgId,
      channel: parsed.data.channel,
      label: parsed.data.label,
      locale: parsed.data.locale ?? null,
      status: parsed.data.status,
      queuedAt: parsed.data.queuedAt,
      lastAttemptAt: parsed.data.lastAttemptAt,
    });
    return reply.code(201).send({ item });
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'offline outbox create failed');
    return reply.code(500).send({ error: 'offline_outbox_failed' });
  }
});

app.patch<{ Params: { itemId: string }; Body: z.input<typeof offlineOutboxUpdateSchema> }>(
  '/launch/offline-outbox/:itemId',
  async (request, reply) => {
    const parsed = offlineOutboxUpdateSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_payload', details: parsed.error.flatten() });
    }

    const userHeader = request.headers['x-user-id'];
    if (!userHeader || typeof userHeader !== 'string') {
      return reply.code(400).send({ error: 'x-user-id header is required' });
    }

    const { orgId, status, lastAttemptAt } = parsed.data;

    try {
      await authorizeRequestWithGuards('admin:manage', orgId, userHeader, request);
      const item = updateOfflineOutboxStatus(orgId, request.params.itemId, status, lastAttemptAt);
      if (!item) {
        return reply.code(404).send({ error: 'offline_outbox_item_not_found' });
      }
      return reply.send({ item });
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
        return reply.code(error.statusCode).send({ error: error.message });
      }
      request.log.error({ err: error }, 'offline outbox update failed');
      return reply.code(500).send({ error: 'offline_outbox_failed' });
    }
  },
);

app.post<{ Body: z.input<typeof regulatorDigestSchema> }>('/launch/digests', async (request, reply) => {
  const parsed = regulatorDigestSchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    return reply.code(400).send({ error: 'invalid_payload', details: parsed.error.flatten() });
  }

  const recipients = parsed.data.recipients.map((recipient) => recipient.trim()).filter(Boolean);
  if (recipients.length === 0) {
    return reply.code(400).send({ error: 'recipients_required' });
  }

  const topics = parsed.data.topics?.map((topic) => topic.trim()).filter(Boolean);
  const sanitizedTopics = topics && topics.length > 0 ? topics : undefined;
  const snapshots = (parsed.data.sloSnapshots ?? []).map((snapshot) => ({
    captured_at: snapshot.captured_at,
    api_uptime_percent: snapshot.api_uptime_percent ?? 0,
    hitl_response_p95_seconds: snapshot.hitl_response_p95_seconds ?? 0,
    retrieval_latency_p95_seconds: snapshot.retrieval_latency_p95_seconds ?? 0,
    citation_precision_p95: snapshot.citation_precision_p95 ?? null,
    notes: snapshot.notes ?? null,
  }));

  const digest = enqueueRegulatorDigest({
    jurisdiction: parsed.data.jurisdiction,
    channel: parsed.data.channel,
    frequency: parsed.data.frequency,
    recipients,
    topics: sanitizedTopics,
    sloSnapshots: snapshots,
  });

  return reply.code(201).send({ digest });
});

// Helpers for upload route
function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function makeStoragePath(orgId: string, name: string): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = pad2(now.getUTCMonth() + 1);
  const safeName = name
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${orgId}/${yyyy}/${mm}/${safeName}`;
}

// JSON upload endpoint (base64 payload)
app.post<{
  Body: {
    orgId?: string;
    userId?: string;
    name?: string;
    mimeType?: string;
    contentBase64?: string;
    bucket?: 'uploads' | 'authorities';
    source?: {
      jurisdiction_code?: string;
      source_type?: string;
      title?: string;
      publisher?: string | null;
      source_url?: string | null;
      binding_lang?: string | null;
      consolidated?: boolean;
      effective_date?: string | null;
    } | null;
  };
}>('/upload', async (request, reply) => {
  const body = request.body ?? {};
  const orgId = body.orgId;
  const userId = body.userId ?? (request.headers['x-user-id'] as string | undefined);
  const bucket = body.bucket ?? 'uploads';
  const name = body.name ?? '';
  const mimeType = body.mimeType ?? 'application/octet-stream';
  const contentBase64 = body.contentBase64 ?? '';

  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }
  if (!userId) {
    return reply.code(400).send({ error: 'x-user-id header or userId is required' });
  }
  if (!name || !contentBase64) {
    return reply.code(400).send({ error: 'name and contentBase64 are required' });
  }

  try {
    await authorizeRequestWithGuards('corpus:manage', orgId, userId, request);
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'upload authorization failed');
    return reply.code(403).send({ error: 'forbidden' });
  }

  // Decode base64
  let buffer: Buffer;
  try {
    const base64 = contentBase64.includes(',') ? contentBase64.split(',').pop() ?? '' : contentBase64;
    buffer = Buffer.from(base64, 'base64');
  } catch (_err) {
    return reply.code(400).send({ error: 'invalid_base64' });
  }

  const storagePath = makeStoragePath(orgId, name);

  const blob = new Blob([buffer], { type: mimeType });
  const upload = await supabase.storage.from(bucket).upload(storagePath, blob, {
    contentType: mimeType,
    upsert: false,
  });
  if (upload.error) {
    request.log.error({ err: upload.error }, 'storage upload failed');
    return reply.code(500).send({ error: 'storage_upload_failed' });
  }

  // Optional source attach for authorities
  let sourceId: string | null = null;
  if (bucket === 'authorities' && body.source && body.source.title && body.source.jurisdiction_code && body.source.source_type) {
    const sourceInsert = await supabase
      .from('sources')
      .insert({
        org_id: orgId,
        jurisdiction_code: body.source.jurisdiction_code,
        source_type: body.source.source_type,
        title: body.source.title,
        publisher: body.source.publisher ?? null,
        source_url: body.source.source_url ?? `https://storage/${bucket}/${storagePath}`,
        binding_lang: body.source.binding_lang ?? null,
        consolidated: Boolean(body.source.consolidated ?? false),
        effective_date: body.source.effective_date ?? null,
      })
      .select('id')
      .single();
    if (!sourceInsert.error) {
      sourceId = sourceInsert.data?.id ?? null;
    } else {
      request.log.warn({ err: sourceInsert.error }, 'source insert failed');
    }
  }

  // Insert document
  const docInsert = await supabase
    .from('documents')
    .insert({
      org_id: orgId,
      source_id: sourceId,
      name,
      storage_path: storagePath,
      bucket_id: bucket,
      mime_type: mimeType,
      bytes: buffer.byteLength,
      vector_store_status: 'pending',
      summary_status: 'pending',
      chunk_count: 0,
    })
    .select('id')
    .single();
  if (docInsert.error) {
    request.log.error({ err: docInsert.error }, 'document insert failed');
    return reply.code(500).send({ error: 'document_insert_failed' });
  }
  const documentId = docInsert.data?.id as string;

  // Best-effort summarisation/embeddings
  let summaryStatus: 'ready' | 'skipped' | 'failed' = 'failed';
  let chunkCount = 0;
  try {
    const metaTitle = body.source?.title ?? name;
    const metaJurisdiction = body.source?.jurisdiction_code ?? 'UNKNOWN';
    const metaPublisher = body.source?.publisher ?? null;
    const result = await summariseDocumentFromPayload({
      payload: new Uint8Array(buffer),
      mimeType,
      openaiApiKey: env.OPENAI_API_KEY,
      metadata: { title: metaTitle, jurisdiction: metaJurisdiction, publisher: metaPublisher },
      summariserModel: env.SUMMARISER_MODEL,
      embeddingModel: env.EMBEDDING_MODEL,
      maxSummaryChars: env.MAX_SUMMARY_CHARS,
    });
    summaryStatus = result.status;
    chunkCount = Array.isArray(result.chunks) ? result.chunks.length : 0;

    if (result.status !== 'failed') {
      await supabase
        .from('document_summaries')
        .upsert({ org_id: orgId, document_id: documentId, summary: result.summary ?? null, outline: result.highlights ?? null }, { onConflict: 'document_id' });
    }
    if (result.embeddings && result.embeddings.length === result.chunks.length && result.chunks.length > 0) {
      const rows = result.chunks.map((chunk, idx) => ({
        org_id: orgId,
        document_id: documentId,
        jurisdiction_code: body.source?.jurisdiction_code ?? 'UNKNOWN',
        content: chunk.content,
        embedding: result.embeddings[idx],
        seq: chunk.seq,
      }));
      const batchSize = 100;
      for (let i = 0; i < rows.length; i += batchSize) {
        const slice = rows.slice(i, i + batchSize);
        const { error } = await supabase.from('document_chunks').insert(slice);
        if (error) {
          request.log.warn({ err: error }, 'chunk insert failed');
          break;
        }
      }
    }
  } catch (error) {
    request.log.warn({ err: error }, 'summarisation/embedding failed');
  }
  const { error: docUpdateError } = await supabase
    .from('documents')
    .update({ summary_status: summaryStatus, chunk_count: chunkCount })
    .eq('id', documentId)
    .eq('org_id', orgId);
  if (docUpdateError) {
    request.log.warn({ err: docUpdateError }, 'document status update failed');
  }

  // Enqueue to OpenAI Vector Store (best-effort)
  try {
    const vectorStoreId = process.env.OPENAI_VECTOR_STORE_AUTHORITIES_ID;
    if (vectorStoreId) {
      const form = new FormData();
      form.append('purpose', 'assistants');
      const dataBlob = new Blob([buffer], { type: mimeType });
      form.append('file', dataBlob, name);
      const fileRes = await fetch('https://api.openai.com/v1/files', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
        body: form,
      });
      const fileJson = (await fileRes.json()) as { id?: string; error?: { message?: string } };
      if (fileRes.ok && fileJson.id) {
        const attachRes = await fetch(`https://api.openai.com/v1/vector_stores/${encodeURIComponent(vectorStoreId)}/files`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.OPENAI_API_KEY}` },
          body: JSON.stringify({ file_id: fileJson.id }),
        });
        if (attachRes.ok) {
          await supabase
            .from('documents')
            .update({ vector_store_status: 'uploaded', vector_store_synced_at: new Date().toISOString() })
            .eq('id', documentId)
            .eq('org_id', orgId);
        } else {
          const attJson = await attachRes.json();
          request.log.warn({ err: attJson?.error?.message ?? 'attach_failed' }, 'vector store attach failed');
        }
      } else {
        request.log.warn({ err: fileJson?.error?.message ?? 'file_upload_failed' }, 'vector store file upload failed');
      }
    }
  } catch (error) {
    request.log.warn({ err: error }, 'vector store enqueue failed');
  }

  return {
    documentId,
    bucket,
    storagePath,
    bytes: buffer.byteLength,
    summaryStatus,
    chunkCount,
  };
});

// Proxy to Supabase Edge Function: drive-watcher
// Accepts: { orgId, manifestName?, manifestUrl?, manifestContent?, entries? }
app.post<{
  Body: {
    orgId?: string;
    manifestName?: string;
    manifestUrl?: string;
    manifestContent?: string;
    entries?: unknown[];
  };
}>('/gdrive/process-manifest', async (request, reply) => {
  const { orgId, manifestName, manifestUrl, manifestContent, entries } = request.body ?? {};
  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('corpus:manage', orgId, userHeader, request);
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'gdrive auth failed');
    return reply.code(403).send({ error: 'forbidden' });
  }

  const fnBase = env.SUPABASE_URL?.replace(/\/?$/, '') ?? '';
  const fnKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!fnBase || !fnKey) {
    return reply.code(500).send({ error: 'supabase_env_missing' });
  }
  const endpoint = `${fnBase}/functions/v1/drive-watcher`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${fnKey}` },
    body: JSON.stringify({ orgId, manifestName, manifestUrl, manifestContent, entries }),
  });
  const json = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (_e) {
    parsed = { raw: json };
  }
  if (!res.ok) {
    request.log.error({ status: res.status, body: parsed }, 'drive-watcher call failed');
    return reply.code(502).send({ error: 'drive_watcher_failed', status: res.status, payload: parsed });
  }
  return parsed;
});

// GDrive state endpoints (install/renew/uninstall/get)
app.get<{ Querystring: { orgId?: string } }>('/gdrive/state', async (request, reply) => {
  const { orgId } = request.query;
  if (!orgId) return reply.code(400).send({ error: 'orgId is required' });
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') return reply.code(400).send({ error: 'x-user-id header is required' });
  try {
    await authorizeRequestWithGuards('corpus:view', orgId, userHeader, request);
  } catch (error) {
    return reply.code(403).send({ error: 'forbidden' });
  }
  const { data, error } = await supabase.from('gdrive_state').select('*').eq('org_id', orgId).maybeSingle();
  if (error) return reply.code(500).send({ error: 'state_failed' });
  return { state: data ?? null };
});

app.post<{
  Body: { orgId?: string; driveId?: string | null; folderId?: string | null };
}>('/gdrive/install', async (request, reply) => {
  const { orgId, driveId, folderId } = request.body ?? {};
  if (!orgId) return reply.code(400).send({ error: 'orgId is required' });
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') return reply.code(400).send({ error: 'x-user-id header is required' });
  try {
    await authorizeRequestWithGuards('corpus:manage', orgId, userHeader, request);
  } catch (error) {
    return reply.code(403).send({ error: 'forbidden' });
  }
  let startPageToken: string | null = null;
  let expiration = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  // Try real Google API if credentials present
  let channelId: string | null = null;
  let resourceId: string | null = null;
  try {
    const saEmail = process.env.GDRIVE_SERVICE_ACCOUNT_EMAIL ?? '';
    const saKey = process.env.GDRIVE_SERVICE_ACCOUNT_KEY ?? '';
    if (saEmail && saKey) {
      const access = await getServiceAccountAccessToken(saEmail, saKey);
      startPageToken = await gdriveGetStartPageToken(access, driveId ?? undefined);
      const address = process.env.GDRIVE_WEBHOOK_URL ?? '';
      const token = process.env.GDRIVE_WATCH_CHANNEL_TOKEN ?? '';
      if (address && startPageToken) {
        const watch = await (await import('./gdrive.js')).watchChanges(access, startPageToken, address, token);
        channelId = watch.id;
        resourceId = watch.resourceId;
        expiration = watch.expiration ?? expiration;
      }
    }
  } catch (error) {
    request.log.warn({ err: error }, 'gdrive install: watch/startPageToken failed, falling back');
  }
  const { data, error } = await supabase
    .from('gdrive_state')
    .upsert(
      {
        org_id: orgId,
        drive_id: driveId ?? null,
        folder_id: folderId ?? null,
        channel_id: channelId ?? 'manual',
        resource_id: resourceId ?? null,
        expiration,
        start_page_token: startPageToken,
        last_page_token: null,
      },
      { onConflict: 'org_id' },
    )
    .select('*')
    .maybeSingle();
  if (error) return reply.code(500).send({ error: 'install_failed' });
  return { state: data };
});

app.post<{
  Body: { orgId?: string };
}>('/gdrive/renew', async (request, reply) => {
  const { orgId } = request.body ?? {};
  if (!orgId) return reply.code(400).send({ error: 'orgId is required' });
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') return reply.code(400).send({ error: 'x-user-id header is required' });
  try {
    await authorizeRequestWithGuards('corpus:manage', orgId, userHeader, request);
  } catch (error) {
    return reply.code(403).send({ error: 'forbidden' });
  }
  const expiration = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('gdrive_state')
    .update({ expiration })
    .eq('org_id', orgId)
    .select('*')
    .maybeSingle();
  if (error) return reply.code(500).send({ error: 'renew_failed' });
  return { state: data };
});

app.post<{
  Body: { orgId?: string };
}>('/gdrive/uninstall', async (request, reply) => {
  const { orgId } = request.body ?? {};
  if (!orgId) return reply.code(400).send({ error: 'orgId is required' });
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') return reply.code(400).send({ error: 'x-user-id header is required' });
  try {
    await authorizeRequestWithGuards('corpus:manage', orgId, userHeader, request);
  } catch (error) {
    return reply.code(403).send({ error: 'forbidden' });
  }
  const { error } = await supabase.from('gdrive_state').delete().eq('org_id', orgId);
  if (error) return reply.code(500).send({ error: 'uninstall_failed' });
  return { ok: true };
});

// Webhook endpoint: logs and acknowledges; validate token if provided
app.post('/gdrive/webhook', async (request, reply) => {
  const channelToken = request.headers['x-goog-channel-token'];
  const configurationToken = process.env.GDRIVE_WATCH_CHANNEL_TOKEN ?? '';
  if (!channelToken || channelToken !== configurationToken) {
    return reply.code(401).send({ error: 'invalid_channel_token' });
  }
  // Optionally log an ingestion run stub
  await supabase.from('ingestion_runs').insert({
    adapter_id: 'gdrive-webhook',
    org_id: null,
    status: 'completed',
    inserted_count: 0,
    skipped_count: 0,
    failed_count: 0,
    finished_at: new Date().toISOString(),
  });
  return { ack: true };
});

app.post<{
  Body: { orgId?: string; pageToken?: string | null };
}>('/gdrive/process-changes', async (request, reply) => {
  const { orgId, pageToken } = request.body ?? {};
  if (!orgId) return reply.code(400).send({ error: 'orgId is required' });
  const userHeader = request.headers['x-user-id'];
  const authHeader = request.headers['authorization'];
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const isInternal = typeof authHeader === 'string' && authHeader.trim().toLowerCase() === `bearer ${serviceKey}`.toLowerCase();
  if (!isInternal) {
    if (!userHeader || typeof userHeader !== 'string') return reply.code(400).send({ error: 'x-user-id header is required' });
    try {
      await authorizeRequestWithGuards('corpus:manage', orgId, userHeader, request);
    } catch (error) {
      return reply.code(403).send({ error: 'forbidden' });
    }
  }
  // Resolve state
  const stateRow = await supabase.from('gdrive_state').select('*').eq('org_id', orgId).maybeSingle();
  if (stateRow.error) {
    request.log.error({ err: stateRow.error }, 'gdrive state fetch failed');
    return reply.code(500).send({ error: 'state_failed' });
  }
  const state = stateRow.data as { drive_id?: string | null; folder_id?: string | null; start_page_token?: string | null; last_page_token?: string | null } | null;
  const tokenToUse = pageToken ?? state?.last_page_token ?? state?.start_page_token ?? null;
  if (!tokenToUse) {
    return { processed: 0, next_page_token: null };
  }

  // Acquire SA access token
  let accessToken: string | null = null;
  try {
    const saEmail = process.env.GDRIVE_SERVICE_ACCOUNT_EMAIL ?? '';
    const saKey = process.env.GDRIVE_SERVICE_ACCOUNT_KEY ?? '';
    if (saEmail && saKey) {
      accessToken = await getServiceAccountAccessToken(saEmail, saKey);
    }
  } catch (error) {
    request.log.warn({ err: error }, 'gdrive auth failed');
  }
  if (!accessToken) {
    // fallback: set last_page_token and return
    await supabase.from('gdrive_state').update({ last_page_token: tokenToUse }).eq('org_id', orgId);
    await supabase.from('ingestion_runs').insert({ adapter_id: 'gdrive-changes', org_id: orgId, status: 'completed', inserted_count: 0, skipped_count: 0, failed_count: 0, finished_at: new Date().toISOString() });
    return { processed: 0, next_page_token: tokenToUse };
  }

  // List changes and ingest a small batch
  let newToken: string | null = null;
  let processed = 0;
  let failed = 0;
  try {
    const { changes, newStartPageToken, nextPageToken } = await gdriveListChanges(accessToken, tokenToUse, 25);
    newToken = nextPageToken ?? newStartPageToken ?? tokenToUse;
    const targetFolder = state?.folder_id ?? null;
    for (const change of changes) {
      if (change.removed) continue;
      const fid = change.fileId || change.file?.id;
      if (!fid) continue;
      const meta = change.file ?? (await gdriveGetFileMetadata(accessToken, fid));
      if (!meta?.id) continue;
      // Filter by folder if provided
      if (targetFolder && Array.isArray(meta.parents) && !meta.parents.includes(targetFolder)) {
        continue;
      }
      const docType = meta.mimeType ? isGoogleDocMime(meta.mimeType) : null;
      let payload: Uint8Array | null = null;
      let mime: string = meta.mimeType ?? 'application/octet-stream';
      if (docType) {
        const exported = await gdriveExportDoc(accessToken, meta.id!, docType);
        if (exported) {
          payload = exported.data;
          mime = exported.mimeType;
        }
      } else {
        const bin = await gdriveDownloadFile(accessToken, meta.id!);
        if (bin) {
          payload = bin.data;
          mime = bin.mimeType;
        }
      }
      if (!payload) continue;

      // Store in Storage (snapshots bucket)
      const storagePath = makeStoragePath(orgId, meta.name || `${meta.id}`);
      const blob = new Blob([payload], { type: mime });
      const up = await supabase.storage.from('snapshots').upload(storagePath, blob, { contentType: mime, upsert: true });
      if (up.error) {
        failed += 1;
        continue;
      }
      // Insert document
      const docIns = await supabase
        .from('documents')
        .upsert(
          {
            org_id: orgId,
            source_id: null,
            name: meta.name || meta.id || 'file',
            storage_path: storagePath,
            bucket_id: 'snapshots',
            mime_type: mime,
            bytes: payload.byteLength,
            vector_store_status: 'pending',
            summary_status: 'pending',
          },
          { onConflict: 'org_id,bucket_id,storage_path' },
        )
        .select('id')
        .maybeSingle();
      if (docIns.error) {
        failed += 1;
        continue;
      }
      const documentId = (docIns.data as { id?: string } | null)?.id ?? null;
      // Summarise (best-effort)
      try {
        const result = await summariseDocumentFromPayload({
          payload,
          mimeType: mime,
          openaiApiKey: env.OPENAI_API_KEY,
          metadata: { title: meta.name || 'Document', jurisdiction: 'UNKNOWN', publisher: null },
          summariserModel: env.SUMMARISER_MODEL,
          embeddingModel: env.EMBEDDING_MODEL,
          maxSummaryChars: env.MAX_SUMMARY_CHARS,
        });
        if (documentId) {
          await supabase
            .from('document_summaries')
            .upsert({ org_id: orgId, document_id: documentId, summary: result.summary ?? null, outline: result.highlights ?? null }, { onConflict: 'document_id' });
          const { error: updErr } = await supabase
            .from('documents')
            .update({ summary_status: result.status, chunk_count: (result.chunks ?? []).length })
            .eq('id', documentId)
            .eq('org_id', orgId);
          if (updErr) request.log.warn({ err: updErr }, 'gdrive doc update failed');
          if (result.embeddings && result.embeddings.length === result.chunks.length && result.chunks.length > 0) {
            const rows = result.chunks.map((chunk, idx) => ({ org_id: orgId, document_id: documentId, jurisdiction_code: 'UNKNOWN', content: chunk.content, embedding: result.embeddings[idx], seq: chunk.seq }));
            const batchSize = 100;
            for (let i = 0; i < rows.length; i += batchSize) {
              const slice = rows.slice(i, i + batchSize);
              const { error } = await supabase.from('document_chunks').insert(slice);
              if (error) break;
            }
          }
        }
        processed += 1;
      } catch (e) {
        failed += 1;
        request.log.warn({ err: e }, 'gdrive summarise failed');
      }
    }
  } catch (error) {
    request.log.error({ err: error }, 'gdrive process-changes failed');
  }

  // Persist last token
  if (newToken) {
    await supabase.from('gdrive_state').update({ last_page_token: newToken }).eq('org_id', orgId);
  }
  await supabase.from('ingestion_runs').insert({
    adapter_id: 'gdrive-changes',
    org_id: orgId,
    status: failed === 0 ? 'completed' : 'completed_with_errors',
    inserted_count: processed,
    skipped_count: 0,
    failed_count: failed,
    finished_at: new Date().toISOString(),
  });
  return { processed, next_page_token: newToken ?? tokenToUse };
});

// Process changes for all orgs with GDrive state (internal, service role only)
app.post('/gdrive/process-all', async (request, reply) => {
  const authHeader = request.headers['authorization'];
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!(typeof authHeader === 'string' && authHeader.trim().toLowerCase() === `bearer ${serviceKey}`.toLowerCase())) {
    return reply.code(401).send({ error: 'unauthorized' });
  }
  const { data, error } = await supabase.from('gdrive_state').select('org_id, last_page_token');
  if (error) return reply.code(500).send({ error: 'state_failed' });
  const results: Array<{ orgId: string; processed: number; nextPageToken: string | null }> = [];
  if (Array.isArray(data)) {
    for (const row of data) {
      const orgId = (row as any).org_id as string;
      try {
        const res = await fetch(`${env.SUPABASE_URL?.replace(/\/?$/, '') ?? ''}/gdrive/process-changes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({ orgId }),
        });
        const json = (await res.json()) as { processed?: number; next_page_token?: string | null };
        results.push({ orgId, processed: json.processed ?? 0, nextPageToken: json.next_page_token ?? null });
      } catch (error) {
        request.log.warn({ err: error }, 'process-all org failed');
      }
    }
  }
  return { results };
});

// Backfill changes for a single org (batched)
app.post<{
  Body: { orgId?: string; batches?: number };
}>('/gdrive/backfill', async (request, reply) => {
  const { orgId, batches } = request.body ?? {};
  if (!orgId) return reply.code(400).send({ error: 'orgId is required' });
  const authHeader = request.headers['authorization'];
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const isInternal = typeof authHeader === 'string' && authHeader.trim().toLowerCase() === `bearer ${serviceKey}`.toLowerCase();
  const userHeader = request.headers['x-user-id'];
  if (!isInternal) {
    if (!userHeader || typeof userHeader !== 'string') return reply.code(400).send({ error: 'x-user-id header is required' });
    try {
      await authorizeRequestWithGuards('corpus:manage', orgId, userHeader, request);
    } catch (error) {
      return reply.code(403).send({ error: 'forbidden' });
    }
  }
  let processedTotal = 0;
  let nextToken: string | null = null;
  const loops = Math.max(1, Math.min(batches ?? 5, 20));
  for (let i = 0; i < loops; i++) {
    const res = await fetch(`${env.SUPABASE_URL?.replace(/\/?$/, '') ?? ''}/gdrive/process-changes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
        ...(isInternal ? {} : { 'x-user-id': String(userHeader) }),
      },
      body: JSON.stringify({ orgId, pageToken: nextToken ?? null }),
    });
    const json = (await res.json()) as { processed?: number; next_page_token?: string | null };
    processedTotal += json.processed ?? 0;
    nextToken = json.next_page_token ?? nextToken;
  }
  return { processed: processedTotal, next_page_token: nextToken };
});


app.post<{
  Body: {
    question: string;
    context?: string;
    orgId?: string;
    userId?: string;
    confidentialMode?: boolean;
    agentCode?: string;
    agentSettings?: Record<string, unknown> | null;
  };
}>('/runs', async (request, reply) => {
  const { question, context, orgId, userId, confidentialMode, agentCode, agentSettings } = request.body;

  if (!question) {
    return reply.code(400).send({ error: 'question is required' });
  }

  if (!orgId || !userId) {
    return reply.code(400).send({ error: 'orgId and userId are required' });
  }

  try {
    const access = await authorizeRequestWithGuards('runs:execute', orgId, userId, request);
    const effectiveConfidential = access.policies.confidentialMode || Boolean(confidentialMode);
    const normalizedAgentSettings =
      agentSettings && typeof agentSettings === 'object' && !Array.isArray(agentSettings)
        ? (agentSettings as Record<string, unknown>)
        : undefined;
    const result = await runLegalAgent(
      {
        question,
        context,
        orgId,
        userId,
        confidentialMode: effectiveConfidential,
        agentCode,
        agentSettings: normalizedAgentSettings ?? null,
      },
      access,
    );
    return {
      runId: result.runId,
      data: result.payload,
      toolLogs: result.toolLogs,
      plan: result.plan ?? [],
      notices: result.notices ?? [],
      reused: Boolean(result.reused),
      verification: result.verification ?? null,
      trustPanel: result.trustPanel ?? null,
      compliance: result.compliance ?? null,
      agent: result.agent,
    };
  } catch (error) {
    request.log.error({ err: error }, 'agent execution failed');
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    return reply.code(502).send({
      error: 'agent_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.get<{
  Querystring: { orgId?: string; adapterId?: string; reason?: string };
}>('/ingestion/quarantine', async (request, reply) => {
  const { orgId, adapterId, reason } = request.query;
  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('corpus:manage', orgId, userHeader, request);
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'quarantine authorization failed');
    return reply.code(403).send({ error: 'forbidden' });
  }

  let query = supabase
    .from('ingestion_quarantine')
    .select('id, adapter_id, source_url, canonical_url, reason, metadata, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (adapterId) {
    query = query.eq('adapter_id', adapterId);
  }
  if (reason) {
    query = query.eq('reason', reason);
  }

  const { data, error } = await query;
  if (error) {
    request.log.error({ err: error }, 'quarantine query failed');
    return reply.code(500).send({ error: 'quarantine_fetch_failed' });
  }

  const entries = (data ?? []).map((row) => ({
    id: row.id as string,
    adapterId: row.adapter_id as string,
    sourceUrl: row.source_url as string,
    canonicalUrl: (row.canonical_url as string | null | undefined) ?? null,
    reason: row.reason as string,
    metadata: (row.metadata as Record<string, unknown> | null | undefined) ?? null,
    createdAt: row.created_at as string,
  }));

  return reply.send({ entries });
});

app.delete<{
  Params: { entryId: string };
  Querystring: { orgId?: string };
}>('/ingestion/quarantine/:entryId', async (request, reply) => {
  const { entryId } = request.params;
  const { orgId } = request.query;
  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('corpus:manage', orgId, userHeader, request);
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'quarantine delete authorization failed');
    return reply.code(403).send({ error: 'forbidden' });
  }

  const { data, error } = await supabase
    .from('ingestion_quarantine')
    .delete()
    .eq('org_id', orgId)
    .eq('id', entryId)
    .select('id')
    .maybeSingle();

  if (error) {
    request.log.error({ err: error }, 'quarantine delete failed');
    return reply.code(500).send({ error: 'quarantine_delete_failed' });
  }

  if (!data) {
    return reply.code(404).send({ error: 'quarantine_entry_not_found' });
  }

  return reply.send({ deleted: entryId });
});

app.get<{
  Querystring: { orgId?: string };
}>('/ingestion/quarantine/summary', async (request, reply) => {
  const { orgId } = request.query;
  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('corpus:manage', orgId, userHeader, request);
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'quarantine summary authorization failed');
    return reply.code(403).send({ error: 'forbidden' });
  }

  const { data, error } = await supabase
    .from('ingestion_quarantine')
    .select('reason, adapter_id')
    .eq('org_id', orgId);

  if (error) {
    request.log.error({ err: error }, 'quarantine summary query failed');
    return reply.code(500).send({ error: 'quarantine_summary_failed' });
  }

  const summary: Record<string, Record<string, number>> = {};
  for (const row of data ?? []) {
    const adapter = typeof row.adapter_id === 'string' ? row.adapter_id : 'unknown';
    const reason = typeof row.reason === 'string' ? row.reason : 'unknown';
    if (!summary[adapter]) {
      summary[adapter] = {};
    }
    summary[adapter][reason] = (summary[adapter][reason] ?? 0) + 1;
  }

  const adapters = Object.entries(summary).map(([adapter, reasonCounts]) => ({
    adapterId: adapter,
    reasons: Object.entries(reasonCounts).map(([reason, count]) => ({ reason, count })),
  }));

  return reply.send({ adapters });
});

app.get<{ Querystring: { orgId?: string } }>('/ingestion/runs', async (request, reply) => {
  const { orgId } = request.query;
  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('corpus:manage', orgId, userHeader, request);
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'ingestion runs authorization failed');
    return reply.code(403).send({ error: 'forbidden' });
  }

  const { data, error } = await supabase
    .from('ingestion_runs')
    .select('id, adapter_id, status, inserted_count, failed_count, skipped_count, finished_at, error_message')
    .eq('org_id', orgId)
    .order('finished_at', { ascending: false })
    .limit(50);

  if (error) {
    request.log.error({ err: error }, 'ingestion runs query failed');
    return reply.code(500).send({ error: 'ingestion_runs_failed' });
  }

  const runs = (data ?? []).map((row) => ({
    id: row.id as string,
    adapterId: row.adapter_id as string,
    status: row.status as string,
    inserted: typeof row.inserted_count === 'number' ? row.inserted_count : 0,
    failed: typeof row.failed_count === 'number' ? row.failed_count : 0,
    skipped: typeof row.skipped_count === 'number' ? row.skipped_count : 0,
    finishedAt: (row.finished_at as string | null) ?? null,
    errorMessage: (row.error_message as string | null) ?? null,
  }));

  return reply.send({ runs });
});

app.get<{ Querystring: { orgId?: string } }>('/metrics/governance', async (request, reply) => {
  const { orgId } = request.query;

  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }

  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('metrics:view', orgId, userHeader, request);
    const [overviewResult, toolResult, provenanceResult, identifierResult, jurisdictionResult] = await Promise.all([
      supabase.from('org_metrics').select('*').eq('org_id', orgId).limit(1).maybeSingle(),
      supabase
        .from('tool_performance_metrics')
        .select('tool_name, total_invocations, success_count, failure_count, avg_latency_ms, p95_latency_ms, last_invoked_at')
        .eq('org_id', orgId)
        .order('tool_name', { ascending: true }),
      supabase.from('org_provenance_metrics').select('*').eq('org_id', orgId).limit(1).maybeSingle(),
      supabase
        .from('jurisdiction_identifier_coverage')
        .select('jurisdiction_code, sources_total, sources_with_eli, sources_with_ecli, sources_with_akoma, akoma_article_count')
        .eq('org_id', orgId)
        .order('jurisdiction_code', { ascending: true }),
      supabase
        .from('org_jurisdiction_provenance')
        .select(
          'jurisdiction_code, residency_zone, total_sources, sources_consolidated, sources_with_binding, sources_with_language_note, sources_with_eli, sources_with_ecli, sources_with_akoma, binding_breakdown, source_type_breakdown, language_note_breakdown',
        )
        .eq('org_id', orgId)
        .order('jurisdiction_code', { ascending: true }),
    ]);

    if (overviewResult.error) {
      request.log.error({ err: overviewResult.error }, 'org metrics query failed');
      return reply.code(500).send({ error: 'metrics_overview_failed' });
    }

    if (toolResult.error) {
      request.log.error({ err: toolResult.error }, 'tool metrics query failed');
      return reply.code(500).send({ error: 'metrics_tool_failed' });
    }

    if (provenanceResult.error) {
      request.log.error({ err: provenanceResult.error }, 'provenance metrics query failed');
      return reply.code(500).send({ error: 'metrics_provenance_failed' });
    }

    if (identifierResult.error) {
      request.log.error({ err: identifierResult.error }, 'identifier coverage query failed');
      return reply.code(500).send({ error: 'metrics_identifier_failed' });
    }

    if (jurisdictionResult.error) {
      request.log.error({ err: jurisdictionResult.error }, 'jurisdiction provenance query failed');
      return reply.code(500).send({ error: 'metrics_jurisdiction_failed' });
    }

    const overviewRow = overviewResult.data ?? null;
    const overview = overviewRow
      ? {
          orgId: overviewRow.org_id,
          orgName: overviewRow.name,
          totalRuns: overviewRow.total_runs ?? 0,
          runsLast30Days: overviewRow.runs_last_30_days ?? 0,
          highRiskRuns: overviewRow.high_risk_runs ?? 0,
          confidentialRuns: overviewRow.confidential_runs ?? 0,
          avgLatencyMs: toNumber(overviewRow.avg_latency_ms) ?? 0,
          allowlistedCitationRatio: toNumber(overviewRow.allowlisted_citation_ratio),
          hitlPending: overviewRow.hitl_pending ?? 0,
          hitlMedianResponseMinutes: toNumber(overviewRow.hitl_median_response_minutes),
          ingestionSuccessLast7Days: overviewRow.ingestion_success_last_7_days ?? 0,
          ingestionFailedLast7Days: overviewRow.ingestion_failed_last_7_days ?? 0,
          evaluationCases: overviewRow.evaluation_cases ?? 0,
          evaluationPassRate: toNumber(overviewRow.evaluation_pass_rate),
          documentsTotal: overviewRow.documents_total ?? 0,
          documentsReady: overviewRow.documents_ready ?? 0,
          documentsPending: overviewRow.documents_pending ?? 0,
          documentsFailed: overviewRow.documents_failed ?? 0,
          documentsSkipped: overviewRow.documents_skipped ?? 0,
          documentsChunked: overviewRow.documents_chunked ?? 0,
        }
      : null;

    const provenanceRow = provenanceResult.data ?? null;
    const provenance = provenanceRow
      ? {
          sourcesTotal: provenanceRow.total_sources ?? 0,
          sourcesWithBinding: provenanceRow.sources_with_binding ?? 0,
          sourcesWithLanguageNote: provenanceRow.sources_with_language_note ?? 0,
          sourcesWithEli: provenanceRow.sources_with_eli ?? 0,
          sourcesWithEcli: provenanceRow.sources_with_ecli ?? 0,
          sourcesWithResidency: provenanceRow.sources_with_residency ?? 0,
          linkOkRecent: provenanceRow.sources_link_ok_recent ?? 0,
          linkStale: provenanceRow.sources_link_stale ?? 0,
          linkFailed: provenanceRow.sources_link_failed ?? 0,
          bindingBreakdown: toNumberRecord(provenanceRow.binding_breakdown),
          residencyBreakdown: toNumberRecord(provenanceRow.residency_breakdown),
          chunkTotal: provenanceRow.chunk_total ?? 0,
          chunksWithMarkers: provenanceRow.chunks_with_markers ?? 0,
        }
      : null;

    const identifierRows = (identifierResult.data ?? []).map((row) => ({
      jurisdiction: row.jurisdiction_code ?? 'UNKNOWN',
      sourcesTotal: row.sources_total ?? 0,
      sourcesWithEli: row.sources_with_eli ?? 0,
      sourcesWithEcli: row.sources_with_ecli ?? 0,
      sourcesWithAkoma: row.sources_with_akoma ?? 0,
      akomaArticles: row.akoma_article_count ?? 0,
    }));

    const tools = (toolResult.data ?? []).map((row) => ({
      toolName: row.tool_name,
      totalInvocations: row.total_invocations ?? 0,
      successCount: row.success_count ?? 0,
      failureCount: row.failure_count ?? 0,
      avgLatencyMs: toNumber(row.avg_latency_ms) ?? 0,
      p95LatencyMs: toNumber(row.p95_latency_ms) ?? 0,
      lastInvokedAt: row.last_invoked_at ?? null,
    }));

    const jurisdictionRows = (jurisdictionResult.data ?? []).map((row) => ({
      jurisdiction: row.jurisdiction_code ?? 'UNKNOWN',
      residencyZone: row.residency_zone ?? 'unknown',
      totalSources: row.total_sources ?? 0,
      sourcesConsolidated: row.sources_consolidated ?? 0,
      sourcesWithBinding: row.sources_with_binding ?? 0,
      sourcesWithLanguageNote: row.sources_with_language_note ?? 0,
      sourcesWithEli: row.sources_with_eli ?? 0,
      sourcesWithEcli: row.sources_with_ecli ?? 0,
      sourcesWithAkoma: row.sources_with_akoma ?? 0,
      bindingBreakdown: toNumberRecord(row.binding_breakdown),
      sourceTypeBreakdown: toNumberRecord(row.source_type_breakdown),
      languageNoteBreakdown: toNumberRecord(row.language_note_breakdown),
    }));

    return { overview, provenance, tools, identifiers: identifierRows, jurisdictions: jurisdictionRows };
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'governance metrics failed');
    return reply.code(500).send({ error: 'metrics_failed' });
  }
});

app.get<{ Querystring: { status?: string; category?: string; orgId?: string } }>('/governance/publications', async (request, reply) => {
  const { status, category, orgId } = request.query ?? {};

  if (orgId) {
    const userHeader = request.headers['x-user-id'];
    if (!userHeader || typeof userHeader !== 'string') {
      return reply.code(400).send({ error: 'x-user-id header is required' });
    }
    try {
      await authorizeRequestWithGuards('reports:view', orgId, userHeader, request);
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
        return reply.code(error.statusCode).send({ error: error.message });
      }
      request.log.error({ err: error }, 'publications authorization failed');
      return reply.code(403).send({ error: 'forbidden' });
    }
  }

  let query = supabase
    .from('governance_publications')
    .select('slug, title, summary, doc_url, category, status, published_at, metadata')
    .order('published_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  } else {
    query = query.eq('status', 'published');
  }

  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query;
  if (error) {
    request.log.error({ err: error }, 'governance publications query failed');
    return reply.code(500).send({ error: 'publications_failed' });
  }

  return { publications: data ?? [] };
});

app.get<{ Params: { orgId: string } }>('/admin/org/:orgId/operations/overview', async (request, reply) => {
  const { orgId } = request.params;
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('admin:audit', orgId, userHeader, request);

    const thirtyDaysAgoIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [
      sloResult,
      incidentResult,
      changeLogResult,
      goNoGoResult,
      cepejMetricsResult,
      cepejViolationResult,
      evaluationCoverageResult,
      webVitalsResult,
      provenanceCoverageResult,
    ] = await Promise.all([
      supabase
        .from('slo_snapshots')
        .select(
          'captured_at, api_uptime_percent, hitl_response_p95_seconds, retrieval_latency_p95_seconds, citation_precision_p95, notes',
        )
        .eq('org_id', orgId)
        .order('captured_at', { ascending: false })
        .limit(20),
      supabase
        .from('incident_reports')
        .select(
          'id, occurred_at, detected_at, resolved_at, severity, status, title, summary, impact, resolution, follow_up, evidence_url, recorded_at',
        )
        .eq('org_id', orgId)
        .order('occurred_at', { ascending: false }),
      supabase
        .from('change_log_entries')
        .select('id, entry_date, title, category, summary, release_tag, links, recorded_at')
        .eq('org_id', orgId)
        .order('entry_date', { ascending: false })
        .limit(20),
      supabase
        .from('go_no_go_evidence')
        .select('criterion, status, evidence_url, notes, section, recorded_at')
        .eq('org_id', orgId)
        .order('recorded_at', { ascending: false })
        .limit(20),
      supabase
        .from('cepej_metrics')
        .select('assessed_runs, passed_runs, violation_runs, fria_required_runs, pass_rate')
        .eq('org_id', orgId)
        .limit(1)
        .maybeSingle(),
      supabase
        .from('cepej_violation_breakdown')
        .select('violation, occurrences')
        .eq('org_id', orgId),
      supabase
        .from('org_evaluation_metrics')
        .select('maghreb_banner_coverage, rwanda_notice_coverage')
        .eq('org_id', orgId)
        .limit(1)
        .maybeSingle(),
      supabase
        .from('ui_telemetry_events')
        .select('payload, created_at')
        .eq('org_id', orgId)
        .eq('event_name', 'web_vital')
        .gte('created_at', thirtyDaysAgoIso)
        .order('created_at', { ascending: false })
        .limit(2000),
      supabase
        .from('org_provenance_metrics')
        .select('total_sources, sources_with_binding, sources_with_residency')
        .eq('org_id', orgId)
        .limit(1)
        .maybeSingle(),
    ]);

    if (sloResult.error) {
      request.log.error({ err: sloResult.error }, 'operations slo query failed');
      return reply.code(500).send({ error: 'operations_slo_failed' });
    }

    if (incidentResult.error) {
      request.log.error({ err: incidentResult.error }, 'operations incidents query failed');
      return reply.code(500).send({ error: 'operations_incidents_failed' });
    }

    if (changeLogResult.error) {
      request.log.error({ err: changeLogResult.error }, 'operations change log query failed');
      return reply.code(500).send({ error: 'operations_change_log_failed' });
    }

    if (goNoGoResult.error) {
      request.log.error({ err: goNoGoResult.error }, 'operations go-no-go query failed');
      return reply.code(500).send({ error: 'operations_go_no_go_failed' });
    }

    if (cepejMetricsResult.error) {
      request.log.error({ err: cepejMetricsResult.error }, 'operations cepej metrics query failed');
      return reply.code(500).send({ error: 'operations_cepej_failed' });
    }

    if (cepejViolationResult.error) {
      request.log.error({ err: cepejViolationResult.error }, 'operations cepej breakdown query failed');
      return reply.code(500).send({ error: 'operations_cepej_failed' });
    }

    if (evaluationCoverageResult.error) {
      request.log.error({ err: evaluationCoverageResult.error }, 'operations evaluation coverage query failed');
      return reply.code(500).send({ error: 'operations_evaluation_failed' });
    }

    if (webVitalsResult.error) {
      request.log.error({ err: webVitalsResult.error }, 'operations web vitals query failed');
      return reply.code(500).send({ error: 'operations_web_vitals_failed' });
    }

    if (provenanceCoverageResult.error) {
      request.log.error({ err: provenanceCoverageResult.error }, 'operations provenance metrics query failed');
      return reply.code(500).send({ error: 'operations_provenance_failed' });
    }

    const sloRows = (sloResult.data ?? []).map((row) => ({
      captured_at: row.captured_at as string,
      api_uptime_percent: toNumber(row.api_uptime_percent) ?? 0,
      hitl_response_p95_seconds: toNumber(row.hitl_response_p95_seconds) ?? 0,
      retrieval_latency_p95_seconds: toNumber(row.retrieval_latency_p95_seconds) ?? 0,
      citation_precision_p95: toNumber(row.citation_precision_p95),
      notes: (row.notes as string | null | undefined) ?? null,
    }));

    const sloSummary = sloRows.length > 0 ? summariseSlo(sloRows) : null;
    const sloSnapshots = sloRows.map((row) => ({
      capturedAt: row.captured_at,
      apiUptimePercent: row.api_uptime_percent,
      hitlResponseP95Seconds: row.hitl_response_p95_seconds,
      retrievalLatencyP95Seconds: row.retrieval_latency_p95_seconds,
      citationPrecisionP95: row.citation_precision_p95,
      notes: row.notes,
    }));

    const incidentRows = (incidentResult.data ?? []).map((row) => ({
      id: row.id as string,
      occurredAt: row.occurred_at as string | null | undefined,
      detectedAt: row.detected_at as string | null | undefined,
      resolvedAt: row.resolved_at as string | null | undefined,
      severity: row.severity as string,
      status: row.status as string,
      title: row.title as string,
      summary: (row.summary as string | null | undefined) ?? '',
      impact: (row.impact as string | null | undefined) ?? '',
      resolution: (row.resolution as string | null | undefined) ?? '',
      followUp: (row.follow_up as string | null | undefined) ?? '',
      evidenceUrl: (row.evidence_url as string | null | undefined) ?? null,
      recordedAt: row.recorded_at as string | null | undefined,
    }));

    const incidentTotals = incidentRows.reduce(
      (acc, incident) => {
        const status = (incident.status ?? '').toLowerCase();
        if (status === 'closed') {
          acc.closed += 1;
        } else {
          acc.open += 1;
        }
        return acc;
      },
      { total: incidentRows.length, open: 0, closed: 0 },
    );

    const changeRows = (changeLogResult.data ?? []).map((row) => ({
      id: row.id as string,
      entryDate: row.entry_date as string | null | undefined,
      title: row.title as string,
      category: row.category as string,
      summary: (row.summary as string | null | undefined) ?? '',
      releaseTag: (row.release_tag as string | null | undefined) ?? null,
      links: row.links ?? null,
      recordedAt: row.recorded_at as string | null | undefined,
    }));

    const goNoGoRows = (goNoGoResult.data ?? []).map((row) => ({
      criterion: row.criterion as string,
      status: row.status as string,
      evidenceUrl: (row.evidence_url as string | null | undefined) ?? null,
      notes: row.notes ?? null,
      section: row.section as string,
      recordedAt: row.recorded_at as string | null | undefined,
    }));

    const cepejMetricsRow = cepejMetricsResult.data ?? null;
    const cepejViolationsRows = cepejViolationResult.data ?? [];
    const cepejSummary = cepejMetricsRow
      ? {
          assessedRuns: cepejMetricsRow.assessed_runs ?? 0,
          passedRuns: cepejMetricsRow.passed_runs ?? 0,
          violationRuns: cepejMetricsRow.violation_runs ?? 0,
          friaRequiredRuns: cepejMetricsRow.fria_required_runs ?? 0,
          passRate: toNumber(cepejMetricsRow.pass_rate),
          violations: cepejViolationsRows.reduce<Record<string, number>>((acc, entry) => {
            const key = typeof entry.violation === 'string' && entry.violation.length > 0 ? entry.violation : 'unknown';
            const count = typeof entry.occurrences === 'number' ? entry.occurrences : Number(entry.occurrences ?? 0);
            acc[key] = (acc[key] ?? 0) + (Number.isFinite(count) ? count : 0);
            return acc;
          }, {}),
        }
      : {
          assessedRuns: 0,
          passedRuns: 0,
          violationRuns: 0,
          friaRequiredRuns: 0,
          passRate: null,
          violations: {} as Record<string, number>,
        };

    const evaluationCoverageRow = evaluationCoverageResult.data ?? null;
    const evaluationCoverage = {
      maghrebBanner: toNumber(evaluationCoverageRow?.maghreb_banner_coverage) ?? null,
      rwandaNotice: toNumber(evaluationCoverageRow?.rwanda_notice_coverage) ?? null,
    };
    const provenanceCoverageRow = provenanceCoverageResult.data ?? null;
    const totalSources = provenanceCoverageRow?.total_sources ?? 0;
    const bindingCoverage = totalSources > 0
      ? toNumber(provenanceCoverageRow?.sources_with_binding) / totalSources
      : null;
    const residencyCoverage = totalSources > 0
      ? toNumber(provenanceCoverageRow?.sources_with_residency) / totalSources
      : null;

    const complianceAlerts: Array<{ code: string; level: 'info' | 'warning' | 'critical' }> = [];
    if (cepejSummary.assessedRuns > 0 && cepejSummary.violationRuns > 0) {
      complianceAlerts.push({ code: 'cepej_violation', level: 'warning' });
    }
    if (cepejSummary.friaRequiredRuns > 0) {
      complianceAlerts.push({ code: 'fria_required', level: 'warning' });
    }
    if (
      evaluationCoverage.maghrebBanner !== null &&
      evaluationCoverage.maghrebBanner < ACCEPTANCE_THRESHOLDS.maghrebBindingBannerCoverage
    ) {
      complianceAlerts.push({ code: 'maghreb_banner_low', level: 'critical' });
    }
    if (
      evaluationCoverage.rwandaNotice !== null &&
      evaluationCoverage.rwandaNotice < ACCEPTANCE_THRESHOLDS.rwandaLanguageNoticeCoverage
    ) {
      complianceAlerts.push({ code: 'rwanda_notice_low', level: 'critical' });
    }
    if (bindingCoverage !== null && bindingCoverage < ACCEPTANCE_THRESHOLDS.citationsAllowlistedP95) {
      complianceAlerts.push({ code: 'binding_coverage_low', level: 'warning' });
    }
    if (residencyCoverage !== null && residencyCoverage < 0.95) {
      complianceAlerts.push({ code: 'residency_coverage_low', level: 'warning' });
    }

    const vitalsRows = webVitalsResult.data ?? [];
    const vitalsByMetric: Record<'LCP' | 'INP' | 'CLS', number[]> = {
      LCP: [],
      INP: [],
      CLS: [],
    };

    for (const event of vitalsRows) {
      const payload = (event.payload ?? {}) as Record<string, unknown>;
      const rawMetric = typeof payload.metric === 'string' ? payload.metric.toUpperCase() : null;
      if (!rawMetric) {
        continue;
      }
      if (rawMetric !== 'LCP' && rawMetric !== 'INP' && rawMetric !== 'CLS') {
        continue;
      }
      const rawValue = payload.value;
      const value = typeof rawValue === 'number' ? rawValue : Number(rawValue);
      if (!Number.isFinite(value)) {
        continue;
      }
      vitalsByMetric[rawMetric].push(value);
    }

    const percentile = (values: number[], fraction: number): number | null => {
      if (values.length === 0) {
        return null;
      }
      const sorted = [...values].sort((a, b) => a - b);
      const index = Math.floor((sorted.length - 1) * fraction);
      return sorted[index];
    };

    const lcpP75 = percentile(vitalsByMetric.LCP, 0.75);
    const inpP75 = percentile(vitalsByMetric.INP, 0.75);
    const clsP75 = percentile(vitalsByMetric.CLS, 0.75);

    const totalVitalSamples = vitalsByMetric.LCP.length + vitalsByMetric.INP.length + vitalsByMetric.CLS.length;
    const webVitalAlerts: Array<{ code: string; level: 'info' | 'warning' | 'critical' }> = [];
    if (lcpP75 !== null && lcpP75 > 2500) {
      webVitalAlerts.push({ code: 'web_vitals_lcp', level: 'warning' });
    }
    if (inpP75 !== null && inpP75 > 200) {
      webVitalAlerts.push({ code: 'web_vitals_inp', level: 'warning' });
    }
    if (clsP75 !== null && clsP75 > 0.1) {
      webVitalAlerts.push({ code: 'web_vitals_cls', level: 'warning' });
    }

    return {
      slo: {
        summary: sloSummary
          ? {
              snapshots: sloSummary.snapshots,
              latestCapture: sloSummary.latestCapture,
              apiUptimeP95: sloSummary.apiUptimeP95,
              hitlResponseP95Seconds: sloSummary.hitlResponseP95Seconds,
              retrievalLatencyP95Seconds: sloSummary.retrievalLatencyP95Seconds,
              citationPrecisionP95: sloSummary.citationPrecisionP95,
            }
          : null,
        snapshots: sloSnapshots,
      },
      incidents: {
        total: incidentTotals.total,
        open: incidentTotals.open,
        closed: incidentTotals.closed,
        latest: incidentRows[0] ?? null,
        entries: incidentRows.slice(0, 5),
      },
      changeLog: {
        total: changeRows.length,
        latest: changeRows[0] ?? null,
        entries: changeRows.slice(0, 5),
      },
      goNoGo: {
        section: goNoGoRows[0]?.section ?? 'A',
        criteria: goNoGoRows.map((row) => ({
          criterion: row.criterion,
          recordedStatus: row.status,
          recordedEvidenceUrl: row.evidenceUrl,
          recordedNotes: row.notes ?? null,
        })),
      },
      compliance: {
        cepej: cepejSummary,
        evaluationCoverage,
        bindingCoverage,
        residencyCoverage,
        alerts: complianceAlerts,
      },
      webVitals: {
        sampleCount: totalVitalSamples,
        metrics: {
          LCP: {
            p75: lcpP75,
            unit: 'ms',
            sampleCount: vitalsByMetric.LCP.length,
          },
          INP: {
            p75: inpP75,
            unit: 'ms',
            sampleCount: vitalsByMetric.INP.length,
          },
          CLS: {
            p75: clsP75,
            unit: 'score',
            sampleCount: vitalsByMetric.CLS.length,
          },
        },
        alerts: webVitalAlerts,
      },
    };
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'operations overview failed');
    return reply.code(500).send({ error: 'operations_overview_failed' });
  }
});

app.get<{ Querystring: { orgId?: string } }>('/metrics/retrieval', async (request, reply) => {
  const { orgId } = request.query;

  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }

  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('metrics:view', orgId, userHeader, request);
    const [summaryResult, originResult, hostResult, fairnessResult, runsResult] = await Promise.all([
      supabase
        .from('org_retrieval_metrics')
        .select('*')
        .eq('org_id', orgId)
        .limit(1)
        .maybeSingle(),
      supabase
        .from('org_retrieval_origin_metrics')
        .select('origin, snippet_count, avg_similarity, avg_weight')
        .eq('org_id', orgId),
      supabase
        .from('org_retrieval_host_metrics')
        .select('host, citation_count, allowlisted_count, translation_warnings, last_cited_at')
        .eq('org_id', orgId)
        .order('citation_count', { ascending: false })
        .limit(15),
      supabase
        .from('agent_learning_reports')
        .select('payload, report_date')
        .eq('org_id', orgId)
        .eq('kind', 'fairness')
        .order('report_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('agent_runs')
        .select('id, jurisdiction_json, risk_level, hitl_required')
        .eq('org_id', orgId)
        .order('finished_at', { ascending: false })
        .limit(500),
    ]);

    if (summaryResult.error) {
      request.log.error({ err: summaryResult.error }, 'retrieval summary query failed');
      return reply.code(500).send({ error: 'metrics_retrieval_summary_failed' });
    }

    if (originResult.error) {
      request.log.error({ err: originResult.error }, 'retrieval origin query failed');
      return reply.code(500).send({ error: 'metrics_retrieval_origin_failed' });
    }

    if (hostResult.error) {
      request.log.error({ err: hostResult.error }, 'retrieval host query failed');
      return reply.code(500).send({ error: 'metrics_retrieval_host_failed' });
    }

    if (fairnessResult.error) {
      request.log.error({ err: fairnessResult.error }, 'retrieval fairness query failed');
      return reply.code(500).send({ error: 'metrics_retrieval_fairness_failed' });
    }

    if (runsResult.error) {
      request.log.error({ err: runsResult.error }, 'retrieval runs query failed');
      return reply.code(500).send({ error: 'metrics_retrieval_runs_failed' });
    }

    const runRows = (runsResult.data ?? []) as Array<{
      id: string;
      jurisdiction_json?: unknown;
      risk_level?: string | null;
      hitl_required?: boolean | null;
    }>;

    const runIds = runRows.map((row) => row.id).filter((id): id is string => typeof id === 'string' && id.length > 0);

    let citationResult: { data: unknown; error: unknown } = { data: [], error: null };
    let retrievalSetResult: { data: unknown; error: unknown } = { data: [], error: null };

    if (runIds.length > 0) {
      [citationResult, retrievalSetResult] = await Promise.all([
        supabase.from('run_citations').select('run_id, url, note').in('run_id', runIds),
        supabase.from('run_retrieval_sets').select('run_id, weight, origin').in('run_id', runIds),
      ]);

      if (citationResult.error) {
        request.log.error({ err: citationResult.error }, 'retrieval citations query failed');
        return reply.code(500).send({ error: 'metrics_retrieval_citations_failed' });
      }

      if (retrievalSetResult.error) {
        request.log.error({ err: retrievalSetResult.error }, 'retrieval snippets query failed');
        return reply.code(500).send({ error: 'metrics_retrieval_snippets_failed' });
      }
    }

    const citationRows = (citationResult.data ?? []) as Array<{ run_id?: string | null; url?: string | null; note?: string | null }>;
    const snippetRows = (retrievalSetResult.data ?? []) as Array<{ run_id?: string | null; weight?: unknown }>;

    const jurisdictionByRun = new Map<string, string>();
    const jurisdictionStats = new Map<
      string,
      {
        runCount: number;
        allowlisted: number;
        citations: number;
        translationWarnings: number;
        snippetCount: number;
        weightSum: number;
        hitl: number;
        highRisk: number;
      }
    >();

    const extractJurisdiction = (value: unknown): string => {
      if (value && typeof value === 'object' && 'country' in (value as Record<string, unknown>)) {
        const country = (value as { country?: unknown }).country;
        if (typeof country === 'string' && country.trim().length > 0) {
          return country;
        }
      }
      return 'UNKNOWN';
    };

    for (const run of runRows) {
      const runId = run.id;
      const jurisdiction = extractJurisdiction(run.jurisdiction_json);
      jurisdictionByRun.set(runId, jurisdiction);
      const stats =
        jurisdictionStats.get(jurisdiction) ?? {
          runCount: 0,
          allowlisted: 0,
          citations: 0,
          translationWarnings: 0,
          snippetCount: 0,
          weightSum: 0,
          hitl: 0,
          highRisk: 0,
        };
      stats.runCount += 1;
      if (run.hitl_required) {
        stats.hitl += 1;
      }
      const level = typeof run.risk_level === 'string' ? run.risk_level.toUpperCase() : null;
      if (level === 'HIGH') {
        stats.highRisk += 1;
      }
      jurisdictionStats.set(jurisdiction, stats);
    }

    for (const citation of citationRows) {
      const runId = typeof citation.run_id === 'string' ? citation.run_id : null;
      if (!runId) continue;
      const jurisdiction = jurisdictionByRun.get(runId);
      if (!jurisdiction) continue;
      const stats = jurisdictionStats.get(jurisdiction);
      if (!stats) continue;
      const url = typeof citation.url === 'string' ? citation.url : null;
      if (url) {
        stats.citations += 1;
        if (isAllowlistedUrl(url)) {
          stats.allowlisted += 1;
        }
      }
      const note = typeof citation.note === 'string' ? citation.note.toLowerCase() : '';
      if (note.includes('traduction') || note.includes('translation')) {
        stats.translationWarnings += 1;
      }
    }

    for (const snippet of snippetRows) {
      const runId = typeof snippet.run_id === 'string' ? snippet.run_id : null;
      if (!runId) continue;
      const jurisdiction = jurisdictionByRun.get(runId);
      if (!jurisdiction) continue;
      const stats = jurisdictionStats.get(jurisdiction);
      if (!stats) continue;
      stats.snippetCount += 1;
      const weight = typeof snippet.weight === 'number' ? snippet.weight : Number(snippet.weight ?? NaN);
      if (Number.isFinite(weight)) {
        stats.weightSum += Number(weight);
      }
    }

    const jurisdictionMetrics = Array.from(jurisdictionStats.entries()).map(([jurisdiction, stats]) => ({
      jurisdiction,
      runCount: stats.runCount,
      allowlistedRatio: stats.citations > 0 ? stats.allowlisted / stats.citations : null,
      translationWarnings: stats.translationWarnings,
      snippetCount: stats.snippetCount,
      avgWeight: stats.snippetCount > 0 ? stats.weightSum / stats.snippetCount : null,
      hitlRate: stats.runCount > 0 ? stats.hitl / stats.runCount : null,
      highRiskRate: stats.runCount > 0 ? stats.highRisk / stats.runCount : null,
    }));

    return buildRetrievalMetricsResponse(
      (summaryResult.data ?? null) as RetrievalSummaryRow | null,
      (originResult.data ?? []) as RetrievalOriginRow[],
      (hostResult.data ?? []) as RetrievalHostRow[],
      jurisdictionMetrics,
      (fairnessResult.data ?? null) as { payload?: unknown; report_date?: string | null } | null,
    );
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'retrieval metrics authorization failed');
    return reply.code(403).send({ error: 'forbidden' });
  }
});

app.get<{ Querystring: { orgId?: string } }>('/metrics/evaluations', async (request, reply) => {
  const { orgId } = request.query;

  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }

  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('metrics:view', orgId, userHeader, request);
    const [summaryResult, jurisdictionResult] = await Promise.all([
      supabase
        .from('org_evaluation_metrics')
        .select('*')
        .eq('org_id', orgId)
        .limit(1)
        .maybeSingle(),
      supabase
        .from('org_evaluation_jurisdiction_metrics')
        .select(
          'jurisdiction, evaluation_count, pass_rate, citation_precision_median, temporal_validity_median, avg_binding_warnings, maghreb_banner_coverage, rwanda_notice_coverage',
        )
        .eq('org_id', orgId),
    ]);

    if (summaryResult.error) {
      request.log.error({ err: summaryResult.error }, 'evaluation summary query failed');
      return reply.code(500).send({ error: 'metrics_evaluation_summary_failed' });
    }

    if (jurisdictionResult.error) {
      request.log.error({ err: jurisdictionResult.error }, 'evaluation jurisdiction query failed');
      return reply.code(500).send({ error: 'metrics_evaluation_jurisdiction_failed' });
    }

    return buildEvaluationMetricsResponse(
      (summaryResult.data ?? null) as EvaluationMetricsSummaryRow | null,
      (jurisdictionResult.data ?? []) as EvaluationJurisdictionRow[],
    );
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'evaluation metrics authorization failed');
    return reply.code(403).send({ error: 'forbidden' });
  }
});

app.get<{ Querystring: { orgId?: string; start?: string; end?: string } }>('/metrics/cepej', async (request, reply) => {
  const { orgId, start, end } = request.query;

  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }

  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  let range: { start: string; end: string };
  try {
    range = resolveDateRange(start, end);
  } catch (error) {
    return reply.code(400).send({ error: error instanceof Error ? error.message : 'invalid_date_range' });
  }

  try {
    await authorizeRequestWithGuards('governance:cepej', orgId, userHeader, request);
    const { data, error } = await supabase
      .from('compliance_assessments')
      .select('cepej_passed, cepej_violations, fria_required, statute_passed, statute_violations, disclosures_missing, created_at')
      .eq('org_id', orgId)
      .gte('created_at', range.start)
      .lte('created_at', range.end);

    if (error) {
      request.log.error({ err: error }, 'cepej metrics query failed');
      return reply.code(500).send({ error: 'cepej_metrics_failed' });
    }

    const summary = summariseCepej((data ?? []) as CepejRecord[]);
    return { timeframe: range, summary };
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'cepej metrics failed');
    return reply.code(500).send({ error: 'cepej_metrics_failed' });
  }
});

app.get<{ Querystring: { orgId?: string; start?: string; end?: string; format?: string } }>(
  '/metrics/cepej/export',
  async (request, reply) => {
    const { orgId, start, end, format } = request.query;
    if (!orgId) {
      return reply.code(400).send({ error: 'orgId is required' });
    }

    const userHeader = request.headers['x-user-id'];
    if (!userHeader || typeof userHeader !== 'string') {
      return reply.code(400).send({ error: 'x-user-id header is required' });
    }

    let range: { start: string; end: string };
    try {
      range = resolveDateRange(start, end);
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : 'invalid_date_range' });
    }

    try {
      await authorizeRequestWithGuards('governance:cepej', orgId, userHeader, request);
      const { data, error } = await supabase
        .from('compliance_assessments')
        .select('cepej_passed, cepej_violations, fria_required, statute_passed, statute_violations, disclosures_missing, created_at')
        .eq('org_id', orgId)
        .gte('created_at', range.start)
        .lte('created_at', range.end);

      if (error) {
        request.log.error({ err: error }, 'cepej export query failed');
        return reply.code(500).send({ error: 'cepej_export_failed' });
      }

      const summary = summariseCepej((data ?? []) as CepejRecord[]);
      if ((format ?? 'json').toLowerCase() === 'csv') {
        const rows: Array<[string, string | number | null]> = [
          ['org_id', orgId],
          ['timeframe_start', range.start],
          ['timeframe_end', range.end],
          ['assessed_runs', summary.assessedRuns],
          ['passed_runs', summary.passedRuns],
          ['violation_runs', summary.violationRuns],
          ['fria_required_runs', summary.friaRequiredRuns],
          ['pass_rate', summary.passRate ?? ''],
        ];
        for (const [violation, count] of Object.entries(summary.violations)) {
          rows.push([`violation_${violation}`, count]);
        }
        const csv = rows
          .map(([key, value]) => `${key},${value === null ? '' : String(value).replace(/"/g, '""')}`)
          .join('\n');
        reply.header('content-type', 'text/csv; charset=utf-8');
        reply.header('content-disposition', `attachment; filename="cepej-${orgId}.csv"`);
        return csv;
      }

      return { timeframe: range, summary };
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
        return reply.code(error.statusCode).send({ error: error.message });
      }
      request.log.error({ err: error }, 'cepej export failed');
      return reply.code(500).send({ error: 'cepej_export_failed' });
    }
  },
);

app.post<{
  Body: { orgId?: string; periodStart?: string; periodEnd?: string; dryRun?: boolean };
}>('/reports/transparency', async (request, reply) => {
  const { orgId, periodStart, periodEnd, dryRun } = request.body ?? {};
  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }

  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  let range: { start: string; end: string };
  try {
    range = resolveDateRange(periodStart, periodEnd);
  } catch (error) {
    return reply.code(400).send({ error: error instanceof Error ? error.message : 'invalid_date_range' });
  }

  try {
    await authorizeRequestWithGuards('governance:transparency', orgId, userHeader, request);

    const [orgResult, runResult, hitlResult, ingestionResult, casesResult, cepejResult] = await Promise.all([
      supabase.from('organizations').select('id, name').eq('id', orgId).maybeSingle(),
      supabase
        .from('agent_runs')
        .select('risk_level, hitl_required, started_at, finished_at, confidential_mode, agent_code')
        .eq('org_id', orgId)
        .gte('started_at', range.start)
        .lte('started_at', range.end),
      supabase
        .from('hitl_queue')
        .select('status, created_at, updated_at')
        .eq('org_id', orgId)
        .gte('created_at', range.start)
        .lte('created_at', range.end),
      supabase
        .from('ingestion_runs')
        .select('status, started_at, inserted_count, failed_count')
        .eq('org_id', orgId)
        .gte('started_at', range.start)
        .lte('started_at', range.end),
      supabase.from('eval_cases').select('id').eq('org_id', orgId),
      supabase
        .from('compliance_assessments')
        .select('cepej_passed, cepej_violations, fria_required, statute_passed, statute_violations, disclosures_missing, created_at')
        .eq('org_id', orgId)
        .gte('created_at', range.start)
        .lte('created_at', range.end),
    ]);

    if (orgResult.error) {
      request.log.error({ err: orgResult.error }, 'transparency org lookup failed');
      return reply.code(500).send({ error: 'transparency_org_failed' });
    }
    if (!orgResult.data) {
      return reply.code(404).send({ error: 'organisation_not_found' });
    }

    const caseIds = (casesResult.data ?? []).map((row) => row.id);
    let evaluationRows: EvaluationRecord[] = [];
    if (caseIds.length > 0) {
      const evalResult = await supabase
        .from('eval_results')
        .select('pass, created_at, case_id')
        .in('case_id', caseIds)
        .gte('created_at', range.start)
        .lte('created_at', range.end);
      if (evalResult.error) {
        request.log.error({ err: evalResult.error }, 'transparency eval lookup failed');
        return reply.code(500).send({ error: 'transparency_eval_failed' });
      }
      evaluationRows = (evalResult.data ?? []) as unknown as EvaluationRecord[];
    }

    if (runResult.error) {
      request.log.error({ err: runResult.error }, 'transparency run query failed');
      return reply.code(500).send({ error: 'transparency_run_failed' });
    }
    if (hitlResult.error) {
      request.log.error({ err: hitlResult.error }, 'transparency hitl query failed');
      return reply.code(500).send({ error: 'transparency_hitl_failed' });
    }
    if (ingestionResult.error) {
      request.log.error({ err: ingestionResult.error }, 'transparency ingestion query failed');
      return reply.code(500).send({ error: 'transparency_ingestion_failed' });
    }
    if (cepejResult.error) {
      request.log.error({ err: cepejResult.error }, 'transparency cepej query failed');
      return reply.code(500).send({ error: 'transparency_cepej_failed' });
    }
    if (casesResult.error) {
      request.log.error({ err: casesResult.error }, 'transparency eval cases query failed');
      return reply.code(500).send({ error: 'transparency_cases_failed' });
    }

    const runSummary = summariseRuns((runResult.data ?? []) as unknown as RunRecord[]);
    const hitlSummary = summariseHitl((hitlResult.data ?? []) as unknown as HitlRecord[]);
    const ingestionSummary = summariseIngestion((ingestionResult.data ?? []) as unknown as IngestionRecord[]);
    const evaluationSummary = summariseEvaluations(evaluationRows);
    const cepejSummary = summariseCepej((cepejResult.data ?? []) as unknown as CepejRecord[]);

    const payload = buildTransparencyReport({
      organisation: { id: orgResult.data.id, name: orgResult.data.name },
      timeframe: range,
      runs: runSummary,
      hitl: hitlSummary,
      ingestion: ingestionSummary,
      evaluations: evaluationSummary,
      cepej: cepejSummary,
    });

    if (dryRun) {
      return { dryRun: true, report: payload };
    }

    const periodStartDate = new Date(range.start).toISOString().slice(0, 10);
    const periodEndDate = new Date(range.end).toISOString().slice(0, 10);
    const insertResult = await supabase
      .from('transparency_reports')
      .insert({
        org_id: orgId,
        generated_by: userHeader,
        period_start: periodStartDate,
        period_end: periodEndDate,
        metrics: payload,
        cepej_summary: cepejSummary,
      })
      .select('id, org_id, period_start, period_end, generated_at, distribution_status, metrics, cepej_summary')
      .single();

    if (insertResult.error || !insertResult.data) {
      request.log.error({ err: insertResult.error }, 'transparency insert failed');
      return reply.code(500).send({ error: 'transparency_insert_failed' });
    }

    return reply.code(201).send({ report: insertResult.data });
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'transparency generation failed');
    return reply.code(500).send({ error: 'transparency_failed' });
  }
});

app.get<{ Querystring: { orgId?: string; limit?: string } }>('/reports/transparency', async (request, reply) => {
  const { orgId } = request.query;
  const limitParam = request.query.limit ? Number.parseInt(request.query.limit, 10) : 20;
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 20;

  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }

  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('governance:transparency', orgId, userHeader, request);
    const { data, error } = await supabase
      .from('transparency_reports')
      .select('id, org_id, period_start, period_end, generated_at, distribution_status, metrics, cepej_summary')
      .eq('org_id', orgId)
      .order('period_end', { ascending: false })
      .limit(limit);

    if (error) {
      request.log.error({ err: error }, 'transparency list failed');
      return reply.code(500).send({ error: 'transparency_list_failed' });
    }

    return { reports: data ?? [] };
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'transparency list auth failed');
    return reply.code(500).send({ error: 'transparency_list_failed' });
  }
});

app.get<{ Params: { reportId: string } }>('/reports/transparency/:reportId', async (request, reply) => {
  const { reportId } = request.params;
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  const { data, error } = await supabase
    .from('transparency_reports')
    .select('id, org_id, period_start, period_end, generated_at, distribution_status, metrics, cepej_summary')
    .eq('id', reportId)
    .maybeSingle();

  if (error) {
    request.log.error({ err: error }, 'transparency fetch failed');
    return reply.code(500).send({ error: 'transparency_fetch_failed' });
  }

  if (!data) {
    return reply.code(404).send({ error: 'report_not_found' });
  }

  try {
    await authorizeRequestWithGuards('governance:transparency', data.org_id as string, userHeader, request);
    return { report: data };
  } catch (authError) {
    if (authError instanceof Error && 'statusCode' in authError && typeof authError.statusCode === 'number') {
      return reply.code(authError.statusCode).send({ error: authError.message });
    }
    request.log.error({ err: authError }, 'transparency fetch auth failed');
    return reply.code(500).send({ error: 'transparency_fetch_failed' });
  }
});

app.get<{ Params: { orgId: string } }>('/admin/org/:orgId/red-team', async (request, reply) => {
  const { orgId } = request.params;
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('governance:red-team', orgId, userHeader, request);
    const { data, error } = await supabase
      .from('red_team_findings')
      .select(
        'id, scenario_key, severity, expected_outcome, observed_outcome, passed, summary, detail, mitigations, status, detected_at, resolved_at, resolved_by, created_by, updated_at',
      )
      .eq('org_id', orgId)
      .order('detected_at', { ascending: false });

    if (error) {
      request.log.error({ err: error }, 'red team fetch failed');
      return reply.code(500).send({ error: 'red_team_fetch_failed' });
    }

    return {
      findings: (data ?? []).map((row) => ({
        id: row.id,
        scenarioKey: row.scenario_key,
        severity: row.severity,
        expectedOutcome: row.expected_outcome,
        observedOutcome: row.observed_outcome,
        passed: row.passed,
        summary: row.summary,
        detail: row.detail ?? null,
        mitigations: row.mitigations ?? null,
        status: row.status,
        detectedAt: row.detected_at,
        resolvedAt: row.resolved_at ?? null,
        resolvedBy: row.resolved_by ?? null,
        createdBy: row.created_by,
        updatedAt: row.updated_at,
      })),
    };
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'red team list failed');
    return reply.code(500).send({ error: 'red_team_failed' });
  }
});

app.post<{
  Params: { orgId: string };
  Body: {
    scenarioKey: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    expectedOutcome: string;
    observedOutcome: string;
    passed: boolean;
    summary: string;
    detail?: Record<string, unknown>;
    mitigations?: string | null;
    status?: 'open' | 'in_progress' | 'resolved' | 'accepted_risk';
    detectedAt?: string;
  };
}>('/admin/org/:orgId/red-team', async (request, reply) => {
  const { orgId } = request.params;
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  const {
    scenarioKey,
    severity,
    expectedOutcome,
    observedOutcome,
    passed,
    summary,
    detail,
    mitigations,
    status,
    detectedAt,
  } = request.body;

  if (!scenarioKey || !severity || !expectedOutcome || !observedOutcome || !summary) {
    return reply.code(400).send({ error: 'missing_required_fields' });
  }

  try {
    await authorizeRequestWithGuards('governance:red-team', orgId, userHeader, request);

    const effectiveStatus = status ?? (passed ? 'resolved' : 'open');
    const payload = {
      org_id: orgId,
      scenario_key: scenarioKey,
      severity,
      expected_outcome: expectedOutcome,
      observed_outcome: observedOutcome,
      passed,
      summary,
      detail: detail ?? null,
      mitigations: mitigations ?? null,
      status: effectiveStatus,
      detected_at: detectedAt ?? new Date().toISOString(),
      resolved_at: effectiveStatus === 'resolved' || effectiveStatus === 'accepted_risk' ? new Date().toISOString() : null,
      resolved_by: effectiveStatus === 'resolved' || effectiveStatus === 'accepted_risk' ? userHeader : null,
      created_by: userHeader,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('red_team_findings')
      .insert(payload)
      .select('id, scenario_key, severity, expected_outcome, observed_outcome, passed, summary, detail, mitigations, status, detected_at, resolved_at, resolved_by, created_by, updated_at')
      .maybeSingle();

    if (error) {
      request.log.error({ err: error }, 'red team insert failed');
      return reply.code(500).send({ error: 'red_team_insert_failed' });
    }

    await logAuditEvent({
      orgId,
      actorId: userHeader,
      kind: 'red_team.recorded',
      object: scenarioKey,
      after: payload,
    });

    return {
      finding: data,
    };
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'red team create failed');
    return reply.code(500).send({ error: 'red_team_failed' });
  }
});

app.patch<{
  Params: { orgId: string; findingId: string };
  Body: {
    status?: 'open' | 'in_progress' | 'resolved' | 'accepted_risk';
    mitigations?: string | null;
    resolvedAt?: string | null;
    observedOutcome?: string;
    passed?: boolean;
  };
}>('/admin/org/:orgId/red-team/:findingId', async (request, reply) => {
  const { orgId, findingId } = request.params;
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('governance:red-team', orgId, userHeader, request);

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (request.body.status) {
      updatePayload.status = request.body.status;
      if (request.body.status === 'resolved' || request.body.status === 'accepted_risk') {
        updatePayload.resolved_at = request.body.resolvedAt ?? new Date().toISOString();
        updatePayload.resolved_by = userHeader;
      }
    }

    if (request.body.mitigations !== undefined) {
      updatePayload.mitigations = request.body.mitigations;
    }

    if (request.body.observedOutcome) {
      updatePayload.observed_outcome = request.body.observedOutcome;
    }

    if (request.body.passed !== undefined) {
      updatePayload.passed = request.body.passed;
    }

    if (request.body.resolvedAt === null) {
      updatePayload.resolved_at = null;
      updatePayload.resolved_by = null;
    }

    const { data, error } = await supabase
      .from('red_team_findings')
      .update(updatePayload)
      .eq('org_id', orgId)
      .eq('id', findingId)
      .select('id, scenario_key, severity, expected_outcome, observed_outcome, passed, summary, detail, mitigations, status, detected_at, resolved_at, resolved_by, created_by, updated_at')
      .maybeSingle();

    if (error) {
      request.log.error({ err: error }, 'red team update failed');
      return reply.code(500).send({ error: 'red_team_update_failed' });
    }

    await logAuditEvent({
      orgId,
      actorId: userHeader,
      kind: 'red_team.updated',
      object: findingId,
      after: updatePayload,
    });

    return { finding: data };
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'red team patch failed');
    return reply.code(500).send({ error: 'red_team_failed' });
  }
});

app.get<{ Params: { orgId: string } }>(
  '/admin/org/:orgId/go-no-go/fria',
  async (request, reply) => {
    const { orgId } = request.params;
    const userHeader = request.headers['x-user-id'];
    if (!userHeader || typeof userHeader !== 'string') {
      return reply.code(400).send({ error: 'x-user-id header is required' });
    }

    try {
      await authorizeRequestWithGuards('governance:go-no-go', orgId, userHeader, request);
      const { data, error } = await supabase
        .from('fria_artifacts')
        .select(
          'id, release_tag, title, evidence_url, storage_path, hash_sha256, validated, submitted_by, submitted_at, notes',
        )
        .eq('org_id', orgId)
        .order('submitted_at', { ascending: false });

      if (error) {
        request.log.error({ err: error }, 'fria artifact fetch failed');
        return reply.code(500).send({ error: 'fria_artifact_failed' });
      }

      return {
        artifacts: (data ?? []).map((row) => ({
          id: row.id,
          releaseTag: row.release_tag ?? null,
          title: row.title,
          evidenceUrl: row.evidence_url ?? null,
          storagePath: row.storage_path ?? null,
          hashSha256: row.hash_sha256 ?? null,
          validated: row.validated ?? false,
          submittedBy: row.submitted_by,
          submittedAt: row.submitted_at,
          notes: row.notes ?? null,
        })),
      };
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
        return reply.code(error.statusCode).send({ error: error.message });
      }
      request.log.error({ err: error }, 'fria artifact auth failed');
      return reply.code(500).send({ error: 'fria_artifact_failed' });
    }
  },
);

app.post<{
  Params: { orgId: string };
  Body: {
    releaseTag?: string | null;
    title: string;
    evidenceUrl?: string | null;
    storagePath?: string | null;
    hashSha256?: string | null;
    validated?: boolean;
    notes?: unknown;
  };
}>('/admin/org/:orgId/go-no-go/fria', async (request, reply) => {
  const { orgId } = request.params;
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  const { releaseTag, title, evidenceUrl, storagePath, hashSha256, validated, notes } = request.body;
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return reply.code(400).send({ error: 'missing_title' });
  }

  if (!evidenceUrl && !storagePath) {
    return reply.code(400).send({ error: 'missing_artifact_reference' });
  }

  let parsedNotes: Record<string, unknown> | null | undefined;
  try {
    parsedNotes = parseEvidenceNotes(notes);
  } catch (error) {
    return reply.code(400).send({ error: 'invalid_notes' });
  }

  try {
    await authorizeRequestWithGuards('governance:go-no-go', orgId, userHeader, request);
    const insertPayload = {
      org_id: orgId,
      release_tag: releaseTag && typeof releaseTag === 'string' ? releaseTag.trim() || null : null,
      title: title.trim(),
      evidence_url: evidenceUrl && typeof evidenceUrl === 'string' ? evidenceUrl.trim() || null : null,
      storage_path: storagePath && typeof storagePath === 'string' ? storagePath.trim() || null : null,
      hash_sha256: hashSha256 && typeof hashSha256 === 'string' ? hashSha256.trim() || null : null,
      validated: Boolean(validated),
      submitted_by: userHeader,
      submitted_at: new Date().toISOString(),
      notes: parsedNotes ?? null,
    };

    const { data, error } = await supabase
      .from('fria_artifacts')
      .insert(insertPayload)
      .select(
        'id, release_tag, title, evidence_url, storage_path, hash_sha256, validated, submitted_by, submitted_at, notes',
      )
      .maybeSingle();

    if (error) {
      request.log.error({ err: error }, 'fria artifact insert failed');
      return reply.code(500).send({ error: 'fria_artifact_failed' });
    }

    await refreshFriaEvidence(orgId, userHeader);

    const artifactId = data?.id ?? 'fria:unknown';

    await logAuditEvent({
      orgId,
      actorId: userHeader,
      kind: 'go_no_go.fria_recorded',
      object: artifactId,
      after: insertPayload,
    });

    return { artifact: data };
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'fria artifact create failed');
    return reply.code(500).send({ error: 'fria_artifact_failed' });
  }
});

app.patch<{
  Params: { orgId: string; artifactId: string };
  Body: {
    releaseTag?: string | null;
    title?: string;
    evidenceUrl?: string | null;
    storagePath?: string | null;
    hashSha256?: string | null;
    validated?: boolean;
    notes?: unknown;
  };
}>('/admin/org/:orgId/go-no-go/fria/:artifactId', async (request, reply) => {
  const { orgId, artifactId } = request.params;
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  const { releaseTag, title, evidenceUrl, storagePath, hashSha256, validated, notes } = request.body;

  let parsedNotes: Record<string, unknown> | null | undefined;
  try {
    parsedNotes = parseEvidenceNotes(notes);
  } catch (error) {
    return reply.code(400).send({ error: 'invalid_notes' });
  }

  try {
    await authorizeRequestWithGuards('governance:go-no-go', orgId, userHeader, request);
    const { data: existing, error: fetchError } = await supabase
      .from('fria_artifacts')
      .select('id, org_id')
      .eq('id', artifactId)
      .maybeSingle();

    if (fetchError) {
      request.log.error({ err: fetchError }, 'fria artifact fetch failed');
      return reply.code(500).send({ error: 'fria_artifact_failed' });
    }

    if (!existing || existing.org_id !== orgId) {
      return reply.code(404).send({ error: 'fria_artifact_not_found' });
    }

    const updatePayload: Record<string, unknown> = {};
    if (releaseTag !== undefined) {
      updatePayload.release_tag = releaseTag && typeof releaseTag === 'string' ? releaseTag.trim() || null : null;
    }
    if (title !== undefined) {
      if (typeof title !== 'string' || title.trim().length === 0) {
        return reply.code(400).send({ error: 'invalid_title' });
      }
      updatePayload.title = title.trim();
    }
    if (evidenceUrl !== undefined) {
      updatePayload.evidence_url = evidenceUrl && typeof evidenceUrl === 'string' ? evidenceUrl.trim() || null : null;
    }
    if (storagePath !== undefined) {
      updatePayload.storage_path = storagePath && typeof storagePath === 'string' ? storagePath.trim() || null : null;
    }
    if (hashSha256 !== undefined) {
      updatePayload.hash_sha256 = hashSha256 && typeof hashSha256 === 'string' ? hashSha256.trim() || null : null;
    }
    if (validated !== undefined) {
      updatePayload.validated = Boolean(validated);
    }
    if (parsedNotes !== undefined) {
      updatePayload.notes = parsedNotes;
    }

    if (Object.keys(updatePayload).length === 0) {
      return reply.code(400).send({ error: 'no_updates_supplied' });
    }

    const { data, error } = await supabase
      .from('fria_artifacts')
      .update(updatePayload)
      .eq('id', artifactId)
      .select(
        'id, release_tag, title, evidence_url, storage_path, hash_sha256, validated, submitted_by, submitted_at, notes',
      )
      .maybeSingle();

    if (error) {
      request.log.error({ err: error }, 'fria artifact update failed');
      return reply.code(500).send({ error: 'fria_artifact_failed' });
    }

    await refreshFriaEvidence(orgId, userHeader);

    await logAuditEvent({
      orgId,
      actorId: userHeader,
      kind: 'go_no_go.fria_updated',
      object: artifactId,
      after: updatePayload,
    });

    return { artifact: data };
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'fria artifact patch failed');
    return reply.code(500).send({ error: 'fria_artifact_failed' });
  }
});

app.get<{ Params: { orgId: string }; Querystring: { section?: string; status?: string } }>(
  '/admin/org/:orgId/go-no-go/evidence',
  async (request, reply) => {
    const { orgId } = request.params;
    const userHeader = request.headers['x-user-id'];
    if (!userHeader || typeof userHeader !== 'string') {
      return reply.code(400).send({ error: 'x-user-id header is required' });
    }

    const sectionFilter = request.query.section?.toUpperCase();
    const statusFilter = request.query.status?.toLowerCase();

    if (sectionFilter && !GO_NO_GO_SECTIONS.has(sectionFilter)) {
      return reply.code(400).send({ error: 'invalid_section' });
    }

    if (statusFilter && !GO_NO_GO_STATUSES.has(statusFilter)) {
      return reply.code(400).send({ error: 'invalid_status' });
    }

    try {
      await authorizeRequestWithGuards('governance:go-no-go', orgId, userHeader, request);
      let query = supabase
        .from('go_no_go_evidence')
        .select('id, section, criterion, status, evidence_url, notes, recorded_by, recorded_at')
        .eq('org_id', orgId)
        .order('section', { ascending: true })
        .order('recorded_at', { ascending: false });

      if (sectionFilter) {
        query = query.eq('section', sectionFilter);
      }
      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) {
        request.log.error({ err: error }, 'go-no-go evidence fetch failed');
        return reply.code(500).send({ error: 'go_no_go_evidence_failed' });
      }

      return {
        evidence: (data ?? []).map((row) => ({
          id: row.id,
          section: row.section,
          criterion: row.criterion,
          status: row.status,
          evidenceUrl: row.evidence_url ?? null,
          notes: row.notes ?? null,
          recordedBy: row.recorded_by,
          recordedAt: row.recorded_at,
        })),
      };
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
        return reply.code(error.statusCode).send({ error: error.message });
      }
      request.log.error({ err: error }, 'go-no-go evidence auth failed');
      return reply.code(500).send({ error: 'go_no_go_evidence_failed' });
    }
  },
);

app.post<{
  Params: { orgId: string };
  Body: {
    section: string;
    criterion: string;
    status?: 'pending' | 'satisfied';
    evidenceUrl?: string | null;
    notes?: unknown;
  };
}>('/admin/org/:orgId/go-no-go/evidence', async (request, reply) => {
  const { orgId } = request.params;
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  const { section, criterion, status, evidenceUrl, notes } = request.body;

  if (!section || typeof section !== 'string' || !criterion || typeof criterion !== 'string') {
    return reply.code(400).send({ error: 'missing_required_fields' });
  }

  const normalizedSection = section.toUpperCase();
  if (!GO_NO_GO_SECTIONS.has(normalizedSection)) {
    return reply.code(400).send({ error: 'invalid_section' });
  }

  const normalizedStatus = (status ?? 'pending').toLowerCase();
  if (!GO_NO_GO_STATUSES.has(normalizedStatus)) {
    return reply.code(400).send({ error: 'invalid_status' });
  }

  let parsedNotes: Record<string, unknown> | null | undefined;
  try {
    parsedNotes = parseEvidenceNotes(notes);
  } catch (error) {
    return reply.code(400).send({ error: 'invalid_notes' });
  }

  try {
    await authorizeRequestWithGuards('governance:go-no-go', orgId, userHeader, request);
    const payload = {
      org_id: orgId,
      section: normalizedSection,
      criterion: criterion.trim(),
      status: normalizedStatus,
      evidence_url: evidenceUrl ?? null,
      notes: parsedNotes ?? null,
      recorded_by: userHeader,
    };

    const { data, error } = await supabase
      .from('go_no_go_evidence')
      .insert(payload)
      .select('id, section, criterion, status, evidence_url, notes, recorded_by, recorded_at')
      .maybeSingle();

    if (error) {
      request.log.error({ err: error }, 'go-no-go evidence insert failed');
      return reply.code(500).send({ error: 'go_no_go_evidence_failed' });
    }

    await logAuditEvent({
      orgId,
      actorId: userHeader,
      kind: 'go_no_go.evidence_recorded',
      object: `${normalizedSection}:${criterion.trim()}`,
      after: payload,
    });

    return {
      evidence: data,
    };
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'go-no-go evidence create failed');
    return reply.code(500).send({ error: 'go_no_go_evidence_failed' });
  }
});

app.patch<{
  Params: { orgId: string; evidenceId: string };
  Body: {
    status?: 'pending' | 'satisfied';
    evidenceUrl?: string | null;
    notes?: unknown;
  };
}>('/admin/org/:orgId/go-no-go/evidence/:evidenceId', async (request, reply) => {
  const { orgId, evidenceId } = request.params;
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  if (
    request.body.status === undefined &&
    request.body.evidenceUrl === undefined &&
    request.body.notes === undefined
  ) {
    return reply.code(400).send({ error: 'nothing_to_update' });
  }

  const nextStatus = request.body.status ? request.body.status.toLowerCase() : undefined;
  if (nextStatus && !GO_NO_GO_STATUSES.has(nextStatus)) {
    return reply.code(400).send({ error: 'invalid_status' });
  }

  let parsedNotes: Record<string, unknown> | null | undefined;
  try {
    parsedNotes = parseEvidenceNotes(request.body.notes);
  } catch (error) {
    return reply.code(400).send({ error: 'invalid_notes' });
  }

  try {
    await authorizeRequestWithGuards('governance:go-no-go', orgId, userHeader, request);

    const { data: current, error: currentError } = await supabase
      .from('go_no_go_evidence')
      .select('id, section, criterion, status, evidence_url, notes, recorded_by, recorded_at')
      .eq('org_id', orgId)
      .eq('id', evidenceId)
      .maybeSingle();

    if (currentError) {
      request.log.error({ err: currentError }, 'go-no-go evidence fetch failed');
      return reply.code(500).send({ error: 'go_no_go_evidence_failed' });
    }

    if (!current) {
      return reply.code(404).send({ error: 'evidence_not_found' });
    }

    const updatePayload: Record<string, unknown> = {};
    if (nextStatus) {
      updatePayload.status = nextStatus;
    }
    if (request.body.evidenceUrl !== undefined) {
      updatePayload.evidence_url = request.body.evidenceUrl ?? null;
    }
    if (parsedNotes !== undefined) {
      updatePayload.notes = parsedNotes ?? null;
    }

    const { data, error } = await supabase
      .from('go_no_go_evidence')
      .update(updatePayload)
      .eq('org_id', orgId)
      .eq('id', evidenceId)
      .select('id, section, criterion, status, evidence_url, notes, recorded_by, recorded_at')
      .maybeSingle();

    if (error) {
      request.log.error({ err: error }, 'go-no-go evidence update failed');
      return reply.code(500).send({ error: 'go_no_go_evidence_failed' });
    }

    await logAuditEvent({
      orgId,
      actorId: userHeader,
      kind: 'go_no_go.evidence_updated',
      object: evidenceId,
      before: current,
      after: { ...current, ...updatePayload },
    });

    return { evidence: data };
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'go-no-go evidence patch failed');
    return reply.code(500).send({ error: 'go_no_go_evidence_failed' });
  }
});

app.get<{ Params: { orgId: string } }>('/admin/org/:orgId/go-no-go/signoffs', async (request, reply) => {
  const { orgId } = request.params;
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('governance:go-no-go', orgId, userHeader, request);
    const { data, error } = await supabase
      .from('go_no_go_signoffs')
      .select('id, release_tag, decision, decided_by, decided_at, notes, evidence_total')
      .eq('org_id', orgId)
      .order('decided_at', { ascending: false });

    if (error) {
      request.log.error({ err: error }, 'go-no-go signoff fetch failed');
      return reply.code(500).send({ error: 'go_no_go_signoff_failed' });
    }

    return { signoffs: data ?? [] };
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'go-no-go signoff auth failed');
    return reply.code(500).send({ error: 'go_no_go_signoff_failed' });
  }
});

app.post<{
  Params: { orgId: string };
  Body: { releaseTag: string; decision: 'go' | 'no-go'; notes?: string | null };
}>('/admin/org/:orgId/go-no-go/signoffs', async (request, reply) => {
  const { orgId } = request.params;
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  const { releaseTag, decision, notes } = request.body;

  if (!releaseTag || typeof releaseTag !== 'string' || !decision || typeof decision !== 'string') {
    return reply.code(400).send({ error: 'missing_required_fields' });
  }

  const normalizedDecision = decision.toLowerCase();
  if (!GO_NO_GO_DECISIONS.has(normalizedDecision)) {
    return reply.code(400).send({ error: 'invalid_decision' });
  }

  try {
    await authorizeRequestWithGuards('governance:go-no-go-signoff', orgId, userHeader, request);

    const { count: satisfiedCount, error: countError } = await supabase
      .from('go_no_go_evidence')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('status', 'satisfied');

    if (countError) {
      request.log.error({ err: countError }, 'go-no-go evidence count failed');
      return reply.code(500).send({ error: 'go_no_go_signoff_failed' });
    }

    const signoffPayload = {
      org_id: orgId,
      release_tag: releaseTag.trim(),
      decision: normalizedDecision,
      decided_by: userHeader,
      decided_at: new Date().toISOString(),
      notes: notes ?? null,
      evidence_total: satisfiedCount ?? 0,
    };

    const { data, error } = await supabase
      .from('go_no_go_signoffs')
      .upsert(signoffPayload, { onConflict: 'org_id,release_tag' })
      .select('id, release_tag, decision, decided_by, decided_at, notes, evidence_total')
      .maybeSingle();

    if (error) {
      request.log.error({ err: error }, 'go-no-go signoff failed');
      return reply.code(500).send({ error: 'go_no_go_signoff_failed' });
    }

    await logAuditEvent({
      orgId,
      actorId: userHeader,
      kind: 'go_no_go.signoff_recorded',
      object: releaseTag.trim(),
      after: signoffPayload,
    });

    return { signoff: data };
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'go-no-go signoff create failed');
    return reply.code(500).send({ error: 'go_no_go_signoff_failed' });
  }
});

app.get<{ Params: { orgId: string } }>('/admin/org/:orgId/performance/snapshots', async (request, reply) => {
  const { orgId } = request.params;
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('metrics:view', orgId, userHeader, request);
    const { data, error } = await supabase
      .from('performance_snapshots')
      .select('id, window_label, collected_at, total_runs, avg_latency_ms, p95_latency_ms, allowlisted_ratio, hitl_median_minutes, citation_precision, temporal_validity, binding_warnings, notes, recorded_by, metadata')
      .eq('org_id', orgId)
      .order('collected_at', { ascending: false });

    if (error) {
      request.log.error({ err: error }, 'performance snapshot fetch failed');
      return reply.code(500).send({ error: 'performance_snapshot_fetch_failed' });
    }

    return {
      snapshots: data ?? [],
    };
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'performance snapshot list failed');
    return reply.code(500).send({ error: 'performance_snapshot_failed' });
  }
});

app.post<{
  Params: { orgId: string };
  Body: {
    windowLabel: string;
    totalRuns?: number;
    avgLatencyMs?: number | null;
    p95LatencyMs?: number | null;
    allowlistedRatio?: number | null;
    hitlMedianMinutes?: number | null;
    citationPrecision?: number | null;
    temporalValidity?: number | null;
    bindingWarnings?: number | null;
    notes?: string | null;
    metadata?: Record<string, unknown> | null;
  };
}>('/admin/org/:orgId/performance/snapshots', async (request, reply) => {
  const { orgId } = request.params;
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  const { windowLabel } = request.body;
  if (!windowLabel) {
    return reply.code(400).send({ error: 'windowLabel is required' });
  }

  try {
    await authorizeRequestWithGuards('metrics:baseline', orgId, userHeader, request);
    const { data, error } = await supabase
      .from('performance_snapshots')
      .insert({
        org_id: orgId,
        window_label: windowLabel,
        total_runs: request.body.totalRuns ?? 0,
        avg_latency_ms: request.body.avgLatencyMs ?? null,
        p95_latency_ms: request.body.p95LatencyMs ?? null,
        allowlisted_ratio: request.body.allowlistedRatio ?? null,
        hitl_median_minutes: request.body.hitlMedianMinutes ?? null,
        citation_precision: request.body.citationPrecision ?? null,
        temporal_validity: request.body.temporalValidity ?? null,
        binding_warnings: request.body.bindingWarnings ?? null,
        notes: request.body.notes ?? null,
        recorded_by: userHeader,
        metadata: request.body.metadata ?? null,
      })
      .select('id, window_label, collected_at, total_runs, avg_latency_ms, p95_latency_ms, allowlisted_ratio, hitl_median_minutes, citation_precision, temporal_validity, binding_warnings, notes, recorded_by, metadata')
      .maybeSingle();

    if (error) {
      request.log.error({ err: error }, 'performance snapshot insert failed');
      return reply.code(500).send({ error: 'performance_snapshot_insert_failed' });
    }

    await logAuditEvent({
      orgId,
      actorId: userHeader,
      kind: 'performance.snapshot_recorded',
      object: windowLabel,
      after: data ?? null,
    });

    return { snapshot: data };
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'performance snapshot create failed');
    return reply.code(500).send({ error: 'performance_snapshot_failed' });
  }
});

app.get<{ Params: { orgId: string } }>('/admin/org/:orgId/sso', async (request, reply) => {
  const { orgId } = request.params;
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }
  try {
    await authorizeRequestWithGuards('admin:manage', orgId, userHeader, request);
    const connections = await listSsoConnections(orgId);
    return { connections };
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'sso list failed');
    return reply.code(500).send({ error: 'sso_list_failed' });
  }
});

app.post<{
  Params: { orgId: string };
  Body: {
    id?: string;
    provider: 'saml' | 'oidc';
    label?: string;
    metadata?: Record<string, unknown>;
    acsUrl?: string;
    entityId?: string;
    clientId?: string;
    clientSecret?: string;
    defaultRole?: string;
    groupMappings?: Record<string, string>;
  };
}>('/admin/org/:orgId/sso', async (request, reply) => {
  const { orgId } = request.params;
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }
  try {
    await authorizeRequestWithGuards('admin:manage', orgId, userHeader, request);
    const connection = await upsertSsoConnection(orgId, userHeader, request.body);
    return reply.code(request.body.id ? 200 : 201).send({ connection });
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'sso upsert failed');
    return reply.code(500).send({ error: 'sso_upsert_failed' });
  }
});

app.delete<{ Params: { orgId: string; connectionId: string } }>(
  '/admin/org/:orgId/sso/:connectionId',
  async (request, reply) => {
    const { orgId, connectionId } = request.params;
    const userHeader = request.headers['x-user-id'];
    if (!userHeader || typeof userHeader !== 'string') {
      return reply.code(400).send({ error: 'x-user-id header is required' });
    }
    try {
      await authorizeRequestWithGuards('admin:manage', orgId, userHeader, request);
      await deleteSsoConnection(orgId, userHeader, connectionId);
      return reply.code(204).send();
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
        return reply.code(error.statusCode).send({ error: error.message });
      }
      request.log.error({ err: error }, 'sso delete failed');
      return reply.code(500).send({ error: 'sso_delete_failed' });
  }
},
);

app.get<{ Querystring: { orgId?: string; limit?: string } }>('/metrics/slo', async (request, reply) => {
  const { orgId, limit } = request.query ?? {};
  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }

  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('metrics:slo', orgId, userHeader, request);
    const query = supabase
      .from('slo_snapshots')
      .select(
        'captured_at, api_uptime_percent, hitl_response_p95_seconds, retrieval_latency_p95_seconds, citation_precision_p95, notes',
      )
      .eq('org_id', orgId)
      .order('captured_at', { ascending: false });

    const parsedLimit = limit ? Number.parseInt(limit, 10) : undefined;
    if (parsedLimit && Number.isFinite(parsedLimit) && parsedLimit > 0) {
      query.limit(parsedLimit);
    }

    const { data, error } = await query;
    if (error) {
      request.log.error({ err: error }, 'slo query failed');
      return reply.code(500).send({ error: 'slo_query_failed' });
    }

    const rows = (data ?? []) as unknown as SloSnapshotRecord[];
    return { summary: summariseSlo(rows), snapshots: rows };
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'slo fetch failed');
    return reply.code(500).send({ error: 'slo_query_failed' });
  }
});

app.get<{ Querystring: { orgId?: string; format?: string } }>('/metrics/slo/export', async (request, reply) => {
  const { orgId, format } = request.query ?? {};
  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }

  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('metrics:slo', orgId, userHeader, request);
    const { data, error } = await supabase
      .from('slo_snapshots')
      .select(
        'captured_at, api_uptime_percent, hitl_response_p95_seconds, retrieval_latency_p95_seconds, citation_precision_p95, notes',
      )
      .eq('org_id', orgId)
      .order('captured_at', { ascending: false });

    if (error) {
      request.log.error({ err: error }, 'slo export query failed');
      return reply.code(500).send({ error: 'slo_export_failed' });
    }

    const rows = (data ?? []) as unknown as SloSnapshotRecord[];
    if ((format ?? 'json').toLowerCase() === 'csv') {
      const csvRows = [
        ['captured_at', 'api_uptime_percent', 'hitl_response_p95_seconds', 'retrieval_latency_p95_seconds', 'citation_precision_p95', 'notes'],
        ...rows.map((row) => [
          row.captured_at,
          String(row.api_uptime_percent ?? ''),
          String(row.hitl_response_p95_seconds ?? ''),
          String(row.retrieval_latency_p95_seconds ?? ''),
          row.citation_precision_p95 === null ? '' : String(row.citation_precision_p95),
          (row.notes ?? '').replace(/\n/g, ' '),
        ]),
      ];
      const csv = csvRows
        .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
        .join('\n');
      reply.header('content-type', 'text/csv; charset=utf-8');
      reply.header('content-disposition', `attachment; filename="slo-${orgId}.csv"`);
      return csv;
    }

    return { summary: summariseSlo(rows), snapshots: rows };
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'slo export failed');
    return reply.code(500).send({ error: 'slo_export_failed' });
  }
});

app.post<{ Body: { orgId?: string; apiUptimePercent?: number; hitlResponseP95Seconds?: number; retrievalLatencyP95Seconds?: number; citationPrecisionP95?: number | null; notes?: string | null } }>(
  '/metrics/slo',
  async (request, reply) => {
    const { orgId, apiUptimePercent, hitlResponseP95Seconds, retrievalLatencyP95Seconds, citationPrecisionP95, notes } =
      request.body ?? {};
    if (!orgId) {
      return reply.code(400).send({ error: 'orgId is required' });
    }
    const userHeader = request.headers['x-user-id'];
    if (!userHeader || typeof userHeader !== 'string') {
      return reply.code(400).send({ error: 'x-user-id header is required' });
    }

    if (
      typeof apiUptimePercent !== 'number' ||
      typeof hitlResponseP95Seconds !== 'number' ||
      typeof retrievalLatencyP95Seconds !== 'number'
    ) {
      return reply.code(400).send({ error: 'slo_body_invalid' });
    }

    try {
      await authorizeRequestWithGuards('metrics:baseline', orgId, userHeader, request);
      const { data, error } = await supabase
        .from('slo_snapshots')
        .insert({
          org_id: orgId,
          api_uptime_percent: apiUptimePercent,
          hitl_response_p95_seconds: hitlResponseP95Seconds,
          retrieval_latency_p95_seconds: retrievalLatencyP95Seconds,
          citation_precision_p95: citationPrecisionP95 ?? null,
          notes: notes ?? null,
          created_by: userHeader,
        })
        .select()
        .single();

      if (error) {
        request.log.error({ err: error }, 'slo insert failed');
        return reply.code(500).send({ error: 'slo_insert_failed' });
      }

      return data;
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
        return reply.code(error.statusCode).send({ error: error.message });
      }
      request.log.error({ err: error }, 'slo insert exception');
      return reply.code(500).send({ error: 'slo_insert_failed' });
    }
  },
);

app.get<{ Querystring: { orgId?: string; kind?: string; limit?: string } }>('/reports/learning', async (request, reply) => {
  const { orgId, kind, limit } = request.query ?? {};
  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }

  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  let parsedLimit = Number.parseInt(typeof limit === 'string' ? limit : '', 10);
  if (!Number.isFinite(parsedLimit) || parsedLimit <= 0) {
    parsedLimit = 20;
  }
  parsedLimit = Math.min(Math.max(parsedLimit, 1), 200);

  try {
    await authorizeRequestWithGuards('reports:view', orgId, userHeader, request);
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'learning reports authorization failed');
    return reply.code(403).send({ error: 'forbidden' });
  }

  let query = supabase
    .from('agent_learning_reports')
    .select('kind, report_date, payload, created_at')
    .eq('org_id', orgId)
    .order('report_date', { ascending: false })
    .limit(parsedLimit);

  if (kind) {
    query = query.eq('kind', kind);
  }

  const { data, error } = await query;
  if (error) {
    request.log.error({ err: error }, 'learning reports query failed');
    return reply.code(500).send({ error: 'learning_reports_failed' });
  }

  return { reports: mapLearningReports((data ?? []) as LearningReportRow[]) };
});

app.get<{ Querystring: { orgId?: string; periodStart?: string; periodEnd?: string } }>('/reports/dispatches', async (request, reply) => {
  const { orgId, periodStart, periodEnd } = request.query ?? {};
  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  let range: { start: string; end: string } | undefined;
  if (periodStart || periodEnd) {
    try {
      range = resolveDateRange(periodStart, periodEnd);
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : 'invalid_date_range' });
    }
  }

  try {
    await authorizeRequestWithGuards('governance:dispatch', orgId, userHeader, request);
    const query = supabase
      .from('regulator_dispatches')
      .select('id, report_type, period_start, period_end, status, payload_url, metadata, created_at, dispatched_at')
      .eq('org_id', orgId)
      .order('period_start', { ascending: false });

    if (range) {
      query.gte('period_start', range.start).lte('period_end', range.end);
    }

    const { data, error } = await query;
    if (error) {
      request.log.error({ err: error }, 'dispatch query failed');
      return reply.code(500).send({ error: 'dispatch_query_failed' });
    }

    return { dispatches: data ?? [] };
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'dispatch fetch failed');
    return reply.code(500).send({ error: 'dispatch_query_failed' });
  }
});

app.post<{
  Body: {
    orgId?: string;
    reportType?: string;
    periodStart?: string;
    periodEnd?: string;
    payloadUrl?: string | null;
    status?: string;
    metadata?: Record<string, unknown> | null;
    dispatchedAt?: string | null;
  };
}>('/reports/dispatches', async (request, reply) => {
  const { orgId, reportType, periodStart, periodEnd, payloadUrl, status, metadata, dispatchedAt } = request.body ?? {};
  if (!orgId || !reportType || !periodStart || !periodEnd) {
    return reply.code(400).send({ error: 'missing_required_fields' });
  }
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  let dispatchedTimestamp: string | null = null;
  if (dispatchedAt) {
    const parsed = new Date(dispatchedAt);
    if (Number.isNaN(parsed.getTime())) {
      return reply.code(400).send({ error: 'invalid_dispatched_at' });
    }
    dispatchedTimestamp = parsed.toISOString();
  }

  try {
    await authorizeRequestWithGuards('governance:dispatch', orgId, userHeader, request);
    const { data, error } = await supabase
      .from('regulator_dispatches')
      .insert({
        org_id: orgId,
        report_type: reportType,
        period_start: periodStart,
        period_end: periodEnd,
        payload_url: payloadUrl ?? null,
        status: status ?? 'draft',
        metadata: metadata ?? null,
        created_by: userHeader,
        dispatched_at: dispatchedTimestamp,
      })
      .select()
      .single();

    if (error) {
      request.log.error({ err: error }, 'dispatch insert failed');
      return reply.code(500).send({ error: 'dispatch_insert_failed' });
    }

    return data;
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'dispatch insert exception');
    return reply.code(500).send({ error: 'dispatch_insert_failed' });
  }
});

app.get<{ Params: { orgId: string } }>('/admin/org/:orgId/scim-tokens', async (request, reply) => {
  const { orgId } = request.params;
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }
  try {
    await authorizeRequestWithGuards('admin:security', orgId, userHeader, request);
    const tokens = await listScimTokens(orgId);
    return { tokens };
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'scim token list failed');
    return reply.code(500).send({ error: 'scim_list_failed' });
  }
});

app.post<{
  Params: { orgId: string };
  Body: { name: string; expiresAt?: string | null };
}>('/admin/org/:orgId/scim-tokens', async (request, reply) => {
  const { orgId } = request.params;
  const { name, expiresAt } = request.body ?? {};
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }
  if (!name) {
    return reply.code(400).send({ error: 'name is required' });
  }
  try {
    await authorizeRequestWithGuards('admin:security', orgId, userHeader, request);
    const token = await createScimToken(orgId, userHeader, name, expiresAt ?? null);
    return reply.code(201).send(token);
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'scim token create failed');
    return reply.code(500).send({ error: 'scim_create_failed' });
  }
});

app.delete<{ Params: { orgId: string; tokenId: string } }>(
  '/admin/org/:orgId/scim-tokens/:tokenId',
  async (request, reply) => {
    const { orgId, tokenId } = request.params;
    const userHeader = request.headers['x-user-id'];
    if (!userHeader || typeof userHeader !== 'string') {
      return reply.code(400).send({ error: 'x-user-id header is required' });
    }
    try {
      await authorizeRequestWithGuards('admin:security', orgId, userHeader, request);
      await deleteScimToken(orgId, userHeader, tokenId);
      return reply.code(204).send();
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
        return reply.code(error.statusCode).send({ error: error.message });
      }
      request.log.error({ err: error }, 'scim token delete failed');
      return reply.code(500).send({ error: 'scim_delete_failed' });
    }
  },
);

app.get<{ Params: { orgId: string }; Querystring: { limit?: string } }>(
  '/admin/org/:orgId/audit-events',
  async (request, reply) => {
    const { orgId } = request.params;
    const limitParam = request.query.limit ? Number.parseInt(request.query.limit, 10) : 50;
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 200) : 50;
    const userHeader = request.headers['x-user-id'];
    if (!userHeader || typeof userHeader !== 'string') {
      return reply.code(400).send({ error: 'x-user-id header is required' });
    }
    try {
      await authorizeRequestWithGuards('admin:audit', orgId, userHeader, request);
      const { data, error } = await supabase
        .from('audit_events')
        .select('id, kind, object, metadata, created_at, actor_user_id')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) {
        throw new Error(error.message);
      }
      return { events: data ?? [] };
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
        return reply.code(error.statusCode).send({ error: error.message });
      }
      request.log.error({ err: error }, 'audit events fetch failed');
      return reply.code(500).send({ error: 'audit_list_failed' });
    }
  },
);

app.get<{ Params: { orgId: string } }>('/admin/org/:orgId/ip-allowlist', async (request, reply) => {
  const { orgId } = request.params;
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }
  try {
    await authorizeRequestWithGuards('admin:security', orgId, userHeader, request);
    const entries = await listIpAllowlist(orgId);
    return { entries };
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'ip allowlist list failed');
    return reply.code(500).send({ error: 'ip_allowlist_list_failed' });
  }
});

app.post<{
  Params: { orgId: string };
  Body: { cidr: string; description?: string | null };
}>('/admin/org/:orgId/ip-allowlist', async (request, reply) => {
  const { orgId } = request.params;
  const { cidr, description } = request.body ?? {};
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }
  if (!cidr) {
    return reply.code(400).send({ error: 'cidr is required' });
  }
  try {
    await authorizeRequestWithGuards('admin:security', orgId, userHeader, request);
    const entry = await upsertIpAllowlist(orgId, userHeader, { cidr, description: description ?? null });
    return reply.code(201).send({ entry });
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'ip allowlist create failed');
    return reply.code(500).send({ error: 'ip_allowlist_create_failed' });
  }
});

app.patch<{
  Params: { orgId: string; entryId: string };
  Body: { cidr: string; description?: string | null };
}>(
  '/admin/org/:orgId/ip-allowlist/:entryId',
  async (request, reply) => {
    const { orgId, entryId } = request.params;
    const { cidr, description } = request.body ?? {};
    const userHeader = request.headers['x-user-id'];
    if (!userHeader || typeof userHeader !== 'string') {
      return reply.code(400).send({ error: 'x-user-id header is required' });
    }
    if (!cidr) {
      return reply.code(400).send({ error: 'cidr is required' });
    }
    try {
      await authorizeRequestWithGuards('admin:security', orgId, userHeader, request);
      const entry = await upsertIpAllowlist(orgId, userHeader, { id: entryId, cidr, description: description ?? null });
      return { entry };
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
        return reply.code(error.statusCode).send({ error: error.message });
      }
      request.log.error({ err: error }, 'ip allowlist update failed');
      return reply.code(500).send({ error: 'ip_allowlist_update_failed' });
    }
  },
);

app.delete<{ Params: { orgId: string; entryId: string } }>(
  '/admin/org/:orgId/ip-allowlist/:entryId',
  async (request, reply) => {
    const { orgId, entryId } = request.params;
    const userHeader = request.headers['x-user-id'];
    if (!userHeader || typeof userHeader !== 'string') {
      return reply.code(400).send({ error: 'x-user-id header is required' });
    }
    try {
      await authorizeRequestWithGuards('admin:security', orgId, userHeader, request);
      await deleteIpAllowlist(orgId, userHeader, entryId);
      return reply.code(204).send();
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
        return reply.code(error.statusCode).send({ error: error.message });
      }
      request.log.error({ err: error }, 'ip allowlist delete failed');
      return reply.code(500).send({ error: 'ip_allowlist_delete_failed' });
    }
  },
);

function scimError(reply: FastifyReply, status: number, detail: string) {
  return reply
    .code(status)
    .header('Content-Type', 'application/scim+json')
    .send({ schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'], detail });
}

app.get('/scim/v2/Users', async (request, reply) => {
  try {
    const result = await listScimUsers(request.headers.authorization ?? '');
    return reply.header('Content-Type', 'application/scim+json').send(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.startsWith('scim_auth')) {
        return scimError(reply, 401, 'Invalid SCIM token');
      }
      request.log.error({ err: error }, 'scim list failed');
    }
    return scimError(reply, 500, 'Unable to list SCIM users');
  }
});

app.post('/scim/v2/Users', async (request, reply) => {
  try {
    const result = await createScimUser(request.headers.authorization ?? '', request.body);
    return reply.code(201).header('Content-Type', 'application/scim+json').send(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.startsWith('scim_auth')) {
        return scimError(reply, 401, 'Invalid SCIM token');
      }
      request.log.error({ err: error }, 'scim create failed');
    }
    return scimError(reply, 500, 'Unable to create SCIM user');
  }
});

app.patch<{ Params: { id: string } }>('/scim/v2/Users/:id', async (request, reply) => {
  try {
    const result = await patchScimUser(request.headers.authorization ?? '', request.params.id, request.body);
    return reply.header('Content-Type', 'application/scim+json').send(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.startsWith('scim_auth')) {
        return scimError(reply, 401, 'Invalid SCIM token');
      }
      if (error.message === 'scim_user_not_found') {
        return scimError(reply, 404, 'User not found');
      }
      request.log.error({ err: error }, 'scim patch failed');
    }
    return scimError(reply, 500, 'Unable to update SCIM user');
  }
});

app.delete<{ Params: { id: string } }>('/scim/v2/Users/:id', async (request, reply) => {
  try {
    await deleteScimUser(request.headers.authorization ?? '', request.params.id);
    return reply.code(204).send();
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.startsWith('scim_auth')) {
        return scimError(reply, 401, 'Invalid SCIM token');
      }
      request.log.error({ err: error }, 'scim delete failed');
    }
    return scimError(reply, 500, 'Unable to delete SCIM user');
  }
});

app.post<{
  Body: { orgId?: string; userId?: string; eventName?: string; payload?: unknown };
}>('/telemetry', async (request, reply) => {
  const { orgId, userId, eventName, payload } = request.body ?? {};

  if (!orgId || !userId || !eventName) {
    return reply.code(400).send({ error: 'orgId, userId, and eventName are required' });
  }

  try {
    await authorizeRequestWithGuards('telemetry:record', orgId, userId, request);
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'telemetry authorization failed');
    return reply.code(403).send({ error: 'forbidden' });
  }

  const { error } = await supabase.from('ui_telemetry_events').insert({
    org_id: orgId,
    user_id: userId,
    event_name: eventName,
    payload: payload ?? null,
  });

  if (error) {
    request.log.error({ err: error }, 'telemetry insert failed');
    return reply.code(500).send({ error: 'telemetry_failed' });
  }

  return reply.code(204).send();
});

app.get<{ Querystring: { orgId?: string } }>('/workspace', async (request, reply) => {
  const { orgId } = request.query;

  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }

  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('workspace:view', orgId, userHeader, request);
    const [jurisdictionsResult, mattersResult, complianceResult, hitlResult] = await Promise.all([
      supabase.from('jurisdictions').select('code, name, eu, ohada').order('name', { ascending: true }),
      supabase
        .from('agent_runs')
        .select('id, question, risk_level, hitl_required, status, started_at, finished_at, jurisdiction_json, agent_code')
        .eq('org_id', orgId)
        .order('started_at', { ascending: false })
        .limit(8),
      supabase
        .from('sources')
        .select('id, title, publisher, source_url, jurisdiction_code, consolidated, effective_date, created_at')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(8),
      supabase
        .from('hitl_queue')
        .select('id, run_id, reason, status, created_at')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(8),
    ]);

    const jurisdictionRows = jurisdictionsResult.data ?? [];
    const matterRows = mattersResult.data ?? [];
    const complianceRows = complianceResult.data ?? [];
    const hitlRows = hitlResult.data ?? [];

    if (jurisdictionsResult.error) {
      request.log.error({ err: jurisdictionsResult.error }, 'workspace jurisdictions query failed');
    }
    if (mattersResult.error) {
      request.log.error({ err: mattersResult.error }, 'workspace matters query failed');
    }
    if (complianceResult.error) {
      request.log.error({ err: complianceResult.error }, 'workspace compliance query failed');
    }
    if (hitlResult.error) {
      request.log.error({ err: hitlResult.error }, 'workspace hitl query failed');
    }

    const matterCounts = new Map<string, number>();
    for (const row of matterRows) {
      const jurisdiction = extractCountry(row.jurisdiction_json);
      const key = jurisdiction ?? 'UNK';
      matterCounts.set(key, (matterCounts.get(key) ?? 0) + 1);
    }

    const jurisdictions = jurisdictionRows.map((row) => ({
      code: row.code,
      name: row.name,
      eu: row.eu,
      ohada: row.ohada,
      matterCount: matterCounts.get(row.code) ?? 0,
    }));

    const matters = matterRows.map((row) => ({
      id: row.id,
      question: row.question,
      status: row.status,
      riskLevel: row.risk_level,
      hitlRequired: row.hitl_required,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      jurisdiction: extractCountry(row.jurisdiction_json),
      agentCode: typeof row.agent_code === 'string' ? row.agent_code : null,
    }));

    const complianceWatch = complianceRows.map((row) => ({
      id: row.id,
      title: row.title,
      publisher: row.publisher,
      url: row.source_url,
      jurisdiction: row.jurisdiction_code,
      consolidated: row.consolidated,
      effectiveDate: row.effective_date,
      createdAt: row.created_at,
    }));

    const hitlInbox = hitlRows.map((row) => ({
      id: row.id,
      runId: row.run_id,
      reason: row.reason,
      status: row.status,
      createdAt: row.created_at,
    }));

    const pendingCount = hitlInbox.filter((item) => item.status === 'pending').length;

    const desk = buildPhaseCWorkspaceDesk();

    return {
      jurisdictions,
      matters,
      complianceWatch,
      hitlInbox: {
        items: hitlInbox,
        pendingCount,
      },
      desk,
    };
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'workspace overview failed');
    return reply.code(500).send({ error: 'workspace_failed' });
  }
});

app.get<{ Querystring: { orgId?: string } }>('/citations', async (request, reply) => {
  const { orgId } = request.query;

  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }

  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('citations:view', orgId, userHeader, request);
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'citations authorization failed');
    return reply.code(403).send({ error: 'forbidden' });
  }

  const { data, error } = await supabase
    .from('sources')
    .select(
      'id, title, source_type, jurisdiction_code, source_url, publisher, binding_lang, consolidated, language_note, effective_date, created_at, capture_sha256, link_last_status, link_last_checked_at, residency_zone',
    )
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    request.log.error({ err: error }, 'citations query failed');
    return reply.code(500).send({ error: 'citations_failed' });
  }

  const now = Date.now();
  const staleThresholdMs = 30 * 24 * 60 * 60 * 1000;
  return {
    entries: (data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      sourceType: row.source_type,
      jurisdiction: row.jurisdiction_code,
      url: row.source_url,
      publisher: row.publisher,
      bindingLanguage: row.binding_lang,
      consolidated: row.consolidated,
      languageNote: row.language_note,
      effectiveDate: row.effective_date,
      capturedAt: row.created_at,
      checksum: row.capture_sha256,
      residencyZone: row.residency_zone ?? null,
      stale:
        row.link_last_status === 'stale' ||
        (row.link_last_checked_at && now - new Date(row.link_last_checked_at).getTime() > staleThresholdMs)
          ? true
          : false,
      linkStatus: row.link_last_status ?? null,
    })),
  };
});

app.get<{ Querystring: { orgId?: string; sourceId?: string } }>('/case-scores', async (request, reply) => {
  const { orgId, sourceId } = request.query;
  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }

  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('cases:view', orgId, userHeader, request);
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'case_scores authorization failed');
    return reply.code(403).send({ error: 'forbidden' });
  }

  const query = supabase
    .from('case_scores')
    .select('id, source_id, juris_code, score_overall, axes, hard_block, version, model_ref, notes, computed_at, sources(title, source_url, trust_tier, court_rank)')
    .eq('org_id', orgId)
    .order('computed_at', { ascending: false })
    .limit(50);

  if (sourceId) {
    query.eq('source_id', sourceId);
  }

  const { data, error } = await query;
  if (error) {
    request.log.error({ err: error }, 'case_scores query failed');
    return reply.code(500).send({ error: 'case_scores_failed' });
  }

  return {
    scores: (data ?? []).map((row) => ({
      id: row.id,
      sourceId: row.source_id,
      jurisdiction: row.juris_code,
      score: row.score_overall,
      axes: row.axes,
      hardBlock: row.hard_block,
      version: row.version,
      modelRef: row.model_ref,
      notes: row.notes,
      computedAt: row.computed_at,
      source: row.sources
        ? {
            title: row.sources.title,
            url: row.sources.source_url,
            trustTier: row.sources.trust_tier,
            courtRank: row.sources.court_rank,
          }
        : null,
    })),
  };
});

app.get<{ Querystring: { orgId?: string; sourceId?: string } }>('/case-treatments', async (request, reply) => {
  const { orgId, sourceId } = request.query;
  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }

  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('cases:view', orgId, userHeader, request);
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'case_treatments authorization failed');
    return reply.code(403).send({ error: 'forbidden' });
  }

  const query = supabase
    .from('case_treatments')
    .select('id, source_id, citing_source_id, treatment, court_rank, weight, decided_at, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (sourceId) {
    query.eq('source_id', sourceId);
  }

  const { data, error } = await query;
  if (error) {
    request.log.error({ err: error }, 'case_treatments query failed');
    return reply.code(500).send({ error: 'case_treatments_failed' });
  }

  return { treatments: data ?? [] };
});

app.get<{ Querystring: { orgId?: string; sourceId?: string } }>('/case-statute-links', async (request, reply) => {
  const { orgId, sourceId } = request.query;
  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }

  if (!sourceId) {
    return reply.code(400).send({ error: 'sourceId is required' });
  }

  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('cases:view', orgId, userHeader, request);
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'case_statute_links authorization failed');
    return reply.code(403).send({ error: 'forbidden' });
  }

  const { data, error } = await supabase
    .from('case_statute_links')
    .select('id, statute_url, article, alignment_score, rationale_json, created_at')
    .eq('org_id', orgId)
    .eq('case_source_id', sourceId)
    .order('created_at', { ascending: false });

  if (error) {
    request.log.error({ err: error }, 'case_statute_links query failed');
    return reply.code(500).send({ error: 'case_statute_links_failed' });
  }

  return { links: data ?? [] };
});

app.get<{
  Querystring: { orgId?: string; jurisdiction?: string; matterType?: string };
}>('/drafting/templates', async (request, reply) => {
  const { orgId, jurisdiction, matterType } = request.query;

  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }

  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('templates:view', orgId, userHeader, request);
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'templates authorization failed');
    return reply.code(403).send({ error: 'forbidden' });
  }

  let query = supabase
    .from('pleading_templates')
    .select('id, org_id, jurisdiction_code, matter_type, title, summary, sections, fill_ins, locale, created_at')
    .or(`org_id.eq.${orgId},org_id.is.null`)
    .order('jurisdiction_code', { ascending: true })
    .order('created_at', { ascending: false });

  if (jurisdiction) {
    query = query.in('jurisdiction_code', [jurisdiction, 'FR', 'OHADA']);
  }

  if (matterType) {
    query = query.eq('matter_type', matterType);
  }

  const { data, error } = await query;

  if (error) {
    request.log.error({ err: error }, 'templates query failed');
    return reply.code(500).send({ error: 'templates_unavailable' });
  }

  return {
    templates: (data ?? []).map((row) => ({
      id: row.id,
      jurisdiction: row.jurisdiction_code,
      matterType: row.matter_type,
      title: row.title,
      summary: row.summary,
      sections: row.sections,
      fillIns: row.fill_ins,
      locale: row.locale,
      scope: row.org_id ? 'org' : 'global',
    })),
  };
});

app.get<{ Querystring: { orgId?: string } }>('/hitl/metrics', async (request, reply) => {
  const { orgId } = request.query;
  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }

  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('hitl:view', orgId, userHeader, request);
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'hitl metrics authorization failed');
    return reply.code(403).send({ error: 'forbidden' });
  }

  const { data, error } = await supabase
    .from('agent_learning_reports')
    .select('kind, report_date, payload')
    .eq('org_id', orgId)
    .in('kind', ['queue', 'drift', 'fairness'])
    .order('report_date', { ascending: false })
    .limit(90);

  if (error) {
    request.log.error({ err: error }, 'hitl metrics query failed');
    return reply.code(500).send({ error: 'hitl_metrics_failed' });
  }

  const latest = new Map<
    string,
    { reportDate: string | null; payload: Record<string, unknown> | null }
  >();

  for (const row of data ?? []) {
    const kind = typeof row.kind === 'string' ? row.kind : null;
    if (!kind || latest.has(kind)) {
      continue;
    }
    const payload = row.payload && typeof row.payload === 'object' ? (row.payload as Record<string, unknown>) : null;
    const reportDate = typeof row.report_date === 'string' ? row.report_date : null;
    latest.set(kind, { reportDate, payload });
  }

  const queueRow = latest.get('queue');
  const queuePayload = queueRow?.payload ?? null;
  const queue = queuePayload
    ? {
        reportDate: queueRow?.reportDate ?? null,
        pending: toNumber(queuePayload.pending) ?? 0,
        byType: toNumberRecord(queuePayload.byType),
        oldestCreatedAt:
          typeof queuePayload.oldestCreatedAt === 'string' ? queuePayload.oldestCreatedAt : null,
        capturedAt:
          typeof queuePayload.capturedAt === 'string'
            ? queuePayload.capturedAt
            : queueRow?.reportDate ?? null,
      }
    : null;

  const driftRow = latest.get('drift');
  const driftPayload = driftRow?.payload ?? null;
  const drift = driftPayload
    ? {
        reportDate: driftRow?.reportDate ?? null,
        totalRuns: toNumber(driftPayload.totalRuns) ?? 0,
        highRiskRuns: toNumber(driftPayload.highRiskRuns) ?? 0,
        hitlEscalations: toNumber(driftPayload.hitlEscalations) ?? 0,
        allowlistedRatio: toNumber(driftPayload.allowlistedRatio),
      }
    : null;

  const fairnessRow = latest.get('fairness');
  const fairnessPayload = fairnessRow?.payload ?? null;
  const fairness = fairnessPayload
    ? {
        reportDate: fairnessRow?.reportDate ?? null,
        overall:
          fairnessPayload.overall && typeof fairnessPayload.overall === 'object'
            ? fairnessPayload.overall
            : null,
        capturedAt:
          typeof fairnessPayload.capturedAt === 'string'
            ? fairnessPayload.capturedAt
            : fairnessRow?.reportDate ?? null,
        jurisdictions: Array.isArray(fairnessPayload.jurisdictions)
          ? fairnessPayload.jurisdictions
          : [],
        benchmarks: Array.isArray(fairnessPayload.benchmarks) ? fairnessPayload.benchmarks : [],
        flagged:
          fairnessPayload.flagged && typeof fairnessPayload.flagged === 'object'
            ? fairnessPayload.flagged
            : { jurisdictions: [], benchmarks: [] },
      }
    : null;

  return {
    orgId,
    metrics: {
      queue,
      drift,
      fairness,
    },
  };
});

app.get<{ Querystring: { orgId?: string } }>('/hitl', async (request, reply) => {
  const { orgId } = request.query;
  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }

  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('hitl:view', orgId, userHeader, request);
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'hitl view authorization failed');
    return reply.code(403).send({ error: 'forbidden' });
  }

  const { data, error } = await supabase
    .from('hitl_queue')
    .select('id, run_id, reason, status, created_at, updated_at, resolution_minutes, resolution_bucket, reviewer_comment')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (error) {
    request.log.error({ err: error }, 'hitl query failed');
    return reply.code(500).send({ error: 'hitl_failed' });
  }

  return {
    items: (data ?? []).map((row) => ({
      id: row.id,
      runId: row.run_id,
      reason: row.reason,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      resolutionMinutes: row.resolution_minutes,
      resolutionBucket: row.resolution_bucket,
      reviewerComment: row.reviewer_comment,
    })),
  };
});

app.get<{ Params: { id: string }; Querystring: { orgId?: string } }>('/hitl/:id', async (request, reply) => {
  const { id } = request.params;
  const { orgId } = request.query;
  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }

  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('hitl:view', orgId, userHeader, request);
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'hitl detail authorization failed');
    return reply.code(403).send({ error: 'forbidden' });
  }

  const hitlRecord = await supabase
    .from('hitl_queue')
    .select('id, run_id, reason, status, created_at, updated_at, resolution_minutes, resolution_bucket, reviewer_comment')
    .eq('org_id', orgId)
    .eq('id', id)
    .maybeSingle();

  if (hitlRecord.error) {
    request.log.error({ err: hitlRecord.error }, 'hitl detail query failed');
    return reply.code(500).send({ error: 'hitl_detail_failed' });
  }
  if (!hitlRecord.data) {
    return reply.code(404).send({ error: 'hitl_not_found' });
  }

  const runId = hitlRecord.data.run_id as string | null;
  const [run, citations, retrieval, edits] = await Promise.all([
    runId
      ? supabase
          .from('agent_runs')
          .select('id, org_id, question, jurisdiction_json, irac, risk_level, status, started_at, finished_at, hitl_required')
          .eq('id', runId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    runId
      ? supabase
          .from('run_citations')
          .select('title, publisher, url, domain_ok, note')
          .eq('run_id', runId)
      : Promise.resolve({ data: [], error: null }),
    runId
      ? supabase
          .from('run_retrieval_sets')
          .select('id, origin, snippet, similarity, weight, metadata')
          .eq('run_id', runId)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from('hitl_reviewer_edits')
      .select('id, action, comment, reviewer_id, created_at, previous_payload, revised_payload')
      .eq('hitl_id', id)
      .order('created_at', { ascending: false }),
  ]);

  if (run && run.error) {
    request.log.error({ err: run.error }, 'hitl detail run fetch failed');
    return reply.code(500).send({ error: 'hitl_detail_failed' });
  }
  if (citations.error) {
    request.log.error({ err: citations.error }, 'hitl detail citations failed');
    return reply.code(500).send({ error: 'hitl_detail_failed' });
  }
  if (retrieval.error) {
    request.log.error({ err: retrieval.error }, 'hitl detail retrieval failed');
    return reply.code(500).send({ error: 'hitl_detail_failed' });
  }
  if (edits.error) {
    request.log.error({ err: edits.error }, 'hitl detail reviewer edits failed');
    return reply.code(500).send({ error: 'hitl_detail_failed' });
  }

  const runData = run?.data ?? null;

  return {
    hitl: {
      id: hitlRecord.data.id,
      reason: hitlRecord.data.reason,
      status: hitlRecord.data.status,
      createdAt: hitlRecord.data.created_at,
      updatedAt: hitlRecord.data.updated_at,
      resolutionMinutes: hitlRecord.data.resolution_minutes,
      resolutionBucket: hitlRecord.data.resolution_bucket,
      reviewerComment: hitlRecord.data.reviewer_comment,
    },
    run: runData
      ? {
          id: runData.id,
          orgId: runData.org_id ?? null,
          question: runData.question,
          jurisdiction: extractCountry(runData.jurisdiction_json),
          irac: runData.irac,
          riskLevel: runData.risk_level,
          status: runData.status,
          hitlRequired: runData.hitl_required,
          startedAt: runData.started_at,
          finishedAt: runData.finished_at,
        }
      : null,
    citations: (citations.data ?? []).map((citation) => ({
      title: citation.title,
      publisher: citation.publisher,
      url: citation.url,
      domainOk: citation.domain_ok,
      note: citation.note ?? null,
    })),
    retrieval: (retrieval.data ?? []).map((entry) => ({
      id: entry.id,
      origin: entry.origin,
      snippet: entry.snippet,
      similarity: entry.similarity === null ? null : Number(entry.similarity),
      weight: entry.weight === null ? null : Number(entry.weight),
      metadata: typeof entry.metadata === 'object' && entry.metadata !== null ? entry.metadata : {},
    })),
    edits:
      edits.data?.map((row) => ({
        id: row.id,
        action: row.action,
        comment: row.comment,
        reviewerId: row.reviewer_id,
        createdAt: row.created_at,
        previousPayload: row.previous_payload ?? null,
        revisedPayload: row.revised_payload ?? null,
      })) ?? [],
  };
});

app.post<{
  Params: { id: string };
  Body: { action?: string; comment?: string; reviewerId?: string; revisedPayload?: IRACPayload | null };
}>(
  '/hitl/:id',
  async (request, reply) => {
    const { id } = request.params;
    const { action, comment, reviewerId, revisedPayload } = request.body ?? {};

    if (!action) {
      return reply.code(400).send({ error: 'action is required' });
    }

    const userHeader = request.headers['x-user-id'];
    const orgHeader = request.headers['x-org-id'];
    if (!userHeader || typeof userHeader !== 'string' || !orgHeader || typeof orgHeader !== 'string') {
      return reply
        .code(400)
        .send({ error: 'x-user-id and x-org-id headers are required for HITL actions' });
    }

    try {
      await authorizeRequestWithGuards('hitl:act', orgHeader, userHeader, request);
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
        return reply.code(error.statusCode).send({ error: error.message });
      }
      request.log.error({ err: error }, 'hitl action authorization failed');
      return reply.code(403).send({ error: 'forbidden' });
    }

    const statusMap: Record<string, string> = {
      approve: 'approved',
      request_changes: 'changes_requested',
      reject: 'rejected',
    };
    const newStatus = statusMap[action];
    if (!newStatus) {
      return reply.code(400).send({ error: 'invalid_action' });
    }

    const existingResult = await supabase
      .from('hitl_queue')
      .select('id, run_id, org_id, created_at, status')
      .eq('id', id)
      .maybeSingle();

    if (existingResult.error) {
      request.log.error({ err: existingResult.error }, 'hitl fetch failed before action');
      return reply.code(500).send({ error: 'hitl_fetch_failed' });
    }

    const existing = existingResult.data as
      | { id?: string; run_id?: string; org_id?: string | null; created_at?: string | null; status?: string }
      | null;
    if (!existing) {
      return reply.code(404).send({ error: 'hitl_not_found' });
    }

    const runLookup = existing.run_id
      ? await supabase
          .from('agent_runs')
          .select('id, org_id, irac')
          .eq('id', existing.run_id as string)
          .maybeSingle()
      : { data: null, error: null };

    if (runLookup.error) {
      request.log.warn({ err: runLookup.error }, 'hitl run lookup failed for reviewer edit');
    }

    const previousPayload =
      runLookup.data && typeof runLookup.data === 'object' && 'irac' in runLookup.data
        ? (runLookup.data.irac as IRACPayload | null)
        : null;
    const runOrgIdCandidate =
      (runLookup.data && typeof runLookup.data === 'object' && runLookup.data.org_id
        ? (runLookup.data.org_id as string)
        : null) ?? (typeof existing.org_id === 'string' ? existing.org_id : null);

    const sanitizedRevisedPayload =
      revisedPayload && typeof revisedPayload === 'object' ? revisedPayload : null;

    const now = new Date();
    const nowIso = now.toISOString();
    const rawMinutes = minutesBetween(existing.created_at as string | null, now);
    const minutes = rawMinutes === null ? null : Math.round(rawMinutes * 100) / 100;
    const bucket = bucketResolution(minutes);
    const reviewerReference = reviewerId ?? userHeader;

    const update = await supabase
      .from('hitl_queue')
      .update({
        status: newStatus,
        reviewer_id: reviewerReference ?? null,
        updated_at: nowIso,
        reviewer_comment: comment ?? null,
        resolution_minutes: minutes,
        resolution_bucket: bucket,
      })
      .eq('id', id)
      .select('run_id, org_id')
      .single();

    if (update.error || !update.data) {
      request.log.error({ err: update.error }, 'hitl update failed');
      return reply.code(500).send({ error: 'hitl_update_failed' });
    }

    await supabase
      .from('agent_runs')
      .update({ status: newStatus, hitl_required: newStatus !== 'approved' })
      .eq('id', update.data.run_id);

    const editInsert = await supabase.from('hitl_reviewer_edits').insert({
      hitl_id: id,
      run_id: update.data.run_id,
      org_id:
        runOrgIdCandidate ??
        (typeof update.data.org_id === 'string' ? update.data.org_id : null) ??
        orgHeader,
      reviewer_id: reviewerReference ?? null,
      action: newStatus,
      comment: comment ?? null,
      previous_payload: previousPayload ?? null,
      revised_payload: sanitizedRevisedPayload,
    });

    if (editInsert.error) {
      request.log.warn({ err: editInsert.error }, 'hitl reviewer edit insert failed');
    }

    if (newStatus !== 'approved') {
      const learningInsert = await supabase.from('agent_learning_jobs').insert({
        org_id: update.data.org_id ?? existing.org_id ?? null,
        type: 'review_feedback_ticket',
        payload: {
          runId: update.data.run_id,
          hitlId: id,
          action: newStatus,
          reviewerId: reviewerReference ?? null,
          comment: comment ?? null,
          resolutionMinutes: minutes ?? null,
        },
      });
      if (learningInsert.error) {
        request.log.warn({ err: learningInsert.error }, 'review feedback learning job insert failed');
      }
    }

    try {
      await logAuditEvent({
        orgId: orgHeader,
        actorId: userHeader,
        kind: 'hitl.action',
        object: id,
        metadata: {
          run_id: update.data.run_id,
          status: newStatus,
          comment: comment ?? null,
          resolution_minutes: minutes ?? null,
          resolution_bucket: bucket,
        },
      });
    } catch (error) {
      request.log.warn({ err: error }, 'hitl audit failed');
    }

    return { status: newStatus, resolutionMinutes: minutes ?? null, resolutionBucket: bucket };
  },
);

app.get<{ Querystring: { orgId?: string } }>('/matters', async (request, reply) => {
  const { orgId } = request.query;
  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }

  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('cases:view', orgId, userHeader, request);
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'matters authorization failed');
    return reply.code(403).send({ error: 'forbidden' });
  }

  const matterResult = await supabase
    .from('matters')
    .select(
      'id, org_id, title, description, status, risk_level, hitl_required, jurisdiction_code, procedure, residency_zone, filing_date, decision_date, structured_payload, metadata, created_at, updated_at, agent_run_id, primary_document_id',
    )
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (matterResult.error) {
    request.log.error({ err: matterResult.error }, 'matters query failed');
    return reply.code(500).send({ error: 'matters_failed' });
  }

  const matterRows = (matterResult.data ?? []).map((row) => normaliseMatterRow(row as Record<string, unknown>));
  const matterIds = matterRows.map((row) => row.id);
  const deadlinesMap = new Map<string, Array<{ id: string; name: string; due_at: string; rule_reference: string | null; notes: string | null }>>();
  const citeCheckMap = new Map<string, CiteCheckSummary>();

  if (matterIds.length > 0) {
    const deadlinesResult = await supabase
      .from('matter_deadlines')
      .select('id, matter_id, name, due_at, rule_reference, notes')
      .in('matter_id', matterIds)
      .order('due_at', { ascending: true });

    if (deadlinesResult.error) {
      request.log.warn({ err: deadlinesResult.error }, 'matter_deadlines query failed');
    } else {
      for (const row of deadlinesResult.data ?? []) {
        const matterId = typeof row.matter_id === 'string' ? row.matter_id : null;
        const dueAt = typeof row.due_at === 'string' ? row.due_at : null;
        if (!matterId || !dueAt) {
          continue;
        }
        const list = deadlinesMap.get(matterId) ?? [];
        list.push({
          id: String(row.id),
          name: typeof row.name === 'string' ? row.name : 'Deadline',
          due_at: dueAt,
          rule_reference: typeof row.rule_reference === 'string' ? row.rule_reference : null,
          notes: typeof row.notes === 'string' ? row.notes : null,
        });
        deadlinesMap.set(matterId, list);
      }
    }
  }

  if (matterIds.length > 0) {
    const documentsResult = await supabase
      .from('matter_documents')
      .select('matter_id, cite_check_status')
      .in('matter_id', matterIds);

    if (documentsResult.error) {
      request.log.warn({ err: documentsResult.error }, 'matter_documents_status_query_failed');
    } else {
      const statusMap = new Map<string, Array<string | null>>();
      for (const row of documentsResult.data ?? []) {
        const matterId = typeof row.matter_id === 'string' ? row.matter_id : null;
        if (!matterId) continue;
        const list = statusMap.get(matterId) ?? [];
        list.push(typeof row.cite_check_status === 'string' ? row.cite_check_status : null);
        statusMap.set(matterId, list);
      }
      for (const [matterId, statuses] of statusMap.entries()) {
        citeCheckMap.set(matterId, summariseCiteCheckStatus(statuses));
      }
    }
  }

  const now = Date.now();
  const matters = matterRows.map((row) => {
    const deadlines = deadlinesMap.get(row.id) ?? [];
    let nextDeadline: { name: string; dueAt: string; ruleReference: string | null } | null = null;
    for (const deadline of deadlines) {
      const dueTime = new Date(deadline.due_at).getTime();
      if (Number.isNaN(dueTime)) {
        continue;
      }
      if (dueTime >= now && (!nextDeadline || dueTime < new Date(nextDeadline.dueAt).getTime())) {
        nextDeadline = {
          name: deadline.name,
          dueAt: deadline.due_at,
          ruleReference: deadline.rule_reference ?? null,
        };
      }
    }

    const calendarSettings = extractCalendarSettings(row.metadata);
    const citeCheck = citeCheckMap.get(row.id) ?? { total: 0, verified: 0, pending: 0, manual: 0 };

    return {
      id: row.id,
      title: row.title,
      status: row.status,
      riskLevel: row.risk_level,
      hitlRequired: row.hitl_required ?? false,
      jurisdiction: row.jurisdiction_code,
      procedure: row.procedure,
      residencyZone: row.residency_zone,
      filingDate: row.filing_date,
      decisionDate: row.decision_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      calendarSettings,
      citeCheck,
      nextDeadline,
    };
  });

  return { matters };
});

app.post<{
  Body: {
    orgId?: string;
    userId?: string;
    title?: string;
    description?: string;
    jurisdiction?: string;
    procedure?: string;
    status?: string;
    riskLevel?: string;
    hitlRequired?: boolean;
    filingDate?: string;
    decisionDate?: string;
    agentRunId?: string;
    draftId?: string;
    primaryDocumentId?: string;
    deadlines?: Array<{
      id?: string;
      name: string;
      dueAt: string;
      ruleReference?: string;
      notes?: string;
      metadata?: Record<string, unknown>;
    }>;
    documents?: Array<{
      id?: string;
      documentId: string;
      role?: string;
      citeCheckStatus?: string;
      metadata?: Record<string, unknown>;
    }>;
    metadata?: Record<string, unknown>;
    structuredPayload?: unknown;
    calendarType?: 'calendar' | 'court';
    calendarTimezone?: string;
    calendarMethod?: 'standard' | 'expedited' | 'extended';
  };
}>('/matters', async (request, reply) => {
  const body = request.body ?? {};
  const orgId = typeof body.orgId === 'string' ? body.orgId : undefined;
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!orgId || title.length === 0) {
    return reply.code(400).send({ error: 'orgId and title are required' });
  }

  const headerUser = typeof request.headers['x-user-id'] === 'string' ? (request.headers['x-user-id'] as string) : undefined;
  const actor = typeof body.userId === 'string' && body.userId.trim().length > 0 ? body.userId : headerUser;
  if (!actor) {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('cases:manage', orgId, actor, request);
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof (error as any).statusCode === 'number') {
      return reply.code((error as any).statusCode).send({ error: (error as Error).message });
    }
    request.log.warn({ err: error, orgId, actor }, 'matter_authorization_failed');
    return reply.code(403).send({ error: 'forbidden' });
  }

  const description = typeof body.description === 'string' ? body.description : null;
  const jurisdiction = typeof body.jurisdiction === 'string' ? body.jurisdiction.toUpperCase() : null;
  const residencyZone = mapJurisdictionToResidency(jurisdiction);
  const procedure = typeof body.procedure === 'string' ? body.procedure : null;
  const status = typeof body.status === 'string' ? body.status : 'open';
  const filingDate = typeof body.filingDate === 'string' ? body.filingDate : null;
  const decisionDate = typeof body.decisionDate === 'string' ? body.decisionDate : null;

  let riskLevel = typeof body.riskLevel === 'string' ? body.riskLevel : null;
  let hitlRequired = typeof body.hitlRequired === 'boolean' ? body.hitlRequired : undefined;
  let structuredPayload = body.structuredPayload ?? null;
  let metadata =
    body.metadata && typeof body.metadata === 'object'
      ? { ...(body.metadata as Record<string, unknown>) }
      : ({} as Record<string, unknown>);

  const calendarType = body.calendarType === 'court' ? 'court' : 'calendar';
  const calendarTimezone =
    typeof body.calendarTimezone === 'string' && body.calendarTimezone.trim().length > 0
      ? body.calendarTimezone.trim()
      : 'Europe/Paris';
  const calendarMethod =
    body.calendarMethod === 'expedited' || body.calendarMethod === 'extended'
      ? body.calendarMethod
      : 'standard';

  const calendarSettings: CalendarSettings = {
    type: calendarType,
    timezone: calendarTimezone,
    method: calendarMethod,
  };

  metadata = {
    ...metadata,
    calendar: calendarSettings,
  };

  const agentRunId = typeof body.agentRunId === 'string' ? body.agentRunId : null;
  if (agentRunId) {
    const run = await supabase
      .from('agent_runs')
      .select('id, org_id, question, jurisdiction_json, irac, risk_level, hitl_required, plan_trace, verification')
      .eq('org_id', orgId)
      .eq('id', agentRunId)
      .maybeSingle();
    if (run.error) {
      request.log.warn({ err: run.error, orgId, agentRunId }, 'agent_run_lookup_failed');
    } else if (run.data) {
      const row = run.data as Record<string, unknown>;
      structuredPayload = structuredPayload ?? row.irac ?? null;
      if (!riskLevel && typeof row.risk_level === 'string') {
        riskLevel = row.risk_level;
      }
      if (hitlRequired === undefined && typeof row.hitl_required === 'boolean') {
        hitlRequired = row.hitl_required;
      }
      metadata = {
        ...metadata,
        agentRun: {
          question: row.question ?? null,
          jurisdiction: extractCountry(row.jurisdiction_json),
          planTrace: row.plan_trace ?? null,
          verification: row.verification ?? null,
        },
      };
    }
  }

  const draftId = typeof body.draftId === 'string' ? body.draftId : null;
  let primaryDocumentId = typeof body.primaryDocumentId === 'string' ? body.primaryDocumentId : null;
  if (draftId) {
    const draftLookup = await supabase
      .from('drafts')
      .select('id, document_id, structured_payload, verification, plan, trust_panel')
      .eq('org_id', orgId)
      .eq('id', draftId)
      .maybeSingle();
    if (draftLookup.error) {
      request.log.warn({ err: draftLookup.error, orgId, draftId }, 'draft_lookup_failed');
    } else if (draftLookup.data) {
      const row = draftLookup.data as Record<string, unknown>;
      if (!structuredPayload && row.structured_payload) {
        structuredPayload = row.structured_payload;
      }
      primaryDocumentId = primaryDocumentId ?? (typeof row.document_id === 'string' ? row.document_id : null);
      metadata = {
        ...metadata,
        draft: {
          id: row.id,
          verification: row.verification ?? null,
          plan: row.plan ?? null,
          trustPanel: row.trust_panel ?? null,
        },
      };
    }
  }

  const schedule: Array<{
    name: string;
    due_at: string;
    rule_reference?: string | null;
    notes?: string | null;
    metadata?: Record<string, unknown>;
  }> =
    Array.isArray(body.deadlines) && body.deadlines.length > 0
      ? body.deadlines
          .filter((deadline) => typeof deadline?.name === 'string' && typeof deadline?.dueAt === 'string')
          .map((deadline) => ({
            name: deadline.name!,
            due_at: deadline.dueAt!,
            rule_reference: deadline.ruleReference ?? null,
            notes: deadline.notes ?? null,
            metadata:
              deadline.metadata && typeof deadline.metadata === 'object'
                ? (deadline.metadata as Record<string, unknown>)
                : {},
          }))
      : computeMatterSchedule({
          jurisdiction,
          filingDate,
          procedure,
          calendarType: calendarSettings.type,
          timezone: calendarSettings.timezone,
          method: calendarSettings.method,
        }).map((item) => ({
          name: item.name,
          due_at: item.dueAt,
          rule_reference: item.ruleReference,
          notes: item.notes,
          metadata: {},
        }));

  const matterInsert = await supabase
    .from('matters')
    .insert({
      org_id: orgId,
      created_by: actor,
      agent_run_id: agentRunId,
      primary_document_id: primaryDocumentId,
      title,
      description,
      jurisdiction_code: jurisdiction,
      procedure,
      status,
      risk_level: riskLevel,
      hitl_required: hitlRequired ?? false,
      filing_date: filingDate,
      decision_date: decisionDate,
      structured_payload: structuredPayload,
      metadata,
      residency_zone: residencyZone,
    })
    .select(
      'id, org_id, title, description, status, risk_level, hitl_required, jurisdiction_code, procedure, residency_zone, filing_date, decision_date, structured_payload, metadata, created_at, updated_at, agent_run_id, primary_document_id',
    )
    .single();

  if (matterInsert.error || !matterInsert.data) {
    request.log.error({ err: matterInsert.error, orgId }, 'matter_insert_failed');
    return reply.code(500).send({ error: 'matter_create_failed' });
  }

  const matterRow = normaliseMatterRow(matterInsert.data as Record<string, unknown>);

  let insertedDeadlines: Array<{
    id: string;
    name: string;
    dueAt: string;
    ruleReference: string | null;
    notes: string | null;
    metadata: Record<string, unknown>;
  }> = [];
  if (schedule.length > 0) {
    const insertDeadlines = await supabase
      .from('matter_deadlines')
      .insert(
        schedule.map((item) => ({
          matter_id: matterRow.id,
          name: item.name,
          due_at: item.due_at,
          rule_reference: item.rule_reference ?? null,
          notes: item.notes ?? null,
          metadata: item.metadata ?? {},
        })),
      )
      .select('id, name, due_at, rule_reference, notes, metadata');
    if (insertDeadlines.error) {
      request.log.warn({ err: insertDeadlines.error, orgId, matterId: matterRow.id }, 'matter_deadlines_insert_failed');
    } else {
      insertedDeadlines = (insertDeadlines.data ?? []).map((row) => ({
        id: String(row.id),
        name: row.name as string,
        dueAt: row.due_at as string,
        ruleReference: (row.rule_reference as string | null) ?? null,
        notes: (row.notes as string | null) ?? null,
        metadata:
          row.metadata && typeof row.metadata === 'object'
            ? (row.metadata as Record<string, unknown>)
            : {},
      }));
    }
  }

  const documentLinks: Array<{
    id: string;
    documentId: string | null;
    name: string | null;
    role: string | null;
    citeCheckStatus: string | null;
    metadata: Record<string, unknown>;
  }> = [];
  const documentsInput = Array.isArray(body.documents) ? body.documents : [];
  if (documentsInput.length > 0) {
    const toInsert = documentsInput
      .filter((doc) => typeof doc?.documentId === 'string')
      .map((doc) => ({
        matter_id: matterRow.id,
        document_id: doc.documentId!,
        role: doc.role ?? null,
        cite_check_status: doc.citeCheckStatus ?? null,
        metadata:
          doc.metadata && typeof doc.metadata === 'object'
            ? (doc.metadata as Record<string, unknown>)
            : {},
      }));
    if (toInsert.length > 0) {
      const docResult = await supabase
        .from('matter_documents')
        .insert(toInsert)
        .select('id, document_id, role, cite_check_status, metadata');
      if (docResult.error) {
        request.log.warn({ err: docResult.error, orgId, matterId: matterRow.id }, 'matter_documents_insert_failed');
      } else {
        documentLinks.push(
          ...(docResult.data ?? []).map((row) => ({
            id: String(row.id),
            documentId: typeof row.document_id === 'string' ? row.document_id : null,
            name: null,
            role: typeof row.role === 'string' ? row.role : null,
            citeCheckStatus: typeof row.cite_check_status === 'string' ? row.cite_check_status : null,
            metadata:
              row.metadata && typeof row.metadata === 'object'
                ? (row.metadata as Record<string, unknown>)
                : {},
          })),
        );
      }
    }
  }
  let detail;
  try {
    detail = await loadMatterDetail({ orgId, matterId: matterRow.id, logger: request.log });
  } catch (error) {
    request.log.error({ err: error, orgId, matterId: matterRow.id }, 'matter_detail_fetch_failed_post');
    return reply.code(500).send({ error: 'matter_detail_unavailable' });
  }

  if (!detail) {
    return reply.code(500).send({ error: 'matter_detail_missing_post' });
  }

  try {
    await logAuditEvent({
      orgId,
      actorId: actor,
      kind: 'matter.created',
      object: matterRow.id,
      metadata: {
        title,
        status,
        jurisdiction,
        riskLevel,
        hitlRequired: hitlRequired ?? false,
        calendar: calendarSettings,
        deadlines: detail.deadlines.length,
        documents: detail.documents.length,
        citeCheck: detail.citeCheck,
      },
    });
  } catch (error) {
    request.log.warn({ err: error, orgId, matterId: matterRow.id }, 'matter_create_audit_failed');
  }

  return reply.code(201).send(detail);
});

app.post<{
  Body: {
    orgId?: string;
    jurisdiction?: string;
    procedure?: string;
    filingDate?: string;
    calendarType?: 'calendar' | 'court';
    calendarTimezone?: string;
    calendarMethod?: 'standard' | 'expedited' | 'extended';
  };
}>('/matters/deadlines/preview', async (request, reply) => {
  const body = request.body ?? {};
  const orgId = typeof body.orgId === 'string' ? body.orgId : undefined;
  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }

  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('cases:view', orgId, userHeader, request);
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error, orgId }, 'deadline_preview_authorization_failed');
    return reply.code(403).send({ error: 'forbidden' });
  }

  const calendarType = body.calendarType === 'court' ? 'court' : 'calendar';
  const calendarTimezone =
    typeof body.calendarTimezone === 'string' && body.calendarTimezone.trim().length > 0
      ? body.calendarTimezone.trim()
      : 'Europe/Paris';
  const calendarMethod =
    body.calendarMethod === 'expedited' || body.calendarMethod === 'extended'
      ? body.calendarMethod
      : 'standard';

  const calendarSettings: CalendarSettings = {
    type: calendarType,
    timezone: calendarTimezone,
    method: calendarMethod,
  };

  const schedule = computeMatterSchedule({
    jurisdiction: body.jurisdiction,
    filingDate: body.filingDate,
    procedure: body.procedure,
    calendarType: calendarSettings.type,
    timezone: calendarSettings.timezone,
    method: calendarSettings.method,
  });

  const methodNote =
    calendarMethod === 'expedited'
      ? 'Expedited timeline condenses each step by ~3 jours; valider la compatibilité avec la juridiction.'
      : calendarMethod === 'extended'
        ? 'Extended timeline ajoute un tampon de 5 jours pour absorber les revues internes.'
        : 'Standard timeline applique les délais par défaut pour la juridiction sélectionnée.';

  const calendarNote =
    calendarType === 'court'
      ? 'Court days ignorent les week-ends et jours fériés; pensez à vérifier les calendriers locaux.'
      : 'Calendar days incluent week-ends et jours fériés; ajuster selon les règles de procédure.';

  return reply.send({
    calendarSettings,
    deadlines: schedule.map((item) => ({
      name: item.name,
      dueAt: item.dueAt,
      ruleReference: item.ruleReference,
      notes: item.notes,
    })),
    notes: {
      method: methodNote,
      calendar: calendarNote,
    },
  });
});

app.patch<{
  Params: { id: string };
  Body: {
    orgId?: string;
    userId?: string;
    title?: string;
    description?: string | null;
    jurisdiction?: string | null;
    procedure?: string | null;
    status?: string | null;
    riskLevel?: string | null;
    hitlRequired?: boolean;
    filingDate?: string | null;
    decisionDate?: string | null;
    agentRunId?: string | null;
    draftId?: string | null;
    primaryDocumentId?: string | null;
    structuredPayload?: unknown;
    metadata?: Record<string, unknown>;
    calendarType?: 'calendar' | 'court';
    calendarTimezone?: string;
    calendarMethod?: 'standard' | 'expedited' | 'extended';
    deadlines?: Array<{
      id?: string;
      name: string;
      dueAt: string;
      ruleReference?: string;
      notes?: string;
      metadata?: Record<string, unknown>;
    }>;
    documents?: Array<{
      documentId: string;
      role?: string;
      citeCheckStatus?: string;
      metadata?: Record<string, unknown>;
    }>;
  };
}>('/matters/:id', async (request, reply) => {
  const { id } = request.params;
  const body = request.body ?? {};
  const orgId = typeof body.orgId === 'string' ? body.orgId : undefined;
  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }

  const headerUser = typeof request.headers['x-user-id'] === 'string' ? (request.headers['x-user-id'] as string) : undefined;
  const actor = typeof body.userId === 'string' && body.userId.trim().length > 0 ? body.userId : headerUser;
  if (!actor) {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('cases:manage', orgId, actor, request);
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof (error as any).statusCode === 'number') {
      return reply.code((error as any).statusCode).send({ error: (error as Error).message });
    }
    request.log.warn({ err: error, orgId, actor }, 'matter_update_authorization_failed');
    return reply.code(403).send({ error: 'forbidden' });
  }

  const existingResult = await supabase
    .from('matters')
    .select(
      'id, org_id, title, description, status, risk_level, hitl_required, jurisdiction_code, procedure, residency_zone, filing_date, decision_date, structured_payload, metadata, created_at, updated_at, agent_run_id, primary_document_id',
    )
    .eq('org_id', orgId)
    .eq('id', id)
    .maybeSingle();

  if (existingResult.error) {
    request.log.error({ err: existingResult.error, orgId, matterId: id }, 'matter_update_fetch_failed');
    return reply.code(500).send({ error: 'matter_fetch_failed' });
  }

  if (!existingResult.data) {
    return reply.code(404).send({ error: 'matter_not_found' });
  }

  const existing = normaliseMatterRow(existingResult.data as Record<string, unknown>);
  let metadata = existing.metadata ? { ...existing.metadata } : ({} as Record<string, unknown>);
  if (body.metadata && typeof body.metadata === 'object') {
    metadata = { ...metadata, ...(body.metadata as Record<string, unknown>) };
  }

  const updates: Record<string, unknown> = {};
  const changedFields: string[] = [];

  if (typeof body.title === 'string' && body.title.trim().length > 0 && body.title.trim() !== existing.title) {
    updates.title = body.title.trim();
    changedFields.push('title');
  }

  if (body.description !== undefined) {
    const value = typeof body.description === 'string' ? body.description : null;
    updates.description = value;
    changedFields.push('description');
  }

  if (body.status !== undefined && typeof body.status === 'string' && body.status.trim().length > 0) {
    updates.status = body.status.trim();
    changedFields.push('status');
  }

  if (body.riskLevel !== undefined) {
    updates.risk_level = typeof body.riskLevel === 'string' && body.riskLevel.trim().length > 0 ? body.riskLevel.trim() : null;
    changedFields.push('riskLevel');
  }

  if (body.hitlRequired !== undefined) {
    updates.hitl_required = Boolean(body.hitlRequired);
    changedFields.push('hitlRequired');
  }

  if (body.filingDate !== undefined) {
    updates.filing_date = typeof body.filingDate === 'string' ? body.filingDate : null;
    changedFields.push('filingDate');
  }

  if (body.decisionDate !== undefined) {
    updates.decision_date = typeof body.decisionDate === 'string' ? body.decisionDate : null;
    changedFields.push('decisionDate');
  }

  if (body.procedure !== undefined) {
    updates.procedure = typeof body.procedure === 'string' && body.procedure.trim().length > 0 ? body.procedure.trim() : null;
    changedFields.push('procedure');
  }

  if (body.jurisdiction !== undefined) {
    const jurisdiction = typeof body.jurisdiction === 'string' && body.jurisdiction.trim().length > 0 ? body.jurisdiction.trim().toUpperCase() : null;
    updates.jurisdiction_code = jurisdiction;
    updates.residency_zone = mapJurisdictionToResidency(jurisdiction);
    changedFields.push('jurisdiction');
  }

  if ('agentRunId' in body) {
    updates.agent_run_id = typeof body.agentRunId === 'string' && body.agentRunId.trim().length > 0 ? body.agentRunId : null;
    changedFields.push('agentRunId');
  }

  if ('primaryDocumentId' in body) {
    updates.primary_document_id =
      typeof body.primaryDocumentId === 'string' && body.primaryDocumentId.trim().length > 0
        ? body.primaryDocumentId
        : null;
    changedFields.push('primaryDocumentId');
  }

  if (body.structuredPayload !== undefined) {
    updates.structured_payload = body.structuredPayload ?? null;
    changedFields.push('structuredPayload');
  }

  const calendarType = body.calendarType === 'court' ? 'court' : undefined;
  const calendarTimezone =
    typeof body.calendarTimezone === 'string' && body.calendarTimezone.trim().length > 0
      ? body.calendarTimezone.trim()
      : undefined;
  const calendarMethod =
    body.calendarMethod === 'expedited' || body.calendarMethod === 'extended' ? body.calendarMethod : undefined;

  if (calendarType || calendarTimezone || calendarMethod) {
    const currentSettings = extractCalendarSettings(metadata);
    const nextSettings: CalendarSettings = {
      type: calendarType ?? currentSettings.type,
      timezone: calendarTimezone ?? currentSettings.timezone,
      method: calendarMethod ?? currentSettings.method,
    };
    metadata = { ...metadata, calendar: nextSettings };
    updates.metadata = metadata;
    changedFields.push('calendar');
    changedFields.push('metadata');
  } else if (body.metadata && typeof body.metadata === 'object') {
    updates.metadata = metadata;
    changedFields.push('metadata');
  }

  if (Object.keys(updates).length > 0) {
    const updateResult = await supabase
      .from('matters')
      .update(updates)
      .eq('org_id', orgId)
      .eq('id', id)
      .select(
        'id, org_id, title, description, status, risk_level, hitl_required, jurisdiction_code, procedure, residency_zone, filing_date, decision_date, structured_payload, metadata, created_at, updated_at, agent_run_id, primary_document_id',
      )
      .maybeSingle();

    if (updateResult.error) {
      request.log.error({ err: updateResult.error, orgId, matterId: id }, 'matter_update_failed');
      return reply.code(500).send({ error: 'matter_update_failed' });
    }

    if (updateResult.data) {
      // Refresh baseline metadata for downstream logging
      metadata = normaliseMatterRow(updateResult.data as Record<string, unknown>).metadata ?? metadata;
    }
  }

  let deadlinesChanged = false;
  if (Array.isArray(body.deadlines)) {
    deadlinesChanged = true;
    const sanitized = body.deadlines
      .filter((deadline) => typeof deadline?.name === 'string' && typeof deadline?.dueAt === 'string')
      .map((deadline) => ({
        id: typeof deadline?.id === 'string' ? deadline.id : undefined,
        name: deadline.name!,
        due_at: deadline.dueAt!,
        rule_reference: deadline.ruleReference ?? null,
        notes: deadline.notes ?? null,
        metadata:
          deadline.metadata && typeof deadline.metadata === 'object'
            ? (deadline.metadata as Record<string, unknown>)
            : {},
      }));

    const existingDeadlines = await supabase
      .from('matter_deadlines')
      .select('id')
      .eq('matter_id', id);

    if (existingDeadlines.error) {
      request.log.warn({ err: existingDeadlines.error, orgId, matterId: id }, 'matter_deadlines_fetch_for_update_failed');
    } else {
      const existingIds = new Set((existingDeadlines.data ?? []).map((row) => String(row.id)));
      const incomingIds = new Set(sanitized.filter((deadline) => deadline.id).map((deadline) => deadline.id!));
      const toDelete = [...existingIds].filter((deadlineId) => !incomingIds.has(deadlineId));
      if (toDelete.length > 0) {
        const deleteResult = await supabase.from('matter_deadlines').delete().in('id', toDelete);
        if (deleteResult.error) {
          request.log.warn({ err: deleteResult.error, orgId, matterId: id }, 'matter_deadlines_delete_failed');
        }
      }
    }

    if (sanitized.length > 0) {
      const payload = sanitized.map((deadline) => ({
        ...(deadline.id ? { id: deadline.id } : {}),
        matter_id: id,
        name: deadline.name,
        due_at: deadline.due_at,
        rule_reference: deadline.rule_reference ?? null,
        notes: deadline.notes ?? null,
        metadata: deadline.metadata ?? {},
      }));

      const upsert = await supabase
        .from('matter_deadlines')
        .upsert(payload, { onConflict: 'id' })
        .select('id');
      if (upsert.error) {
        request.log.warn({ err: upsert.error, orgId, matterId: id }, 'matter_deadlines_upsert_failed');
      }
    }
  }

  let documentsChanged = false;
  if (Array.isArray(body.documents)) {
    documentsChanged = true;
    const sanitizedDocs = body.documents
      .filter((doc) => typeof doc?.documentId === 'string')
      .map((doc) => ({
        document_id: doc.documentId!,
        role: doc.role ?? null,
        cite_check_status: doc.citeCheckStatus ?? null,
        metadata:
          doc.metadata && typeof doc.metadata === 'object'
            ? (doc.metadata as Record<string, unknown>)
            : {},
      }));

    const existingDocs = await supabase
      .from('matter_documents')
      .select('id, document_id')
      .eq('matter_id', id);

    if (existingDocs.error) {
      request.log.warn({ err: existingDocs.error, orgId, matterId: id }, 'matter_documents_fetch_for_update_failed');
    } else {
      const incomingDocIds = new Set(sanitizedDocs.map((doc) => doc.document_id));
      const toDelete = (existingDocs.data ?? [])
        .filter((doc) => !incomingDocIds.has(typeof doc.document_id === 'string' ? doc.document_id : ''))
        .map((doc) => String(doc.id));
      if (toDelete.length > 0) {
        const deleteResult = await supabase.from('matter_documents').delete().in('id', toDelete);
        if (deleteResult.error) {
          request.log.warn({ err: deleteResult.error, orgId, matterId: id }, 'matter_documents_delete_failed');
        }
      }
    }

    if (sanitizedDocs.length > 0) {
      const payload = sanitizedDocs.map((doc) => ({
        matter_id: id,
        document_id: doc.document_id,
        role: doc.role,
        cite_check_status: doc.cite_check_status,
        metadata: doc.metadata,
      }));

      const upsert = await supabase
        .from('matter_documents')
        .upsert(payload, { onConflict: 'matter_id,document_id' })
        .select('id');

      if (upsert.error) {
        request.log.warn({ err: upsert.error, orgId, matterId: id }, 'matter_documents_upsert_failed');
      }
    }
  }

  let detail;
  try {
    detail = await loadMatterDetail({ orgId, matterId: id, logger: request.log });
  } catch (error) {
    request.log.error({ err: error, orgId, matterId: id }, 'matter_detail_fetch_failed_patch');
    return reply.code(500).send({ error: 'matter_detail_unavailable' });
  }

  if (!detail) {
    return reply.code(404).send({ error: 'matter_not_found' });
  }

  try {
    await logAuditEvent({
      orgId,
      actorId: actor,
      kind: 'matter.updated',
      object: id,
      metadata: {
        changedFields,
        deadlinesChanged,
        documentsChanged,
        calendar: detail.calendarSettings,
        citeCheck: detail.citeCheck,
      },
    });
  } catch (error) {
    request.log.warn({ err: error, orgId, matterId: id }, 'matter_update_audit_failed');
  }

  return reply.send(detail);
});

app.delete<{
  Params: { id: string };
  Querystring: { orgId?: string;
    userId?: string };
}>('/matters/:id', async (request, reply) => {
  const { id } = request.params;
  const { orgId, userId } = request.query ?? {};

  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }

  const headerUser = typeof request.headers['x-user-id'] === 'string' ? (request.headers['x-user-id'] as string) : undefined;
  const actor = typeof userId === 'string' && userId.trim().length > 0 ? userId : headerUser;
  if (!actor) {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('cases:manage', orgId, actor, request);
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof (error as any).statusCode === 'number') {
      return reply.code((error as any).statusCode).send({ error: (error as Error).message });
    }
    request.log.warn({ err: error, orgId, actor }, 'matter_delete_authorization_failed');
    return reply.code(403).send({ error: 'forbidden' });
  }

  const deletion = await supabase
    .from('matters')
    .delete()
    .eq('org_id', orgId)
    .eq('id', id)
    .select('id, title, status, jurisdiction_code, metadata')
    .maybeSingle();

  if (deletion.error) {
    request.log.error({ err: deletion.error, orgId, matterId: id }, 'matter_delete_failed');
    return reply.code(500).send({ error: 'matter_delete_failed' });
  }

  if (!deletion.data) {
    return reply.code(404).send({ error: 'matter_not_found' });
  }

  await deleteMatterCalendar(orgId, id, request.log);

  try {
    await logAuditEvent({
      orgId,
      actorId: actor,
      kind: 'matter.deleted',
      object: id,
      metadata: {
        title: deletion.data.title ?? null,
        status: deletion.data.status ?? null,
        jurisdiction: deletion.data.jurisdiction_code ?? null,
      },
    });
  } catch (error) {
    request.log.warn({ err: error, orgId, matterId: id }, 'matter_delete_audit_failed');
  }

  return reply.code(204).send();
});

app.get<{
  Params: { id: string };
  Querystring: { orgId?: string };
}>('/matters/:id/calendar', async (request, reply) => {
  const { id } = request.params;
  const { orgId } = request.query;

  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }

  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('cases:view', orgId, userHeader, request);
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error, orgId, matterId: id }, 'matter_calendar_authorization_failed');
    return reply.code(403).send({ error: 'forbidden' });
  }

  let detail;
  try {
    detail = await loadMatterDetail({ orgId, matterId: id, logger: request.log });
  } catch (error) {
    request.log.error({ err: error, orgId, matterId: id }, 'matter_calendar_fetch_failed');
    return reply.code(500).send({ error: 'matter_calendar_failed' });
  }

  if (!detail) {
    return reply.code(404).send({ error: 'matter_not_found' });
  }

  return reply.send({
    calendar: detail.calendar,
    calendarUrl: detail.calendarUrl,
    calendarSettings: detail.calendarSettings,
  });
});

app.get<{ Params: { id: string }; Querystring: { orgId?: string } }>('/matters/:id', async (request, reply) => {
  const { orgId } = request.query;
  const { id } = request.params;

  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }

  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('cases:view', orgId, userHeader, request);
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'matter detail authorization failed');
    return reply.code(403).send({ error: 'forbidden' });
  }

  let detail;
  try {
    detail = await loadMatterDetail({ orgId, matterId: id, logger: request.log });
  } catch (error) {
    request.log.error({ err: error, orgId, matterId: id }, 'matter_detail_fetch_failed');
    return reply.code(500).send({ error: 'matter_failed' });
  }

  if (!detail) {
    return reply.code(404).send({ error: 'matter_not_found' });
  }

  return detail;
});

app.get<{ Querystring: { orgId?: string } }>('/corpus', async (request, reply) => {
  const { orgId } = request.query;
  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }

  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('corpus:view', orgId, userHeader, request);
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'corpus authorization failed');
    return reply.code(403).send({ error: 'forbidden' });
  }

  const [domains, snapshots, uploads, ingestions, summaries] = await Promise.all([
    supabase
      .from('authority_domains')
      .select('jurisdiction_code, host, active, last_ingested_at'),
    supabase
      .from('documents')
      .select(
        'id, name, storage_path, vector_store_status, vector_store_synced_at, created_at, bytes, mime_type, summary_status, summary_generated_at, summary_error, chunk_count, bucket_id, source_id, residency_zone',
      )
      .eq('org_id', orgId)
      .eq('bucket_id', 'authorities')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('documents')
      .select('id, name, storage_path, created_at, bytes, mime_type')
      .eq('org_id', orgId)
      .eq('bucket_id', 'uploads')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('ingestion_runs')
      .select('id, adapter_id, status, inserted_count, skipped_count, failed_count, started_at, finished_at, error_message')
      .eq('org_id', orgId)
      .order('started_at', { ascending: false })
      .limit(25),
    supabase
      .from('document_summaries')
      .select('document_id, summary, outline, created_at')
      .eq('org_id', orgId),
  ]);

  const ingestionRuns = (ingestions.data ?? []).map((run) => ({
    id: run.id,
    adapter: run.adapter_id,
    status: run.status,
    inserted: run.inserted_count,
    skipped: run.skipped_count,
    failed: run.failed_count,
    startedAt: run.started_at,
    finishedAt: run.finished_at,
    error: run.error_message,
  }));

  const summaryMap = new Map((summaries.data ?? []).map((row) => [row.document_id, row] as const));

  return {
    allowlist: (domains.data ?? []).map((row) => ({
      jurisdiction: row.jurisdiction_code,
      host: row.host,
      active: row.active ?? true,
      lastIngestedAt: row.last_ingested_at,
      residencyZone: mapJurisdictionToResidency(row.jurisdiction_code),
    })),
    snapshots: (snapshots.data ?? []).map((doc) => {
      const summaryRow = summaryMap.get(doc.id) ?? null;
      return {
        id: doc.id,
        name: doc.name,
        path: doc.storage_path,
        status: doc.vector_store_status,
        syncedAt: doc.vector_store_synced_at,
        createdAt: doc.created_at,
        bytes: doc.bytes,
        mimeType: doc.mime_type,
        summaryStatus: doc.summary_status,
        summaryGeneratedAt: doc.summary_generated_at,
        summaryError: doc.summary_error,
        chunkCount: doc.chunk_count ?? 0,
        summary: summaryRow?.summary ?? null,
        highlights: Array.isArray(summaryRow?.outline) ? summaryRow?.outline : null,
        residencyZone: doc.residency_zone ?? null,
      };
    }),
    uploads: (uploads.data ?? []).map((doc) => ({
      id: doc.id,
      name: doc.name,
      path: doc.storage_path,
      createdAt: doc.created_at,
      bytes: doc.bytes,
      mimeType: doc.mime_type,
    })),
    ingestionRuns,
  };
});

app.post<{
  Params: { documentId: string };
  Body: { orgId?: string; summariserModel?: string; embeddingModel?: string; maxSummaryChars?: number };
}>('/corpus/:documentId/resummarize', async (request, reply) => {
  const { documentId } = request.params;
  const { orgId, summariserModel, embeddingModel, maxSummaryChars } = request.body ?? {};

  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }

  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('corpus:manage', orgId, userHeader, request);
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'corpus resummarize authorization failed');
    return reply.code(403).send({ error: 'forbidden' });
  }

  const { data: document, error: documentError } = await supabase
    .from('documents')
    .select('id, org_id, bucket_id, storage_path, mime_type, source_id, name')
    .eq('id', documentId)
    .eq('org_id', orgId)
    .maybeSingle();

  if (documentError) {
    request.log.error({ err: documentError }, 'document fetch failed');
    return reply.code(500).send({ error: 'document_unavailable' });
  }

  if (!document) {
    return reply.code(404).send({ error: 'document_not_found' });
  }

  if (document.bucket_id !== 'authorities') {
    return reply.code(400).send({ error: 'resummarize_supported_only_for_authorities' });
  }

  const { data: source } = await supabase
    .from('sources')
    .select(
      'title, publisher, jurisdiction_code, source_url, adopted_date, effective_date, binding_lang, language_note, consolidated, eli, ecli, akoma_ntoso',
    )
    .eq('id', document.source_id ?? '')
    .maybeSingle();

  const metadata = {
    title: source?.title ?? document.name,
    jurisdiction: source?.jurisdiction_code ?? 'FR',
    publisher: source?.publisher ?? null,
  };

  const { data: blob, error: downloadError } = await supabase.storage
    .from(document.bucket_id)
    .download(document.storage_path);

  if (downloadError || !blob) {
    request.log.error({ err: downloadError }, 'document download failed');
    return reply.code(500).send({ error: 'document_download_failed' });
  }

  const buffer = await (blob as Blob).arrayBuffer();
  const payload = new Uint8Array(buffer);

  const result = await summariseDocumentFromPayload({
    payload,
    mimeType: document.mime_type ?? 'text/plain',
    metadata,
    openaiApiKey: env.OPENAI_API_KEY,
    summariserModel,
    embeddingModel,
    maxSummaryChars,
  });

  const nowIso = new Date().toISOString();
  let finalStatus = result.status;
  let summaryError: string | null = result.error ?? null;
  let chunkCount = result.status === 'ready' ? result.chunks.length : 0;

  if (result.status === 'ready' && result.chunks.length !== result.embeddings.length) {
    finalStatus = 'failed';
    summaryError = 'Nombre de chunks et embeddings incohérent';
  }

  if (finalStatus === 'ready') {
    await supabase.from('document_chunks').delete().eq('document_id', document.id);

    const rows = result.chunks.map((chunk, index) => ({
      org_id: orgId,
      document_id: document.id,
      jurisdiction_code: metadata.jurisdiction,
      content: chunk.content,
      embedding: result.embeddings[index],
      seq: chunk.seq,
      article_or_section: chunk.marker,
    }));

    for (let idx = 0; idx < rows.length; idx += 50) {
      const batch = rows.slice(idx, idx + 50);
      const { error } = await supabase.from('document_chunks').insert(batch);
      if (error) {
        request.log.error({ err: error }, 'chunk insert failed');
        finalStatus = 'failed';
        summaryError = error.message;
        chunkCount = 0;
        break;
      }
    }

    if (finalStatus !== 'ready') {
      await supabase.from('document_chunks').delete().eq('document_id', document.id);
    }

    if (finalStatus === 'ready') {
      const { error: summaryErrorUpsert } = await supabase
        .from('document_summaries')
        .upsert(
          {
            org_id: orgId,
            document_id: document.id,
            summary: result.summary ?? null,
            outline: result.highlights && result.highlights.length > 0 ? result.highlights : null,
          },
          { onConflict: 'document_id' },
        );

      if (summaryErrorUpsert) {
        request.log.error({ err: summaryErrorUpsert }, 'summary upsert failed');
        finalStatus = 'failed';
        summaryError = summaryErrorUpsert.message;
        chunkCount = 0;
      }
    }

    if (finalStatus === 'ready') {
      const { error: updateError } = await supabase
        .from('documents')
        .update({
          summary_status: 'ready',
          summary_generated_at: nowIso,
          summary_error: null,
          chunk_count: chunkCount,
        })
        .eq('id', document.id);

      if (updateError) {
        request.log.error({ err: updateError }, 'document summary update failed');
        finalStatus = 'failed';
        summaryError = updateError.message;
      }
    }

    if (finalStatus === 'ready' && document.source_id) {
      const MAX_AKOMA_ARTICLES = 400;
      const articleCandidates = result.chunks.filter(
        (chunk) => typeof chunk.marker === 'string' && chunk.marker.length > 0,
      );
      const articles = articleCandidates.slice(0, MAX_AKOMA_ARTICLES).map((chunk) => ({
          marker: chunk.marker as string,
          seq: chunk.seq,
          excerpt: chunk.content.slice(0, 280).trim(),
        }));

      if (articleCandidates.length > MAX_AKOMA_ARTICLES) {
        request.log.info(
          {
            sourceId: document.source_id ?? null,
            totalArticles: articleCandidates.length,
            maxArticles: MAX_AKOMA_ARTICLES,
          },
          'akoma_ntoso_articles_truncated',
        );
      }

      const existingAkoma =
        source && typeof source.akoma_ntoso === 'object' && source.akoma_ntoso
          ? (source.akoma_ntoso as {
              meta?: { publication?: { consolidated?: boolean | null } };
            })
          : null;
      const consolidatedFlag =
        typeof source?.consolidated === 'boolean'
          ? (source.consolidated as boolean)
          : typeof existingAkoma?.meta?.publication?.consolidated === 'boolean'
            ? (existingAkoma.meta?.publication?.consolidated as boolean)
            : null;

      const akomaPayload = {
        meta: {
          identification: {
            source: source?.publisher ?? null,
            jurisdiction: source?.jurisdiction_code ?? null,
            eli: source?.eli ?? deriveEliFromUrl(source?.source_url),
            ecli: source?.ecli ?? deriveEcliFromUrl(source?.source_url),
            workURI: source?.source_url ?? null,
          },
          publication: {
            adoptionDate: source?.adopted_date ?? null,
            effectiveDate: source?.effective_date ?? null,
            capturedAt: nowIso,
            consolidated: consolidatedFlag,
            bindingLanguage: source?.binding_lang ?? null,
            languageNote: source?.language_note ?? null,
          },
        },
        body: {
          articles,
        },
      };

      const updates: Record<string, unknown> = {
        akoma_ntoso: akomaPayload,
      };

      const derivedEli = deriveEliFromUrl(source?.source_url);
      if (!source?.eli && derivedEli) {
        updates.eli = derivedEli;
      }

      const derivedEcli = deriveEcliFromUrl(source?.source_url);
      if (!source?.ecli && derivedEcli) {
        updates.ecli = derivedEcli;
      }

      const { error: akomaUpdateError } = await supabase
        .from('sources')
        .update(updates)
        .eq('id', document.source_id);

      if (akomaUpdateError) {
        request.log.warn({ err: akomaUpdateError }, 'akoma_ntoso_update_failed');
      }
    }
  }

  if (finalStatus === 'skipped') {
    await supabase.from('document_summaries').delete().eq('document_id', document.id);
    await supabase.from('document_chunks').delete().eq('document_id', document.id);
    const { error: skippedUpdate } = await supabase
      .from('documents')
      .update({
        summary_status: 'skipped',
        summary_generated_at: nowIso,
        summary_error: summaryError,
        chunk_count: 0,
      })
      .eq('id', document.id);

    if (skippedUpdate) {
      request.log.error({ err: skippedUpdate }, 'document skipped update failed');
    }
    chunkCount = 0;
  }

  if (finalStatus === 'failed') {
    await supabase
      .from('documents')
      .update({ summary_status: 'failed', summary_generated_at: nowIso, summary_error: summaryError })
      .eq('id', document.id);
  }

  const { data: updatedSummary } = await supabase
    .from('document_summaries')
    .select('summary, outline, created_at')
    .eq('document_id', document.id)
    .maybeSingle();

  try {
    await logAuditEvent({
      orgId,
      actorId: userHeader,
      kind: 'corpus.resummarize',
      object: document.id,
      after: {
        summary_status: finalStatus,
        chunk_count: chunkCount,
        summary_error: summaryError,
      },
    });
  } catch (error) {
    request.log.warn({ err: error }, 'resummarize audit failed');
  }

  return reply.send({
    documentId: document.id,
    summaryStatus: finalStatus,
    summaryGeneratedAt: nowIso,
    summaryError,
    chunkCount,
    summary: updatedSummary?.summary ?? null,
    highlights: Array.isArray(updatedSummary?.outline) ? updatedSummary?.outline : null,
  });
});

app.get<{
  Querystring: { orgId?: string; snapshotId?: string; compareTo?: string };
}>('/corpus/diff', async (request, reply) => {
  const { orgId, snapshotId, compareTo } = request.query;
  if (!orgId || !snapshotId || !compareTo) {
    return reply.code(400).send({ error: 'orgId, snapshotId et compareTo sont requis' });
  }

  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('corpus:view', orgId, userHeader, request);
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'corpus diff authorization failed');
    return reply.code(403).send({ error: 'forbidden' });
  }

  const { data, error } = await supabase
    .from('documents')
    .select('id, org_id, bucket_id, storage_path, name, created_at, mime_type')
    .in('id', [snapshotId, compareTo]);

  if (error) {
    request.log.error({ err: error }, 'documents fetch failed');
    return reply.code(500).send({ error: 'documents_unavailable' });
  }

  const docs = data ?? [];
  if (docs.length < 2) {
    return reply.code(404).send({ error: 'snapshots_not_found' });
  }

  const baseDoc = docs.find((doc) => doc.id === snapshotId);
  const compareDoc = docs.find((doc) => doc.id === compareTo);

  if (!baseDoc || !compareDoc || baseDoc.org_id !== orgId || compareDoc.org_id !== orgId) {
    return reply.code(403).send({ error: 'forbidden' });
  }

  async function downloadText(bucket: string, path: string) {
    const { data: blob, error: storageError } = await supabase.storage.from(bucket).download(path);
    if (storageError || !blob) {
      return { content: '', warning: 'Contenu indisponible pour comparaison.' };
    }
    const text = await (blob as Blob).text().catch(() => null);
    if (!text) {
      return { content: '', warning: 'Document binaire : diff indisponible.' };
    }
    return { content: text, warning: null };
  }

  const [baseContent, compareContent] = await Promise.all([
    downloadText(baseDoc.bucket_id, baseDoc.storage_path),
    downloadText(compareDoc.bucket_id, compareDoc.storage_path),
  ]);

  const diff = diffWordsWithSpace(baseContent.content, compareContent.content).map((part) => ({
    value: part.value,
    added: Boolean(part.added),
    removed: Boolean(part.removed),
  }));

  return {
    base: {
      id: baseDoc.id,
      name: baseDoc.name,
      createdAt: baseDoc.created_at,
      warning: baseContent.warning,
    },
    compare: {
      id: compareDoc.id,
      name: compareDoc.name,
      createdAt: compareDoc.created_at,
      warning: compareContent.warning,
    },
    diff,
  };
});

app.patch<{ Params: { host: string }; Body: { active?: boolean; jurisdiction?: string } }>(
  '/corpus/allowlist/:host',
  async (request, reply) => {
    const { host } = request.params;
    const { active, jurisdiction } = request.body ?? {};
    if (typeof active !== 'boolean') {
      return reply.code(400).send({ error: 'active flag required' });
    }

    const userHeader = request.headers['x-user-id'];
    const orgHeader = request.headers['x-org-id'];
    if (!userHeader || typeof userHeader !== 'string' || !orgHeader || typeof orgHeader !== 'string') {
      return reply
        .code(400)
        .send({ error: 'x-user-id and x-org-id headers are required for allowlist updates' });
    }

    try {
      await authorizeRequestWithGuards('corpus:manage', orgHeader, userHeader, request);
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
        return reply.code(error.statusCode).send({ error: error.message });
      }
      request.log.error({ err: error }, 'allowlist authorization failed');
      return reply.code(403).send({ error: 'forbidden' });
    }

    let lookupBuilder = supabase
      .from('authority_domains')
      .select('host, jurisdiction_code, active')
      .eq('host', host);
    if (jurisdiction) {
      lookupBuilder = lookupBuilder.eq('jurisdiction_code', jurisdiction);
    }
    const before = await lookupBuilder.limit(1).maybeSingle();

    let updateBuilder = supabase
      .from('authority_domains')
      .update({ active })
      .eq('host', host);
    if (jurisdiction) {
      updateBuilder = updateBuilder.eq('jurisdiction_code', jurisdiction);
    }

    const update = await updateBuilder
      .select('host, jurisdiction_code, active')
      .maybeSingle();

    if (update.error) {
      request.log.error({ err: update.error }, 'allowlist toggle failed');
      return reply.code(500).send({ error: 'allowlist_failed' });
    }

    try {
      await logAuditEvent({
        orgId: orgHeader,
        actorId: userHeader,
        kind: 'allowlist.updated',
        object: host,
        before: before.data ?? undefined,
        after: update.data ?? undefined,
      });
    } catch (error) {
      request.log.warn({ err: error }, 'allowlist audit failed');
    }

    return { host, active };
  },
);

app.get<{
  Querystring: { orgId?: string; query?: string; jurisdiction?: string };
}>('/search-hybrid', async (request, reply) => {
  const { orgId, query, jurisdiction } = request.query;

  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }

  if (!query) {
    return reply.code(400).send({ error: 'query is required' });
  }

  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('search-hybrid', orgId, userHeader, request);
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'hybrid search authorization failed');
    return reply.code(403).send({ error: 'forbidden' });
  }

  try {
    const results = await getHybridRetrievalContext(orgId, query, jurisdiction ?? null);
    return {
      results: results.map((item) => ({
        content: item.content,
        similarity: item.similarity,
        weight: item.weight,
        origin: item.origin,
        sourceId: item.sourceId ?? null,
        documentId: item.documentId ?? null,
        fileId: item.fileId ?? null,
        url: item.url ?? null,
        title: item.title ?? null,
        publisher: item.publisher ?? null,
        trustTier: item.trustTier ?? null,
      })),
    };
  } catch (error) {
    request.log.error({ err: error }, 'hybrid search failed');
    return reply.code(502).send({ error: 'hybrid_search_failed' });
  }
});

app.get<{
  Querystring: { orgId?: string; query?: string; jurisdiction?: string; limit?: string };
}>('/search-local', async (request, reply) => {
  const { orgId, query, jurisdiction, limit } = request.query;

  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }

  if (!query) {
    return reply.code(400).send({ error: 'query is required' });
  }

  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('search-local', orgId, userHeader, request);
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'local search authorization failed');
    return reply.code(403).send({ error: 'forbidden' });
  }

  try {
    const embedding = await embedQuery(query);
    const matchCount = limit ? Math.min(Math.max(Number.parseInt(limit, 10) || 0, 1), 20) : 8;

    const { data, error } = await supabase.rpc('match_chunks', {
      p_org: orgId,
      p_query_embedding: embedding,
      p_match_count: matchCount,
      p_jurisdiction: jurisdiction ?? null,
    });

    if (error) {
      request.log.error({ err: error }, 'match_chunks rpc failed');
      return reply.code(500).send({ error: 'search_failed' });
    }

    return {
      matches: (data ?? []).map((entry) => ({
        id: entry.chunk_id,
        documentId: entry.document_id,
        jurisdiction: entry.jurisdiction_code,
        content: entry.content,
        similarity: entry.similarity,
      })),
    };
  } catch (error) {
    request.log.error({ err: error }, 'local search failed');
    return reply.code(502).send({ error: 'embedding_failed' });
  }
});

if (process.env.NODE_ENV !== 'test' && process.env.VITEST !== 'true') {
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
}

export { app };
// C2PA signing endpoint
app.post<{ Body: { orgId?: string; contentSha256?: string; filename?: string } }>(
  '/exports/sign',
  async (request, reply) => {
    const { orgId, contentSha256, filename } = request.body ?? {};
    if (!orgId || !contentSha256) {
      return reply.code(400).send({ error: 'orgId and contentSha256 are required' });
    }
    const userHeader = request.headers['x-user-id'];
    if (!userHeader || typeof userHeader !== 'string') {
      return reply.code(400).send({ error: 'x-user-id header is required' });
    }
    try {
      await authorizeRequestWithGuards('workspace:view', orgId, userHeader, request);
    } catch (error) {
      return reply.code(403).send({ error: 'forbidden' });
    }

    try {
      const signature = signC2PA({
        orgId,
        userId: userHeader,
        contentSha256,
        filename: filename ?? null,
      });

      await logAuditEvent({
        orgId,
        actorId: userHeader,
        kind: 'export.signed',
        object: filename ?? contentSha256,
        metadata: {
          keyId: signature.keyId,
          statementId: signature.statementId,
          algorithm: signature.algorithm,
        },
      });

      return {
        signature: signature.signature,
        keyId: signature.keyId,
        algorithm: signature.algorithm,
        signedAt: signature.signedAt,
        statementId: signature.statementId,
        manifest: signature.manifest,
      };
    } catch (error) {
      request.log.error({ err: error }, 'c2pa_sign_failed');
      return reply.code(500).send({ error: 'signing_failed' });
    }
  },
);

// Admin policies
app.get<{ Params: { orgId: string } }>(
  '/admin/org/:orgId/policies',
  async (request, reply) => {
    const { orgId } = request.params;
    const userHeader = request.headers['x-user-id'];
    if (!userHeader || typeof userHeader !== 'string') return reply.code(400).send({ error: 'x-user-id header is required' });
    try {
      await authorizeRequestWithGuards('admin:manage', orgId, userHeader, request);
    } catch (error) {
      return reply.code(403).send({ error: 'forbidden' });
    }
    const { data, error } = await supabase.from('org_policies').select('key, value').eq('org_id', orgId);
    if (error) return reply.code(500).send({ error: 'policies_failed' });
    const record: Record<string, unknown> = {};
    for (const row of data ?? []) {
      record[(row as any).key as string] = (row as any).value;
    }
    return { policies: record };
  },
);

app.patch<{ Params: { orgId: string }; Body: { updates?: Array<{ key: string; value: unknown }>; removes?: string[] } }>(
  '/admin/org/:orgId/policies',
  async (request, reply) => {
    const { orgId } = request.params;
    const { updates, removes } = request.body ?? {};
    const userHeader = request.headers['x-user-id'];
    if (!userHeader || typeof userHeader !== 'string') return reply.code(400).send({ error: 'x-user-id header is required' });
    try {
      await authorizeRequestWithGuards('admin:manage', orgId, userHeader, request);
    } catch (error) {
      return reply.code(403).send({ error: 'forbidden' });
    }
    const nowIso = new Date().toISOString();
    if (Array.isArray(updates) && updates.length > 0) {
      const rows = updates.map((u) => ({
        org_id: orgId,
        key: u.key,
        value: u.value,
        updated_by: userHeader,
        updated_at: nowIso,
      }));
      const up = await supabase.from('org_policies').upsert(rows, { onConflict: 'org_id,key' });
      if (up.error) return reply.code(500).send({ error: 'policies_update_failed' });

      for (const entry of updates) {
        try {
          await logAuditEvent({
            orgId,
            actorId: userHeader,
            kind: 'policy.updated',
            object: entry.key,
            after: entry.value as Record<string, unknown> | null,
          });
        } catch (auditError) {
          request.log.warn({ err: auditError }, 'audit_policy_update_failed');
        }
      }
    }
    if (Array.isArray(removes) && removes.length > 0) {
      const del = await supabase.from('org_policies').delete().eq('org_id', orgId).in('key', removes);
      if (del.error) return reply.code(500).send({ error: 'policies_delete_failed' });

      for (const key of removes) {
        try {
          await logAuditEvent({
            orgId,
            actorId: userHeader,
            kind: 'policy.removed',
            object: key,
          });
        } catch (auditError) {
          request.log.warn({ err: auditError }, 'audit_policy_remove_failed');
        }
      }
    }
    return { ok: true };
  },
);

// Alerts snapshot for dashboards
const webVitalSchema = z.object({
  id: z.string().min(3),
  name: z.string().min(2),
  value: z.number(),
  delta: z.number().optional(),
  label: z.string().optional(),
  rating: z.enum(['good', 'needs-improvement', 'poor']).optional(),
  page: z.string().optional(),
  locale: z.string().optional(),
  navigationType: z.string().optional(),
});

app.post<{ Body: z.infer<typeof webVitalSchema> }>(
  '/metrics/web-vitals',
  async (request, reply) => {
    const userHeader = request.headers['x-user-id'];
    const orgHeader = request.headers['x-org-id'];
    if (!userHeader || typeof userHeader !== 'string') {
      return reply.code(400).send({ error: 'x-user-id header is required' });
    }
    if (!orgHeader || typeof orgHeader !== 'string') {
      return reply.code(400).send({ error: 'x-org-id header is required' });
    }

    const parsed = webVitalSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_payload', details: parsed.error.flatten() });
    }

    try {
      await authorizeRequestWithGuards('metrics:view', orgHeader, userHeader, request);
    } catch (error) {
      return reply.code(403).send({ error: 'forbidden' });
    }

    const rating = parsed.data.rating ?? 'needs-improvement';
    const refererHeader = request.headers.referer;
    const entry: Omit<WebVitalRecord, 'createdAt'> = {
      id: parsed.data.id,
      name: parsed.data.name,
      value: parsed.data.value,
      delta: parsed.data.delta ?? 0,
      label: parsed.data.label ?? 'web-vital',
      rating,
      page: parsed.data.page ?? (typeof refererHeader === 'string' ? refererHeader : '/'),
      locale: parsed.data.locale ?? null,
      navigationType: parsed.data.navigationType ?? null,
      userAgent: typeof request.headers['user-agent'] === 'string' ? request.headers['user-agent'] : null,
      orgId: orgHeader,
      userId: userHeader,
    };
    recordWebVital(entry);

    return reply.code(204).send();
  },
);

app.get<{ Querystring: { limit?: string } }>(
  '/metrics/web-vitals',
  async (request, reply) => {
    const userHeader = request.headers['x-user-id'];
    const orgHeader = request.headers['x-org-id'];
    if (!userHeader || typeof userHeader !== 'string') {
      return reply.code(400).send({ error: 'x-user-id header is required' });
    }
    if (!orgHeader || typeof orgHeader !== 'string') {
      return reply.code(400).send({ error: 'x-org-id header is required' });
    }
    try {
      await authorizeRequestWithGuards('metrics:view', orgHeader, userHeader, request);
    } catch (error) {
      return reply.code(403).send({ error: 'forbidden' });
    }

    const limitParam = request.query.limit ? Number.parseInt(request.query.limit, 10) : undefined;
    const metrics = listWebVitals(orgHeader, Number.isFinite(limitParam) ? Number(limitParam) : undefined);
    return { metrics };
  },
);

app.get<{ Querystring: { orgId?: string } }>(
  '/metrics/alerts',
  async (request, reply) => {
    const { orgId } = request.query;
    if (!orgId) return reply.code(400).send({ error: 'orgId is required' });
    const userHeader = request.headers['x-user-id'];
    if (!userHeader || typeof userHeader !== 'string') return reply.code(400).send({ error: 'x-user-id header is required' });
    try {
      await authorizeRequestWithGuards('metrics:view', orgId, userHeader, request);
    } catch (error) {
      return reply.code(403).send({ error: 'forbidden' });
    }
    const [metrics, provenance] = await Promise.all([
      supabase.from('org_metrics').select('*').eq('org_id', orgId).limit(1).maybeSingle(),
      supabase.from('org_provenance_metrics').select('*').eq('org_id', orgId).limit(1).maybeSingle(),
    ]);
    const thresholds = {
      precision: 0.95,
      temporal: 0.95,
      linkHealthFailureRatioMax: 0.05,
    };
    const precisionOk = (metrics.data?.citation_precision_p95 ?? 1) >= thresholds.precision;
    const temporalOk = (metrics.data?.temporal_validity_p95 ?? 1) >= thresholds.temporal;
    const totalSources = provenance.data?.total_sources ?? 0;
    const failed = provenance.data?.link_failed ?? 0;
    const linkOk = totalSources === 0 ? true : failed / totalSources <= thresholds.linkHealthFailureRatioMax;
    return {
      thresholds,
      results: {
        citationPrecision: { ok: precisionOk, value: metrics.data?.citation_precision_p95 ?? null },
        temporalValidity: { ok: temporalOk, value: metrics.data?.temporal_validity_p95 ?? null },
        linkHealth: { ok: linkOk, failed, totalSources },
      },
    };
  },
);

// Export jobs
app.get<{ Params: { orgId: string } }>(
  '/admin/org/:orgId/exports',
  async (request, reply) => {
    const { orgId } = request.params;
    const userHeader = request.headers['x-user-id'];
    if (!userHeader || typeof userHeader !== 'string') return reply.code(400).send({ error: 'x-user-id header is required' });
    try {
      await authorizeRequestWithGuards('admin:manage', orgId, userHeader, request);
    } catch (error) {
      return reply.code(403).send({ error: 'forbidden' });
    }
    const { data, error } = await supabase
      .from('export_jobs')
      .select('id, format, status, file_path, error, created_at, completed_at, signature_manifest, content_sha256')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) return reply.code(500).send({ error: 'exports_failed' });

    // Create signed URLs for file_path where present
    const rows = [] as Array<any>;
    for (const row of data ?? []) {
      let signedUrl: string | null = null;
      if (row.file_path) {
        const signed = await supabase.storage.from('snapshots').createSignedUrl(row.file_path, 60 * 60);
        if (!signed.error) signedUrl = signed.data?.signedUrl ?? null;
      }
      rows.push({ ...row, signedUrl });
    }
    return { exports: rows };
  },
);

app.post<{ Params: { orgId: string }; Body: { format?: 'csv' | 'json' } }>(
  '/admin/org/:orgId/export',
  async (request, reply) => {
    const { orgId } = request.params;
    const { format } = request.body ?? {};
    const userHeader = request.headers['x-user-id'];
    if (!userHeader || typeof userHeader !== 'string') return reply.code(400).send({ error: 'x-user-id header is required' });
    try {
      await authorizeRequestWithGuards('admin:manage', orgId, userHeader, request);
    } catch (error) {
      return reply.code(403).send({ error: 'forbidden' });
    }

    // Insert job
    const ins = await supabase
      .from('export_jobs')
      .insert({ org_id: orgId, requested_by: userHeader, format: format ?? 'csv', status: 'pending' })
      .select('id')
      .single();
    if (ins.error || !ins.data) return reply.code(500).send({ error: 'export_insert_failed' });
    const jobId = (ins.data as any).id as string;

    // Build export snapshot
    const { data: sources, error } = await supabase
      .from('sources')
      .select(
        'jurisdiction_code, source_type, title, publisher, source_url, binding_lang, consolidated, effective_date, eli, ecli, link_last_status, residency_zone',
      )
      .eq('org_id', orgId);
    if (error) return reply.code(500).send({ error: 'export_query_failed' });

    let filePath = `${orgId}/exports/export-${Date.now()}.${format ?? 'csv'}`;
    let status: 'completed' | 'failed' = 'completed';
    let errorMessage: string | null = null;
    let contentSha: string | null = null;
    let signature: C2PASignature | null = null;
    try {
      const totalSources = sources?.length ?? 0;
      const bindingCount = (sources ?? []).reduce((acc, s: any) => acc + (s.binding_lang ? 1 : 0), 0);
      const residencyCount = (sources ?? []).reduce((acc, s: any) => acc + (s.residency_zone ? 1 : 0), 0);
      const bindingCoverage = totalSources > 0 ? bindingCount / totalSources : null;
      const residencyCoverage = totalSources > 0 ? residencyCount / totalSources : null;
      const summary = {
        totalSources,
        bindingCoverage,
        residencyCoverage,
      };
      const filename = filePath.split('/').pop() ?? `export.${format ?? 'csv'}`;
      if ((format ?? 'csv') === 'json') {
        const payload = { summary, sources: sources ?? [] };
        const json = JSON.stringify(payload, null, 2);
        contentSha = createHash('sha256').update(json).digest('hex');
        signature = signC2PA({ orgId, userId: userHeader, contentSha256: contentSha, filename });
        const blob = new Blob([json], { type: 'application/json' });
        const up = await supabase.storage
          .from('snapshots')
          .upload(filePath, blob, { upsert: true, contentType: 'application/json' });
        if (up.error) throw new Error(up.error.message);
      } else {
        // CSV
        const header = [
          'jurisdiction',
          'type',
          'title',
          'publisher',
          'url',
          'binding_lang',
          'consolidated',
          'effective_date',
          'eli',
          'ecli',
          'link_status',
          'residency_zone',
        ];
        const rows = (sources ?? []).map((s: any) => [
          s.jurisdiction_code ?? '',
          s.source_type ?? '',
          (s.title ?? '').replaceAll('"', '""'),
          (s.publisher ?? '').replaceAll('"', '""'),
          s.source_url ?? '',
          s.binding_lang ?? '',
          String(Boolean(s.consolidated)),
          s.effective_date ?? '',
          s.eli ?? '',
          s.ecli ?? '',
          s.link_last_status ?? '',
          s.residency_zone ?? '',
        ]);
        const summaryLine = `# binding_ratio=${bindingCoverage === null ? '' : bindingCoverage.toFixed(4)}, residency_coverage=${
          residencyCoverage === null ? '' : residencyCoverage.toFixed(4)
        }`;
        const csv = [summaryLine, header, ...rows]
          .map((r) =>
            Array.isArray(r)
              ? r
                  .map((v) => {
                    const value = String(v);
                    const escaped = value.replaceAll('"', '""');
                    return `"${escaped}"`;
                  })
                  .join(',')
              : r,
          )
          .join('\n');
        contentSha = createHash('sha256').update(csv).digest('hex');
        signature = signC2PA({ orgId, userId: userHeader, contentSha256: contentSha, filename });
        const blob = new Blob([csv], { type: 'text/csv' });
        const up = await supabase.storage
          .from('snapshots')
          .upload(filePath, blob, { upsert: true, contentType: 'text/csv' });
        if (up.error) throw new Error(up.error.message);
      }
    } catch (e) {
      status = 'failed';
      errorMessage = (e as Error).message ?? 'export_failed';
      contentSha = null;
      signature = null;
    }
    await supabase
      .from('export_jobs')
      .update({
        status,
        file_path: status === 'completed' ? filePath : null,
        error: errorMessage,
        completed_at: new Date().toISOString(),
        content_sha256: status === 'completed' ? contentSha : null,
        signature_manifest: status === 'completed' ? (signature as unknown as Record<string, unknown> | null) : null,
      })
      .eq('id', jobId);

    return { id: jobId, status, filePath: status === 'completed' ? filePath : null };
  },
);

// Deletion requests
app.get<{ Params: { orgId: string } }>(
  '/admin/org/:orgId/deletion-requests',
  async (request, reply) => {
    const { orgId } = request.params;
    const userHeader = request.headers['x-user-id'];
    if (!userHeader || typeof userHeader !== 'string') return reply.code(400).send({ error: 'x-user-id header is required' });
    try {
      await authorizeRequestWithGuards('admin:manage', orgId, userHeader, request);
    } catch (error) {
      return reply.code(403).send({ error: 'forbidden' });
    }
    const { data, error } = await supabase
      .from('deletion_requests')
      .select('id, target, target_id, reason, status, created_at, processed_at, error')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) return reply.code(500).send({ error: 'deletion_list_failed' });
    return { requests: data ?? [] };
  },
);

app.post<{ Params: { orgId: string }; Body: { target: 'document' | 'source' | 'org'; id?: string; reason?: string } }>(
  '/admin/org/:orgId/delete',
  async (request, reply) => {
    const { orgId } = request.params;
    const { target, id, reason } = request.body ?? {};
    const userHeader = request.headers['x-user-id'];
    if (!userHeader || typeof userHeader !== 'string') return reply.code(400).send({ error: 'x-user-id header is required' });
    try {
      await authorizeRequestWithGuards('admin:manage', orgId, userHeader, request);
    } catch (error) {
      return reply.code(403).send({ error: 'forbidden' });
    }
    const ins = await supabase
      .from('deletion_requests')
      .insert({ org_id: orgId, requested_by: userHeader, target, target_id: id ?? null, reason: reason ?? null, status: 'pending' })
      .select('id')
      .single();
    if (ins.error || !ins.data) return reply.code(500).send({ error: 'deletion_insert_failed' });
    const reqId = (ins.data as any).id as string;

    // Process synchronously for documents only (demo path)
    let status: 'completed' | 'failed' = 'completed';
    let errorMessage: string | null = null;
    if (target === 'document' && id) {
      try {
        const doc = await supabase
          .from('documents')
          .select('id, org_id, bucket_id, storage_path')
          .eq('id', id)
          .eq('org_id', orgId)
          .maybeSingle();
        if (doc.error || !doc.data) throw new Error('document_not_found');
        const del = await supabase.storage.from(doc.data.bucket_id as string).remove([doc.data.storage_path as string]);
        if (del.error) throw new Error(del.error.message);
        await supabase.from('documents').delete().eq('id', id).eq('org_id', orgId);
        await supabase.from('document_chunks').delete().eq('document_id', id).eq('org_id', orgId);
      } catch (e) {
        status = 'failed';
        errorMessage = (e as Error).message ?? 'deletion_failed';
      }
    }
    await supabase
      .from('deletion_requests')
      .update({ status, processed_at: new Date().toISOString(), error: errorMessage })
      .eq('id', reqId);
    return { id: reqId, status };
  },
);
// Recompute case scores for an organization
app.post<{ Body: { orgId?: string; limit?: number } }>('/cases/recompute', async (request, reply) => {
  const { orgId, limit } = request.body ?? {};
  if (!orgId) return reply.code(400).send({ error: 'orgId is required' });
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') return reply.code(400).send({ error: 'x-user-id header is required' });
  try {
    await authorizeRequestWithGuards('cases:view', orgId, userHeader, request);
  } catch (error) {
    return reply.code(403).send({ error: 'forbidden' });
  }

  const { data: cases, error } = await supabase
    .from('sources')
    .select('id, jurisdiction_code, trust_tier, court_rank, binding_lang, effective_date, created_at')
    .eq('org_id', orgId)
    .eq('source_type', 'case')
    .order('created_at', { ascending: false })
    .limit(Math.max(1, Math.min(limit ?? 200, 1000)));
  if (error) return reply.code(500).send({ error: 'sources_failed' });

  let updated = 0;
  for (const row of cases ?? []) {
    const sourceId = (row as any).id as string;
    const juris = (row as any).jurisdiction_code as string;
    const trustTier = (((row as any).trust_tier as string) ?? 'T2') as 'T1' | 'T2' | 'T3' | 'T4';
    const courtRank = (row as any).court_rank as string | null;
    const bindingLang = (row as any).binding_lang as string | null;
    const effectiveDate = (row as any).effective_date as string | null;
    const createdAt = (row as any).created_at as string | null;

    const [treatmentsRes, alignmentsRes] = await Promise.all([
      supabase
        .from('case_treatments')
        .select('treatment, weight, decided_at')
        .eq('org_id', orgId)
        .eq('source_id', sourceId),
      supabase
        .from('case_statute_links')
        .select('alignment_score')
        .eq('org_id', orgId)
        .eq('case_source_id', sourceId),
    ]);
    if (treatmentsRes.error || alignmentsRes.error) {
      continue;
    }
    const signals = {
      trustTier,
      courtRank,
      jurisdiction: juris,
      bindingJurisdiction: juris,
      politicalRiskFlag: false,
      bindingLanguage: bindingLang,
      effectiveDate,
      createdAt,
      treatments: (treatmentsRes.data ?? []).map((t) => ({ treatment: t.treatment as string, weight: (t.weight as number) ?? 1, decidedAt: (t.decided_at as string) ?? null })),
      statuteAlignments: (alignmentsRes.data ?? []).map((a) => ({ alignmentScore: (a.alignment_score as number) ?? null })),
      riskOverlays: [],
    } as const;
    const result = evaluateCaseQuality(signals);
    const upsert = await supabase
      .from('case_scores')
      .upsert(
        {
          org_id: orgId,
          source_id: sourceId,
          juris_code: juris,
          score_overall: result.score,
          axes: result.axes as any,
          hard_block: result.hardBlock,
          model_ref: 'policy_v1',
          computed_at: new Date().toISOString(),
        },
        { onConflict: 'source_id' },
      )
      .select('id')
      .maybeSingle();
    if (!upsert.error) updated += 1;
  }
  return { updated };
});
