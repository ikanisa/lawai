import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Avocat-AI Francophone',
    short_name: 'Avocat-AI',
    description: 'Agent juridique autonome francophone avec citations officielles et revue humaine.',
    start_url: '/fr/research',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    background_color: '#0f172a',
    theme_color: '#0f172a',
    lang: 'fr',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
    shortcuts: [
      {
        name: 'Nouvelle recherche',
        short_name: 'Recherche',
        description: "Poser une nouvelle question juridique",
        url: '/fr/research',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Tableau de bord opérateur',
        short_name: 'Opérations',
        description: 'Consulter les métriques SLO et incidents',
        url: '/fr/admin',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Centre de confiance',
        short_name: 'Trust',
        description: 'Accéder aux publications gouvernance',
        url: '/fr/trust',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
    ],
  };
}
