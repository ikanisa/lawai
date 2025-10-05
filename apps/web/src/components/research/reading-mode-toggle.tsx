'use client';

import { ReadingMode } from '../../hooks/use-reading-mode';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

interface ReadingModeToggleProps {
  mode: ReadingMode;
  onModeChange: (mode: ReadingMode) => void;
  messages: {
    label: string;
    research: string;
    brief: string;
    evidence: string;
    helper: string;
  };
}

const OPTIONS: Array<{ value: ReadingMode; key: keyof ReadingModeToggleProps['messages'] }> = [
  { value: 'research', key: 'research' },
  { value: 'brief', key: 'brief' },
  { value: 'evidence', key: 'evidence' },
];

export function ReadingModeToggle({ mode, onModeChange, messages }: ReadingModeToggleProps) {
  return (
    <div className="glass-card rounded-3xl border border-slate-800/60 p-4 shadow-lg">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-200">{messages.label}</p>
          <p className="text-xs text-slate-400">{messages.helper}</p>
        </div>
        <div role="radiogroup" aria-label={messages.label} className="flex rounded-full border border-slate-700/60 bg-slate-900/60 p-1">
          {OPTIONS.map((option) => {
            const label = messages[option.key];
            const selected = mode === option.value;
            return (
              <Button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                variant="ghost"
                size="sm"
                className={cn(
                  'px-4 text-xs font-semibold uppercase tracking-wide transition',
                  selected
                    ? 'rounded-full border border-teal-300/60 bg-teal-500/20 text-teal-100 shadow'
                    : 'rounded-full text-slate-300 hover:text-white',
                )}
                onClick={() => onModeChange(option.value)}
              >
                {label}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

