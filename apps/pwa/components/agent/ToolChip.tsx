"use client";

import { motion } from "framer-motion";
import { Check, Loader2, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";

export type ToolChipStatus = "running" | "success" | "error";

interface ToolChipProps {
  name: string;
  status: ToolChipStatus;
  description?: string;
}

export function ToolChip({ name, status, description }: ToolChipProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium backdrop-blur",
        status === "running" && "border-sky-400/40 bg-sky-400/10 text-sky-200",
        status === "success" && "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
        status === "error" && "border-red-400/40 bg-red-400/10 text-red-200"
      )}
      role="status"
      aria-live="polite"
    >
      {status === "running" && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
      {status === "success" && <Check className="h-3.5 w-3.5" aria-hidden />}
      {status === "error" && <TriangleAlert className="h-3.5 w-3.5" aria-hidden />}
      <span>{name}</span>
      {description ? <span className="text-[11px] text-white/60">· {description}</span> : null}
    </motion.div>
  );
}
