'use client';

import { AnchorHTMLAttributes } from 'react';
import clsx from 'clsx';

export function SkipLink({ className, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a {...props} className={clsx('skip-link', className)} />;
}
