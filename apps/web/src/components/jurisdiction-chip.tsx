'use client';

import { BadgeCheck } from 'lucide-react';
import { Badge } from '@avocat-ai/ui';
import { cn } from '@/lib/utils';

type BadgeVariant = 'default' | 'success' | 'warning' | 'outline';

export interface JurisdictionChipProps {
  code: string;
  label: string;
  badges?: Array<{ label: string; variant?: BadgeVariant }>;
  onClick?: () => void;
}

export function JurisdictionChip({ code, label, badges = [], onClick }: JurisdictionChipProps) {
  const primaryDescriptor = badges.length > 0 ? badges[0]?.label : 'National';

  return (
    <button
      onClick={onClick}
      className={cn(
        'focus-ring inline-flex w-full items-center gap-2 rounded-full border border-slate-600/70 bg-slate-900/50 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-slate-400/80 hover:text-white',
      )}
      aria-label={`Sélectionner ${label}`}
      type="button"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800/70 text-sm font-semibold">
        {code}
      </span>
      <span className="text-left">
        <span className="block text-xs uppercase tracking-wide text-slate-400">{label}</span>
        <span className="flex items-center gap-1 text-xs text-slate-300">
          <BadgeCheck className="h-3 w-3" aria-hidden />
          {primaryDescriptor}
        </span>
      </span>
      <div className="ml-auto flex flex-wrap gap-2">
        {badges.map((badge) => (
          <Badge key={`${code}-${badge.label}`} variant={badge.variant ?? 'outline'}>
            {badge.label}
          </Badge>
        ))}
      </div>
    </button>
  );
}
