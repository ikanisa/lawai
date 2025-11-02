'use client';

import * as React from 'react';
import { cva } from 'class-variance-authority';

import { cn } from '@avocat-ai/utils';

import { useUiTheme } from './theme.js';

type BadgeVariant = 'default' | 'outline' | 'secondary' | 'success' | 'warning' | 'danger';

const webBadgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide shadow-sm',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-accent text-accent-foreground',
        success: 'border-transparent bg-success/15 text-success-foreground',
        warning: 'border-transparent bg-warning/15 text-warning-foreground',
        danger: 'border-transparent bg-destructive/10 text-destructive-foreground',
        outline: 'border-border text-foreground',
        secondary: 'border-transparent bg-muted text-muted-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

const pwaBadgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium uppercase tracking-wide',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-white/15 text-text-primary',
        outline: 'border-white/40 text-text-primary',
        secondary: 'border-white/20 bg-white/10 text-white/80',
        success: 'border-success/30 bg-success/10 text-success',
        warning: 'border-warning/30 bg-warning/10 text-warning',
        danger: 'border-error/30 bg-error/10 text-error',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const theme = useUiTheme();
  const variants = theme === 'pwa' ? pwaBadgeVariants : webBadgeVariants;
  return <span className={cn(variants({ variant }), className)} {...props} />;
}
