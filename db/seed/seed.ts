import { createHash } from 'node:crypto';
import { config as loadEnv } from 'dotenv';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SEED_ENV = process.env.SUPABASE_SEED_ENV ?? process.env.NODE_ENV ?? 'development';
const ALLOW_PRODUCTION_SEED = process.env.SUPABASE_SEED_ALLOW === 'true';

const allowedSeedEnvironments = new Set(['development', 'test', 'preview', 'staging', 'ci']);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase credentials in environment');
  process.exit(1);
}

if (SEED_ENV === 'production' && !ALLOW_PRODUCTION_SEED) {
  console.error('Refusing to seed production without SUPABASE_SEED_ALLOW=true');
  process.exit(1);
}

if (!allowedSeedEnvironments.has(SEED_ENV) && !(SEED_ENV === 'production' && ALLOW_PRODUCTION_SEED)) {
  console.error(`Unsupported seeding environment: ${SEED_ENV}. Set SUPABASE_SEED_ENV to development|test|preview|staging|ci.`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const globalStructuredClone = (globalThis as unknown as { structuredClone?: <T>(value: T) => T }).structuredClone;

function cloneDeep<T>(value: T): T {
  if (globalStructuredClone) {
    return globalStructuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function createFactory<T>(items: readonly T[]): () => T[] {
  const canonical = items.map((item) => cloneDeep(item));
  return () => canonical.map((item) => cloneDeep(item));
}

function deterministicUuid(namespace: string, value: string): string {
  const hash = createHash('sha256').update(`${namespace}:${value}`).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

const DEMO_ORG_ID = '00000000-0000-0000-0000-000000000000';

const jurisdictionsFactory = createFactory([
  { code: 'FR', name: 'France', eu: true, ohada: false },
  { code: 'BE', name: 'Belgique', eu: true, ohada: false },
  { code: 'LU', name: 'Luxembourg', eu: true, ohada: false },
  { code: 'CH', name: 'Suisse (FR)', eu: false, ohada: false },
  { code: 'MC', name: 'Monaco', eu: false, ohada: false },
  { code: 'CA-QC', name: 'Québec / Canada', eu: false, ohada: false },
  { code: 'EU', name: 'Union européenne', eu: true, ohada: false },
  { code: 'OHADA', name: 'OHADA', eu: false, ohada: true },
  { code: 'MA', name: 'Maroc', eu: false, ohada: false },
  { code: 'TN', name: 'Tunisie', eu: false, ohada: false },
  { code: 'DZ', name: 'Algérie', eu: false, ohada: false },
  { code: 'OAPI', name: 'Organisation africaine de la propriété intellectuelle', eu: false, ohada: false },
  { code: 'CIMA', name: 'Conférence interafricaine des marchés d\'assurances', eu: false, ohada: false },
]);

const authorityDomainSeeds: Record<string, readonly string[]> = {
  FR: ['legifrance.gouv.fr', 'courdecassation.fr', 'conseil-etat.fr'],
  BE: ['justel.fgov.be', 'moniteur.be', 'ejustice.fgov.be'],
  LU: ['legilux.public.lu'],
  CH: ['fedlex.admin.ch', 'bger.ch'],
  MC: ['legimonaco.mc'],
  'CA-QC': [
    'legisquebec.gouv.qc.ca',
    'canlii.org',
    'laws-lois.justice.gc.ca',
    'scc-csc.ca',
    'scc-csc.lexum.com',
  ],
  EU: ['eur-lex.europa.eu'],
  OHADA: ['ohada.org'],
  MA: ['sgg.gov.ma'],
  TN: ['iort.gov.tn'],
  DZ: ['joradp.dz'],
  OAPI: ['oapi.int'],
  CIMA: ['cima-afrique.org'],
};

function buildAuthorityDomainFactory(): () => { jurisdiction_code: string; host: string }[] {
  const entries: { jurisdiction_code: string; host: string }[] = [];
  for (const [code, hosts] of Object.entries(authorityDomainSeeds).sort(([a], [b]) => a.localeCompare(b))) {
    for (const host of [...hosts].sort()) {
      entries.push({ jurisdiction_code: code, host });
    }
  }
  return createFactory(entries);
}

const authorityDomainsFactory = buildAuthorityDomainFactory();

const residencyZonesFactory = createFactory([
  { code: 'eu', description: 'Union européenne / EEE' },
  { code: 'ohada', description: "OHADA - Afrique de l\'Ouest et Centrale" },
  { code: 'ch', description: 'Suisse (cantons francophones)' },
  { code: 'ca', description: 'Canada / Québec' },
  { code: 'rw', description: 'Rwanda (gazette et justice)' },
  { code: 'maghreb', description: 'Maghreb francophone (Maroc, Tunisie, Algérie)' },
]);

const entitlementsSeeds = [
  { juris_code: 'FR', can_read: true, can_write: false },
  { juris_code: 'BE', can_read: true, can_write: false },
  { juris_code: 'LU', can_read: true, can_write: false },
  { juris_code: 'EU', can_read: true, can_write: false },
  { juris_code: 'OHADA', can_read: true, can_write: false },
  { juris_code: 'CA-QC', can_read: true, can_write: false },
  { juris_code: 'MAGHREB', can_read: true, can_write: false },
  { juris_code: 'RW', can_read: true, can_write: false },
] as const;

function buildEntitlementsFactory(orgId: string) {
  return createFactory(
    entitlementsSeeds.map((seed) => ({
      org_id: orgId,
      juris_code: seed.juris_code,
      can_read: seed.can_read,
      can_write: seed.can_write,
    })),
  );
}

const orgPolicySeeds = [
  { key: 'confidential_mode', value: { enabled: false } },
  { key: 'fr_judge_analytics_block', value: { enabled: true } },
] as const;

function buildOrgPolicyFactory(orgId: string) {
  return createFactory(
    orgPolicySeeds.map((seed) => ({
      org_id: orgId,
      key: seed.key,
      value: cloneDeep(seed.value),
    })),
  );
}

const evaluationCaseSeeds = [
  {
    name: 'FR - Responsabilité délictuelle',
    prompt: "Quels sont les critères de mise en jeu de la responsabilité délictuelle pour un dommage causé par un salarié en France ?",
    expected_contains: ['code civil', '1240', 'faute'],
  },
  {
    name: 'OHADA - Sûretés mobilières',
    prompt:
      'Dans le cadre OHADA, quelles sont les exigences pour constituer un gage sans dépossession sur un stock de marchandises ?',
    expected_contains: ['acte uniforme', 'sûretés', 'ccja'],
  },
  {
    name: 'MA - Clause de non-concurrence',
    prompt: 'Au Maroc, quelles conditions rendent valable une clause de non-concurrence insérée dans un contrat de travail ?',
    expected_contains: ['bulletin officiel', 'code du travail', 'traduction'],
  },
] as const;

function buildEvaluationCaseFactory(orgId: string) {
  return createFactory(
    evaluationCaseSeeds.map((seed) => ({
      org_id: orgId,
      name: seed.name,
      prompt: seed.prompt,
      expected_contains: seed.expected_contains,
    })),
  );
}

const pleadingTemplateFactory = createFactory([
  {
    org_id: null,
    jurisdiction_code: 'FR',
    matter_type: 'assignation',
    title: 'Assignation civile devant le tribunal judiciaire',
    summary:
      "Assignation introductive d'instance comprenant exposé des faits, fondement juridique et demandes principales.",
    sections: [
      { heading: 'Faits', body: 'Exposer chronologiquement les faits pertinents et les pièces clés.' },
      {
        heading: 'Discussion',
        body: "Rappeler les articles applicables (ex. Code civil art. 1240) et la jurisprudence de la Cour de cassation.",
      },
      { heading: 'Dispositif', body: 'Formuler précisément les demandes au tribunal.' },
    ],
    fill_ins: ['Nom du tribunal', 'Parties', 'Montant réclamé'],
  },
  {
    org_id: null,
    jurisdiction_code: 'OHADA',
    matter_type: 'procesVerbal',
    title: 'Procès-verbal d’Assemblée Générale Ordinaire (AUSCGIE)',
    summary: "Modèle conforme à l’AUSCGIE avec quorum, ordre du jour et résolution de distribution.",
    sections: [
      { heading: 'Constitution de séance', body: 'Présence du commissaire aux comptes et vérification du quorum.' },
      { heading: 'Ordre du jour', body: 'Lister les résolutions et rappeler les articles de l’AUSCGIE applicables.' },
      { heading: 'Résolutions', body: 'Consigner chaque vote avec le résultat et les pouvoirs.' },
    ],
    fill_ins: ['Date', 'Lieu', 'Résolution principale'],
  },
  {
    org_id: null,
    jurisdiction_code: 'MA',
    matter_type: 'miseEnDemeure',
    title: 'Mise en demeure pour inexécution contractuelle',
    summary:
      "Lettre recommandée rappelant le contrat, les manquements et le délai de régularisation (Code des obligations et contrats).",
    sections: [
      { heading: 'Objet', body: 'Notifier la mise en demeure et rappeler la clause concernée.' },
      {
        heading: 'Fondements',
        body: "Mentionner le Code des obligations et contrats et l'édition de traduction officielle du Bulletin Officiel.",
      },
      { heading: 'Injonction', body: 'Fixer un délai clair et mentionner les suites (résiliation, dommages-intérêts).' },
    ],
    fill_ins: ['Clause contractuelle', 'Délai', 'Conséquences'],
  },
  {
    org_id: null,
    jurisdiction_code: 'CA-QC',
    matter_type: 'contrats',
    title: 'Clause de confidentialité bilingue',
    summary: 'Clause standard pour accords commerciaux québécois incluant hiérarchie des langues et tribunal compétent.',
    sections: [
      { heading: 'Objet', body: 'Décrire les informations confidentielles et exceptions.' },
      {
        heading: 'Durée',
        body: "Préciser la durée de l'obligation en cohérence avec le C.c.Q. art. 1375 et la jurisprudence.",
      },
      { heading: 'Langue', body: 'Indiquer la version faisant foi en vertu de la Charte de la langue française.' },
    ],
    fill_ins: ['Durée (mois)', 'Tribunal compétent', 'Langue prioritaire'],
  },
]);

const governancePublicationFactory = createFactory([
  {
    slug: 'dpia-commitments',
    title: "DPIA & Engagements Conseil de l'Europe",
    summary:
      "Synthèse des mesures de conformité (RGPD, Loi IA UE) et des engagements pris dans le cadre de la Convention-cadre du Conseil de l'Europe.",
    doc_url: 'https://app.avocat-ai.example/governance/dpia_commitments.md',
    category: 'compliance',
    status: 'published',
    metadata: { version: '1.0.0' },
  },
  {
    slug: 'coe-alignment',
    title: "Alignement Conseil de l'Europe – IA Responsable",
    summary:
      "Cadre de transparence, supervision humaine, responsabilité et équité pour l'agent juridique autonome conformément au traité en préparation.",
    doc_url: 'https://app.avocat-ai.example/governance/coe_ai_alignment.md',
    category: 'compliance',
    status: 'published',
    metadata: { version: '1.0.0' },
  },
  {
    slug: 'cepej-charter',
    title: 'Charte éthique CEPEJ',
    summary: 'Cartographie des principes CEPEJ et des contrôles produits associés, à partager avec les clients et autorités.',
    doc_url: 'https://app.avocat-ai.example/governance/cepej_charter_mapping.md',
    category: 'compliance',
    status: 'published',
    metadata: { version: '1.0.0' },
  },
  {
    slug: 'incident-response-plan',
    title: 'Plan de réponse aux incidents',
    summary: 'Processus en six étapes, SLA et responsabilités pour la gestion des incidents de sécurité, qualité ou disponibilité.',
    doc_url: 'https://app.avocat-ai.example/governance/incident_response_plan.md',
    category: 'operations',
    status: 'published',
    metadata: { version: '1.0.0' },
  },
  {
    slug: 'change-management-playbook',
    title: 'Playbook de gestion des changements',
    summary: 'Cycle CAB, classifications et check-lists pour piloter les évolutions sans régression de conformité.',
    doc_url: 'https://app.avocat-ai.example/governance/change_management_playbook.md',
    category: 'operations',
    status: 'published',
    metadata: { version: '1.0.0' },
  },
  {
    slug: 'slo-and-support',
    title: 'SLO & support opérationnel',
    summary: 'Objectifs de service, engagements support et reporting mensuel communiqués dans le centre de confiance.',
    doc_url: 'https://app.avocat-ai.example/governance/slo_and_support.md',
    category: 'operations',
    status: 'published',
    metadata: { version: '1.0.0' },
  },
  {
    slug: 'pilot-onboarding',
    title: "Playbook d'onboarding pilote",
    summary: 'Check-list de préparation, formation et indicateurs de succès pour conduire un pilote de six semaines.',
    doc_url: 'https://app.avocat-ai.example/governance/pilot_onboarding_playbook.md',
    category: 'launch',
    status: 'published',
    metadata: { version: '1.0.0' },
  },
  {
    slug: 'pricing-collateral',
    title: 'Tarification & supports commerciaux',
    summary: 'Grille tarifaire, packaging et checklist de lancement à fournir aux équipes commerciales et clients.',
    doc_url: 'https://app.avocat-ai.example/governance/pricing_collateral.md',
    category: 'launch',
    status: 'published',
    metadata: { version: '1.0.0' },
  },
  {
    slug: 'support-runbook',
    title: 'Runbook support & astreinte',
    summary: 'Escalade 24/5, responsabilités et scénarios types pour gérer les demandes clients et incidents.',
    doc_url: 'https://app.avocat-ai.example/governance/support_runbook.md',
    category: 'operations',
    status: 'published',
    metadata: { version: '1.0.0' },
  },
  {
    slug: 'regulator-outreach-plan',
    title: 'Plan de communication régulateurs',
    summary: 'Canaux officiels, cadence de reporting et points de contact pour informer autorités & ordres professionnels.',
    doc_url: 'https://app.avocat-ai.example/governance/regulator_outreach_plan.md',
    category: 'operations',
    status: 'published',
    metadata: { version: '1.0.0' },
  },
]);

const incidentReportSeeds = [
  {
    key: 'hitl-latency',
    occurred_at: '2024-07-04T08:30:00Z',
    detected_at: '2024-07-04T08:37:00Z',
    resolved_at: '2024-07-04T09:05:00Z',
    severity: 'medium',
    status: 'closed',
    title: 'Dégradation ponctuelle du délai HITL',
    summary:
      "Temps de réponse reviewer > SLA pendant 35 minutes suite à un pic d'escalades déclenché par une mise à jour du modèle.",
    impact: 'Temps d’attente moyen 12 min vs objectif 8 min sur la fenêtre concernée.',
    resolution:
      "Activation du plan de contingence reviewer + reconfiguration du seuil d'escalade ; métriques redevenues nominales.",
    follow_up: 'Ajouter un garde-fou automatique dans le worker de learning et informer les clients pilotes de l’incident clos.',
    evidence_url: 'https://app.avocat-ai.example/governance/incident_response_plan.md',
  },
  {
    key: 'maghreb-link',
    occurred_at: '2024-08-22T16:12:00Z',
    detected_at: '2024-08-22T16:15:00Z',
    resolved_at: '2024-08-22T16:40:00Z',
    severity: 'low',
    status: 'closed',
    title: 'Lien source expiré (Maghreb)',
    summary:
      'Lien JORT expiré détecté par la surveillance de santé des sources ; aucun client impacté grâce au fallback vector store.',
    impact: 'Aucun incident client, correction proactive.',
    resolution: 'Remplacement du snapshot, ajout du hash correct et relecture par l’équipe ingestion.',
    follow_up: 'Suivi hebdo renforcé sur les gazettes Maghreb et alertes dans le tableau de bord retravaillé.',
    evidence_url: 'https://app.avocat-ai.example/governance/change_management_playbook.md',
  },
] as const;

function buildIncidentReportFactory(orgId: string) {
  return createFactory(
    incidentReportSeeds.map((seed) => ({
      id: deterministicUuid('incident', `${orgId}:${seed.key}`),
      org_id: orgId,
      occurred_at: seed.occurred_at,
      detected_at: seed.detected_at,
      resolved_at: seed.resolved_at,
      severity: seed.severity,
      status: seed.status,
      title: seed.title,
      summary: seed.summary,
      impact: seed.impact,
      resolution: seed.resolution,
      follow_up: seed.follow_up,
      evidence_url: seed.evidence_url,
      recorded_by: orgId,
    })),
  );
}

const changeLogSeeds = [
  {
    key: 'slo-dashboard',
    entry_date: '2024-08-15',
    title: 'Dashboard SLO & export régulateur',
    category: 'ops',
    summary: "Ajout du panneau SLO dans la console admin et export CSV destiné aux autorités / clients entreprises.",
    release_tag: '2024.08-ga-readiness',
    links: { docs: ['https://app.avocat-ai.example/governance/slo_and_support.md'] },
  },
  {
    key: 'incident-playbook-1-2',
    entry_date: '2024-09-02',
    title: 'Playbook incidents mis à jour',
    category: 'policy',
    summary: 'Version 1.2 du plan de réponse aux incidents avec nouveaux seuils de notification régulateur et modèle de rapport.',
    release_tag: '2024.09-hardening',
    links: { docs: ['https://app.avocat-ai.example/governance/incident_response_plan.md'] },
  },
  {
    key: 'regulator-outreach-plan',
    entry_date: '2024-09-10',
    title: 'Plan de communication régulateurs',
    category: 'compliance',
    summary: 'Création du plan de contact trimestriel (CNIL, CSA, Ordre des avocats) et intégration dans la checklist Go / No-Go.',
    release_tag: '2024.09-hardening',
    links: { docs: ['https://app.avocat-ai.example/governance/regulator_outreach_plan.md'] },
  },
] as const;

function buildChangeLogFactory(orgId: string) {
  return createFactory(
    changeLogSeeds.map((seed) => ({
      id: deterministicUuid('change-log', `${orgId}:${seed.key}`),
      org_id: orgId,
      entry_date: seed.entry_date,
      title: seed.title,
      category: seed.category,
      summary: seed.summary,
      release_tag: seed.release_tag,
      links: cloneDeep(seed.links),
      recorded_by: orgId,
    })),
  );
}

function buildSeedPlan(orgId: string) {
  const entitlementsFactory = buildEntitlementsFactory(orgId);
  const orgPolicyFactory = buildOrgPolicyFactory(orgId);
  const evaluationFactory = buildEvaluationCaseFactory(orgId);
  const incidentFactory = buildIncidentReportFactory(orgId);
  const changeLogFactory = buildChangeLogFactory(orgId);

  return {
    organization: { id: orgId, name: 'Organisation de démonstration' },
    ownerMember: { org_id: orgId, user_id: orgId, role: 'owner' },
    jurisdictions: jurisdictionsFactory(),
    authorityDomains: authorityDomainsFactory(),
    residencyZones: residencyZonesFactory(),
    entitlements: entitlementsFactory(),
    orgPolicies: orgPolicyFactory(),
    evaluationCases: evaluationFactory(),
    pleadingTemplates: pleadingTemplateFactory(),
    governancePublications: governancePublicationFactory(),
    incidentReports: incidentFactory(),
    changeLogEntries: changeLogFactory(),
  };
}

type SeedPlan = ReturnType<typeof buildSeedPlan>;

async function applySeedPlan(plan: SeedPlan) {
  await supabase.from('jurisdictions').upsert(plan.jurisdictions, { onConflict: 'code' });
  await supabase.from('authority_domains').upsert(plan.authorityDomains, { onConflict: 'jurisdiction_code,host' });
  await supabase.from('residency_zones').upsert(plan.residencyZones, { onConflict: 'code' });
  await supabase.from('organizations').upsert(plan.organization);
  await supabase.from('org_members').upsert(plan.ownerMember, { onConflict: 'org_id,user_id' });
  await supabase.from('org_policies').upsert(plan.orgPolicies, { onConflict: 'org_id,key' });
  await supabase.from('jurisdiction_entitlements').upsert(plan.entitlements, { onConflict: 'org_id,juris_code' });
  await supabase.from('eval_cases').upsert(plan.evaluationCases, { onConflict: 'org_id,name' });
  await supabase.from('pleading_templates').upsert(plan.pleadingTemplates);
  await supabase.from('governance_publications').upsert(plan.governancePublications, { onConflict: 'slug' });
  await supabase.from('incident_reports').upsert(plan.incidentReports, { onConflict: 'id' });
  await supabase.from('change_log_entries').upsert(plan.changeLogEntries, { onConflict: 'id' });
}

async function main() {
  const seedPlan = buildSeedPlan(DEMO_ORG_ID);
  await applySeedPlan(seedPlan);
  console.log(`Seed completed for ${seedPlan.organization.id} (${SEED_ENV})`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
