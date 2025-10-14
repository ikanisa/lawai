"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";

export function focusTrap(container: HTMLElement) {
  const focusable = container.querySelectorAll<HTMLElement>(
    'a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])'
  );
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  function handleKey(event: KeyboardEvent) {
    if (event.key !== "Tab") return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  container.addEventListener("keydown", handleKey);

  return () => container.removeEventListener("keydown", handleKey);
}

export function shouldReduceMotion() {
  if (typeof window === "undefined") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function shouldReduceData() {
  if (typeof navigator === "undefined") {
    return false;
  }

  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return Boolean(connection?.saveData);
}

type AccessibilityContextValue = {
  prefersReducedMotion: boolean;
  prefersReducedData: boolean;
};

const AccessibilityContext = createContext<AccessibilityContextValue | null>(null);

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() => shouldReduceMotion());
  const [prefersReducedData, setPrefersReducedData] = useState<boolean>(() => shouldReduceData());

  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleMotion = (event: MediaQueryListEvent) => setPrefersReducedMotion(event.matches);
    motionQuery.addEventListener("change", handleMotion);
    return () => motionQuery.removeEventListener("change", handleMotion);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.prefersReducedMotion = prefersReducedMotion ? "true" : "false";
  }, [prefersReducedMotion]);

  useEffect(() => {
    document.documentElement.dataset.prefersReducedData = prefersReducedData ? "true" : "false";
  }, [prefersReducedData]);

  useEffect(() => {
    if (typeof navigator === "undefined") return;

    const connection = (navigator as Navigator & { connection?: EventTarget & { saveData?: boolean } })
      .connection;
    if (!connection || typeof connection.addEventListener !== "function") return;

    const handleChange = () => setPrefersReducedData(Boolean((connection as any).saveData));
    connection.addEventListener("change", handleChange);
    return () => connection.removeEventListener("change", handleChange);
  }, []);

  const value = useMemo<AccessibilityContextValue>(
    () => ({ prefersReducedMotion, prefersReducedData }),
    [prefersReducedMotion, prefersReducedData]
  );

  return <AccessibilityContext.Provider value={value}>{children}</AccessibilityContext.Provider>;
}

export function useAccessibility() {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error("useAccessibility must be used within an AccessibilityProvider");
  }
  return context;
}

export function usePrefersReducedMotion() {
  return useAccessibility().prefersReducedMotion;
}
