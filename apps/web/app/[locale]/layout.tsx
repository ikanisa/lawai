import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppProviders } from '../../src/components/providers';
import { AppShell } from '../../src/components/app-shell';
import { getMessages, isLocale, locales, type Locale } from '../../src/lib/i18n';

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
      <AppShell messages={messages} locale={locale}>
        {children}
      </AppShell>
    </AppProviders>
  );
}
