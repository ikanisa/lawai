'use client';

import { useState } from 'react';
import { Info } from 'lucide-react';
import { Button } from '@/ui/button';

export interface RwandaLanguageMessages {
  label: string;
  description?: string;
  note: string;
  languages: {
    fr: string;
    en: string;
    rw: string;
  };
}

interface RwandaLanguageTriageProps {
  messages: RwandaLanguageMessages;
  onSelect?: (language: 'fr' | 'en' | 'rw') => void;
}

export function RwandaLanguageTriage({ messages, onSelect }: RwandaLanguageTriageProps) {
  const [language, setLanguage] = useState<'fr' | 'en' | 'rw'>('fr');

  function handleSelect(next: 'fr' | 'en' | 'rw') {
    setLanguage(next);
    onSelect?.(next);
  }

  return (
    <section className="glass-card space-y-3 rounded-2xl border border-slate-700/60 p-4 text-slate-200">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-100">{messages.label}</p>
          {messages.description ? (
            <p className="text-xs text-slate-300">{messages.description}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={language === 'fr' ? 'default' : 'outline'}
            onClick={() => handleSelect('fr')}
          >
            {messages.languages.fr}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={language === 'en' ? 'default' : 'outline'}
            onClick={() => handleSelect('en')}
          >
            {messages.languages.en}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={language === 'rw' ? 'default' : 'outline'}
            onClick={() => handleSelect('rw')}
          >
            {messages.languages.rw}
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
