'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

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
        'inline-flex items-center gap-3 rounded-full border border-border/60 bg-secondary/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        checked ? 'bg-primary/10 text-primary-foreground' : 'text-muted-foreground',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          'inline-flex h-5 w-9 items-center rounded-full border border-border/40 bg-background transition-colors',
          checked && 'border-transparent bg-primary',
        )}
      >
        <span
          className={cn(
            'ml-0.5 inline-block h-4 w-4 rounded-full bg-muted-foreground transition-transform',
            checked && 'translate-x-3 bg-primary-foreground',
          )}
        />
      </span>
      {label && <span>{label}</span>}
    </button>
  );
}
