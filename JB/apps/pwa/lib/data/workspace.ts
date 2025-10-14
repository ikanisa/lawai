export interface WorkspaceMatter {
  id: string;
  title: string;
  parties: string;
  stage: string;
  updatedAt: string;
  risk: "BAS" | "MOYEN" | "ÉLEVÉ";
}

export interface ComplianceItem {
  id: string;
  jurisdiction: string;
  effectiveDate: string;
  summary: string;
  reference: string;
}

export interface HitlItem {
  id: string;
  title: string;
  dueAt: string;
  risk: "faible" | "moyen" | "élevé";
  reason: string;
}

export interface WorkspaceShortcut {
  id: string;
  label: string;
  description: string;
  href: string;
  agentId: string;
  prefill?: string;
}

export interface WorkspaceOverview {
  recentMatters: WorkspaceMatter[];
  complianceWatch: ComplianceItem[];
  hitlInbox: HitlItem[];
  shortcuts: WorkspaceShortcut[];
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWorkspaceOverview(): Promise<WorkspaceOverview> {
  await delay(420);

  const today = new Date();

  const formatIso = (date: Date) => date.toISOString();

  return {
    recentMatters: [
      {
        id: "matter-f2487",
        title: "SARL Lumière c/ URSSAF",
        parties: "SARL Lumière · URSSAF Île-de-France",
        stage: "Assignation déposée",
        updatedAt: formatIso(new Date(today.getTime() - 1000 * 60 * 60 * 6)),
        risk: "MOYEN"
      },
      {
        id: "matter-c9912",
        title: "Banque Helios c/ Dupont",
        parties: "Banque Helios · Claire Dupont",
        stage: "Audience de mise en état",
        updatedAt: formatIso(new Date(today.getTime() - 1000 * 60 * 60 * 24)),
        risk: "ÉLEVÉ"
      },
      {
        id: "matter-ohada-104",
        title: "SCOA RDC c/ N'Dala Logistique",
        parties: "SCOA RDC · N'Dala Logistique",
        stage: "Tentative conciliation",
        updatedAt: formatIso(new Date(today.getTime() - 1000 * 60 * 60 * 48)),
        risk: "BAS"
      }
    ],
    complianceWatch: [
      {
        id: "compliance-ohada-acte1",
        jurisdiction: "OHADA",
        effectiveDate: formatIso(new Date(today.getTime() + 1000 * 60 * 60 * 24 * 14)),
        summary:
          "Révision de l’Acte uniforme sur les sûretés : clarification sur les nantissements de créances professionnelles.",
        reference: "CCJA/2024/UA-S-112"
      },
      {
        id: "compliance-fr-cass",
        jurisdiction: "FR",
        effectiveDate: formatIso(new Date(today.getTime() - 1000 * 60 * 60 * 72)),
        summary: "Cour de cassation : obligation d’information renforcée pour les prêteurs sur les taux variables.",
        reference: "ECLI:FR:CCASS:2024:C100512"
      }
    ],
    hitlInbox: [
      {
        id: "hitl-risk-9821",
        title: "Revue risque — assignation Banque Helios",
        dueAt: formatIso(new Date(today.getTime() + 1000 * 60 * 60 * 8)),
        risk: "élevé",
        reason: "Analyse d’exposition médiatique et conformité RGPD requises."
      },
      {
        id: "hitl-translation-334",
        title: "Vérification traduction CCJA",
        dueAt: formatIso(new Date(today.getTime() + 1000 * 60 * 60 * 24)),
        risk: "moyen",
        reason: "Article 45 nécessite validation en langue de procédure."
      }
    ],
    shortcuts: [
      {
        id: "shortcut-research",
        label: "Nouvelle recherche",
        description: "Interroger l’agent recherche avec contexte juridictionnel.",
        href: "/research?new=1",
        agentId: "research",
        prefill: "Comparer les délais de prescription OHADA et droit français"
      },
      {
        id: "shortcut-drafting",
        label: "Nouvelle rédaction",
        description: "Générer un projet d’acte ou de contrat.",
        href: "/drafting?new=1",
        agentId: "drafting",
        prefill: "Préparer un protocole transactionnel pour SARL Lumière"
      },
      {
        id: "shortcut-upload",
        label: "Téléverser une preuve",
        description: "Ajouter une pièce et déclencher l’OCR + indexation.",
        href: "/workspace/upload",
        agentId: "evidence"
      },
      {
        id: "shortcut-voice",
        label: "Session vocale",
        description: "Démarrer l’assistant temps réel avec lecture citations.",
        href: "/voice",
        agentId: "voice"
      }
    ]
  };
}
