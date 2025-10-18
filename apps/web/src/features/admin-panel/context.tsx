'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { getAdminEnvironmentLabel } from '../../config/feature-flags';

export interface AdminOrganization {
  id: string;
  name: string;
  slug: string;
}

export interface AdminPanelContextValue {
  environment: 'development' | 'staging' | 'production';
  organizations: AdminOrganization[];
  activeOrg: AdminOrganization;
  setActiveOrg: (orgId: string) => void;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
}

const AdminPanelContext = createContext<AdminPanelContextValue | null>(null);

const DEMO_ORGS: AdminOrganization[] = [
  { id: 'org-demo', name: 'Démo Internationale', slug: 'demo' },
  { id: 'org-eu', name: 'Démo Europe', slug: 'demo-eu' },
];

export function AdminPanelContextProvider({ children }: { children: ReactNode }) {
  const environment = getAdminEnvironmentLabel();
  const [activeId, setActiveId] = useState(DEMO_ORGS[0].id);
  const [searchQuery, setSearchQuery] = useState('');

  const value = useMemo<AdminPanelContextValue>(() => {
    const activeOrg = DEMO_ORGS.find((org) => org.id === activeId) ?? DEMO_ORGS[0];
    return {
      environment,
      organizations: DEMO_ORGS,
      activeOrg,
      setActiveOrg: setActiveId,
      searchQuery,
      setSearchQuery,
    };
  }, [activeId, environment, searchQuery]);

  return <AdminPanelContext.Provider value={value}>{children}</AdminPanelContext.Provider>;
}

export function useAdminPanelContext(): AdminPanelContextValue {
  const ctx = useContext(AdminPanelContext);
  if (!ctx) {
    throw new Error('useAdminPanelContext must be used within AdminPanelContextProvider');
  }
  return ctx;
}
