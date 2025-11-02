'use client';

import * as React from 'react';

import { cn } from '@avocat-ai/utils';

import { useUiTheme } from './theme.js';

const inputThemeClass: Record<'web' | 'pwa', string> = {
  web: 'flex h-11 w-full rounded-2xl border border-input bg-background/60 px-4 py-3 text-sm text-foreground shadow-inner placeholder:text-muted-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
  pwa: 'flex h-11 w-full rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-text-primary shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)] transition placeholder:text-text-muted/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22D3EE] disabled:cursor-not-allowed disabled:opacity-60',
};

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
  const theme = useUiTheme();
  return <input ref={ref} type={type} className={cn(inputThemeClass[theme], className)} {...props} />;
});
Input.displayName = 'Input';
