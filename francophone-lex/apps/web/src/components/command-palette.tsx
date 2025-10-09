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
  Upload,
  Globe2,
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
  const sections = messages.app.commandPalette.sections;
  return group === 'actions' ? sections.actions : sections.navigate;
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

  const paletteMessages = messages.app.commandPalette;

  const formatNavigateDescription = useCallback(
    (destination: string) => paletteMessages.navigateTo.replace('{destination}', destination),
    [paletteMessages.navigateTo],
  );

  const commands = useMemo<CommandItem[]>(() => {
    const navCommands: CommandItem[] = [
      {
        id: 'nav-workspace',
        label: messages.nav.workspace,
        description: formatNavigateDescription(messages.nav.workspace),
        group: 'navigation',
        keywords: ['workspace', 'accueil'],
        icon: LayoutGrid,
        perform: () => router.push(localizedHref('/workspace')),
      },
      {
        id: 'nav-research',
        label: messages.nav.research,
        description: formatNavigateDescription(messages.nav.research),
        group: 'navigation',
        keywords: ['recherche', 'search'],
        icon: Search,
        shortcut: locale === 'fr' ? '⌘⌥R' : '⌘⇧R',
        perform: () => router.push(localizedHref('/research')),
      },
      {
        id: 'nav-drafting',
        label: messages.nav.drafting,
        description: formatNavigateDescription(messages.nav.drafting),
        group: 'navigation',
        keywords: ['brouillon', 'draft'],
        icon: FileText,
        perform: () => router.push(localizedHref('/drafting')),
      },
      {
        id: 'nav-matters',
        label: messages.nav.matters,
        description: formatNavigateDescription(messages.nav.matters),
        group: 'navigation',
        keywords: ['dossier', 'case'],
        icon: Briefcase,
        perform: () => router.push(localizedHref('/matters')),
      },
      {
        id: 'nav-citations',
        label: messages.nav.citations,
        description: formatNavigateDescription(messages.nav.citations),
        group: 'navigation',
        keywords: ['sources', 'citations'],
        icon: BookMarked,
        perform: () => router.push(localizedHref('/citations')),
      },
      {
        id: 'nav-hitl',
        label: messages.nav.hitl,
        description: formatNavigateDescription(messages.nav.hitl),
        group: 'navigation',
        keywords: ['hitl', 'review'],
        icon: ShieldCheck,
        perform: () => router.push(localizedHref('/hitl')),
      },
      {
        id: 'nav-admin',
        label: messages.nav.admin,
        description: formatNavigateDescription(messages.nav.admin),
        group: 'navigation',
        keywords: ['admin', 'conformité'],
        icon: Settings,
        perform: () => router.push(localizedHref('/admin')),
      },
      {
        id: 'nav-corpus',
        label: messages.nav.corpus,
        description: formatNavigateDescription(messages.nav.corpus),
        group: 'navigation',
        keywords: ['corpus', 'sources'],
        icon: Database,
        perform: () => router.push(localizedHref('/corpus')),
      },
      {
        id: 'nav-trust',
        label: messages.nav.trust,
        description: formatNavigateDescription(messages.nav.trust),
        group: 'navigation',
        keywords: ['trust', 'governance'],
        icon: Globe2,
        perform: () => router.push(localizedHref('/trust')),
      },
    ];

    const actionDefinitions: Array<{
      id: string;
      key: keyof typeof paletteMessages.actions;
      icon: React.ComponentType<{ className?: string }>;
      perform: () => void;
      keywords: string[];
      shortcut?: string;
    }> = [
      {
        id: 'action-new-research',
        key: 'newResearch',
        icon: Search,
        keywords: ['nouvelle', 'question'],
        perform: () => router.push(localizedHref('/research')),
        shortcut: '⌘K',
      },
      {
        id: 'action-upload',
        key: 'upload',
        icon: Upload,
        keywords: ['upload', 'ingest'],
        perform: () => router.push(localizedHref('/corpus')),
      },
      {
        id: 'action-open-workspace',
        key: 'openWorkspace',
        icon: LayoutGrid,
        keywords: ['workspace', 'home'],
        perform: () => router.push(localizedHref('/workspace')),
      },
      {
        id: 'action-open-drafting',
        key: 'openDrafting',
        icon: FileText,
        keywords: ['drafting', 'clauses'],
        perform: () => router.push(localizedHref('/drafting')),
      },
      {
        id: 'action-open-matters',
        key: 'openMatters',
        icon: Briefcase,
        keywords: ['matters', 'cases'],
        perform: () => router.push(localizedHref('/matters')),
      },
      {
        id: 'action-open-citations',
        key: 'openCitations',
        icon: BookMarked,
        keywords: ['sources', 'citations'],
        perform: () => router.push(localizedHref('/citations')),
      },
      {
        id: 'action-open-hitl',
        key: 'openHitl',
        icon: ShieldCheck,
        keywords: ['hitl', 'review'],
        perform: () => router.push(localizedHref('/hitl')),
      },
      {
        id: 'action-open-corpus',
        key: 'openCorpus',
        icon: Database,
        keywords: ['corpus', 'sources'],
        perform: () => router.push(localizedHref('/corpus')),
      },
      {
        id: 'action-open-admin',
        key: 'openAdmin',
        icon: Settings,
        keywords: ['admin', 'policies'],
        perform: () => router.push(localizedHref('/admin')),
      },
      {
        id: 'action-open-trust',
        key: 'openTrust',
        icon: Globe2,
        keywords: ['trust', 'transparency'],
        perform: () => router.push(localizedHref('/trust')),
      },
      {
        id: 'action-plan',
        key: 'openPlan',
        icon: Sparkle,
        keywords: ['plan', 'provenance'],
        perform: () => togglePlanDrawer(true),
        shortcut: 'P',
      },
      {
        id: 'action-security',
        key: 'security',
        icon: Lock,
        keywords: ['security', 'confidential'],
        perform: () => router.push(localizedHref('/workspace/security')),
      },
      {
        id: 'action-new-draft',
        key: 'newDraft',
        icon: Wand2,
        keywords: ['générer', 'draft'],
        perform: () => router.push(localizedHref('/drafting')),
      },
    ];

    const quickActions = actionDefinitions
      .map((definition) => {
        const actionMessage = paletteMessages.actions[definition.key];
        if (!actionMessage) {
          return null;
        }
        return {
          id: definition.id,
          label: actionMessage.label,
          description: actionMessage.description,
          group: 'actions' as CommandGroup,
          keywords: definition.keywords,
          icon: definition.icon,
          perform: definition.perform,
          shortcut: definition.shortcut,
        } satisfies CommandItem;
      })
      .filter((item): item is CommandItem => Boolean(item));

    return [...navCommands, ...quickActions];
  }, [
    paletteMessages.actions,
    formatNavigateDescription,
    messages.nav,
    router,
    localizedHref,
    locale,
    togglePlanDrawer,
  ]);

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
          aria-label={paletteMessages.title}
        >
          <div className="space-y-4">
            <div>
              <Dialog.Title className="text-base font-semibold text-slate-100">{paletteMessages.title}</Dialog.Title>
              <Dialog.Description className="text-sm text-slate-400">
                {paletteMessages.subtitle}
              </Dialog.Description>
            </div>
            <div className="glass-card flex items-center gap-2 rounded-2xl border border-slate-800/60 bg-slate-900/60 px-3 py-2">
              <Search className="h-4 w-4 text-slate-400" aria-hidden />
              <Input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={paletteMessages.placeholder}
                className="border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
                aria-label={paletteMessages.placeholder}
              />
            </div>
            {filtered.length === 0 ? (
              <p className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-4 text-sm text-slate-400">
                {paletteMessages.empty}
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
              <span>{messages.app.commandPlaceholder}</span>
              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => setOpen(false)}>
                {paletteMessages.close}
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
