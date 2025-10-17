export type SupportedLocale = "fr" | "en" | "rw";

export const locales: Record<SupportedLocale, { label: string; territory: string }> = {
  fr: { label: "Français", territory: "FR" },
  en: { label: "English", territory: "US" },
  rw: { label: "Kinyarwanda", territory: "RW" }
};

export const defaultLocale: SupportedLocale = "fr";

const frenchPunctuationRegex = /(\s)?([\:;\?\!])/g;

export function applyFrenchPunctuationSpacing(
  value: string,
  locale: SupportedLocale = defaultLocale
) {
  if (locale !== "fr") return value;
  return value.replace(frenchPunctuationRegex, "\u00A0$2");
}

function normalizeDate(date: Date | string) {
  return typeof date === "string" ? new Date(date) : date;
}

export function formatDate(
  date: Date | string,
  locale: SupportedLocale = defaultLocale,
  options: Intl.DateTimeFormatOptions = { year: "numeric", month: "long", day: "numeric" }
) {
  return new Intl.DateTimeFormat(locale, options).format(normalizeDate(date));
}

export function formatDateTime(
  date: Date | string,
  locale: SupportedLocale = defaultLocale,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }
) {
  return new Intl.DateTimeFormat(locale, options).format(normalizeDate(date));
}

export function formatNumber(
  value: number,
  locale: SupportedLocale = defaultLocale,
  options: Intl.NumberFormatOptions = {}
) {
  return new Intl.NumberFormat(locale, options).format(value);
}

export function formatCurrency(
  value: number,
  currency: string,
  locale: SupportedLocale = defaultLocale
) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

export function resolveLocale(candidate?: string | null): SupportedLocale {
  if (!candidate) return defaultLocale;
  const normalized = candidate.split("-")[0]?.toLowerCase() as SupportedLocale | undefined;
  return normalized && normalized in locales ? normalized : defaultLocale;
}
