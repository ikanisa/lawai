'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@avocat-ai/utils';

export interface SpinnerProps extends React.ComponentProps<typeof Loader2> {
    className?: string;
}

export function Spinner({ className, ...props }: SpinnerProps) {
    return <Loader2 className={cn('h-4 w-4 animate-spin', className)} {...props} />;
}
