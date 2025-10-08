"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";

import {
  applyFrenchPunctuationSpacing,
  defaultLocale,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  locales,
  resolveLocale,
  type SupportedLocale
} from "./config";

type LocaleContextValue = {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  formatDate: typeof formatDate;
  formatDateTime: typeof formatDateTime;
  formatNumber: typeof formatNumber;
  formatCurrency: (value: number, currency: string, locale?: SupportedLocale) => string;
  formatLegalText: (value: string) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

const STORAGE_KEY = "avocat-ai:locale";

function detectInitialLocale(): SupportedLocale {
  if (typeof window === "undefined") {
    return defaultLocale;
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored) {
    return resolveLocale(stored);
  }

  const navigatorLocale =
    typeof navigator !== "undefined" ? resolveLocale(navigator.language) : defaultLocale;
  return navigatorLocale;
}

export function I18nProvider({
  children,
  initialLocale
}: {
  children: ReactNode;
  initialLocale?: SupportedLocale;
}) {
  const [locale, setLocaleState] = useState<SupportedLocale>(initialLocale ?? detectInitialLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = "ltr";
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, locale);
    }
  }, [locale]);

  const setLocale = useCallback((next: SupportedLocale) => {
    setLocaleState(resolveLocale(next));
  }, []);

  const value = useMemo<LocaleContextValue>(() => {
    return {
      locale,
      setLocale,
      formatDate: (date, loc = locale, options) => formatDate(date, loc, options),
      formatDateTime: (date, loc = locale, options) => formatDateTime(date, loc, options),
      formatNumber: (value, loc = locale, options) => formatNumber(value, loc, options),
      formatCurrency: (value, currency, loc = locale) => formatCurrency(value, currency, loc),
      formatLegalText: (value) => applyFrenchPunctuationSpacing(value, locale)
    };
  }, [locale, setLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used within an I18nProvider");
  }
  return context;
}

export function useLocaleLabel(locale: SupportedLocale) {
  return locales[locale]?.label ?? locales[defaultLocale].label;
}
