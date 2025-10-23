import { randomUUID } from 'node:crypto';
import {
  type VoiceConsoleContext,
  type VoiceRunRequest,
  type VoiceRunResponse,
  type VoiceToolIntent,
} from '@avocat-ai/shared';

interface VoiceCitation {
  id: string;
  label: string;
  href: string;
  snippet: string;
}

const voiceCitations: VoiceCitation[] = [
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
];

const quickIntents: VoiceToolIntent[] = [
  {
    id: 'intent_deadline',
    name: 'Calculer un délai',
    tool: 'deadlineCalculator',
    status: 'scheduled',
    detail: 'Calcule les échéances de signification CCJA / tribunal français.',
  },
  {
    id: 'intent_service',
    name: 'Planifier la signification',
    tool: 'service_of_process',
    status: 'scheduled',
    detail: 'Prépare les modalités de signification transfrontalière OHADA.',
  },
  {
    id: 'intent_guardrail',
    name: 'Activer le mode confidentiel',
    tool: 'confidential_mode',
    status: 'requires_hitl',
    detail: 'Nécessite validation HITL avant d’engager les outils web.',
  },
];

export const voiceConsoleContext: VoiceConsoleContext = {
  suggestions: [
    'Prépare une synthèse vocale pour la signification CCJA avant vendredi',
    'Quelles pièces devons-nous rassembler pour la requête en référé ?',
    'Calcule le délai d’appel OHADA si le jugement est rendu aujourd’hui',
  ],
  quickIntents: quickIntents.map((intent) => ({ ...intent })),
  recentSessions: [
    {
      id: 'voice_session_helios',
      startedAt: '2024-06-03T08:40:00Z',
      durationMs: 54_000,
      transcript:
        "Synthèse de la réunion Banque Helios : besoin d'une mesure conservatoire CCJA et de notifier le DPO.",
      summary:
        'Mesures conservatoires proposées avec rappel des obligations OHADA et articulation avec la loi française.',
      citations: [voiceCitations[0], voiceCitations[1]],
      intents: [
        {
          id: 'intent_deadline',
          name: 'Calculer un délai',
          tool: 'deadlineCalculator',
          status: 'completed',
        },
        {
          id: 'intent_service',
          name: 'Planifier la signification',
          tool: 'service_of_process',
          status: 'completed',
        },
      ],
    },
    {
      id: 'voice_session_rw',
      startedAt: '2024-06-02T16:05:00Z',
      durationMs: 48_000,
      transcript:
        'Incident cybersécurité Rwanda : vérifier les obligations de notification et préparer un plan de réponse.',
      summary:
        'Plan d’alerte immédiat avec rappel des obligations ICT Law Rwanda et proposition d’activation du mode confidentiel.',
      citations: [voiceCitations[2]],
      intents: [
        {
          id: 'intent_guardrail',
          name: 'Activer le mode confidentiel',
          tool: 'confidential_mode',
          status: 'requires_hitl',
        },
      ],
    },
  ],
  guardrails: [
    'france_judge_analytics_block actif — aucune analyse prédictive sur les magistrats.',
    'confidential_mode coupe la recherche web durant les sessions vocales.',
  ],
};

export function cloneVoiceConsoleContext(): VoiceConsoleContext {
  return JSON.parse(JSON.stringify(voiceConsoleContext)) as VoiceConsoleContext;
}

export function buildVoiceRunResponse(request: VoiceRunRequest): VoiceRunResponse {
  const transcript = request.transcript.toLowerCase();
  const mentionsUrgency = transcript.includes('urgence') || transcript.includes('référé');
  const mentionsPrivacy = transcript.includes('dpo') || transcript.includes('données');

  const intents = quickIntents.map((intent) => {
    const next: VoiceToolIntent = { ...intent };
    if (intent.id === 'intent_deadline' && mentionsUrgency) {
      next.status = 'running';
      next.detail = 'Calcul express des délais de référé demandé.';
    } else if (intent.id === 'intent_guardrail' && mentionsPrivacy) {
      next.status = 'completed';
      next.detail = 'Mode confidentiel activé pour bloquer la recherche web.';
    }
    return next;
  });

  const selectedCitations = voiceCitations.filter((citation): boolean => {
    if (mentionsUrgency && citation.id.includes('procedure')) {
      return true;
    }
    if (mentionsPrivacy && citation.id.includes('ict')) {
      return true;
    }
    return citation.id.includes('ohada');
  });

  const effectiveCitations: VoiceCitation[] = selectedCitations.length
    ? selectedCitations
    : voiceCitations.slice(0, 2);
  const riskLevel = mentionsUrgency ? 'HIGH' : mentionsPrivacy ? 'MED' : 'LOW';

  const clarifications: string[] = [];
  if (!mentionsUrgency) {
    clarifications.push('Confirmez si une procédure d’urgence est requise avant d’engager les mesures.');
  }
  if (!mentionsPrivacy) {
    clarifications.push('Souhaitez-vous activer le mode confidentiel pour bloquer la recherche web ?');
  }

  const response: VoiceRunResponse = {
    id: `voice_run_${randomUUID()}`,
    summary: mentionsUrgency
      ? 'Plan vocal : mesures de référé et notifications CCJA prêtes.'
      : 'Plan vocal : vérifications OHADA et sécurisation des notifications en cours.',
    followUps: [
      'Dois-je planifier une revue HITL pour valider les actions sensibles ?',
      'Faut-il lancer la rédaction d’un mémo de banc sur ces mesures ?',
    ],
    citations: effectiveCitations.map((citation) => ({ ...citation })),
    intents,
    readback: effectiveCitations.map((citation) => `${citation.label} — ${citation.snippet}`),
    riskLevel,
    clarifications,
  };

  return response;
}
