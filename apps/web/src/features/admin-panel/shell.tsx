'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState, type ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  BookMarked,
  Building2,
  ClipboardList,
  FileSearch,
  FolderSearch,
  Gauge,
  Layers,
  ListChecks,
  Network,
  PersonStanding,
  ShieldCheck,
  SquareStack,
  Users,
  Workflow,
} from 'lucide-react';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Badge } from '@/ui/badge';
import { useAdminPanelContext } from './context';
import { useAdminMessages } from './messages-context';

const NAV_ITEMS = [
  { key: 'overview', href: '/admin/overview', label: 'Overview', icon: Gauge },
  { key: 'people', href: '/admin/people', label: 'People', icon: Users },
  { key: 'policies', href: '/admin/policies', label: 'Policies', icon: ClipboardList },
  { key: 'jurisdictions', href: '/admin/jurisdictions', label: 'Jurisdictions', icon: Building2 },
  { key: 'agents', href: '/admin/agents', label: 'Agents & Tools', icon: Network },
  { key: 'workflows', href: '/admin/workflows', label: 'Workflows', icon: Workflow },
  { key: 'hitl', href: '/admin/hitl', label: 'HITL', icon: ShieldCheck },
  { key: 'corpus', href: '/admin/corpus', label: 'Corpus & Sources', icon: FolderSearch },
  { key: 'ingestion', href: '/admin/ingestion', label: 'Ingestion', icon: SquareStack },
  { key: 'evaluations', href: '/admin/evaluations', label: 'Evaluations', icon: ListChecks },
  { key: 'telemetry', href: '/admin/telemetry', label: 'Telemetry', icon: BarChart3 },
  { key: 'audit-log', href: '/admin/audit-log', label: 'Audit Log', icon: BookMarked },
  { key: 'billing', href: '/admin/billing', label: 'Billing', icon: Activity },
] as const;

const ALERTS = [
  { id: 'jobs', message: 'Drive watcher backlog detected', severity: 'warning' as const },
  { id: 'evals', message: 'Nightly evals missed latest SLA gate', severity: 'critical' as const },
];

export function AdminPanelAppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { environment, organizations, activeOrg, setActiveOrg, setSearchQuery, searchQuery } = useAdminPanelContext();
  const { locale } = useAdminMessages();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const environmentBadge = useMemo(() => {
    switch (environment) {
      case 'production':
        return { label: 'Prod', className: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/40' };
      case 'staging':
        return { label: 'Staging', className: 'bg-amber-500/10 text-amber-200 border border-amber-500/40' };
      default:
        return { label: 'Dev', className: 'bg-sky-500/10 text-sky-200 border border-sky-500/40' };
    }
  }, [environment]);

  const navItems = useMemo(() => {
    return NAV_ITEMS.map((item) => ({
      ...item,
      active: pathname?.includes(item.href) ?? false,
    }));
  }, [pathname]);

  const alerts = useMemo(() => ALERTS, []);

  return (
    <div className="flex h-full min-h-screen w-full bg-slate-950 text-slate-100">
      <AnimatePresence>
        {(sidebarOpen || typeof window === 'undefined') && (
          <motion.aside
            initial={{ x: sidebarOpen ? -16 : 0, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -24, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
            className="z-40 hidden w-72 flex-col border-r border-slate-800/60 bg-slate-900/40 px-4 py-6 lg:flex"
          >
            <div className="flex items-center justify-between pb-6">
              <div>
                <p className="text-lg font-semibold">Admin Panel</p>
                <p className="text-xs text-slate-400">Agent-first control surface</p>
              </div>
              <Badge variant="outline" className={environmentBadge.className}>
                {environmentBadge.label}
              </Badge>
            </div>
            <nav className="flex-1 space-y-1" aria-label="Admin navigation">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.key}
                    href={`/${locale}${item.href}`}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-slate-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
                      item.active ? 'bg-slate-800/80 text-sky-100' : 'text-slate-300'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="space-y-2 pt-6">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Alerts</p>
              <div className="space-y-2">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${
                      alert.severity === 'critical'
                        ? 'border-rose-500/40 bg-rose-950/40 text-rose-100'
                        : 'border-amber-500/40 bg-amber-950/30 text-amber-100'
                    }`}
                  >
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>{alert.message}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-slate-800/60 bg-slate-900/50 px-6 py-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen((prev) => !prev)}
            aria-label={sidebarOpen ? 'Close navigation' : 'Open navigation'}
          >
            <SquareStack className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="admin-org-switcher">
              Organisation
            </label>
            <select
              id="admin-org-switcher"
              className="rounded-md border border-slate-700/70 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              value={activeOrg.id}
              onChange={(event) => setActiveOrg(event.target.value)}
            >
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>
          <div className="relative flex-1">
            <label htmlFor="admin-search" className="sr-only">
              Search admin surface
            </label>
            <Input
              id="admin-search"
              placeholder="Search people, policies, jobs..."
              className="w-full bg-slate-900/70 pl-9"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            <FileSearch className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" aria-hidden />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" aria-label="Open notifications">
              <Bell className="h-5 w-5" />
            </Button>
            <Button variant="default" size="sm" className="gap-2">
              <Layers className="h-4 w-4" />
              Preview changes
            </Button>
            <Button variant="secondary" size="sm" className="gap-2">
              <PersonStanding className="h-4 w-4" />
              Save &amp; audit
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto bg-slate-950 px-6 py-6" role="main">
          <div className="mx-auto w-full max-w-[1400px] space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
