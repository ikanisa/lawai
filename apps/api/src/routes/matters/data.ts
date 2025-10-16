import { MattersOverviewSchema, type MattersOverview } from '@avocat-ai/shared';

const mattersData = MattersOverviewSchema.parse({
  matters: [
    {
      id: 'matter_helios',
      name: 'Banque Helios c/ SARL Lumière',
      client: 'Banque Helios',
      opposing: 'SARL Lumière',
      governingLaw: 'Droit français · OHADA',
      riskLevel: 'medium',
      stage: 'Instruction',
      nextHearing: '2024-06-18T09:00:00Z',
      principalIssue: 'Validité de la clause compromissoire et obligations de conformité bancaire.',
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
      governingLaw: 'Droit français · UE',
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
});

export function cloneMattersData(): MattersOverview {
  return JSON.parse(JSON.stringify(mattersData)) as MattersOverview;
}
