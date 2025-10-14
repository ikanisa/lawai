import { describe, expect, it } from "vitest";

import {
  applyFrenchPunctuationSpacing,
  formatCurrency,
  formatDate,
  formatNumber,
  resolveLocale
} from "@/lib/i18n";

describe("i18n utilities", () => {
  it("applies non-breaking spaces before French punctuation", () => {
    const result = applyFrenchPunctuationSpacing("Bonjour : comment ça va ?", "fr");
    expect(result).toBe("Bonjour\u00A0: comment ça va\u00A0?");
  });

  it("resolves fallback locale when unknown", () => {
    expect(resolveLocale("es" as any)).toBe("fr");
  });

  it("formats numbers based on locale", () => {
    expect(formatNumber(1234.5, "fr")).toBe("1\u202f234,5");
    expect(formatNumber(1234.5, "en")).toBe("1,234.5");
  });

  it("formats currency in the requested locale", () => {
    expect(formatCurrency(42, "EUR", "fr")).toContain("42,00 €");
  });

  it("formats dates with locale preferences", () => {
    const date = new Date("2024-04-05T00:00:00Z");
    expect(formatDate(date, "en").toLowerCase()).toContain("april");
  });
});
