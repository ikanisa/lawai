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
      className="pointer-events-auto glass-card fixed bottom-28 left-1/2 z-50 w-[min(92%,24rem)] -translate-x-1/2 border border-amber-400/40 p-5 text-sm text-slate-100 shadow-2xl backdrop-blur"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <span className="rounded-2xl bg-amber-400/20 p-2 text-amber-200">
          <ShieldAlert className="h-5 w-5" aria-hidden />
        </span>
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-white">{title}</p>
            <p className="mt-1 text-slate-200">{body}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setEnabled(false)}>
            {cta}
          </Button>
        </div>
      </div>
    </div>
  );
}
