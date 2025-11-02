import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ReactNode } from 'react';
import { Providers } from '@/providers/providers';
import { SkipLink } from '@/components/SkipLink';
import { TopNav } from '@/components/TopNav';
import { ServiceWorkerManager } from '@/components/ServiceWorkerManager';
import { InstallPromptBanner } from '@/components/InstallPromptBanner';

export const metadata: Metadata = {
  title: 'Avocat AI field staff',
  description:
    'Offline-first staffing and logistics experience for Avocat AI rapid response teams with accessible defaults.',
  manifest: '/manifest.webmanifest',
  applicationName: 'Avocat AI Staff',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
  },
  themeColor: '#0b1220',
};

export const viewport: Viewport = {
  themeColor: '#0b1220',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <ServiceWorkerManager />
          <SkipLink href="#main-content">Skip to main content</SkipLink>
          <header style={{ padding: '1.5rem 1.5rem 0' }}>
            <p className="badge" aria-label="Environment">
              Staff PWA
            </p>
            <h1 style={{ margin: '0.75rem 0 0', fontSize: '1.75rem' }}>Avocat AI Rapid Response</h1>
            <p style={{ margin: '0.5rem 0 0', color: '#cbd5f5' }}>
              Designed for offline resilience and keyboard-first dispatch.
            </p>
            <TopNav />
          </header>
          <InstallPromptBanner />
          <main id="main-content">{children}</main>
          <footer style={{ padding: '2rem 1.5rem 3rem', color: '#94a3b8' }}>
            <p>Budgeted for Lighthouse performance (125 KB scripts, 3 s TTI) — see budgets.json.</p>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
