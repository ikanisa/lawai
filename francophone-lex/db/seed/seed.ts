import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase credentials in environment');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const jurisdictions = [
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
  { code: 'RW', name: 'Rwanda', eu: false, ohada: false },
];

const authorityDomains = {
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
  RW: ['gazette.gov.rw', 'gazettes.gov.rw', 'minijust.gov.rw', 'amategeko.gov.rw', 'rlrc.gov.rw', 'judiciary.gov.rw', 'rwandalii.gov.rw'],
};

const DEMO_ORG_ID = '00000000-0000-0000-0000-000000000000';

const residencyZones = [
  { code: 'eu', description: 'Union européenne / EEE' },
  { code: 'ohada', description: "OHADA - Afrique de l'Ouest et Centrale" },
  { code: 'ch', description: 'Suisse (cantons francophones)' },
  { code: 'ca', description: 'Canada / Québec' },
  { code: 'rw', description: 'Rwanda (gazette et justice)' },
  { code: 'maghreb', description: 'Maghreb francophone (Maroc, Tunisie, Algérie)' },
];

const entitlements = [
  { org_id: DEMO_ORG_ID, juris_code: 'FR', can_read: true, can_write: false },
  { org_id: DEMO_ORG_ID, juris_code: 'BE', can_read: true, can_write: false },
  { org_id: DEMO_ORG_ID, juris_code: 'LU', can_read: true, can_write: false },
  { org_id: DEMO_ORG_ID, juris_code: 'EU', can_read: true, can_write: false },
  { org_id: DEMO_ORG_ID, juris_code: 'OHADA', can_read: true, can_write: false },
  { org_id: DEMO_ORG_ID, juris_code: 'CA-QC', can_read: true, can_write: false },
  { org_id: DEMO_ORG_ID, juris_code: 'MAGHREB', can_read: true, can_write: false },
  { org_id: DEMO_ORG_ID, juris_code: 'RW', can_read: true, can_write: false },
];

const orgPolicies = [
  { org_id: DEMO_ORG_ID, key: 'confidential_mode', value: { enabled: false } },
  { org_id: DEMO_ORG_ID, key: 'fr_judge_analytics_block', value: { enabled: true } },
];

const evaluationCases = [
  {
    org_id: DEMO_ORG_ID,
    name: 'FR - Responsabilité délictuelle',
    prompt:
      "Quels sont les critères de mise en jeu de la responsabilité délictuelle pour un dommage causé par un salarié en France ?",
    expected_contains: ['code civil', '1240', 'faute'],
  },
  {
    org_id: DEMO_ORG_ID,
    name: 'OHADA - Sûretés mobilières',
    prompt:
      "Dans le cadre OHADA, quelles sont les exigences pour constituer un gage sans dépossession sur un stock de marchandises ?",
    expected_contains: ['acte uniforme', 'sûretés', 'ccja'],
  },
  {
    org_id: DEMO_ORG_ID,
    name: 'MA - Clause de non-concurrence',
    prompt:
      "Au Maroc, quelles conditions rendent valable une clause de non-concurrence insérée dans un contrat de travail ?",
    expected_contains: ['bulletin officiel', 'code du travail', 'traduction'],
  },
];

const pleadingTemplates = [
  {
    org_id: null,
    jurisdiction_code: 'FR',
    matter_type: 'assignation',
    title: "Assignation civile devant le tribunal judiciaire",
    summary:
      "Assignation introductive d'instance comprenant exposé des faits, fondement juridique et demandes principales.",
    sections: [
      { heading: 'Faits', body: "Exposer chronologiquement les faits pertinents et les pièces clés." },
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
    summary:
      'Clause standard pour accords commerciaux québécois incluant hiérarchie des langues et tribunal compétent.',
    sections: [
      { heading: 'Objet', body: 'Définir les informations confidentielles et exceptions.' },
      {
        heading: 'Durée',
        body: "Préciser la durée de l'obligation en cohérence avec le C.c.Q. art. 1375 et la jurisprudence." },
      { heading: 'Langue', body: 'Indiquer la version faisant foi en vertu de la Charte de la langue française.' },
    ],
    fill_ins: ['Durée (mois)', 'Tribunal compétent', 'Langue prioritaire'],
  },
];

const governancePublications = [
  {
    slug: 'dpia-commitments',
    title: 'DPIA & Engagements Conseil de l\'Europe',
    summary:
      "Synthèse des mesures de conformité (RGPD, Loi IA UE) et des engagements pris dans le cadre de la Convention-cadre du Conseil de l'Europe.",
    doc_url: 'https://app.avocat-ai.example/governance/dpia_commitments.md',
    category: 'compliance',
    status: 'published',
    metadata: { version: '1.0.0' },
  },
  {
    slug: 'coe-alignment',
    title: 'Alignement Conseil de l\'Europe – IA Responsable',
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
    summary:
      'Cartographie des principes CEPEJ et des contrôles produits associés, à partager avec les clients et autorités.',
    doc_url: 'https://app.avocat-ai.example/governance/cepej_charter_mapping.md',
    category: 'compliance',
    status: 'published',
    metadata: { version: '1.0.0' },
  },
  {
    slug: 'incident-response-plan',
    title: 'Plan de réponse aux incidents',
    summary:
      'Processus en six étapes, SLA et responsabilités pour la gestion des incidents de sécurité, qualité ou disponibilité.',
    doc_url: 'https://app.avocat-ai.example/governance/incident_response_plan.md',
    category: 'operations',
    status: 'published',
    metadata: { version: '1.0.0' },
  },
  {
    slug: 'change-management-playbook',
    title: 'Playbook de gestion des changements',
    summary:
      'Cycle CAB, classifications et check-lists pour piloter les évolutions sans régression de conformité.',
    doc_url: 'https://app.avocat-ai.example/governance/change_management_playbook.md',
    category: 'operations',
    status: 'published',
    metadata: { version: '1.0.0' },
  },
  {
    slug: 'slo-and-support',
    title: 'SLO & support opérationnel',
    summary:
      "Objectifs de service, engagements support et reporting mensuel communiqués dans le centre de confiance.",
    doc_url: 'https://app.avocat-ai.example/governance/slo_and_support.md',
    category: 'operations',
    status: 'published',
    metadata: { version: '1.0.0' },
  },
  {
    slug: 'pilot-onboarding',
    title: "Playbook d'onboarding pilote",
    summary:
      'Check-list de préparation, formation et indicateurs de succès pour conduire un pilote de six semaines.',
    doc_url: 'https://app.avocat-ai.example/governance/pilot_onboarding_playbook.md',
    category: 'launch',
    status: 'published',
    metadata: { version: '1.0.0' },
  },
  {
    slug: 'pricing-collateral',
    title: 'Tarification & supports commerciaux',
    summary:
      'Grille tarifaire, packaging et checklist de lancement à fournir aux équipes commerciales et clients.',
    doc_url: 'https://app.avocat-ai.example/governance/pricing_collateral.md',
    category: 'launch',
    status: 'published',
    metadata: { version: '1.0.0' },
  },
  {
    slug: 'support-runbook',
    title: 'Runbook support & astreinte',
    summary:
      "Escalade 24/5, responsabilités et scénarios types pour gérer les demandes clients et incidents.",
    doc_url: 'https://app.avocat-ai.example/governance/support_runbook.md',
    category: 'operations',
    status: 'published',
    metadata: { version: '1.0.0' },
  },
  {
    slug: 'regulator-outreach-plan',
    title: 'Plan de communication régulateurs',
    summary:
      "Canaux officiels, cadence de reporting et points de contact pour informer autorités & ordres professionnels.",
    doc_url: 'https://app.avocat-ai.example/governance/regulator_outreach_plan.md',
    category: 'operations',
    status: 'published',
    metadata: { version: '1.0.0' },
  },
  {
    slug: 'disaster-recovery-runbook',
    title: 'Runbook reprise & rollback',
    summary:
      "Procédure de restauration complète, objectifs RPO/RTO et drill trimestriel de bascule régionale.",
    doc_url: 'https://app.avocat-ai.example/governance/disaster_recovery_runbook.md',
    category: 'operations',
    status: 'published',
    metadata: { version: '1.0.0' },
  },
];

const incidentReports = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    org_id: DEMO_ORG_ID,
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
    follow_up:
      'Ajouter un garde-fou automatique dans le worker de learning et informer les clients pilotes de l’incident clos.',
    evidence_url: 'https://app.avocat-ai.example/governance/incident_response_plan.md',
    recorded_by: DEMO_ORG_ID,
  },
  {
    id: '11111111-1111-1111-1111-222222222222',
    org_id: DEMO_ORG_ID,
    occurred_at: '2024-08-22T16:12:00Z',
    detected_at: '2024-08-22T16:15:00Z',
    resolved_at: '2024-08-22T16:40:00Z',
    severity: 'low',
    status: 'closed',
    title: 'Lien source expiré (Maghreb)',
    summary:
      "Lien JORT expiré détecté par la surveillance de santé des sources ; aucun client impacté grâce au fallback vector store.",
    impact: 'Aucun incident client, correction proactive.',
    resolution: 'Remplacement du snapshot, ajout du hash correct et relecture par l’équipe ingestion.',
    follow_up: 'Suivi hebdo renforcé sur les gazettes Maghreb et alertes dans le tableau de bord retravaillé.',
    evidence_url: 'https://app.avocat-ai.example/governance/change_management_playbook.md',
    recorded_by: DEMO_ORG_ID,
  },
];

const changeLogEntries = [
  {
    id: '22222222-1111-1111-1111-111111111111',
    org_id: DEMO_ORG_ID,
    entry_date: '2024-08-15',
    title: 'Dashboard SLO & export régulateur',
    category: 'ops',
    summary:
      "Ajout du panneau SLO dans la console admin et export CSV destiné aux autorités / clients entreprises.",
    release_tag: '2024.08-ga-readiness',
    links: { docs: ['https://app.avocat-ai.example/governance/slo_and_support.md'] },
    recorded_by: DEMO_ORG_ID,
  },
  {
    id: '22222222-1111-1111-1111-222222222222',
    org_id: DEMO_ORG_ID,
    entry_date: '2024-09-02',
    title: 'Playbook incidents mis à jour',
    category: 'policy',
    summary:
      "Version 1.2 du plan de réponse aux incidents avec nouveaux seuils de notification régulateur et modèle de rapport.",
    release_tag: '2024.09-hardening',
    links: { docs: ['https://app.avocat-ai.example/governance/incident_response_plan.md'] },
    recorded_by: DEMO_ORG_ID,
  },
  {
    id: '22222222-1111-1111-1111-333333333333',
    org_id: DEMO_ORG_ID,
    entry_date: '2024-09-10',
    title: 'Plan de communication régulateurs',
    category: 'compliance',
    summary:
      'Création du plan de contact trimestriel (CNIL, CSA, Ordre des avocats) et intégration dans la checklist Go / No-Go.',
    release_tag: '2024.09-hardening',
    links: { docs: ['https://app.avocat-ai.example/governance/regulator_outreach_plan.md'] },
    recorded_by: DEMO_ORG_ID,
  },
];

async function main() {
  for (const jurisdiction of jurisdictions) {
    await supabase.from('jurisdictions').upsert(jurisdiction, {
      onConflict: 'code',
    });
  }

  for (const [code, domains] of Object.entries(authorityDomains)) {
    for (const host of domains) {
      await supabase.from('authority_domains').upsert(
        { jurisdiction_code: code, host },
        { onConflict: 'jurisdiction_code,host' },
      );
    }
  }

  await supabase.from('organizations').upsert({
    id: DEMO_ORG_ID,
    name: 'Organisation de démonstration',
  });

  await supabase.from('org_members').upsert(
    { org_id: DEMO_ORG_ID, user_id: DEMO_ORG_ID, role: 'owner' },
    { onConflict: 'org_id,user_id' },
  );

  for (const zone of residencyZones) {
    await supabase.from('residency_zones').upsert(zone, { onConflict: 'code' });
  }

  for (const policy of orgPolicies) {
    await supabase.from('org_policies').upsert(policy, { onConflict: 'org_id,key' });
  }

  for (const entitlement of entitlements) {
    await supabase.from('jurisdiction_entitlements').upsert(entitlement, { onConflict: 'org_id,juris_code' });
  }

  for (const evalCase of evaluationCases) {
    await supabase.from('eval_cases').upsert(evalCase, { onConflict: 'org_id,name' });
  }

  for (const template of pleadingTemplates) {
    await supabase
      .from('pleading_templates')
      .upsert({
        ...template,
        sections: template.sections,
        fill_ins: template.fill_ins,
      });
  }

  for (const publication of governancePublications) {
    await supabase
      .from('governance_publications')
      .upsert(publication, { onConflict: 'slug' });
  }

  for (const incident of incidentReports) {
    await supabase
      .from('incident_reports')
      .upsert(incident, { onConflict: 'id' });
  }

  for (const change of changeLogEntries) {
    await supabase
      .from('change_log_entries')
      .upsert(change, { onConflict: 'id' });
  }

  console.log('Seed completed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
