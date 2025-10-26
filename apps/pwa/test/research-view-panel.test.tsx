import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ResearchControls, ResearchViewPanel } from "@/components/research/ResearchViewPanel";
import type { ResearchPlan } from "@/lib/data/research";
import type { ChatMessage } from "@/lib/research/types";

const plan: ResearchPlan = {
  id: "plan",
  title: "Plan",
  jurisdiction: "FR",
  riskLevel: "LOW",
  riskSummary: "",
  steps: []
};

describe("Research presenters", () => {
  it("renders messages in chronological order and submits composer", () => {
    const messages: ChatMessage[] = [
      { id: "b", role: "assistant", content: "Second", createdAt: 2, citations: [] },
      { id: "a", role: "assistant", content: "First", createdAt: 1, citations: [] }
    ];

    const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
    });
    const onComposerChange = vi.fn();

    render(
      <ResearchViewPanel
        plan={plan}
        messages={messages}
        activeTools={[]}
        composer="Hello"
        isStreaming={false}
        suggestions={["Suggestion"]}
        confidentialMode={false}
        onComposerChange={onComposerChange}
        onComposerSubmit={onSubmit}
        onSuggestionSelect={vi.fn()}
      />
    );

    const log = screen.getByRole("log", { name: /flux de réponses/i });
    const orderedMessages = within(log).getAllByText(/First|Second/);
    expect(orderedMessages[0]).toHaveTextContent("First");
    expect(orderedMessages[1]).toHaveTextContent("Second");

    const composer = screen.getByRole("textbox", { name: /message/i });
    fireEvent.submit(composer.closest("form")!);
    expect(onSubmit).toHaveBeenCalled();
  });

  it("disables quick actions when transcript is unavailable", () => {
    const onJurisdiction = vi.fn();
    const onToggle = vi.fn();

    render(
      <ResearchControls
        jurisdiction="FR"
        onJurisdictionChange={onJurisdiction}
        suggestions={[]}
        confidentialMode={false}
        onConfidentialModeChange={onToggle}
        webSearchMode="allowlist"
        onWebSearchModeChange={vi.fn()}
        fileSearchEnabled
        onFileSearchChange={vi.fn()}
        activeDateFilter={null}
        onDateFilterChange={vi.fn()}
        activeVersionFilter={null}
        onVersionFilterChange={vi.fn()}
        filters={{ publicationDates: [], entryIntoForce: [] }}
        quickActionsDisabled
      />
    );

    const uploadLink = screen.getByText("Téléverser une pièce").closest("a");
    expect(uploadLink).toHaveClass("opacity-50");
  });
});
