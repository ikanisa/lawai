'use client';

import { useEffect, useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import { Button } from './ui/button';

export interface BilingualToggleLanguage {
  code: string;
  label: string;
}

export interface BilingualToggleMessages {
  label: string;
  note: string;
  languages: BilingualToggleLanguage[];
}

interface BilingualToggleProps {
  messages: BilingualToggleMessages;
  onSelect?: (language: string) => void;
}

export function BilingualToggle({ messages, onSelect }: BilingualToggleProps) {
  const availableLanguages = useMemo(() => messages.languages ?? [], [messages.languages]);
  const [language, setLanguage] = useState(() => availableLanguages[0]?.code ?? '');

  useEffect(() => {
    if (availableLanguages.length === 0) {
      setLanguage('');
      return;
    }
    if (!availableLanguages.some((item) => item.code === language)) {
      setLanguage(availableLanguages[0]?.code ?? '');
    }
  }, [availableLanguages, language]);

  function handleSelect(next: string) {
    setLanguage(next);
    onSelect?.(next);
  }

  if (availableLanguages.length === 0) {
    return null;
  }

  return (
    <section className="glass-card space-y-3 rounded-2xl border border-slate-700/60 p-4 text-slate-200">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-100">{messages.label}</p>
        <div className="flex gap-2">
          {availableLanguages.map((item) => (
            <Button
              key={item.code}
              type="button"
              size="sm"
              variant={language === item.code ? 'default' : 'outline'}
              onClick={() => handleSelect(item.code)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </header>
      <div className="flex items-start gap-2 text-xs text-slate-300">
        <Info className="mt-0.5 h-4 w-4" aria-hidden />
        <p>{messages.note}</p>
      </div>
    </section>
  );
}
