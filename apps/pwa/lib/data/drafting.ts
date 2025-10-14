export interface DraftTemplate {
  id: string;
  title: string;
  type: "assignation" | "protocole" | "contrat" | "pv";
  summary: string;
  jurisdictions: string[];
  tags: string[];
  updatedAt: string;
  complexity: "standard" | "complexe" | "urgent";
  languages: ("fr" | "en" | "rw")[];
}

export interface DraftCitation {
  id: string;
  label: string;
}

export interface DraftClauseDiff {
  id: string;
  heading: string;
  baseText: string;
  agentProposal: string;
  rationale: string;
  citations: DraftCitation[];
  risk: "faible" | "moyen" | "élevé";
}

export interface ClauseBenchmark {
  id: string;
  clause: string;
  marketStandard: string;
  agentProposal: string;
  authority: string;
  delta: "aligné" | "avantage_client" | "risque";
  updatedAt: string;
}

export interface DraftingExportOption {
  format: "pdf" | "docx";
  label: string;
  c2paSigned: boolean;
}

export interface DraftMatterSummary {
  id: string;
  title: string;
  jurisdiction: string;
}

export interface DraftingStudioData {
  templates: DraftTemplate[];
  recommendedTemplateId: string;
  activeDraft: {
    matter: DraftMatterSummary;
    title: string;
    lastSyncedAt: string;
    clauses: DraftClauseDiff[];
    comment: string;
  };
  clauseBenchmarks: ClauseBenchmark[];
  exportOptions: DraftingExportOption[];
  attachableMatters: DraftMatterSummary[];
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchDraftingStudioData(): Promise<DraftingStudioData> {
  await delay(360);

  const now = new Date();
  const iso = (date: Date) => date.toISOString();

  return {
    templates: [
      {
        id: "tpl-assignation-standard",
        title: "Assignation en référé (commerce)",
        type: "assignation",
        summary:
          "Trame structurée avec sections IRAC, annexes pièces, mentions d’urgence et calculs d’astreinte.",
        jurisdictions: ["FR", "OHADA"],
        tags: ["urgence", "audience", "commerce"],
        updatedAt: iso(new Date(now.getTime() - 1000 * 60 * 60 * 12)),
        complexity: "urgent",
        languages: ["fr"]
      },
      {
        id: "tpl-protocole-transaction",
        title: "Protocole transactionnel transfrontalier",
        type: "protocole",
        summary:
          "Inclut clauses de confidentialité renforcée et arbitrage OHADA, compatible droit belge.",
        jurisdictions: ["FR", "BE", "OHADA"],
        tags: ["arbitrage", "compliance"],
        updatedAt: iso(new Date(now.getTime() - 1000 * 60 * 60 * 24 * 2)),
        complexity: "complexe",
        languages: ["fr", "en"]
      },
      {
        id: "tpl-contrat-prestation",
        title: "Contrat de prestation de services cloud",
        type: "contrat",
        summary: "SLA, clauses RGPD, résilience, support multilingue (FR/RW).",
        jurisdictions: ["FR", "RW", "EU"],
        tags: ["rgpd", "cloud", "sla"],
        updatedAt: iso(new Date(now.getTime() - 1000 * 60 * 60 * 5)),
        complexity: "complexe",
        languages: ["fr", "rw", "en"]
      },
      {
        id: "tpl-pv-assemblee",
        title: "Procès-verbal d’assemblée OHADA",
        type: "pv",
        summary: "Formalités CCJA, registre des décisions et feuille de présence intégrée.",
        jurisdictions: ["OHADA"],
        tags: ["corporate", "ccja"],
        updatedAt: iso(new Date(now.getTime() - 1000 * 60 * 60 * 48)),
        complexity: "standard",
        languages: ["fr"]
      }
    ],
    recommendedTemplateId: "tpl-protocole-transaction",
    activeDraft: {
      matter: {
        id: "matter-f2487",
        title: "SARL Lumière c/ URSSAF",
        jurisdiction: "FR"
      },
      title: "Projet de protocole transactionnel",
      lastSyncedAt: iso(new Date(now.getTime() - 1000 * 60 * 7)),
      comment: "Dernier sync avec l’agent le 09/06 à 10:42 — statut : en revue HITL.",
      clauses: [
        {
          id: "clause-confidentialite",
          heading: "Confidentialité",
          baseText:
            "Chaque partie s’engage à ne pas divulguer les informations confidentielles sauf obligation légale ou accord écrit de l’autre partie.",
          agentProposal:
            "Chaque partie s’engage à ne pas divulguer les informations confidentielles sauf obligation légale impérative, décision judiciaire exécutoire ou accord écrit préalable de l’autre partie. L’agent ajoute un mécanisme de notification en cas d’obligation légale.",
          rationale:
            "Ajout d’une obligation de notification et d’une liste fermée des exceptions, conformément à la jurisprudence Cass. com., 3 mai 2024.",
          citations: [
            { id: "ECLI:FR:CCASS:2024:C100512", label: "Cass. com., 3 mai 2024" },
            { id: "eli:ohada:acte:securite:art:14", label: "AU Sûretés art. 14" }
          ],
          risk: "faible"
        },
        {
          id: "clause-penalite",
          heading: "Pénalités",
          baseText:
            "Tout manquement donne lieu à une pénalité forfaitaire de 50 000 € par infraction constatée, sans préjudice des dommages-intérêts.",
          agentProposal:
            "Toute violation substantielle entraîne une pénalité progressive calculée selon la gravité (palier 15 000 € / 35 000 € / 60 000 €) et plafonnée à 12 % de la valeur du contrat, avec possibilité de médiation obligatoire avant exécution.",
          rationale:
            "Rééquilibrage recommandé par l’Autorité de la concurrence (avis 2023-A14) et conformité aux critères de proportionnalité OHADA.",
          citations: [
            { id: "avis:AutoriteConcurrence:2023-A14", label: "Autorité concurrence 2023-A14" },
            { id: "eli:ohada:acte:contrats:art:112", label: "Acte uniforme OHADA art. 112" }
          ],
          risk: "moyen"
        },
        {
          id: "clause-redressement",
          heading: "Redressement fiscal",
          baseText:
            "Les parties coopèrent de bonne foi en cas de contrôle fiscal et partagent les coûts résultant d’un redressement.",
          agentProposal:
            "En cas de contrôle fiscal, les parties coopèrent activement et notifient toute communication dans un délai de 48h. Les coûts sont supportés par la partie fautive sauf si l’administration identifie une faute partagée.",
          rationale:
            "Clarifie l’allocation des risques conformément à la doctrine fiscale BOFiP et réduit l’exposition de SARL Lumière.",
          citations: [
            { id: "BOI-CTX-10-20-20-20240214", label: "BOFiP CTX-10-20-20" }
          ],
          risk: "faible"
        }
      ]
    },
    clauseBenchmarks: [
      {
        id: "bm-confidentialite",
        clause: "Confidentialité",
        marketStandard: "Notification sous 5 jours ouvrés, exceptions larges",
        agentProposal: "Notification sous 48h, exceptions limitatives",
        authority: "Cass. com., 3 mai 2024",
        delta: "avantage_client",
        updatedAt: iso(new Date(now.getTime() - 1000 * 60 * 60 * 24))
      },
      {
        id: "bm-penalite",
        clause: "Pénalités",
        marketStandard: "Pénalité fixe 10 % valeur contrat",
        agentProposal: "Palier progressif + médiation préalable",
        authority: "Autorité concurrence 2023-A14",
        delta: "aligné",
        updatedAt: iso(new Date(now.getTime() - 1000 * 60 * 60 * 6))
      },
      {
        id: "bm-redressement",
        clause: "Redressement fiscal",
        marketStandard: "Partage égal des coûts",
        agentProposal: "Responsabilité proportionnelle à la faute",
        authority: "BOFiP CTX-10-20-20",
        delta: "avantage_client",
        updatedAt: iso(new Date(now.getTime() - 1000 * 60 * 45))
      }
    ],
    exportOptions: [
      { format: "pdf", label: "Exporter en PDF (signé C2PA)", c2paSigned: true },
      { format: "docx", label: "Exporter en DOCX", c2paSigned: false }
    ],
    attachableMatters: [
      { id: "matter-f2487", title: "SARL Lumière c/ URSSAF", jurisdiction: "FR" },
      { id: "matter-c9912", title: "Banque Helios c/ Dupont", jurisdiction: "FR" },
      { id: "matter-ohada-104", title: "SCOA RDC c/ N'Dala Logistique", jurisdiction: "OHADA" }
    ]
  };
}
