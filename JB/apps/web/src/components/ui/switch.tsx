'use client';

import * as React from 'react';
import { cn } from '../../lib/utils';

export interface SwitchProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  checked?: boolean;
  label?: string;
}

export function Switch({ checked, label, className, ...props }: SwitchProps) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      className={cn(
        'focus-ring inline-flex items-center gap-2 rounded-full border border-slate-600/70 bg-slate-900/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide',
        checked ? 'border-teal-400/80 text-teal-200' : 'text-slate-300',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          'inline-flex h-4 w-7 items-center rounded-full bg-slate-700 transition',
          checked && 'bg-teal-400/70',
        )}
      >
        <span
          className={cn(
            'ml-0.5 inline-block h-3 w-3 rounded-full bg-slate-300 transition',
            checked && 'translate-x-3 bg-slate-900/90',
          )}
        />
      </span>
      {label && <span>{label}</span>}
    </button>
  );
}
