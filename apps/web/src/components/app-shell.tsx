'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useRef, useState } from 'react';
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
  Upload,
  WifiOff,
} from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import type { Messages, Locale } from '../lib/i18n';
import { useCommandPalette } from '../state/command-palette';
import { CommandPalette } from './command-palette';
import { Sheet, SheetSection } from './ui/sheet';
import { useOnlineStatus } from '../hooks/use-online-status';
import { useOutbox } from '../hooks/use-outbox';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import { useDigest } from '../hooks/use-digest';

interface AppShellProps {
  children: ReactNode;
  messages: Messages;
  locale: Locale;
}

const NAVIGATION = [
  { key: 'workspace', href: '/workspace', icon: LayoutGrid },
  { key: 'research', href: '/research', icon: Search, badge: 'beta' },
  { key: 'drafting', href: '/drafting', icon: FileText },
  { key: 'matters', href: '/matters', icon: Briefcase },
  { key: 'citations', href: '/citations', icon: BookMarked },
  { key: 'hitl', href: '/hitl', icon: ShieldCheck },
  { key: 'corpus', href: '/corpus', icon: Database },
  { key: 'admin', href: '/admin', icon: Settings },
  { key: 'trust', href: '/trust', icon: Globe2 },
];

const MOBILE_PRIMARY_NAV = ['workspace', 'research', 'drafting', 'hitl'] as const;

export function AppShell({ children, messages, locale }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);
  const installPromptRef = useRef<any>(null);
  const successRef = useRef(false);
  const installDismissedRef = useRef(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const setCommandOpen = useCommandPalette((state) => state.setOpen);
  const online = useOnlineStatus();
  const { items: outboxItems } = useOutbox();
  const { enabled: digestEnabled, enable: enableDigest, loading: digestLoading } = useDigest();

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    installDismissedRef.current = window.localStorage.getItem('avocat-ai-install-dismissed') === '1';

    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      if (installDismissedRef.current) {
        return;
      }
      installPromptRef.current = event;
      if (successRef.current) {
        setShowInstallPrompt(true);
      }
    };

    const handleRunSuccess = () => {
      successRef.current = true;
      if (installPromptRef.current && !installDismissedRef.current) {
        setShowInstallPrompt(true);
      }
    };

    const handleInstalled = () => {
      installPromptRef.current = null;
      setShowInstallPrompt(false);
      installDismissedRef.current = true;
      window.localStorage.setItem('avocat-ai-install-dismissed', '1');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('avocat-run-success', handleRunSuccess);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('avocat-run-success', handleRunSuccess);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName;
      const isEditable = target?.isContentEditable;
      const isInput = tagName === 'INPUT' || tagName === 'TEXTAREA' || (tagName === 'DIV' && isEditable);

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen(true);
        return;
      }

      if (!event.metaKey && !event.ctrlKey && event.key === '/' && !isInput) {
        event.preventDefault();
        setCommandOpen(true);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setCommandOpen]);

  async function handleEnableDigest() {
    try {
      const granted = await enableDigest();
      if (granted) {
        toast.success(messages.workspace.digestEnabled);
      } else {
        toast.error(messages.workspace.digestError);
      }
    } catch (error) {
      console.error('digest_enable_failed', error);
      toast.error(messages.workspace.digestError);
    }
  }

  const localizedHref = (href: string) => `/${locale}${href}` as Route;

  return (
    <>
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
                  <span className="flex items-center gap-2">
                    {messages.nav[item.key as keyof typeof messages.nav]}
                    {item.badge === 'beta' ? (
                      <Badge variant="outline" className="rounded-full border-teal-300/60 bg-teal-500/10 text-[10px] uppercase tracking-wide text-teal-200">
                        Beta
                      </Badge>
                    ) : null}
                  </span>
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
            <Button
              type="button"
              variant="outline"
              onClick={() => setCommandOpen(true)}
              className="hidden items-center gap-3 rounded-full border-slate-800/60 bg-slate-900/60 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-teal-400/60 hover:text-teal-100 lg:inline-flex"
            >
              <Command className="h-4 w-4" aria-hidden />
              <span>{messages.commands.open}</span>
              <span className="hidden items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 xl:flex">
                <kbd className="rounded border border-slate-700/60 bg-slate-900/80 px-2 py-1">⌘</kbd>
                <kbd className="rounded border border-slate-700/60 bg-slate-900/80 px-2 py-1">K</kbd>
              </span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setCommandOpen(true)}
              aria-label={messages.commands.open}
            >
              <Command className="h-5 w-5" aria-hidden />
            </Button>
          </div>
          <div className="flex items-center gap-3">
            {!online ? (
              <span
                role="status"
                aria-live="polite"
                className="hidden rounded-full border border-amber-400/60 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-200 lg:inline-flex"
              >
                {messages.app.offlineLabel}
                {outboxItems.length > 0 ? ` • ${messages.app.offlineQueued.replace('{count}', String(outboxItems.length))}` : ''}
              </span>
            ) : null}
            {!online ? (
              <span
                role="status"
                aria-live="polite"
                className="inline-flex rounded-full border border-amber-400/60 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-200 lg:hidden"
              >
                {messages.app.offlineShort}
              </span>
            ) : null}
            {online && outboxItems.length > 0 ? (
              <span
                role="status"
                aria-live="polite"
                className="hidden rounded-full border border-teal-400/60 bg-teal-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-teal-200 lg:inline-flex"
              >
                {messages.app.outboxPending.replace('{count}', String(outboxItems.length))}
              </span>
            ) : null}
            <Button variant="ghost" size="icon" aria-label="Notifications">
              <Bell className="h-5 w-5" aria-hidden />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleEnableDigest}
              aria-label={messages.workspace.enableDigest}
              disabled={digestEnabled || digestLoading}
              className={cn(
                'relative border-slate-700/60 bg-slate-900/60 text-slate-200 transition hover:border-teal-400/60 hover:text-teal-100',
                digestEnabled && 'border-teal-400/60 text-teal-200',
              )}
            >
              <Bell className="h-5 w-5" aria-hidden />
              {digestEnabled ? (
                <Badge
                  variant="outline"
                  className="absolute -right-2 -top-2 rounded-full border-teal-300/70 bg-teal-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-100"
                >
                  {messages.workspace.digestEnabledBadge}
                </Badge>
              ) : null}
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
          {!online ? (
            <div className="pointer-events-auto mb-3 flex items-center gap-2 rounded-2xl border border-amber-500/40 bg-amber-900/50 px-4 py-2 text-xs text-amber-100">
              <WifiOff className="h-4 w-4" aria-hidden />
              <span>{messages.app.mobileOfflineNotice}</span>
            </div>
          ) : null}
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
                  <span className="sr-only sm:not-sr-only">
                    {messages.nav[item.key as keyof typeof messages.nav]}
                    {item.badge === 'beta' ? ' (Beta)' : ''}
                  </span>
                </Link>
              );
            })}
          </nav>
          <button
            type="button"
            onClick={() => setMobileActionsOpen(true)}
            className="pointer-events-auto focus-ring absolute -top-9 left-1/2 inline-flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full bg-grad-1 text-slate-950 shadow-2xl"
            aria-label={messages.actions.ask}
          >
            <Search className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>
      <CommandPalette messages={messages} locale={locale} />
    </div>
      {showInstallPrompt ? (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm rounded-3xl border border-slate-800/60 bg-slate-900/90 p-5 text-slate-100 shadow-2xl">
          <h2 className="text-sm font-semibold">{messages.app.installPromptTitle}</h2>
          <p className="mt-2 text-sm text-slate-300">{messages.app.installPromptBody}</p>
          <div className="mt-4 flex items-center gap-3">
            <Button
              onClick={async () => {
                const prompt = installPromptRef.current as any;
                if (!prompt || typeof prompt.prompt !== 'function') {
                  setShowInstallPrompt(false);
                  return;
                }
                prompt.prompt();
                try {
                  await prompt.userChoice;
                } catch (error) {
                  console.warn('install_prompt_cancelled', error);
                }
                installPromptRef.current = null;
                setShowInstallPrompt(false);
                installDismissedRef.current = true;
                window.localStorage.setItem('avocat-ai-install-dismissed', '1');
              }}
            >
              {messages.app.installPromptCta}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setShowInstallPrompt(false);
                installDismissedRef.current = true;
                window.localStorage.setItem('avocat-ai-install-dismissed', '1');
              }}
            >
              {messages.app.installPromptDismiss}
            </Button>
          </div>
        </div>
      ) : null}
      <Sheet
        open={mobileActionsOpen}
        onOpenChange={setMobileActionsOpen}
        title={messages.app.mobileActionsTitle}
        description={messages.app.mobileActionsDescription}
      >
        <SheetSection>
          <div className="flex flex-col gap-3">
            <Button
              variant="outline"
              className="flex items-center justify-between gap-3 border-slate-700/60 bg-slate-900/60 text-slate-100"
              onClick={() => {
                setMobileActionsOpen(false);
                router.push(localizedHref('/research'));
              }}
              disabled={!online}
            >
              <span className="flex items-center gap-3">
                <Search className="h-4 w-4 text-teal-200" aria-hidden />
                {messages.actions.newResearch}
              </span>
              <span className="text-xs text-slate-500">⌘K</span>
            </Button>
            <Button
              variant="outline"
              className="flex items-center justify-between gap-3 border-slate-700/60 bg-slate-900/60 text-slate-100"
              onClick={() => {
                setMobileActionsOpen(false);
                router.push(localizedHref('/corpus'));
              }}
              disabled={!online}
            >
              <span className="flex items-center gap-3">
                <Upload className="h-4 w-4 text-teal-200" aria-hidden />
                {messages.actions.upload}
              </span>
            </Button>
            <Button
              variant="outline"
              className="flex items-center justify-between gap-3 border-slate-700/60 bg-slate-900/60 text-slate-100"
              onClick={() => {
                setMobileActionsOpen(false);
                router.push(localizedHref('/drafting'));
              }}
              disabled={!online}
            >
              <span className="flex items-center gap-3">
                <FileText className="h-4 w-4 text-teal-200" aria-hidden />
                {messages.actions.newDraft}
              </span>
            </Button>
            <Button
              variant="outline"
              className="flex items-center justify-between gap-3 border-slate-700/60 bg-slate-900/60 text-slate-100"
              onClick={() => {
                setMobileActionsOpen(false);
                void handleEnableDigest();
              }}
              disabled={digestEnabled || digestLoading}
            >
              <span className="flex items-center gap-3">
                <Bell className="h-4 w-4 text-teal-200" aria-hidden />
                {messages.workspace.enableDigest}
              </span>
              {digestEnabled ? (
                <Badge variant="outline" className="text-[10px] uppercase tracking-wide text-teal-200">
                  {messages.workspace.digestEnabledBadge}
                </Badge>
              ) : null}
            </Button>
          </div>
          {!online ? (
            <p className="mt-4 rounded-2xl border border-amber-400/40 bg-amber-500/10 p-3 text-xs text-amber-200">
              {messages.app.mobileOfflineNotice}
              {outboxItems.length > 0 ? ` ${messages.app.offlineQueued.replace('{count}', String(outboxItems.length))}.` : ''}
            </p>
          ) : null}
          {online && outboxItems.length > 0 ? (
            <p className="mt-4 rounded-2xl border border-slate-700/60 bg-slate-900/50 p-3 text-xs text-slate-300">
              {messages.app.outboxPending.replace('{count}', String(outboxItems.length))}
            </p>
          ) : null}
        </SheetSection>
      </Sheet>
    </>
  );
}
