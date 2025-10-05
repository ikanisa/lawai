'use client';

import { useState } from 'react';
import { Info } from 'lucide-react';
import { Button } from './ui/button';

export interface BilingualToggleMessages {
  label: string;
  note: string;
  languages: Array<{ code: string; label: string }>;
}

interface BilingualToggleProps {
  messages: BilingualToggleMessages;
  onSelect?: (language: string) => void;
}

export function BilingualToggle({ messages, onSelect }: BilingualToggleProps) {
  const [language, setLanguage] = useState<string>(messages.languages[0]?.code ?? 'fr');

  function handleSelect(next: string) {
    setLanguage(next);
    onSelect?.(next);
  }

  return (
    <section className="glass-card space-y-3 rounded-2xl border border-slate-700/60 p-4 text-slate-200">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-100">{messages.label}</p>
        <div className="flex flex-wrap gap-2">
          {messages.languages.map((option) => (
            <Button
              key={option.code}
              type="button"
              size="sm"
              variant={language === option.code ? 'default' : 'outline'}
              onClick={() => handleSelect(option.code)}
            >
              {option.label}
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
