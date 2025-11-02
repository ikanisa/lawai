import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ReactNode } from 'react';
import { Providers } from '@/providers/providers';
import { SkipLink } from '@/components/SkipLink';
import { TopNav } from '@/components/TopNav';
import { ServiceWorkerManager } from '@/components/ServiceWorkerManager';
import { InstallPromptBanner } from '@/components/InstallPromptBanner';

export const metadata: Metadata = {
  title: 'Avocat AI admin hub',
  description: 'Progressive web app for executives to supervise compliance, deployments, and incidents offline.',
  manifest: '/manifest.webmanifest',
  applicationName: 'Avocat AI Admin',
  themeColor: '#020617',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  themeColor: '#020617',
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
          <header style={{ padding: '1.75rem 1.75rem 0' }}>
            <p className="badge" aria-label="Environment">
              Admin PWA
            </p>
            <h1 style={{ margin: '0.75rem 0 0', fontSize: '1.85rem' }}>Avocat AI Control Center</h1>
            <p style={{ margin: '0.5rem 0 0', color: '#cbd5f5' }}>
              Keyboard navigable oversight for compliance and operations teams.
            </p>
            <TopNav />
          </header>
          <InstallPromptBanner />
          <main id="main-content">{children}</main>
          <footer style={{ padding: '2rem 1.75rem 3rem', color: '#94a3b8' }}>
            <p>Lighthouse budgets enforced (120 KB scripts, 3 s TTI). Review budgets.json before shipping.</p>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
