'use client';

import * as React from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';

import { cn } from '@avocat-ai/utils';

import { useUiTheme } from './theme.js';

export interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked?: boolean;
  defaultChecked?: boolean;
  label?: React.ReactNode;
  onCheckedChange?: (checked: boolean) => void;
}

export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, checked, defaultChecked, onCheckedChange, label, onClick, ...rest }, ref) => {
    const theme = useUiTheme();

    if (theme === 'pwa') {
      const rootClass = cn(
        'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-white/15 bg-white/10 p-1 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22D3EE] data-[state=checked]:bg-gradient-primary',
        className,
      );

      return (
        <span className={cn('inline-flex items-center gap-2', label ? '' : '')}>
          <SwitchPrimitive.Root
            ref={ref as React.Ref<HTMLButtonElement>}
            className={rootClass}
            checked={checked}
            defaultChecked={defaultChecked}
            onCheckedChange={onCheckedChange}
            {...rest}
          >
            <SwitchPrimitive.Thumb
              className="block h-4 w-4 rounded-full bg-white shadow-[var(--shadow-z1)] transition data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
            />
          </SwitchPrimitive.Root>
          {label ? <span className="text-sm text-text-primary">{label}</span> : null}
        </span>
      );
    }

    const handleClick: React.MouseEventHandler<HTMLButtonElement> = (event) => {
      onClick?.(event);
      if (!event.defaultPrevented && typeof checked === 'boolean') {
        onCheckedChange?.(!checked);
      }
    };

    return (
      <button
        ref={ref}
        role="switch"
        aria-checked={checked}
        className={cn(
          'inline-flex items-center gap-3 rounded-full border border-border/60 bg-secondary/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          checked ? 'bg-primary/10 text-primary-foreground' : 'text-muted-foreground',
          className,
        )}
        onClick={handleClick}
        {...rest}
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
        {label ? <span>{label}</span> : null}
      </button>
    );
  },
);
Switch.displayName = 'Switch';
