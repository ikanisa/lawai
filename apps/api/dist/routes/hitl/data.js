import { HitlQueueDataSchema } from '@avocat-ai/shared';
const hitlQueueData = HitlQueueDataSchema.parse({
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
            summary: 'L’agent recommande de plaider l’incompétence OHADA et de solliciter un renvoi pour production d’un audit conformité.',
            irac: {
                issue: 'Le tribunal français est-il compétent malgré la clause OHADA ?',
                rules: [
                    'Code de procédure civile art. 76',
                    'Acte uniforme OHADA art. 5',
                    'Convention de New York art. II',
                ],
                application: "La clause compromissoire vise la CCJA mais la banque n’a pas signé l’avenant. L’OHADA s’applique par défaut mais la résidence principale est en France.",
                conclusion: 'Risques élevés de contestation, privilégier une exception d’incompétence et négocier un renvoi.',
            },
            evidence: [
                { id: 'eli:ohada:audcg:art5', label: 'Acte uniforme OHADA art. 5', uri: 'eli:ohada:audcg:art5', type: 'statute' },
                { id: 'eli:fr:cpc:art76', label: 'CPC art. 76', uri: 'eli:fr:cpc:art76', type: 'statute' },
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
            summary: 'Vérifier la conformité des traductions des contrats et sécuriser le calcul des pénalités avec l’outil interestCalculator.',
            irac: {
                issue: 'Les contrats bilingues sont-ils opposables sans traduction certifiée ?',
                rules: [
                    'Code du travail art. L1321-6',
                    'Directive 91/533/CEE',
                    'Cass. soc., 29 juin 2022',
                ],
                application: "Les contrats français/anglais fournis aux prestataires ne comportent pas toutes les clauses obligatoires. L’absence de traduction intégrale soulève une nullité potentielle.",
                conclusion: 'Imposer une traduction certifiée avant l’audience et recalculer les pénalités URSSAF.',
            },
            evidence: [
                { id: 'eli:fr:ct:artL1321-6', label: 'Code du travail art. L1321-6', uri: 'eli:fr:ct:artL1321-6', type: 'statute' },
                { id: 'eli:eu:directive:91:533', label: 'Directive 91/533/CEE', uri: 'eli:eu:directive:91:533', type: 'regulation' },
            ],
            deltas: [
                'Projet de circulaire DGT sur les langues de travail (mai 2024)',
                'Signalement interne: contrats bilingues incomplets détectés',
            ],
        },
    ],
});
export function cloneHitlQueueData() {
    return JSON.parse(JSON.stringify(hitlQueueData));
}
