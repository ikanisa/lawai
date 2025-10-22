'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
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
  Shield,
  ShieldOff,
  Inbox,
  WifiOff,
} from 'lucide-react';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { cn } from '../lib/utils';
import type { Messages, Locale } from '../lib/i18n';
import { CommandPalette, type CommandPaletteAction } from './command-palette';
import { sendTelemetryEvent } from '../lib/api';
import { toast } from 'sonner';
import { ConfidentialModeBanner } from './confidential-mode-banner';
import { ComplianceBanner } from './compliance-banner';
import { useConfidentialMode } from '../state/confidential-mode';
import { useShallow } from 'zustand/react/shallow';
import { useOutbox } from '../hooks/use-outbox';
import { useOnlineStatus } from '../hooks/use-online-status';
import { PwaInstallPrompt } from './pwa-install-prompt';
import { usePwaPreference } from '../hooks/use-pwa-preference';
import { clientEnv } from '../env.client';

interface AppShellProps {
  children: ReactNode;
  messages: Messages;
  locale: Locale;
}

type StatusBarMessages = NonNullable<Messages['app']['statusBar']>;

const NAVIGATION = [
  { key: 'workspace', href: '/workspace', icon: LayoutGrid },
  { key: 'research', href: '/research', icon: Search },
  { key: 'drafting', href: '/drafting', icon: FileText },
  { key: 'matters', href: '/matters', icon: Briefcase },
  { key: 'citations', href: '/citations', icon: BookMarked },
  { key: 'hitl', href: '/hitl', icon: ShieldCheck },
  { key: 'corpus', href: '/corpus', icon: Database },
  { key: 'trust', href: '/trust', icon: Shield },
  { key: 'admin', href: '/admin', icon: Settings },
];

const MOBILE_PRIMARY_NAV = ['workspace', 'research', 'drafting', 'hitl'] as const;

export function AppShell({ children, messages, locale }: AppShellProps) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const longPressTriggered = useRef(false);
  const { enabled: confidentialMode, setEnabled: setConfidentialMode } = useConfidentialMode(
    useShallow((state) => ({ enabled: state.enabled, setEnabled: state.setEnabled })),
  );
  const confidentialMessages = messages.app.confidential;
  const statusMessages = confidentialMessages?.status;
  const confidentialActions = confidentialMessages?.actions;
  const { pendingCount: outboxCount, hasItems: hasOutbox, stalenessMs } = useOutbox();
  const online = useOnlineStatus();
  const statusBarMessages = messages.app.statusBar;
  const { enabled: pwaOptIn, ready: pwaPreferenceReady, setEnabled: setPwaOptIn } = usePwaPreference();

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (confidentialMode) {
      document.documentElement.dataset.confidential = 'true';
    } else {
      delete document.documentElement.dataset.confidential;
    }
  }, [confidentialMode]);

  const handleConfidentialToggle = useCallback(() => {
    const next = !confidentialMode;
    setConfidentialMode(next);
    const toastMessage = next ? statusMessages?.enabled : statusMessages?.disabled;
    if (toastMessage) {
      toast.info(toastMessage);
    }
    void sendTelemetryEvent('confidential_mode_toggled', { enabled: next });
  }, [confidentialMode, setConfidentialMode, statusMessages]);

  const confidentialToggleLabel = confidentialMode
    ? confidentialActions?.disable?.label ?? confidentialMessages?.cta ?? 'Disable confidential mode'
    : confidentialActions?.enable?.label ?? confidentialMessages?.title ?? 'Enable confidential mode';

  const commandActions = useMemo<CommandPaletteAction[]>(() => {
    const palette = messages.app.commandPalette;
    const quickActions: CommandPaletteAction[] = [];
    if (palette) {
      const routeMap: Record<keyof typeof palette.actions, string> = {
        newResearch: '/research',
        upload: '/corpus',
        openWorkspace: '/workspace',
        openDrafting: '/drafting',
        openMatters: '/matters',
        openCitations: '/citations',
        openHitl: '/hitl',
        openCorpus: '/corpus',
        openAdmin: '/admin',
        openTrust: '/trust',
      };

      (Object.entries(palette.actions) as [keyof typeof palette.actions, { label: string; description: string }][]).forEach(
        ([key, value]) => {
          const action: CommandPaletteAction = {
            id: `action-${key}`,
            label: value.label,
            description: value.description,
            section: 'actions',
            href: routeMap[key],
          };
          if (key === 'newResearch') {
            action.shortcut = '/';
          }
          quickActions.push(action);
        },
      );
    }

    if (confidentialActions) {
      const toggleAction = confidentialMode ? confidentialActions.disable : confidentialActions.enable;
      if (toggleAction) {
        quickActions.unshift({
          id: 'action-confidential-mode-toggle',
          label: toggleAction.label,
          description: toggleAction.description,
          section: 'actions',
          shortcut: toggleAction.shortcut,
          run: handleConfidentialToggle,
        });
      }
    }

    const navActions = NAVIGATION.map((item) => {
      const label = messages.nav[item.key as keyof typeof messages.nav];
      const descriptionTemplate = messages.app.commandPalette?.navigateTo ?? '{destination}';
      return {
        id: `nav-${item.key}`,
        label,
        description: descriptionTemplate.replace('{destination}', label),
        href: item.href,
        section: 'navigate' as const,
      } satisfies CommandPaletteAction;
    });

    return [...quickActions, ...navActions];
  }, [messages, confidentialActions, confidentialMode, handleConfidentialToggle]);

  const startLongPress = (pointerType: string) => {
    if (pointerType === 'mouse') return;
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      setCommandOpen(true);
    }, 600);
  };

  const cancelLongPressTimer = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  useEffect(() => () => {
    cancelLongPressTimer();
  }, []);

  useEffect(() => {
    if (!commandOpen) {
      longPressTriggered.current = false;
    }
  }, [commandOpen]);

  const localizedHref = (href: string) => `/${locale}${href}`;

  const handleCommandButton = () => {
    setCommandOpen(true);
    void sendTelemetryEvent('command_palette_button');
  };

  const handleFabPointerDown = (event: ReactPointerEvent<HTMLAnchorElement>) => {
    startLongPress(event.pointerType);
  };

  const handleFabPointerUp = () => {
    cancelLongPressTimer();
  };

  const handleFabPointerLeave = () => {
    cancelLongPressTimer();
  };

  const handleFabClick = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    if (longPressTriggered.current) {
      event.preventDefault();
      longPressTriggered.current = false;
    }
  };

  const handleFabContextMenu = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    setCommandOpen(true);
  };

  const installMessages = messages.app.install;
  const optInMessages = installMessages?.optIn;
  const handlePwaToggle = useCallback(() => {
    const next = !pwaOptIn;
    setPwaOptIn(next);
    const feedback = next
      ? optInMessages?.on ?? optInMessages?.label
      : optInMessages?.off ?? optInMessages?.label;
    if (feedback) {
      toast.info(feedback);
    }
    void sendTelemetryEvent('pwa_opt_in_toggled', { enabled: next });
  }, [optInMessages, pwaOptIn, setPwaOptIn]);
  const canTogglePwa = clientEnv.NEXT_PUBLIC_ENABLE_PWA && Boolean(optInMessages);
  const outboxAgeLabel = useMemo(() => {
    if (!statusBarMessages || !hasOutbox) {
      return null;
    }
    return formatOutboxAge(stalenessMs, locale, statusBarMessages);
  }, [statusBarMessages, hasOutbox, stalenessMs, locale]);

  return (
    <div className="relative flex min-h-screen bg-slate-950 text-slate-100">
      <a href="#main" className="skip-link">
        {messages.app.skipToContent}
      </a>
      {confidentialMode ? (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-20 bg-slate-950/20 backdrop-blur-sm" />
      ) : null}
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
            <Button
              variant="outline"
              size="sm"
              onClick={handleCommandButton}
              className="hidden items-center gap-2 rounded-full bg-slate-900/60 text-xs font-semibold uppercase tracking-wide text-slate-100 hover:bg-slate-800/60 sm:inline-flex"
            >
              <Command className="h-4 w-4 text-teal-200" aria-hidden />
              {messages.app.commandButton}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCommandButton}
              aria-label={messages.app.commandButton}
              className="sm:hidden"
            >
              <Command className="h-5 w-5" aria-hidden />
            </Button>
            <p className="hidden text-xs text-slate-400 md:block">{messages.app.commandPlaceholder}</p>
        </div>
        <div className="flex items-center gap-3">
          {canTogglePwa ? (
            <Switch
              type="button"
              checked={pwaOptIn}
              disabled={!pwaPreferenceReady}
              onClick={handlePwaToggle}
              label={
                pwaOptIn
                  ? optInMessages?.on ?? optInMessages?.label
                  : optInMessages?.off ?? optInMessages?.label
              }
              className="hidden bg-slate-900/60 text-[11px] sm:inline-flex"
              title={optInMessages?.description}
            />
          ) : null}
          {statusBarMessages && !online ? (
            <span className="hidden items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-200 sm:inline-flex">
              <WifiOff className="h-4 w-4" aria-hidden />
              {statusBarMessages.offline}
            </span>
          ) : null}
          {statusBarMessages && hasOutbox ? (
            <Link
              href={localizedHref('/research#outbox-panel')}
              className="focus-ring hidden items-center gap-2 rounded-full border border-teal-400/40 bg-teal-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-teal-100 shadow-sm transition hover:bg-teal-500/20 sm:flex"
              aria-label={`${statusBarMessages.outbox} (${outboxCount})`}
            >
              <Inbox className="h-4 w-4" aria-hidden />
              <span>{statusBarMessages.outbox}</span>
              <span className="rounded-full bg-teal-400/20 px-2 py-0.5 text-[11px] font-semibold text-teal-50">
                {outboxCount}
              </span>
              {outboxAgeLabel ? (
                <span className="text-[10px] font-normal text-teal-100/80">{outboxAgeLabel}</span>
              ) : null}
            </Link>
          ) : null}
          <Button
            variant={confidentialMode ? 'outline' : 'ghost'}
            size="icon"
            onClick={handleConfidentialToggle}
            aria-pressed={confidentialMode}
              aria-label={confidentialToggleLabel}
              title={confidentialToggleLabel}
              className={cn(confidentialMode ? 'text-amber-200 hover:text-amber-100' : undefined)}
            >
              {confidentialMode ? (
                <ShieldOff className="h-5 w-5" aria-hidden />
              ) : (
                <Shield className="h-5 w-5" aria-hidden />
              )}
            </Button>
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
          {messages.app.compliance ? <ComplianceBanner messages={messages.app.compliance} /> : null}
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
            onPointerDown={handleFabPointerDown}
            onPointerUp={handleFabPointerUp}
            onPointerLeave={handleFabPointerLeave}
            onClick={handleFabClick}
            onContextMenu={handleFabContextMenu}
          >
            <Search className="h-5 w-5" aria-hidden />
          </Link>
        </div>
      </div>
      <CommandPalette
        open={commandOpen}
        onOpenChange={setCommandOpen}
        actions={commandActions}
        messages={messages}
        locale={locale}
      />
      {confidentialMode && confidentialMessages ? (
        <ConfidentialModeBanner
          title={confidentialMessages.title}
          body={confidentialMessages.body}
          cta={confidentialMessages.cta}
        />
      ) : null}
      <PwaInstallPrompt messages={installMessages} locale={locale} />
    </div>
  );
}

function formatOutboxAge(stalenessMs: number, locale: Locale, copy: StatusBarMessages): string {
  if (stalenessMs <= 0) {
    return copy.staleNow;
  }

  const minutes = Math.floor(stalenessMs / 60_000);
  const formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });

  if (minutes < 1) {
    return copy.staleNow;
  }

  if (minutes < 60) {
    return copy.staleMinutes.replace('{count}', formatter.format(minutes));
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return copy.staleHours.replace('{count}', formatter.format(hours));
  }

  const days = Math.floor(hours / 24);
  return copy.staleDays.replace('{count}', formatter.format(days));
}
