"use client";

import { useEffect, useRef } from "react";

import { ToastAction } from "@/components/ui/toast";
import { toast } from "@/components/ui/use-toast";
import { useAccessibility } from "@/lib/a11y";

export function ServiceWorkerBridge() {
  const { prefersReducedData } = useAccessibility();
  const hasRegistered = useRef(false);

  useEffect(() => {
    if (prefersReducedData || hasRegistered.current || process.env.NODE_ENV === "development") {
      return;
    }

    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const handleControllerChange = () => {
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/"
        });

        const showUpdateToast = () => {
          const waiting = registration.waiting;
          if (!waiting) return;
          const { dismiss } = toast({
            title: "Mise à jour disponible",
            description: "Rechargez pour profiter des dernières optimisations.",
            action: (
              <ToastAction
                altText="Recharger"
                onClick={() => {
                  waiting.postMessage({ type: "SKIP_WAITING" });
                  dismiss();
                }}
              >
                Mettre à jour
              </ToastAction>
            )
          });
        };

        if (registration.waiting) {
          showUpdateToast();
        }

        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              showUpdateToast();
            }
          });
        });
      } catch (error) {
        console.error("[pwa] Service worker registration failed", error);
      }
    };

    const onReady = () => {
      register().catch((error) => {
        console.error("[pwa] registration error", error);
      });
    };

    if (document.readyState === "complete") {
      onReady();
    } else {
      window.addEventListener("load", onReady, { once: true });
    }

    hasRegistered.current = true;

    return () => {
      window.removeEventListener("load", onReady);
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, [prefersReducedData]);

  return null;
}
