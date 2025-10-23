'use client';

interface SpinnerProps {
  label?: string;
}

export function Spinner({ label }: SpinnerProps) {
  return (
    <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary/40 border-t-primary" aria-hidden />
      {label && <span>{label}</span>}
    </div>
  );
}
