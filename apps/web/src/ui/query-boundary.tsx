'use client';

import { Suspense, type ReactNode } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useQueryErrorResetBoundary } from '@tanstack/react-query';

import { Button } from '@/ui/button';

interface QueryBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
  errorFallback: ReactNode | ((error: Error, reset: () => void) => ReactNode);
}

export function QueryBoundary({ children, fallback, errorFallback }: QueryBoundaryProps) {
  const { reset } = useQueryErrorResetBoundary();

  return (
    <ErrorBoundary
      onReset={reset}
      fallbackRender={({ error, resetErrorBoundary }) =>
        typeof errorFallback === 'function' ? (
          errorFallback(error as Error, resetErrorBoundary)
        ) : (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 rounded-3xl border border-destructive/40 bg-destructive/10 p-6 text-center text-sm text-destructive-foreground">
            {errorFallback}
            <Button variant="destructive" onClick={() => resetErrorBoundary()}>
              Try again
            </Button>
          </div>
        )
      }
    >
      <Suspense fallback={fallback}>{children}</Suspense>
    </ErrorBoundary>
  );
}
