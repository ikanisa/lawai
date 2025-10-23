import {
  ResearchDeskContextSchema,
  type ResearchDeskContext,
  type ResearchPlan,
  type ResearchCitation,
  type ResearchStreamEvent,
  type WebSearchMode
} from '@avocat-ai/shared';

const researchPlan: ResearchPlan = {
  id: 'plan-ohada-default',
  title: 'Analyse IRAC — Inexécution contractuelle (OHADA)',
  jurisdiction: 'OHADA',
  riskLevel: 'MED',
  riskSummary:
    "Risque moyen : nécessité d'assurer la preuve de l'obligation et de l'inexécution; vigilance accrue sur la compétence du juge OHADA.",
  steps: [
    {
      id: 'step-qualification',
      title: "Qualifier la nature de l'obligation et le fondement OHADA",
      tool: 'lookupCodeArticle',
      status: 'active',
      summary: "Identifier les articles applicables de l’AUSCGIE et des actes uniformes pertinents."
    },
    {
      id: 'step-precedents',
      title: 'Comparer avec la jurisprudence régionale',
      tool: 'file_search',
      status: 'pending',
      summary: 'Vérifier les décisions CCJA et cours d’appel alignées sur des faits similaires.'
    },
    {
      id: 'step-remedies',
      title: 'Évaluer les voies de recours et délais',
      tool: 'deadlineCalculator',
      status: 'pending',
      summary: 'Calculer les délais procéduraux et mettre en avant les options HITL.'
    }
  ]
};

const researchCitations: ResearchCitation[] = [
  {
    id: 'citation-ausgie-1132',
    label: 'AUSCGIE art. 1132 — Inexécution contractuelle',
    href: 'https://www.ohada.org/actes-uniformes/ausgie#article1132',
    type: 'Officiel',
    snippet: "L'Acte uniforme impose l'exécution de bonne foi des obligations contractuelles et prévoit la mise en demeure préalable.",
    score: 89,
    date: '2023-03-01'
  },
  {
    id: 'citation-ccja-2022-04',
    label: 'CCJA, 3e ch., 12 mai 2022, n° 046/2022',
    href: 'https://juris.ohada.org/ccja/2022/046',
    type: 'Jurisprudence',
    snippet: "La CCJA rappelle que la partie créancière doit démontrer la mise en demeure et le préjudice né de l'inexécution.",
    score: 77,
    date: '2022-05-12'
  },
  {
    id: 'citation-jo-ohada-2023-08',
    label: 'Journal Officiel OHADA — Avis 2023/08',
    href: 'https://www.ohada.org/jo/2023/08',
    type: 'Consolidé',
    snippet: "Mise à jour des sanctions contractuelles et articulation avec les procédures d'urgence.",
    score: 71,
    date: '2023-08-18'
  }
];

const researchFilters = {
  publicationDates: [
    { id: 'last-12-months', label: '12 derniers mois' },
    { id: 'last-5-years', label: '5 dernières années' },
    { id: 'all', label: 'Historique complet' }
  ],
  entryIntoForce: [
    { id: 'current', label: 'Texte en vigueur' },
    { id: 'future', label: 'Entrée en vigueur différée' }
  ]
} as const;

const researchSuggestions = [
  'Analyse l’exécution forcée sur les sûretés OHADA',
  'Comparer avec le droit français applicable à la clause résolutoire',
  'Identifier les voies de recours en cas de résistance de l’huissier'
];

export const researchDeskContext: ResearchDeskContext = ResearchDeskContextSchema.parse({
  plan: researchPlan,
  filters: researchFilters,
  defaultCitations: researchCitations,
  suggestions: researchSuggestions
});

export function createResearchStream(
  input: string,
  toolsEnabled: readonly string[],
  webSearchMode: WebSearchMode = 'allowlist'
): ResearchStreamEvent[] {
  const stream: ResearchStreamEvent[] = [];
  const lowerInput = input.toLowerCase();

  stream.push({
    type: 'tool',
    data: {
      tool: {
        id: 'tool-lookup-ohada',
        name: 'lookupCodeArticle',
        status: 'running',
        detail: "Consultation de l'AUSCGIE pour qualifier l'obligation.",
        planStepId: 'step-qualification'
      }
    }
  });

  stream.push({
    type: 'citation',
    data: { citation: researchCitations[0] }
  });

  stream.push({
    type: 'tool',
    data: {
      tool: {
        id: 'tool-lookup-ohada',
        name: 'lookupCodeArticle',
        status: 'success',
        detail: "Article 1132 confirmé : inexécution sanctionnée par mise en demeure écrite.",
        planStepId: 'step-qualification'
      }
    }
  });

  if (toolsEnabled.includes('file_search')) {
    stream.push({
      type: 'tool',
      data: {
        tool: {
          id: 'tool-file-search',
          name: 'file_search',
          status: 'running',
          detail: 'Interrogation du corpus OHADA-Supabase pour jurisprudence CCJA.',
          planStepId: 'step-precedents'
        }
      }
    });
    stream.push({
      type: 'citation',
      data: { citation: researchCitations[1] }
    });
    stream.push({
      type: 'tool',
      data: {
        tool: {
          id: 'tool-file-search',
          name: 'file_search',
          status: 'success',
          detail: 'Jurisprudence CCJA pertinente ajoutée au dossier.',
          planStepId: 'step-precedents'
        }
      }
    });
  }

  if (toolsEnabled.includes('web_search')) {
    const webSearchStartDetail =
      webSearchMode === 'broad'
        ? 'Recherche étendue incluant les sources publiques surveillées.'
        : 'Requête ciblée sur le JO OHADA et les bulletins officiels.';
    const webSearchSuccessDetail =
      webSearchMode === 'broad'
        ? 'Sources publiques élargies synthétisées et ajoutées aux preuves.'
        : 'Sources publiques vérifiées et ajoutées aux preuves.';
    stream.push({
      type: 'tool',
      data: {
        tool: {
          id: 'tool-web-search',
          name: 'web_search',
          status: 'running',
          detail: webSearchStartDetail,
          planStepId: 'step-precedents'
        }
      }
    });
    stream.push({
      type: 'citation',
      data: { citation: researchCitations[2] }
    });
    stream.push({
      type: 'tool',
      data: {
        tool: {
          id: 'tool-web-search',
          name: 'web_search',
          status: 'success',
          detail: webSearchSuccessDetail,
          planStepId: 'step-precedents'
        }
      }
    });
  }

  const summaryIntro =
    "Analyse factuelle : les éléments reçus évoquent une inexécution contractuelle. L'objectif est de documenter la faute et les remèdes disponibles.";
  const obligationFocus = lowerInput.includes('résiliation')
    ? "Le texte mentionne explicitement une résiliation : proposer une résiliation judiciaire et calculer les délais de signification."
    : "Insister sur la mise en demeure préalable et la preuve des obligations contractuelles.";
  const riskSummary =
    "Sensibilisation : la compétence peut basculer vers un juge national, prévoir une revue HITL pour sécuriser la stratégie.";

  stream.push({
    type: 'token',
    data: {
      token: `${summaryIntro}\n\n`
    }
  });

  stream.push({
    type: 'token',
    data: {
      token: `Qualification : ${obligationFocus}`
    }
  });

  stream.push({
    type: 'token',
    data: {
      token:
        "Remèdes : engager la procédure de mise en demeure, prévoir les mesures conservatoires et préparer un dossier HITL pour validation finale."
    }
  });

  stream.push({
    type: 'risk',
    data: {
      risk: {
        level: 'MED',
        summary: riskSummary
      }
    }
  });

  stream.push({
    type: 'tool',
    data: {
      tool: {
        id: 'tool-deadline',
        name: 'deadlineCalculator',
        status: 'success',
        detail: 'Délais de signification estimés à 15 jours selon le ressort OHADA.',
        planStepId: 'step-remedies'
      }
    }
  });

  return stream;
}

export function cloneResearchContext(): ResearchDeskContext {
  return JSON.parse(JSON.stringify(researchDeskContext)) as ResearchDeskContext;
}

export function getResearchPlan(): ResearchPlan {
  return JSON.parse(JSON.stringify(researchPlan)) as ResearchPlan;
}

export function getResearchCitations(): ResearchCitation[] {
  return JSON.parse(JSON.stringify(researchCitations)) as ResearchCitation[];
}

export function getResearchFilters() {
  return JSON.parse(JSON.stringify(researchFilters));
}
