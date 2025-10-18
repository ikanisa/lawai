'use client';

import type { ReactNode } from 'react';
import type { Locale, Messages } from '../../lib/i18n';
import { AdminPanelContextProvider } from './context';
import { AdminPanelMessagesProvider } from './messages-context';

interface ProviderProps {
  children: ReactNode;
  messages: Messages;
  locale: Locale;
}

export function AdminPanelProviders({ children, messages, locale }: ProviderProps) {
  return (
    <AdminPanelMessagesProvider messages={messages} locale={locale}>
      <AdminPanelContextProvider>{children}</AdminPanelContextProvider>
    </AdminPanelMessagesProvider>
  );
}
