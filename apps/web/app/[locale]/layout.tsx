import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppProviders } from '../../src/components/providers';
import { AppShell } from '../../src/components/app-shell';
import { getMessages, isLocale, locales, type Locale } from '../../src/lib/i18n';
import { getServerSession } from '../../src/server/auth/session';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

async function SessionHydrator({ children }: { children: ReactNode }) {
  const { session, orgId, userId, error } = await getServerSession();
  return (
    <AppProviders
      initialSession={{
        session,
        orgId,
        userId,
        error: error?.message ?? null,
      }}
    >
      {children}
    </AppProviders>
  );
}

export default async function LocaleLayout({
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
    <SessionHydrator>
      <AppShell messages={messages} locale={locale}>
        {children}
      </AppShell>
    </SessionHydrator>
  );
}
