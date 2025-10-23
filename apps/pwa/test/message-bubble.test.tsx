import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MessageBubble, type ChatMessage } from "@/components/research/MessageBubble";

const citation = {
  id: "citation-1",
  label: "Code civil",
  href: "https://example.com",
  type: "Officiel" as const,
  snippet: "Article 1",
  score: 92,
  date: "2024-01-01T00:00:00Z"
};

describe("MessageBubble", () => {
  it("renders external citation links with rel attribute including noopener", () => {
    const message: ChatMessage = {
      id: "assistant-1",
      role: "assistant",
      content: "Consultez la source ci-dessous.",
      citations: [citation],
      createdAt: Date.now()
    };

    render(<MessageBubble message={message} />);

    const link = screen.getByRole("link", { name: /code civil/i });
    expect(link).toHaveAttribute("rel", "noreferrer noopener");
  });
});
