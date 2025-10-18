'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Locale, Messages } from '../../lib/i18n';

type AdminMessages = NonNullable<Messages['admin']> & {
  panel?: {
    overviewTitle: string;
  };
};

interface MessagesContextValue {
  messages: AdminMessages;
  locale: Locale;
}

const AdminMessagesContext = createContext<MessagesContextValue | null>(null);

export function AdminPanelMessagesProvider({
  messages,
  locale,
  children,
}: {
  messages: Messages;
  locale: Locale;
  children: ReactNode;
}) {
  const adminMessages: AdminMessages = {
    ...(messages.admin ?? {}),
    panel: {
      overviewTitle: messages.admin?.overviewTitle ?? 'Tableau de bord',
      ...(messages.admin?.panel ?? {}),
    },
  };

  return (
    <AdminMessagesContext.Provider value={{ messages: adminMessages, locale }}>
      {children}
    </AdminMessagesContext.Provider>
  );
}

export function useAdminMessages(): MessagesContextValue {
  const ctx = useContext(AdminMessagesContext);
  if (!ctx) {
    throw new Error('useAdminMessages must be used within AdminPanelMessagesProvider');
  }
  return ctx;
}
