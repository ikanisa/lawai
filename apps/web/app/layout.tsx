import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Avocat-AI Francophone',
  description: 'Assistant juridique autonome francophone avec traçabilité et citations officielles.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className="bg-slate-950">{children}</body>
    </html>
  );
}
