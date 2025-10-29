import { CitationsBrowserDataSchema, } from '@avocat-ai/shared';
const citationsData = CitationsBrowserDataSchema.parse({
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
            summary: "Énumère les actes de commerce par nature et précise le champ d’application du droit commercial français.",
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
                Type: 'Code consolidé',
                'Dernière mise à jour': '2024-05-10',
                Référence: 'JORF n°001 du 2 janvier 2024',
                Autorité: 'Légifrance',
            },
            content: [
                {
                    anchor: 'actes',
                    heading: 'Actes de commerce',
                    text: "Sont commerçants ceux qui exercent des actes de commerce et en font leur profession habituelle. Les actes de commerce comprennent notamment...",
                },
                {
                    anchor: 'obligations',
                    heading: 'Obligations',
                    text: "Les commerçants sont tenus de s’immatriculer au registre du commerce et des sociétés et doivent tenir une comptabilité régulière...",
                },
            ],
        },
        {
            id: 'eli:eu:regulation:2016:679',
            title: 'Règlement (UE) 2016/679 RGPD',
            eli: 'eli:eu:regulation:2016:679',
            jurisdiction: 'EU',
            type: 'regulation',
            publicationDate: '2016-05-04',
            entryIntoForce: '2018-05-25',
            badges: ['Officiel', 'Traduction'],
            summary: 'Cadre général sur la protection des données, obligations des responsables et droits des personnes.',
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
                Type: 'Règlement UE',
                Autorité: 'Parlement européen & Conseil',
                Langue: 'FR',
                Champ: 'Protection des données',
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
                Type: 'Loi nationale',
                Autorité: 'Parlement du Rwanda',
                Langue: 'FR',
                Champ: 'Services numériques',
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
                Type: 'Acte uniforme',
                Autorité: 'OHADA',
                Champ: 'Comptabilité',
                Langue: 'FR',
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
});
export function cloneCitationsData() {
    return JSON.parse(JSON.stringify(citationsData));
}
export function getCitationById(id) {
    const all = [...citationsData.results, ...citationsData.ohadaFeatured];
    return all.find((item) => item.id === id);
}
