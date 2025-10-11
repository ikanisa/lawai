// @ts-nocheck
import type {
  AllowlistSource,
  CitationDocument,
  CitationsBrowserData,
  CorpusDashboardData,
  HitlQueueData,
  MattersOverview,
  PolicyConfiguration,
  ResearchDeskContext,
  VoiceConsoleContext,
  VoiceRunResponse,
} from '@avocat-ai/shared';

export const researchDeskContext: ResearchDeskContext = {
  plan: {
    id: 'plan-helio-contrat',
    title: 'Analyse de la responsabilité contractuelle',
    jurisdiction: 'OHADA · Tribunal de commerce Dakar',
    riskLevel: 'MED',
    riskSummary:
      "Niveau de risque modéré : divergence sur la compétence OHADA et clauses limitatives de responsabilité",
    steps: [
      {
        id: 'step-intake',
        title: 'Qualifier les obligations principales',
        tool: 'lookupCodeArticle',
        status: 'done',
        summary: "Articles clés identifiés pour la vente internationale et la compétence OHADA.",
      },
      {
        id: 'step-risk',
        title: 'Comparer la jurisprudence OHADA',
        tool: 'web_search',
        status: 'active',
        summary: 'Recherche des décisions CCJA concernant les clauses limitatives.',
      },
      {
        id: 'step-deadline',
        title: 'Vérifier les délais de prescription',
        tool: 'limitationCheck',
        status: 'pending',
        summary: 'Calculs nécessaires pour confirmer le délai biennal applicable.',
      },
    ],
  },
  filters: {
    publicationDates: [
      { id: '30', label: '30 derniers jours' },
      { id: '180', label: '6 derniers mois' },
      { id: '365', label: '12 derniers mois' },
    ],
    entryIntoForce: [
      { id: 'current', label: 'Version en vigueur' },
      {
        id: 'all',
        label: 'Toutes les versions',
        description: 'Inclut les textes abrogés pour analyse historique.',
      },
    ],
  },
  defaultCitations: [
    {
      id: 'eli:ohada:acte:commerce:20240115:art:5',
      label: 'Acte uniforme OHADA, art. 5',
      href: 'https://www.ohada.org/eli/acte/commerce/2024/01/15/5',
      type: 'Officiel',
      snippet:
        "Les commerçants sont tenus de respecter les obligations issues des contrats conclus dans l'exercice de leur commerce.",
      score: 92,
      date: '2024-01-15',
    },
    {
      id: 'eli:fr:legifrance:code:commerce:20240101:art:L110-1',
      label: 'Code de commerce, art. L110-1',
      href: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006243890',
      type: 'Consolidé',
      snippet:
        'Sont réputés actes de commerce toutes les opérations d\'intermédiaire pour le commerce de biens mobiliers.',
      score: 88,
      date: '2024-01-01',
    },
    {
      id: 'eli:ccja:2022:arret:132',
      label: 'CCJA, arrêt n°132/2022',
      href: 'https://www.ohada.org/jurisprudence/ccja/arret-132-2022',
      type: 'Jurisprudence',
      snippet:
        "La clause limitative de responsabilité ne peut faire échec à l'obligation essentielle du débiteur sans stipulation expresse.",
      score: 84,
      date: '2022-10-04',
    },
  ],
  suggestions: [
    'Comparer les clauses limitatives de responsabilité OHADA vs droit français',
    'Identifier les décisions CCJA postérieures à 2022 sur les obligations essentielles',
    'Établir un argumentaire sur la compétence territoriale du tribunal',
  ],
};

export const researchAnswerChunks: string[] = [
  'Pour ce dossier, les obligations essentielles portent sur la fourniture continue des services numériques et la sécurisation des données clients.',
  "Les clauses limitatives invoquées par la partie adverse sont susceptibles d'être réputées non écrites si elles privent l'obligation de sa substance.",
  'La jurisprudence récente de la CCJA confirme cette analyse et ouvre un angle de négociation pour une transaction encadrée.',
];

export const researchToolSummaries: Record<string, { start: string; success: string }> = {
  'lookupCodeArticle': {
    start: "Analyse de l'article L110-1 et identification des obligations principales.",
    success: 'Article L110-1 enrichi avec les obligations essentielles et alignements OHADA.',
  },
  'web_search': {
    start: 'Recherche des arrêts CCJA récents sur les clauses limitatives de responsabilité.',
    success: 'Décision CCJA 132/2022 identifiée et ajoutée aux citations.',
  },
  'limitationCheck': {
    start: 'Calcul du délai de prescription applicable au contrat de services.',
    success: 'Prescription confirmée à deux ans, alerte sur interruption possible.',
  },
};

export const citationsData: CitationsBrowserData = {
  results: [
    {
      id: 'eli:fr:legifrance:code:commerce:20240101:art:L110-1',
      title: 'Code de commerce — Article L110-1',
      eli: 'eli:fr:legifrance:code:commerce:20240101:art:L110-1',
      jurisdiction: 'FR',
      type: 'statute',
      publicationDate: '2024-01-01',
      entryIntoForce: '2024-01-02',
      badges: ['Officiel', 'Consolidé'],
      summary:
        'Énumère les actes de commerce par nature et précise le champ d’application du droit commercial français.',
      toc: [
        { id: 'toc1', label: 'I. Actes de commerce', anchor: 'actes' },
        { id: 'toc2', label: 'II. Obligations', anchor: 'obligations' },
      ],
      versions: [
        {
          id: 'ver_2024_01',
          label: 'Version consolidée 01/2024',
          publishedAt: '2024-01-02',
          isConsolidated: true,
          diffSummary: 'Ajout d’une précision sur les prestations numériques.',
        },
        {
          id: 'ver_2023_07',
          label: 'Version 07/2023',
          publishedAt: '2023-07-01',
          isConsolidated: false,
          diffSummary: 'Ancienne rédaction avant réforme numérique.',
        },
      ],
      metadata: {
        'Type': 'Code consolidé',
        'Dernière mise à jour': '2024-05-10',
        'Référence': 'JORF n°001 du 2 janvier 2024',
        'Autorité': 'Légifrance',
      },
      content: [
        {
          anchor: 'actes',
          heading: 'Actes de commerce',
          text:
            'Sont commerçants ceux qui exercent des actes de commerce et en font leur profession habituelle. Les actes de commerce comprennent notamment...',
        },
        {
          anchor: 'obligations',
          heading: 'Obligations',
          text:
            'Les commerçants sont tenus de s’immatriculer au registre du commerce et des sociétés et doivent tenir une comptabilité régulière...',
        },
      ],
    },
    {
      id: 'eli:eu:regulation:gdpr',
      title: 'Règlement (UE) 2016/679 RGPD',
      eli: 'eli:eu:regulation:2016:679',
      jurisdiction: 'EU',
      type: 'regulation',
      publicationDate: '2016-05-04',
      entryIntoForce: '2018-05-25',
      badges: ['Officiel', 'Traduction'],
      summary:
        'Cadre général sur la protection des données, obligations des responsables et droits des personnes.',
      toc: [
        { id: 'toc1', label: 'Chapitre I — Dispositions générales', anchor: 'chap1' },
        { id: 'toc2', label: 'Chapitre II — Principes', anchor: 'chap2' },
      ],
      versions: [
        {
          id: 'ver_2018',
          label: 'Version en vigueur',
          publishedAt: '2018-05-25',
          isConsolidated: true,
          diffSummary: 'Version initiale, toujours applicable.',
        },
      ],
      metadata: {
        'Type': 'Règlement UE',
        'Autorité': 'Parlement européen & Conseil',
        'Langue': 'FR',
        'Champ': 'Protection des données',
      },
      content: [
        {
          anchor: 'chap1',
          heading: 'Dispositions générales',
          text: 'Le présent règlement protège les libertés et droits fondamentaux...',
        },
        {
          anchor: 'chap2',
          heading: 'Principes',
          text: 'Les données à caractère personnel doivent être traitées de manière licite, loyale et transparente...',
        },
      ],
    },
    {
      id: 'eli:rw:law:ict:2023',
      title: 'Rwanda ICT Law 2023',
      eli: 'eli:rw:law:ict:2023',
      jurisdiction: 'RW',
      type: 'statute',
      publicationDate: '2023-08-15',
      entryIntoForce: '2023-09-01',
      badges: ['Officiel'],
      summary: 'Régit les services numériques et la protection des données au Rwanda.',
      toc: [
        { id: 'toc1', label: 'Partie I — Principes', anchor: 'principes' },
        { id: 'toc2', label: 'Partie II — Obligations', anchor: 'obligations' },
      ],
      versions: [
        {
          id: 'ver_2023',
          label: 'Version initiale',
          publishedAt: '2023-09-01',
          isConsolidated: true,
          diffSummary: 'Version initiale en vigueur.',
        },
      ],
      metadata: {
        'Type': 'Loi nationale',
        'Autorité': 'Parlement du Rwanda',
        'Langue': 'FR',
        'Champ': 'Services numériques',
      },
      content: [
        {
          anchor: 'principes',
          heading: 'Principes',
          text: "Les fournisseurs de services numériques doivent garantir la confidentialité et l'intégrité des données...",
        },
        {
          anchor: 'obligations',
          heading: 'Obligations',
          text: 'Des obligations renforcées sont prévues pour les opérateurs transfrontaliers.',
        },
      ],
    },
  ],
  ohadaFeatured: [
    {
      id: 'eli:ohada:audcg:2023:art:10',
      title: 'Acte uniforme OHADA — Art. 10',
      eli: 'eli:ohada:audcg:2023:art:10',
      jurisdiction: 'OHADA',
      type: 'statute',
      publicationDate: '2023-04-01',
      entryIntoForce: '2023-07-01',
      badges: ['Officiel', 'Consolidé'],
      summary: 'Précise les obligations comptables et de transparence des commerçants OHADA.',
      toc: [
        { id: 'toc1', label: 'Obligations comptables', anchor: 'comptables' },
        { id: 'toc2', label: 'Sanctions', anchor: 'sanctions' },
      ],
      versions: [
        {
          id: 'ver_2024',
          label: 'Version consolidée 2024',
          publishedAt: '2024-02-01',
          isConsolidated: true,
          diffSummary: 'Clarification sur la conservation des pièces comptables numériques.',
        },
      ],
      metadata: {
        'Type': 'Acte uniforme',
        'Autorité': 'OHADA',
        'Champ': 'Comptabilité',
        'Langue': 'FR',
      },
      content: [
        {
          anchor: 'comptables',
          heading: 'Obligations comptables',
          text: 'Les commerçants tiennent un livre-journal et un livre d’inventaire...',
        },
        {
          anchor: 'sanctions',
          heading: 'Sanctions',
          text: 'Le défaut de tenue comptable expose à des sanctions civiles et pénales.',
        },
      ],
    },
  ],
};

export const mattersData: MattersOverview = {
  matters: [
    {
      id: 'matter_helios',
      name: 'Banque Helios c/ SARL Lumière',
      client: 'Banque Helios',
      opposing: 'SARL Lumière',
      governingLaw: 'Droit français + OHADA',
      riskLevel: 'medium',
      stage: 'Instruction',
      nextHearing: '2024-06-18T09:00:00Z',
      principalIssue:
        'Validité de la clause compromissoire et obligations de conformité bancaire.',
      documents: [
        {
          id: 'docs_plaidoyer',
          title: 'Assignation & conclusions adverses',
          kind: 'pleading',
          citeCheck: 'issues',
          updatedAt: '2024-05-20T14:20:00Z',
          author: 'Cabinet Durand',
          children: [
            {
              id: 'docs_plaidoyer_annexe',
              title: 'Annexe: pièces justificatives',
              kind: 'evidence',
              citeCheck: 'pending',
              updatedAt: '2024-05-21T08:50:00Z',
              author: 'Greffe Tribunal',
            },
          ],
        },
        {
          id: 'docs_conformite',
          title: 'Audit conformité LCB/FT',
          kind: 'analysis',
          citeCheck: 'clean',
          updatedAt: '2024-05-18T10:10:00Z',
          author: 'Avocat-AI',
        },
      ],
      deadlines: [
        {
          id: 'deadline_observations',
          label: 'Dépôt des observations CCJA',
          dueAt: '2024-06-05T17:00:00Z',
          status: 'urgent',
          jurisdiction: 'OHADA',
          note: 'Inclure traduction certifiée des pièces bancaires.',
        },
        {
          id: 'deadline_mediation',
          label: 'Réunion de médiation',
          dueAt: '2024-06-12T14:00:00Z',
          status: 'upcoming',
          jurisdiction: 'FR',
          note: 'Présence obligatoire du DPO.',
        },
      ],
      timeline: [
        {
          id: 'timeline_assignation',
          label: 'Assignation reçue',
          occurredAt: '2024-04-22T09:30:00Z',
          actor: 'Greffe Tribunal',
          summary: 'Assignation à comparaître devant le tribunal de commerce de Paris.',
        },
        {
          id: 'timeline_audience',
          label: 'Audience de procédure',
          occurredAt: '2024-05-15T10:00:00Z',
          actor: 'Juge de la mise en état',
          summary: 'Renvoi accordé pour production des pièces OHADA.',
        },
      ],
    },
    {
      id: 'matter_urssaf',
      name: 'URSSAF c/ Coop Atlas',
      client: 'Coop Atlas',
      opposing: 'URSSAF',
      governingLaw: 'Droit français + UE',
      riskLevel: 'high',
      stage: 'Audience',
      nextHearing: '2024-06-28T13:30:00Z',
      principalIssue: 'Opposabilité des contrats bilingues et recalcul des pénalités.',
      documents: [
        {
          id: 'docs_contrats',
          title: 'Contrats bilingues',
          kind: 'evidence',
          citeCheck: 'pending',
          updatedAt: '2024-05-22T11:00:00Z',
          author: 'Service juridique Coop Atlas',
        },
        {
          id: 'docs_penalites',
          title: 'Calcul des pénalités URSSAF',
          kind: 'analysis',
          citeCheck: 'issues',
          updatedAt: '2024-05-24T16:30:00Z',
          author: 'Avocat-AI',
        },
      ],
      deadlines: [
        {
          id: 'deadline_traduction',
          label: 'Traductions certifiées',
          dueAt: '2024-06-10T09:00:00Z',
          status: 'urgent',
          jurisdiction: 'FR',
          note: 'Recourir à un traducteur assermenté.',
        },
        {
          id: 'deadline_penalites',
          label: 'Recalcul des pénalités',
          dueAt: '2024-06-20T18:00:00Z',
          status: 'upcoming',
          jurisdiction: 'FR',
          note: 'Utiliser l’outil interestCalculator.',
        },
      ],
      timeline: [
        {
          id: 'timeline_controle',
          label: 'Contrôle URSSAF',
          occurredAt: '2024-03-10T08:15:00Z',
          actor: 'URSSAF',
          summary: 'Contrôle ciblé sur les prestataires étrangers.',
        },
        {
          id: 'timeline_conciliation',
          label: 'Tentative de conciliation',
          occurredAt: '2024-04-30T15:45:00Z',
          actor: 'URSSAF',
          summary: 'Refus d’étalement des pénalités.',
        },
      ],
    },
  ],
};

export const hitlQueueData: HitlQueueData = {
  queue: [
    {
      id: 'hitl_helios_1',
      submittedAt: '2024-05-25T10:40:00Z',
      matter: 'Banque Helios c/ SARL Lumière',
      agent: 'Concierge FR',
      locale: 'fr-FR',
      riskLevel: 'medium',
      requiresTranslationCheck: false,
      litigationType: 'commercial',
      summary:
        'L’agent recommande de plaider l’incompétence OHADA et de solliciter un renvoi pour production d’un audit conformité.',
      irac: {
        issue: 'Le tribunal français est-il compétent malgré la clause OHADA ?',
        rules: [
          'Code de procédure civile art. 76',
          'Acte uniforme OHADA art. 5',
          'Convention de New York art. II',
        ],
        application:
          'La clause compromissoire vise la CCJA mais la banque n’a pas signé l’avenant. L’OHADA s’applique par défaut mais la résidence principale est en France.',
        conclusion:
          'Risques élevés de contestation, privilégier une exception d’incompétence et négocier un renvoi.',
      },
      evidence: [
        {
          id: 'eli:ohada:audcg:art5',
          label: 'Acte uniforme OHADA art. 5',
          uri: 'eli:ohada:audcg:art5',
          type: 'statute',
        },
        {
          id: 'eli:fr:cpc:art76',
          label: 'CPC art. 76',
          uri: 'eli:fr:cpc:art76',
          type: 'statute',
        },
      ],
      deltas: [
        'Code de commerce art. L110-1 modifié le 02/05/2024',
        'Nouveau communiqué CCJA sur compétence concurrente publié le 18/05/2024',
      ],
    },
    {
      id: 'hitl_urssaf_1',
      submittedAt: '2024-05-24T08:15:00Z',
      matter: 'URSSAF c/ Coop Atlas',
      agent: 'Procedure EU',
      locale: 'fr-FR',
      riskLevel: 'high',
      requiresTranslationCheck: true,
      litigationType: 'labor',
      summary:
        'Vérifier la conformité des traductions des contrats et sécuriser le calcul des pénalités avec l’outil interestCalculator.',
      irac: {
        issue: 'Les contrats bilingues sont-ils opposables sans traduction certifiée ?',
        rules: [
          'Code du travail art. L1321-6',
          'Directive 91/533/CEE',
          'Cass. soc., 29 juin 2022',
        ],
        application:
          'Les contrats français/anglais fournis aux prestataires ne comportent pas toutes les clauses obligatoires. L’absence de traduction intégrale soulève une nullité potentielle.',
        conclusion:
          'Imposer une traduction certifiée avant l’audience et recalculer les pénalités URSSAF.',
      },
      evidence: [
        {
          id: 'eli:fr:ct:artL1321-6',
          label: 'Code du travail L1321-6',
          uri: 'eli:fr:ct:artL1321-6',
          type: 'statute',
        },
      ],
      deltas: [
        'Nouvelle circulaire URSSAF sur la sous-traitance (mai 2024)',
        'Traduction anglaise fournie non certifiée',
      ],
    },
  ],
};

export const corpusDashboardData: CorpusDashboardData = {
  allowlist: [
    {
      id: 'legifrance',
      name: 'Légifrance',
      jurisdiction: 'FR',
      enabled: true,
      lastIndexed: '2024-05-27T07:00:00Z',
      type: 'official',
    },
    {
      id: 'ccja',
      name: 'CCJA',
      jurisdiction: 'OHADA',
      enabled: true,
      lastIndexed: '2024-05-25T05:00:00Z',
      type: 'official',
    },
    {
      id: 'doctrine',
      name: 'Doctrine sociale',
      jurisdiction: 'FR',
      enabled: false,
      lastIndexed: '2024-04-30T09:30:00Z',
      type: 'secondary',
    },
  ],
  integrations: [
    {
      id: 'supabase_drive',
      name: 'Supabase Drive',
      provider: 'Supabase',
      status: 'connected',
      lastSync: '2024-05-27T06:30:00Z',
    },
    {
      id: 'sharepoint',
      name: 'SharePoint',
      provider: 'Microsoft',
      status: 'error',
      message: 'Consentement administrateur requis pour l’API Graph.',
    },
    {
      id: 's3_archive',
      name: 'Archive S3',
      provider: 'AWS',
      status: 'syncing',
      lastSync: '2024-05-27T05:45:00Z',
      message: 'Traitement des métadonnées Akoma Ntoso (42 %).',
    },
  ],
  snapshots: [
    {
      id: 'snapshot_mars',
      label: 'Snapshot mars 2024',
      createdAt: '2024-03-31T12:00:00Z',
      author: 'Avocat-AI',
      sizeMb: 1820,
    },
    {
      id: 'snapshot_fevrier',
      label: 'Snapshot février 2024',
      createdAt: '2024-02-29T12:00:00Z',
      author: 'Avocat-AI',
      sizeMb: 1764,
    },
  ],
  ingestionJobs: [
    {
      id: 'job_ohada_apr',
      filename: 'ohada_uniform_act_2024-04-18.pdf',
      status: 'processing',
      submittedAt: '2024-05-27T07:10:00Z',
      jurisdiction: 'OHADA',
      progress: 58,
      note: 'Extraction Akoma Ntoso en cours.',
    },
    {
      id: 'job_ccja_audio',
      filename: 'ccja_audience_2024-05-12.mp3',
      status: 'failed',
      submittedAt: '2024-05-26T19:45:00Z',
      jurisdiction: 'OHADA',
      progress: 20,
      note: 'Transcription vocale à relancer (erreur 500).',
    },
    {
      id: 'job_legifrance',
      filename: 'legifrance_codes_2024-05-20.zip',
      status: 'ready',
      submittedAt: '2024-05-21T08:00:00Z',
      jurisdiction: 'FR',
      progress: 100,
    },
  ],
};

export const policyConfiguration: PolicyConfiguration = {
  statute_first: true,
  ohada_preemption_priority: true,
  binding_language_guardrail: true,
  sensitive_topic_hitl: true,
  confidential_mode: false,
};

const voiceCitations = [
  {
    id: 'eli:ohada:procedure:2024:art:7',
    label: 'Acte uniforme OHADA Procédure, art. 7',
    href: 'https://www.ohada.org/eli/acte/procedure/2024/03/01/7',
    snippet:
      "En cas d'urgence, les juridictions peuvent ordonner toutes mesures nécessaires pour éviter un dommage imminent.",
  },
  {
    id: 'eli:fr:legifrance:code:justice:2024:art:R121-1',
    label: 'Code de justice administrative, art. R.121-1',
    href: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000043807985',
    snippet:
      "Le président peut fixer un calendrier accéléré et convoquer les parties en référé pour les mesures conservatoires.",
  },
  {
    id: 'eli:rw:law:ict:2023:art:18',
    label: 'Rwanda ICT Law, art. 18',
    href: 'https://www.rra.gov.rw/eli/ict/2023/18',
    snippet: 'Les fournisseurs doivent assurer une traçabilité immédiate des incidents de sécurité numérique.',
  },
] satisfies VoiceRunResponse['citations'];

const voiceQuickIntents = [
  {
    id: 'intent_deadline',
    name: 'Calculer un délai',
    tool: 'deadlineCalculator',
    status: 'scheduled' as const,
    detail: 'Calcule les échéances de signification CCJA / tribunal français.',
  },
  {
    id: 'intent_service',
    name: 'Planifier la signification',
    tool: 'service_of_process',
    status: 'scheduled' as const,
    detail: 'Prépare les modalités de signification transfrontalière OHADA.',
  },
  {
    id: 'intent_guardrail',
    name: 'Activer le mode confidentiel',
    tool: 'confidential_mode',
    status: 'requires_hitl' as const,
    detail: 'Nécessite validation HITL avant d’engager les outils web.',
  },
];

export const voiceConsoleContext: VoiceConsoleContext = {
  suggestions: [
    'Prépare une synthèse vocale pour la signification CCJA avant vendredi',
    'Quelles pièces devons-nous rassembler pour la requête en référé ?',
    'Calcule le délai d’appel OHADA si le jugement est rendu aujourd’hui',
  ],
  quickIntents: voiceQuickIntents,
  recentSessions: [
    {
      id: 'voice_session_helios',
      startedAt: '2024-06-03T08:40:00Z',
      durationMs: 54000,
      transcript:
        "Synthèse de la réunion Banque Helios : besoin d'une mesure conservatoire CCJA et de notifier le DPO.",
      summary:
        'Mesures conservatoires proposées avec rappel des obligations OHADA et articulation avec la loi française.',
      citations: [voiceCitations[0], voiceCitations[1]],
      intents: [
        { id: 'intent_deadline', name: 'Calculer un délai', tool: 'deadlineCalculator' },
        { id: 'intent_service', name: 'Planifier la signification', tool: 'service_of_process' },
      ],
    },
    {
      id: 'voice_session_rw',
      startedAt: '2024-06-02T16:05:00Z',
      durationMs: 48000,
      transcript:
        "Incident cybersécurité Rwanda : vérifier les obligations de notification et préparer un plan de réponse.",
      summary:
        'Plan d’alerte immédiat avec rappel des obligations ICT Law Rwanda et proposition d’activation du mode confidentiel.',
      citations: [voiceCitations[2]],
      intents: [
        { id: 'intent_guardrail', name: 'Activer le mode confidentiel', tool: 'confidential_mode' },
      ],
    },
  ],
  guardrails: [
    'france_judge_analytics_block actif — aucune analyse prédictive sur les magistrats.',
    'Confidential_mode coupe la recherche web durant les sessions vocales.',
  ],
};

export function buildVoiceRunResponse(transcript: string): VoiceRunResponse {
  const lower = transcript.toLowerCase();
  const urgency = lower.includes('urgence') || lower.includes('référé');
  const compliance = lower.includes('dpo') || lower.includes('données');

  const selectedCitations = voiceCitations.filter((citation) => {
    if (urgency && citation.id.includes('procedure')) {
      return true;
    }
    if (compliance && citation.id.includes('ict')) {
      return true;
    }
    return citation.id.includes('ohada');
  });

  const intents = voiceQuickIntents.map((intent) => {
    if (intent.id === 'intent_deadline' && urgency) {
      return { ...intent, status: 'running' as const, detail: 'Calcul express des délais de référé demandé.' };
    }
    if (intent.id === 'intent_guardrail' && compliance) {
      return {
        ...intent,
        status: 'completed' as const,
        detail: 'Mode confidentiel activé pour bloquer la recherche web.',
      };
    }
    return intent;
  });

  const followUps = [
    'Souhaitez-vous lancer la rédaction d’un mémo de banc sur ces mesures ?',
    'Dois-je planifier une revue HITL pour valider les actions sensibles ?',
  ];

  const clarifications = [] as string[];
  if (!urgency) {
    clarifications.push('Confirmez si une procédure d’urgence est requise avant d’engager les mesures.');
  }
  if (!compliance) {
    clarifications.push('Faut-il notifier le DPO et activer le mode confidentiel ?');
  }

  return {
    id: `voice_run_${Date.now()}`,
    summary:
      urgency
        ? 'Plan vocal : mesures de référé et notifications CCJA préparées.'
        : 'Plan vocal : vérifications OHADA et sécurisation des notifications en cours.',
    followUps,
    citations: selectedCitations.length ? selectedCitations : voiceCitations.slice(0, 2),
    intents,
    readback: (selectedCitations.length ? selectedCitations : voiceCitations.slice(0, 2)).map(
      (citation) => `${citation.label} — ${citation.snippet}`,
    ),
    riskLevel: urgency ? 'HIGH' : compliance ? 'MED' : 'LOW',
    clarifications,
  };
}

export const uploadAllowlist: AllowlistSource[] = corpusDashboardData.allowlist;

export const ohadaHighlights: CitationDocument[] = citationsData.ohadaFeatured;
