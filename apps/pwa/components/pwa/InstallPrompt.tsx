"use client";

import { useEffect, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { Button } from '@avocat-ai/ui';
import { cn } from "@/lib/utils";

const STORAGE_KEY = "avocat-ai-install-dismissed-at";
const REAPPEAR_DAYS = 14;

type InstallPromptState = {
  event: BeforeInstallPromptEvent;
  timestamp: number;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function getDismissedAt() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export function InstallPrompt({ className }: { className?: string }) {
  const [promptState, setPromptState] = useState<InstallPromptState | null>(null);
  const [isDismissed, setDismissed] = useState(() => {
    const dismissedAt = getDismissedAt();
    if (!dismissedAt) return false;
    const threshold = REAPPEAR_DAYS * 24 * 60 * 60 * 1000;
    return Date.now() - dismissedAt < threshold;
  });

  const resetPrompt = useCallback(() => setPromptState(null), []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const dismissedAt = getDismissedAt();
    if (dismissedAt) {
      const threshold = REAPPEAR_DAYS * 24 * 60 * 60 * 1000;
      if (Date.now() - dismissedAt < threshold) {
        setDismissed(true);
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
        setDismissed(false);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || isDismissed) return;

    const handler = (event: Event) => {
      event.preventDefault();
      const installEvent = event as BeforeInstallPromptEvent;
      setPromptState({ event: installEvent, timestamp: Date.now() });
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, [isDismissed]);

  const dismiss = useCallback(() => {
    setPromptState(null);
    setDismissed(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, Date.now().toString());
    }
  }, []);

  const handleInstall = useCallback(async () => {
    if (!promptState?.event) return;

    try {
      await promptState.event.prompt();
      const { outcome } = await promptState.event.userChoice;
      if (outcome === "accepted") {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(STORAGE_KEY, Date.now().toString());
        }
        resetPrompt();
        setDismissed(true);
      } else {
        dismiss();
      }
    } catch (error) {
      console.error("[pwa] Install prompt failed", error);
      dismiss();
    }
  }, [dismiss, promptState, resetPrompt]);

  return (
    <AnimatePresence>
      {promptState && !isDismissed ? (
        <motion.aside
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
          className={cn(
            "fixed bottom-24 left-1/2 z-40 w-[min(28rem,calc(100%-2rem))] -translate-x-1/2 rounded-3xl border border-white/12 bg-white/10 p-5 shadow-[0_16px_48px_rgba(2,6,23,0.55)] backdrop-blur-2xl",
            className,
          )}
          role="dialog"
          aria-live="polite"
        >
          <div className="space-y-3 text-sm leading-relaxed text-white/90">
            <p className="text-base font-semibold text-white">
              Installez Avocat-AI sur votre appareil
            </p>
            <p className="text-white/70">
              Accédez plus rapidement aux recherches, à la rédaction et à la console vocale même hors ligne.
            </p>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={handleInstall} className="flex-1 min-w-[8rem]">
              Installer
            </Button>
            <Button variant="ghost" onClick={dismiss} className="flex-1 min-w-[8rem]">
              Plus tard
            </Button>
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
