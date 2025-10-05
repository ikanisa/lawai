'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useRouter, usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LayoutGrid,
  Search,
  FileText,
  Briefcase,
  BookMarked,
  ShieldCheck,
  Database,
  Settings,
  Lock,
  Wand2,
  Sparkle,
  Shield,
} from 'lucide-react';
import type { Route } from 'next';
import type { Locale, Messages } from '../lib/i18n';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useCommandPalette } from '../state/command-palette';
import { usePlanDrawer } from '../state/plan-drawer';

interface CommandPaletteProps {
  messages: Messages;
  locale: Locale;
}

type CommandGroup = 'navigation' | 'actions';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  group: CommandGroup;
  keywords?: string[];
  icon: React.ComponentType<{ className?: string }>;
  perform: () => void;
  shortcut?: string;
}

function groupLabel(group: CommandGroup, messages: Messages): string {
  if (group === 'actions') return messages.commands.groupActions;
  return messages.commands.groupNavigation;
}

export function CommandPalette({ messages, locale }: CommandPaletteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState('');
  const open = useCommandPalette((state) => state.open);
  const setOpen = useCommandPalette((state) => state.setOpen);
  const togglePlanDrawer = usePlanDrawer((state) => state.toggle);

  useEffect(() => {
    setOpen(false);
    setQuery('');
  }, [pathname, setOpen]);

  const localizedHref = useCallback((href: string) => `/${locale}${href}` as Route, [locale]);

  const commands = useMemo<CommandItem[]>(
    () => [
      {
        id: 'nav-workspace',
        label: messages.commands.workspace,
        description: messages.commands.workspaceDescription,
        group: 'navigation',
        keywords: ['workspace', 'accueil'],
        icon: LayoutGrid,
        perform: () => router.push(localizedHref('/workspace')),
      },
      {
        id: 'nav-research',
        label: messages.commands.research,
        description: messages.commands.researchDescription,
        group: 'navigation',
        keywords: ['recherche', 'search'],
        icon: Search,
        shortcut: locale === 'fr' ? '⌘⌥R' : '⌘⇧R',
        perform: () => router.push(localizedHref('/research')),
      },
      {
        id: 'nav-drafting',
        label: messages.commands.drafting,
        description: messages.commands.draftingDescription,
        group: 'navigation',
        keywords: ['brouillon', 'draft'],
        icon: FileText,
        perform: () => router.push(localizedHref('/drafting')),
      },
      {
        id: 'nav-matters',
        label: messages.commands.matters,
        description: messages.commands.mattersDescription,
        group: 'navigation',
        keywords: ['dossier', 'case'],
        icon: Briefcase,
        perform: () => router.push(localizedHref('/matters')),
      },
      {
        id: 'nav-citations',
        label: messages.commands.citations,
        description: messages.commands.citationsDescription,
        group: 'navigation',
        keywords: ['sources', 'citations'],
        icon: BookMarked,
        perform: () => router.push(localizedHref('/citations')),
      },
      {
        id: 'nav-hitl',
        label: messages.commands.hitl,
        description: messages.commands.hitlDescription,
        group: 'navigation',
        keywords: ['hitl', 'review'],
        icon: ShieldCheck,
        perform: () => router.push(localizedHref('/hitl')),
      },
      {
        id: 'nav-admin',
        label: messages.commands.admin,
        description: messages.commands.adminDescription,
        group: 'navigation',
        keywords: ['admin', 'conformité'],
        icon: Settings,
        perform: () => router.push(localizedHref('/admin')),
      },
      {
        id: 'nav-corpus',
        label: messages.commands.corpus,
        description: messages.commands.corpusDescription,
        group: 'navigation',
        keywords: ['corpus', 'sources'],
        icon: Database,
        perform: () => router.push(localizedHref('/corpus')),
      },
      {
        id: 'nav-trust',
        label: messages.commands.trust,
        description: messages.commands.trustDescription,
        group: 'navigation',
        keywords: ['trust', 'fairness', 'telemetry'],
        icon: Shield,
        perform: () => router.push(localizedHref('/trust')),
      },
      {
        id: 'action-plan',
        label: messages.commands.openPlan,
        description: messages.commands.openPlanDescription,
        group: 'actions',
        keywords: ['plan', 'provenance'],
        icon: Sparkle,
        shortcut: 'P',
        perform: () => togglePlanDrawer(true),
      },
      {
        id: 'action-security',
        label: messages.commands.security,
        description: messages.commands.securityDescription,
        group: 'actions',
        keywords: ['security', 'confidential'],
        icon: Lock,
        perform: () => router.push(localizedHref('/workspace/security')),
      },
      {
        id: 'action-new-draft',
        label: messages.commands.newDraft,
        description: messages.commands.newDraftDescription,
        group: 'actions',
        keywords: ['générer', 'draft'],
        icon: Wand2,
        perform: () => router.push(localizedHref('/drafting')),
      },
    ],
    [messages, router, togglePlanDrawer, locale, localizedHref],
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return commands;
    return commands.filter((command) => {
      if (command.label.toLowerCase().includes(term)) return true;
      if (command.description?.toLowerCase().includes(term)) return true;
      return command.keywords?.some((keyword) => keyword.toLowerCase().includes(term));
    });
  }, [commands, query]);

  const grouped = useMemo(() => {
    return filtered.reduce<Record<CommandGroup, CommandItem[]>>(
      (acc, command) => {
        acc[command.group]?.push(command);
        return acc;
      },
      { navigation: [], actions: [] },
    );
  }, [filtered]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur" />
        <Dialog.Content
          className="glass-card fixed left-1/2 top-24 z-50 w-full max-w-xl -translate-x-1/2 rounded-3xl border border-slate-800/60 bg-slate-950/95 p-6 text-slate-100 shadow-2xl focus:outline-none"
          aria-label={messages.commands.title}
        >
          <div className="space-y-4">
            <div>
              <Dialog.Title className="text-base font-semibold text-slate-100">{messages.commands.title}</Dialog.Title>
              <Dialog.Description className="text-sm text-slate-400">
                {messages.commands.subtitle}
              </Dialog.Description>
            </div>
            <div className="glass-card flex items-center gap-2 rounded-2xl border border-slate-800/60 bg-slate-900/60 px-3 py-2">
              <Search className="h-4 w-4 text-slate-400" aria-hidden />
              <Input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={messages.commands.searchPlaceholder}
                className="border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
                aria-label={messages.commands.searchPlaceholder}
              />
            </div>
            {filtered.length === 0 ? (
              <p className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-4 text-sm text-slate-400">
                {messages.commands.empty}
              </p>
            ) : (
              <div className="space-y-6">
                {(['navigation', 'actions'] as const).map((group) => {
                  const items = grouped[group];
                  if (!items || items.length === 0) return null;
                  return (
                    <section key={group} aria-label={groupLabel(group, messages)} className="space-y-2">
                      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        {groupLabel(group, messages)}
                      </h2>
                      <ul className="space-y-2">
                        {items.map((item) => {
                          const Icon = item.icon;
                          return (
                            <li key={item.id}>
                              <button
                                type="button"
                                onClick={() => {
                                  item.perform();
                                  setOpen(false);
                                  setQuery('');
                                }}
                                className="focus-ring group flex w-full items-center justify-between gap-4 rounded-2xl border border-slate-800/60 bg-slate-900/60 px-4 py-3 text-left text-sm text-slate-200 transition hover:border-teal-400/60 hover:text-teal-100"
                              >
                                <span className="flex items-center gap-3">
                                  <span className="rounded-xl border border-slate-800/60 bg-slate-900/60 p-2 text-teal-200">
                                    <Icon className="h-4 w-4" aria-hidden />
                                  </span>
                                  <span>
                                    <span className="block font-semibold">{item.label}</span>
                                    {item.description ? (
                                      <span className="block text-xs text-slate-400">{item.description}</span>
                                    ) : null}
                                  </span>
                                </span>
                                {item.shortcut ? (
                                  <span className="flex gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                    {item.shortcut.split(' ').map((part) => (
                                      <kbd
                                        key={part}
                                        className="rounded border border-slate-700/60 bg-slate-900/80 px-2 py-1"
                                      >
                                        {part}
                                      </kbd>
                                    ))}
                                  </span>
                                ) : null}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  );
                })}
              </div>
            )}
            <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-500">
              <span className="flex items-center gap-2">
                <kbd className="rounded border border-slate-700/60 bg-slate-900/80 px-2 py-1">Esc</kbd>
                {messages.commands.pressEsc}
              </span>
              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => setOpen(false)}>
                {messages.commands.close}
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
