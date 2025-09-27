'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode, useState } from 'react';
import {
  LayoutGrid,
  Search,
  FileText,
  Briefcase,
  BookMarked,
  ShieldCheck,
  Database,
  Settings,
  Bell,
  Command,
  Menu,
  Globe2,
  X,
} from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import type { Messages, Locale } from '../lib/i18n';

interface AppShellProps {
  children: ReactNode;
  messages: Messages;
  locale: Locale;
}

const NAVIGATION = [
  { key: 'workspace', href: '/workspace', icon: LayoutGrid },
  { key: 'research', href: '/research', icon: Search },
  { key: 'drafting', href: '/drafting', icon: FileText },
  { key: 'matters', href: '/matters', icon: Briefcase },
  { key: 'citations', href: '/citations', icon: BookMarked },
  { key: 'hitl', href: '/hitl', icon: ShieldCheck },
  { key: 'corpus', href: '/corpus', icon: Database },
  { key: 'admin', href: '/admin', icon: Settings },
];

const MOBILE_PRIMARY_NAV = ['workspace', 'research', 'drafting', 'hitl'] as const;

export function AppShell({ children, messages, locale }: AppShellProps) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);

  const localizedHref = (href: string) => `/${locale}${href}`;

  return (
    <div className="relative flex min-h-screen bg-slate-950 text-slate-100">
      <a href="#main" className="skip-link">
        {messages.app.skipToContent}
      </a>
      {navOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/70 backdrop-blur-sm lg:hidden"
          role="presentation"
          onClick={() => setNavOpen(false)}
        />
      )}
      <aside
        className={cn(
          'glass-card fixed inset-y-0 left-0 z-40 hidden w-64 flex-col gap-6 border-r border-slate-800/60 px-6 py-8 lg:flex',
          navOpen && 'flex',
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Globe2 className="h-5 w-5 text-teal-300" aria-hidden />
            <span>{messages.app.title}</span>
          </div>
          <button
            className="lg:hidden"
            onClick={() => setNavOpen(false)}
            aria-label="Fermer la navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav aria-label="Navigation principale" className="space-y-1">
          {NAVIGATION.map((item) => {
            const Icon = item.icon;
            const href = localizedHref(item.href);
            const isActive = pathname?.startsWith(href);
            return (
              <Link
                key={item.key}
                href={href}
                className="block"
                onClick={() => setNavOpen(false)}
              >
                <span
                  className={cn(
                    'focus-ring flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold uppercase tracking-wide transition',
                    isActive
                      ? 'bg-grad-1 text-slate-900 shadow-lg'
                      : 'bg-slate-900/40 text-slate-300 hover:bg-slate-800/50 hover:text-white',
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {messages.nav[item.key as keyof typeof messages.nav]}
                </span>
              </Link>
            );
          })}
        </nav>
      </aside>
      <button
        className="focus-ring fixed left-4 top-4 z-50 inline-flex items-center gap-2 rounded-full bg-slate-900/80 px-4 py-2 text-sm font-semibold text-slate-100 shadow-lg backdrop-blur lg:hidden"
        onClick={() => setNavOpen((prev) => !prev)}
        aria-expanded={navOpen}
        aria-controls="mobile-nav"
      >
        <Menu className="h-4 w-4" aria-hidden /> Menu
      </button>
      <div className="flex flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-800/60 bg-slate-950/80 px-6 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex">
              <Command className="h-5 w-5 text-slate-500" aria-hidden />
            </div>
            <p className="text-sm text-slate-400">{messages.app.commandPlaceholder}</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" aria-label="Notifications">
              <Bell className="h-5 w-5" aria-hidden />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Sélecteur d’organisation">
              <Database className="h-5 w-5" aria-hidden />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Profil utilisateur">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-800/70 text-sm font-semibold">
                AV
              </span>
            </Button>
          </div>
        </header>
        <main id="main" className="flex-1 px-6 pb-24 pt-10">
          {children}
        </main>
      </div>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-lg px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] lg:hidden">
        <div className="relative">
          <nav
            id="mobile-nav"
            aria-label="Navigation principale mobile"
            className="pointer-events-auto glass-card flex items-center justify-between rounded-3xl border border-slate-800/60 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide"
          >
            {MOBILE_PRIMARY_NAV.map((key) => {
              const item = NAVIGATION.find((nav) => nav.key === key)!;
              const Icon = item.icon;
              const href = localizedHref(item.href);
              const isActive = pathname?.startsWith(href);
              return (
                <Link
                  key={key}
                  href={href}
                  className={cn(
                    'focus-ring flex flex-col items-center gap-1 rounded-full px-2 py-1',
                    isActive ? 'text-teal-200' : 'text-slate-400 hover:text-white',
                  )}
                  aria-label={messages.nav[item.key as keyof typeof messages.nav]}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                  <span className="sr-only sm:not-sr-only">{messages.nav[item.key as keyof typeof messages.nav]}</span>
                </Link>
              );
            })}
          </nav>
          <Link
            href={localizedHref('/research')}
            className="pointer-events-auto focus-ring absolute -top-9 left-1/2 inline-flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full bg-grad-1 text-slate-950 shadow-2xl"
            aria-label={messages.actions.ask}
          >
            <Search className="h-5 w-5" aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}
