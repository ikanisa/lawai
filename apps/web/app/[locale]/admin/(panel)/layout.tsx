import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { isAdminPanelEnabled } from '../../../../src/config/feature-flags';
import { getMessages, type Locale } from '../../../../src/lib/i18n';
import { AdminPanelProviders } from '../../../../src/features/admin-panel/providers';
import { AdminPanelAppShell } from '../../../../src/features/admin-panel/shell';

interface LayoutProps {
  children: ReactNode;
  params: { locale: Locale };
}

export default function AdminPanelLayout({ children, params }: LayoutProps) {
  if (!isAdminPanelEnabled()) {
    notFound();
  }
  const messages = getMessages(params.locale);

  return (
    <AdminPanelProviders locale={params.locale} messages={messages}>
      <AdminPanelAppShell>{children}</AdminPanelAppShell>
    </AdminPanelProviders>
  );
}
