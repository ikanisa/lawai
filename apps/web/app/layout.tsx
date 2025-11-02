import type { Metadata } from 'next';
import { Inter, IBM_Plex_Serif } from 'next/font/google';
import './globals.css';
import { isLocale } from '../src/lib/i18n';
import { ServiceWorkerRegistration } from '../src/components/service-worker-registration';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const plex = IBM_Plex_Serif({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-serif' });

const DEFAULT_LOCALE = 'fr';

export const metadata: Metadata = {
  title: 'Avocat-AI Francophone',
  description: 'Assistant juridique autonome francophone avec traçabilité et citations officielles.',
  manifest: '/manifest.json',
  applicationName: 'Avocat-AI Admin Console',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Avocat-AI Admin',
  },
};

export default function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale?: string };
}) {
  const requestedLocale = params?.locale;
  const locale = requestedLocale && isLocale(requestedLocale) ? requestedLocale : DEFAULT_LOCALE;
  const direction = locale === 'ar' || locale === 'he' ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={direction} className={`${inter.variable} ${plex.variable}`} suppressHydrationWarning>
      <body className="bg-slate-950" data-locale={locale} data-direction={direction}>
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}
