export interface AdminPerson {
  id: string;
  name: string;
  role: "Avocat" | "Paralegal" | "Responsable conformité" | "Administrateur";
  jurisdictionFocus: string[];
  status: "active" | "invited" | "suspended";
}

export interface PolicyToggle {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

export interface JurisdictionEntitlement {
  id: string;
  jurisdiction: string;
  seats: number;
  usage: number;
}

export interface AuditLogEntry {
  id: string;
  actor: string;
  action: string;
  occurredAt: string;
  detail: string;
}

export interface BillingSummary {
  currentPlan: string;
  seatsUsed: number;
  seatsIncluded: number;
  nextInvoiceAt: string;
  estimatedAmount: number;
}

export interface AdminConsoleData {
  people: AdminPerson[];
  policies: PolicyToggle[];
  jurisdictions: JurisdictionEntitlement[];
  auditLogs: AuditLogEntry[];
  billing: BillingSummary;
}

const adminMock: AdminConsoleData = {
  people: [
    {
      id: "user_1",
      name: "Me Clara Dupont",
      role: "Avocat",
      jurisdictionFocus: ["FR", "OHADA"],
      status: "active"
    },
    {
      id: "user_2",
      name: "Jean Mugenzi",
      role: "Responsable conformité",
      jurisdictionFocus: ["RW"],
      status: "active"
    },
    {
      id: "user_3",
      name: "Sarah Ben Amar",
      role: "Paralegal",
      jurisdictionFocus: ["FR", "EU"],
      status: "invited"
    }
  ],
  policies: [
    {
      id: "confidential_mode",
      label: "Mode confidentiel (désactive la recherche web)",
      description: "Empêche toute requête externe lorsque des données sensibles sont signalées.",
      enabled: true
    },
    {
      id: "france_judge_analytics_block",
      label: "Blocage analytics juges FR",
      description: "Interdit le scoring des juges français conformément aux recommandations CNB.",
      enabled: true
    },
    {
      id: "sensitive_topic_hitl",
      label: "Escalade HITL sujets sensibles",
      description: "Oblige une revue humaine pour les sujets sensibles (pénal, presse, personnes publiques).",
      enabled: false
    }
  ],
  jurisdictions: [
    { id: "jur_fr", jurisdiction: "France", seats: 30, usage: 24 },
    { id: "jur_ohada", jurisdiction: "OHADA", seats: 15, usage: 9 },
    { id: "jur_rw", jurisdiction: "Rwanda", seats: 10, usage: 6 }
  ],
  auditLogs: [
    {
      id: "audit_1",
      actor: "Me Clara Dupont",
      action: "Activation mode confidentiel",
      occurredAt: "2024-05-26T15:42:00Z",
      detail: "Mode confidentiel activé suite à l’ingestion d’une pièce médicale."
    },
    {
      id: "audit_2",
      actor: "Sarah Ben Amar",
      action: "Ajout utilisateur",
      occurredAt: "2024-05-25T09:12:00Z",
      detail: "Invitation envoyée à Idriss Kouassi (juridiction OHADA)."
    }
  ],
  billing: {
    currentPlan: "Suite Justice Autonome — Enterprise",
    seatsUsed: 42,
    seatsIncluded: 50,
    nextInvoiceAt: "2024-06-30T00:00:00Z",
    estimatedAmount: 4800
  }
};

export async function getAdminConsoleData(): Promise<AdminConsoleData> {
  await new Promise((resolve) => setTimeout(resolve, 150));
  return adminMock;
}
