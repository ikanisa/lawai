"use client";

import { useMemo } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from '@avocat-ai/ui';
import { cn } from "@/lib/utils";

interface OutboxStatusChipProps {
  queued: number;
  stalenessMs: number;
  isOnline: boolean;
  onRetry?: () => void;
}

export function OutboxStatusChip({ queued, stalenessMs, isOnline, onRetry }: OutboxStatusChipProps) {
  const label = useMemo(() => {
    if (!queued) {
      return isOnline ? "Synchro à jour" : "Hors ligne";
    }
    const minutes = Math.max(1, Math.round(stalenessMs / 60000));
    return `${queued} en attente · ${minutes} min`;
  }, [isOnline, queued, stalenessMs]);

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium backdrop-blur",
        queued
          ? "border-amber-300/40 bg-amber-500/15 text-amber-100"
          : isOnline
            ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-100"
            : "border-sky-300/30 bg-sky-500/10 text-sky-100"
      )}
      role="status"
      aria-live="polite"
    >
      <AlertTriangle className={cn("h-3.5 w-3.5", queued ? "text-amber-200" : "text-sky-200")} aria-hidden />
      <span>{label}</span>
      {queued && onRetry ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-1 h-5 rounded-full border border-white/20 bg-white/10 px-2 py-0 text-[10px] text-white hover:bg-white/20"
          onClick={onRetry}
        >
          <RefreshCw className="mr-1 h-3 w-3" aria-hidden />
          Relancer
        </Button>
      ) : null}
    </div>
  );
}
