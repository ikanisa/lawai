import type { Metadata } from 'next';
import { Inter, IBM_Plex_Serif } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const plex = IBM_Plex_Serif({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-serif' });

export const metadata: Metadata = {
  title: 'Avocat-AI Francophone',
  description: 'Assistant juridique autonome francophone avec traçabilité et citations officielles.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${inter.variable} ${plex.variable}`} suppressHydrationWarning>
      <body className="bg-slate-950">{children}</body>
    </html>
  );
}
