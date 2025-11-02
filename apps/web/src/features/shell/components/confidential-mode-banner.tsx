'use client';

import { ShieldAlert } from 'lucide-react';
import { Button } from '@avocat-ai/ui';
import { useConfidentialMode } from '@/state/confidential-mode';

interface ConfidentialModeBannerProps {
  title: string;
  body: string;
  cta: string;
}

export function ConfidentialModeBanner({ title, body, cta }: ConfidentialModeBannerProps) {
  const setEnabled = useConfidentialMode((state) => state.setEnabled);

  return (
    <div
      className="pointer-events-auto glass-card fixed bottom-28 left-1/2 z-50 w-[min(92%,24rem)] -translate-x-1/2 border border-warning/40 p-5 text-sm text-foreground shadow-2xl backdrop-blur"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <span className="rounded-2xl bg-warning/20 p-2 text-warning-foreground">
          <ShieldAlert className="h-5 w-5" aria-hidden />
        </span>
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{body}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setEnabled(false)}>
            {cta}
          </Button>
        </div>
      </div>
    </div>
  );
}
