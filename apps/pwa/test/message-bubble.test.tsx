import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MessageBubble, type ChatMessage } from "@/components/research/MessageBubble";

const baseMessage: ChatMessage = {
  id: "message-1",
  role: "assistant",
  content: "Voici une décision pertinente.",
  createdAt: Date.now(),
  citations: [
    {
      id: "citation-1",
      label: "Décret 2024-123",
      href: "https://example.com/decret-2024-123",
      type: "Officiel",
      snippet: "Extrait du décret...",
      score: 92,
      date: new Date().toISOString()
    }
  ]
};

describe("MessageBubble", () => {
  it("notifies when a citation link is activated", async () => {
    const handleCitationClick = vi.fn();

    render(<MessageBubble message={baseMessage} onCitationClick={handleCitationClick} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("link", { name: "Décret 2024-123" }));

    expect(handleCitationClick).toHaveBeenCalledTimes(1);
    expect(handleCitationClick).toHaveBeenCalledWith(baseMessage.citations[0]);
  });
});
