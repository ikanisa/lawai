import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { AppShell } from '@/features/shell';
import { AppProviders } from '@/features/platform/providers/app-providers';
import { AuthGuard } from '@/features/auth/components/auth-guard';
import { getMessages, isLocale, locales, type Locale } from '@/lib/i18n';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { locale: string };
}) {
  if (!isLocale(params.locale)) {
    notFound();
  }
  const locale = params.locale as Locale;
  const messages = getMessages(locale);

  return (
    <AppProviders>
      <AuthGuard locale={locale}>
        <AppShell messages={messages} locale={locale}>
          {children}
        </AppShell>
      </AuthGuard>
    </AppProviders>
  );
}
