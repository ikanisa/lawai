import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MessageBubble, type ChatMessage } from "@/components/research/MessageBubble";
import type { ResearchCitation } from "@/lib/data/research";

describe("MessageBubble", () => {
  it("renders citations as anchors with the expected href", () => {
    const citation: ResearchCitation = {
      id: "citation-1",
      label: "Article 1103 du Code civil",
      href: "https://legifrance.gouv.fr/codes/article_lc/LEGIARTI000032040563/",
      type: "Officiel",
      snippet: "Les contrats légalement formés tiennent lieu de loi à ceux qui les ont faits.",
      score: 92,
      date: "2024-01-15T00:00:00.000Z"
    };

    const message: ChatMessage = {
      id: "message-1",
      role: "assistant",
      content: "Selon l'article 1103 du Code civil, ...",
      citations: [citation],
      createdAt: Date.now()
    };

    render(<MessageBubble message={message} />);

    const formattedDate = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(
      new Date(citation.date)
    );

    const link = screen.getByRole("link", {
      name: `Consulter ${citation.type} publié le ${formattedDate} : ${citation.label}`
    });

    expect(link).toHaveAttribute("href", citation.href);
  });
});
