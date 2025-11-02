'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';

import { cn } from '@avocat-ai/utils';

import { useUiTheme } from './theme.js';

type ButtonVariant = 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'subtle' | 'glass';
type ButtonSize = 'default' | 'sm' | 'xs' | 'lg' | 'icon';

const webButtonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
        outline: 'border border-border bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
        subtle: 'bg-muted text-muted-foreground hover:bg-muted/80',
        glass: 'border border-border/70 bg-background/40 text-foreground hover:bg-background/60',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 px-3 text-xs',
        xs: 'h-8 px-3 text-xs',
        lg: 'h-12 px-5 text-base',
        icon: 'h-10 w-10 rounded-full',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

const pwaButtonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-full text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-60',
  {
    variants: {
      variant: {
        default: 'bg-gradient-primary text-[#0B1220] shadow-[var(--shadow-z2)] focus-visible:outline-[#22D3EE]',
        secondary: 'bg-white/10 text-text-primary border border-white/20 shadow-[var(--shadow-z1)] focus-visible:outline-white/60',
        outline: 'border border-white/20 bg-transparent text-text-primary hover:bg-white/10 focus-visible:outline-white/60',
        ghost: 'text-text-primary hover:bg-white/10 focus-visible:outline-white/60',
        destructive: 'bg-rose-500/90 text-white shadow-[var(--shadow-z2)] hover:bg-rose-500 focus-visible:outline-rose-300',
        subtle: 'bg-white/5 text-white/80 focus-visible:outline-white/40',
        glass: 'glass-panel text-text-primary backdrop-blur-2xl focus-visible:outline-white/60 border border-white/20',
      },
      size: {
        default: 'px-5 py-2.5',
        sm: 'px-3 py-2 text-xs',
        xs: 'px-3 py-2 text-xs',
        lg: 'px-6 py-3 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', asChild = false, ...props }, ref) => {
    const theme = useUiTheme();
    const Comp = asChild ? Slot : 'button';
    const variants = theme === 'pwa' ? pwaButtonVariants : webButtonVariants;
    return <Comp ref={ref} className={cn(variants({ variant, size }), className)} {...props} />;
  },
);
Button.displayName = 'Button';
