'use client';

import { useState } from 'react';
import { Info } from 'lucide-react';
import { Button } from './ui/button';

export interface BilingualToggleMessages {
  label: string;
  fr: string;
  en: string;
  note: string;
}

interface BilingualToggleProps {
  messages: BilingualToggleMessages;
  onSelect?: (language: 'fr' | 'en') => void;
}

export function BilingualToggle({ messages, onSelect }: BilingualToggleProps) {
  const [language, setLanguage] = useState<'fr' | 'en'>('fr');

  function handleSelect(next: 'fr' | 'en') {
    setLanguage(next);
    onSelect?.(next);
  }

  return (
    <section className="glass-card space-y-3 rounded-2xl border border-slate-700/60 p-4 text-slate-200">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-100">{messages.label}</p>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={language === 'fr' ? 'default' : 'outline'}
            onClick={() => handleSelect('fr')}
          >
            {messages.fr}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={language === 'en' ? 'default' : 'outline'}
            onClick={() => handleSelect('en')}
          >
            {messages.en}
          </Button>
        </div>
      </header>
      <div className="flex items-start gap-2 text-xs text-slate-300">
        <Info className="mt-0.5 h-4 w-4" aria-hidden />
        <p>{messages.note}</p>
      </div>
    </section>
  );
}
