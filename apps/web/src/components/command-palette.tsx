'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Search, ArrowUpRight, Command as CommandIcon } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import type { Messages, Locale } from '../lib/i18n';
import { sendTelemetryEvent } from '../lib/api';

export interface CommandPaletteAction {
  id: string;
  label: string;
  description?: string;
  href?: string;
  section: 'navigate' | 'actions';
  shortcut?: string;
  run?: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: Locale;
  messages: Messages;
  actions: CommandPaletteAction[];
}

const sectionOrder: Array<CommandPaletteAction['section']> = ['actions', 'navigate'];

function isTypingElement(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
}

export function CommandPalette({ open, onOpenChange, locale, messages, actions }: CommandPaletteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      const slashShortcut = event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey;
      const commandShortcut =
        (event.key === 'k' || event.key === 'p') && (event.metaKey || event.ctrlKey);
      if (slashShortcut || commandShortcut) {
        if (isTypingElement(event.target)) {
          return;
        }
        event.preventDefault();
        onOpenChange(true);
      }
    }
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [onOpenChange]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      inputRef.current?.focus();
      void sendTelemetryEvent('command_palette_opened');
    }
  }, [open]);

  const filteredActions = useMemo(() => {
    if (!query.trim()) {
      return actions;
    }
    const searchValue = query.toLowerCase();
    return actions.filter((action) => {
      const value = `${action.label} ${action.description ?? ''}`.toLowerCase();
      return value.includes(searchValue);
    });
  }, [actions, query]);

  const groupedActions = useMemo(
    () =>
      sectionOrder
        .map((section) => ({ section, items: filteredActions.filter((action) => action.section === section) }))
        .filter(({ items }) => items.length > 0),
    [filteredActions],
  );

  const flattenedActions = useMemo(
    () => groupedActions.flatMap((group) => group.items.map((action) => ({ action, section: group.section }))),
    [groupedActions],
  );

  useEffect(() => {
    if (activeIndex >= flattenedActions.length) {
      setActiveIndex(flattenedActions.length > 0 ? flattenedActions.length - 1 : 0);
    }
  }, [activeIndex, flattenedActions.length]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, filteredActions.length]);

  const handleSelect = useCallback(
    (action: CommandPaletteAction) => {
      onOpenChange(false);
      void sendTelemetryEvent('command_palette_action', { actionId: action.id });
      if (action.run) {
        action.run();
      }
      if (action.href) {
        const localized = `/${locale}${action.href}`;
        if (pathname !== localized) {
          router.push(localized);
        }
      }
    },
    [locale, onOpenChange, pathname, router],
  );

  const handleInputKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (flattenedActions.length === 0) {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
        }
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((prev) => (prev + 1) % flattenedActions.length);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((prev) => (prev - 1 + flattenedActions.length) % flattenedActions.length);
      } else if (event.key === 'Home') {
        event.preventDefault();
        setActiveIndex(0);
      } else if (event.key === 'End') {
        event.preventDefault();
        setActiveIndex(flattenedActions.length - 1);
      } else if (event.key === 'Enter') {
        const selected = flattenedActions[activeIndex];
        if (selected) {
          event.preventDefault();
          handleSelect(selected.action);
        }
      }
    },
    [activeIndex, flattenedActions, handleSelect],
  );

  const labels = messages.app.commandPalette;
  const listboxId = 'command-palette-options';
  const keyboardHintId = 'command-palette-hint';
  const activeOption = flattenedActions[activeIndex];
  const activeOptionId = activeOption ? `command-option-${activeOption.action.id}` : undefined;
  const resultsCount = flattenedActions.length;
  let optionOffset = -1;
  const renderedGroups = groupedActions.map(({ section, items }) => (
    <div key={section} role="group" aria-label={labels.sections[section]}>
      <p className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {labels.sections[section]}
      </p>
      <ul className="mt-1 space-y-1" role="presentation">
        {items.map((action) => {
          optionOffset += 1;
          const currentIndex = optionOffset;
          const optionId = `command-option-${action.id}`;
          const isActive = currentIndex === activeIndex;
          return (
            <li key={action.id} role="presentation">
              <button
                type="button"
                id={optionId}
                role="option"
                aria-selected={isActive}
                tabIndex={-1}
                data-active={isActive ? 'true' : undefined}
                onMouseEnter={() => setActiveIndex(currentIndex)}
                onFocus={() => setActiveIndex(currentIndex)}
                onClick={() => handleSelect(action)}
                className={cn(
                  'focus-ring flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left text-sm transition',
                  'bg-slate-900/60 text-slate-100 hover:bg-slate-800 hover:text-white',
                  isActive && 'ring-2 ring-teal-300/60 hover:bg-slate-800',
                )}
              >
                <div>
                  <p className="font-semibold">{action.label}</p>
                  {action.description ? <p className="text-xs text-slate-400">{action.description}</p> : null}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  {action.shortcut ? <span>{action.shortcut}</span> : null}
                  {action.href ? (
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <CommandIcon className="h-3.5 w-3.5" aria-hidden />
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  ));

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm" />
        <Dialog.Content
          className="glass-card fixed inset-x-4 top-[10vh] z-50 mx-auto max-w-2xl rounded-3xl border border-slate-800/80 p-4 shadow-2xl"
          aria-label={labels.title}
        >
          <div className="flex items-center gap-3 border-b border-slate-800/60 pb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900/80">
              <CommandIcon className="h-5 w-5 text-teal-200" aria-hidden />
            </div>
            <div className="flex-1">
              <Dialog.Title className="text-sm font-semibold text-slate-100">{labels.title}</Dialog.Title>
              <Dialog.Description className="text-xs text-slate-400" id="command-palette-description">
                {labels.subtitle}
              </Dialog.Description>
            </div>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} aria-label={labels.close}>
              ×
            </Button>
          </div>
          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-slate-900/60 px-4 py-3">
            <Search className="h-4 w-4 text-slate-500" aria-hidden />
            <Input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={labels.placeholder}
              role="combobox"
              aria-expanded={open}
              aria-haspopup="listbox"
              aria-controls={listboxId}
              aria-describedby={`command-palette-description ${keyboardHintId}`}
              aria-activedescendant={activeOptionId}
              onKeyDown={handleInputKeyDown}
              className="flex-1 border-none bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
            />
            <kbd className="rounded-md bg-slate-800 px-2 py-1 text-[10px] uppercase text-slate-400">/</kbd>
          </div>
          <div className="mt-2 text-xs text-slate-500" id={keyboardHintId}>
            {labels.keyboardHint}
          </div>
          <div className="mt-3 max-h-[50vh] overflow-y-auto" role="presentation">
            <div className="sr-only" aria-live="polite" role="status">
              {labels.resultsCount.replace('{count}', resultsCount.toString())}
            </div>
            {groupedActions.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-slate-400">{labels.empty}</p>
            ) : (
              <div id={listboxId} role="listbox" aria-label={labels.title} className="space-y-3">
                {renderedGroups}
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
