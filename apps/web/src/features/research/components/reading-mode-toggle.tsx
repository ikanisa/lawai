'use client';

import { Button } from '@/ui/button';
import { cn } from '@/lib/utils';

export type ReadingMode = 'research' | 'brief' | 'evidence';

interface ReadingModeToggleProps {
  mode: ReadingMode;
  onChange: (mode: ReadingMode) => void;
  labels: {
    label: string;
    research: string;
    brief: string;
    evidence: string;
  };
  descriptions?: Partial<Record<ReadingMode, string>>;
}

const MODES: ReadingMode[] = ['research', 'brief', 'evidence'];

export function ReadingModeToggle({ mode, onChange, labels, descriptions }: ReadingModeToggleProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{labels.label}</p>
        {descriptions && descriptions[mode] ? (
          <p className="text-xs text-slate-400">{descriptions[mode]}</p>
        ) : null}
      </div>
      <div
        role="radiogroup"
        aria-label={labels.label}
        className="glass-card inline-flex gap-1 rounded-2xl border border-slate-800/60 bg-slate-900/60 p-1"
      >
        {MODES.map((value) => (
          <Button
            key={value}
            type="button"
            role="radio"
            aria-checked={mode === value}
            variant={mode === value ? 'default' : 'ghost'}
            size="sm"
            className={cn(
              'rounded-2xl px-3 text-xs font-semibold uppercase tracking-wide transition',
              mode === value
                ? 'bg-grad-1 text-slate-900 shadow-lg'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white',
            )}
            onClick={() => {
              if (mode !== value) {
                onChange(value);
              }
            }}
          >
            {labels[value]}
          </Button>
        ))}
      </div>
    </div>
  );
}
