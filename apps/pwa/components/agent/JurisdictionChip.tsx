"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Flag } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  jurisdictionOptions,
  useUIState,
  type JurisdictionCode
} from "@/lib/state/ui-store";

type JurisdictionChipProps = {
  value?: JurisdictionCode;
  onChange?: (value: JurisdictionCode) => void;
};

export function JurisdictionChip({ value, onChange }: JurisdictionChipProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const globalJurisdiction = useUIState((state) => state.jurisdiction);
  const setJurisdiction = useUIState((state) => state.setJurisdiction);

  const current = value ?? globalJurisdiction;

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const jurisdictionLabels = useMemo(
    () =>
      new Map<JurisdictionCode, string>([
        ["FR", "France"],
        ["BE", "Belgique"],
        ["LU", "Luxembourg"],
        ["CH-FR", "Suisse (FR)"],
        ["CA-QC", "Canada (QC)"],
        ["OHADA", "OHADA"],
        ["RW", "Rwanda"],
        ["EU", "Union européenne"]
      ]),
    []
  );

  function handleSelect(next: JurisdictionCode) {
    setOpen(false);
    setJurisdiction(next);
    onChange?.(next);
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        className={cn(
          "group flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-semibold text-white shadow-z1 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22D3EE]",
          open && "bg-white/20"
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Changer la juridiction active"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span
          className="flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.7)] transition group-hover:shadow-[0_0_16px_rgba(16,185,129,0.9)]"
          aria-hidden
        />
        <span className="flex items-center gap-2">
          <Flag className="h-3.5 w-3.5 text-white/70" aria-hidden />
          <span>
            {current}
            <span className="sr-only"> — {jurisdictionLabels.get(current)}</span>
          </span>
        </span>
        <ChevronDown className="h-4 w-4 transition group-hover:text-white" aria-hidden />
      </button>
      {open ? (
        <ul
          className="absolute right-0 z-20 mt-2 w-56 rounded-2xl border border-white/20 bg-[#0B1220]/95 p-2 shadow-z2 backdrop-blur-xl"
          role="listbox"
          aria-label="Juridictions disponibles"
        >
          {jurisdictionOptions.map((code) => (
            <li key={code}>
              <button
                className={cn(
                  "w-full rounded-xl px-3 py-2 text-left text-sm text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22D3EE]",
                  current === code && "bg-white/10"
                )}
                onClick={() => handleSelect(code)}
                role="option"
                aria-selected={current === code}
              >
                <div className="flex items-center justify-between">
                  <span>{code}</span>
                  <span className="text-xs text-white/60">
                    {jurisdictionLabels.get(code)}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
