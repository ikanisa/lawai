export type ProceduralStepStatus = "terminé" | "en_cours" | "à_venir";

export interface ProceduralStep {
  id: string;
  title: string;
  description: string;
  jurisdiction: string;
  status: ProceduralStepStatus;
  dueDate: string;
  tools: string[];
  documents: { id: string; label: string }[];
  checklist: string[];
}

export interface DeadlineComputation {
  id: string;
  label: string;
  baseDate: string;
  computedDate: string;
  daysUntilDue: number;
  rule: string;
  tool: "deadlineCalculator" | "calendar_emit";
}

export interface ServiceOfProcessOption {
  id: string;
  method: string;
  deadlineHours: number;
  costEstimate: number;
  currency: string;
  jurisdiction: string;
  requirements: string[];
}

export interface CourtFeeEstimate {
  id: string;
  label: string;
  amount: number;
  currency: string;
  payableTo: string;
  reference: string;
}

export interface ProceduralCalendarEntry {
  id: string;
  summary: string;
  description: string;
  start: string;
  end: string;
  location: string;
}

export interface ProceduralNavigatorData {
  matterId: string;
  matterTitle: string;
  jurisdiction: string;
  confidentialModeDefault: boolean;
  steps: ProceduralStep[];
  deadlines: DeadlineComputation[];
  serviceOptions: ServiceOfProcessOption[];
  courtFees: CourtFeeEstimate[];
  calendarEntries: ProceduralCalendarEntry[];
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchProceduralNavigatorData(): Promise<ProceduralNavigatorData> {
  await delay(420);

  const now = Date.now();
  const iso = (offsetHours: number) => new Date(now + offsetHours * 60 * 60 * 1000).toISOString();

  return {
    matterId: "matter-f2487",
    matterTitle: "SARL Lumière c/ URSSAF",
    jurisdiction: "FR",
    confidentialModeDefault: false,
    steps: [
      {
        id: "filing",
        title: "Dépôt de l’assignation",
        description:
          "Vérifier les pièces jointes, signer électroniquement et déposer via le portail e-Barreau / Télérecours",
        jurisdiction: "FR",
        status: "terminé",
        dueDate: iso(-72),
        tools: ["document_parser", "snapshotAuthority"],
        documents: [
          { id: "doc-assignation", label: "Assignation signée" },
          { id: "doc-preuves", label: "Annexes pièces A1-A6" }
        ],
        checklist: [
          "Contrôler la signature C2PA",
          "Attester l’horodatage avant dépôt",
          "Générer la preuve de dépôt via Télérecours"
        ]
      },
      {
        id: "service",
        title: "Signification / signification internationale",
        description:
          "Choisir l’huissier, planifier la signification physique et électronique, notifier le greffe.",
        jurisdiction: "FR",
        status: "en_cours",
        dueDate: iso(24),
        tools: ["service_of_process", "routeJurisdiction"],
        documents: [
          { id: "lettre-mission", label: "Lettre de mission huissier" },
          { id: "bordereau", label: "Bordereau de pièces" }
        ],
        checklist: [
          "Vérifier les adresses des défendeurs",
          "Programmer la signification via RPVA",
          "Notifier le greffe avec l’AR huissier"
        ]
      },
      {
        id: "hearing",
        title: "Audience de mise en état",
        description:
          "Confirmer la date d’audience, préparer le dossier de plaidoirie et notifier les conclusions.",
        jurisdiction: "FR",
        status: "à_venir",
        dueDate: iso(24 * 5),
        tools: ["deadlineCalculator", "buildTreatmentGraph"],
        documents: [
          { id: "agenda", label: "Calendrier de procédure" },
          { id: "conclusions", label: "Conclusions actualisées" }
        ],
        checklist: [
          "Vérifier la disponibilité du conseil",
          "Envoyer les conclusions via RPVA",
          "Confirmer la présence du témoin clé"
        ]
      },
      {
        id: "judgment",
        title: "Délibéré et jugement",
        description:
          "Suivre la publication du jugement, préparer l’analyse de risques et plan de communication.",
        jurisdiction: "FR",
        status: "à_venir",
        dueDate: iso(24 * 14),
        tools: ["computeCaseScore", "snapshotAuthority"],
        documents: [
          { id: "grille-risques", label: "Grille de risques" },
          { id: "comm-plan", label: "Plan de communication" }
        ],
        checklist: [
          "Mettre en veille l’équipe communication",
          "Anticiper les voies de recours",
          "Valider la stratégie de publication"
        ]
      },
      {
        id: "enforcement",
        title: "Exécution et suivi",
        description:
          "Coordonner avec l’huissier, calculer les intérêts et surveiller le recouvrement.",
        jurisdiction: "FR",
        status: "à_venir",
        dueDate: iso(24 * 30),
        tools: ["interestCalculator", "court_fees"],
        documents: [
          { id: "titre-exec", label: "Titre exécutoire" },
          { id: "plan-recouvrement", label: "Plan de recouvrement" }
        ],
        checklist: [
          "Notifier la direction financière",
          "Programmer la relance des paiements",
          "Vérifier les biens saisissables"
        ]
      }
    ],
    deadlines: [
      {
        id: "deadline-conclusions",
        label: "Conclusions défendeur",
        baseDate: iso(-24 * 2),
        computedDate: iso(24 * 4),
        daysUntilDue: 4,
        rule: "Article 763 CPC — délai de 15 jours avant audience",
        tool: "deadlineCalculator"
      },
      {
        id: "deadline-communication",
        label: "Communication pièces",
        baseDate: iso(0),
        computedDate: iso(24 * 2),
        daysUntilDue: 2,
        rule: "Protocole tribunal de commerce Paris — J-10",
        tool: "calendar_emit"
      }
    ],
    serviceOptions: [
      {
        id: "service-huissier-paris",
        method: "Huissier RPVA Île-de-France",
        deadlineHours: 36,
        costEstimate: 420,
        currency: "EUR",
        jurisdiction: "FR",
        requirements: [
          "Mandat signé électroniquement",
          "Remise physique sous 24h",
          "Rapport de signification téléversé"
        ]
      },
      {
        id: "service-international",
        method: "Signification internationale (Belgique)",
        deadlineHours: 96,
        costEstimate: 760,
        currency: "EUR",
        jurisdiction: "BE",
        requirements: [
          "Traduction certifiée FR→NL",
          "Formulaire EU Service Regulation",
          "Suivi CCBE"
        ]
      }
    ],
    courtFees: [
      {
        id: "fee-greffe",
        label: "Droit de greffe (commerce)",
        amount: 125,
        currency: "EUR",
        payableTo: "Greffe Tribunal de commerce Paris",
        reference: "Arrêté du 16/12/2023"
      },
      {
        id: "fee-execution",
        label: "Provision huissier",
        amount: 180,
        currency: "EUR",
        payableTo: "Étude Dupuis & Associés",
        reference: "Barème CNHJ 2024"
      }
    ],
    calendarEntries: [
      {
        id: "cal-audience",
        summary: "Audience de mise en état",
        description: "Audience SARL Lumière c/ URSSAF — plaidoirie intermédiaire",
        start: iso(24 * 5),
        end: iso(24 * 5 + 2),
        location: "Tribunal de commerce de Paris"
      },
      {
        id: "cal-mediation",
        summary: "Médiation préalable pénalités",
        description: "Session de médiation obligatoire avant exécution des pénalités",
        start: iso(24 * 8),
        end: iso(24 * 8 + 2),
        location: "En ligne / Teams"
      }
    ]
  };
}
