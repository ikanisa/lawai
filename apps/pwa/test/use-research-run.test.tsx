import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";

import type { ResearchPlan } from "@/lib/data/research";
import { researchDeskContextQueryOptions } from "@/lib/queries/research";
import { useResearchRun } from "@/lib/hooks/useResearchRun";

vi.mock("@/lib/telemetry", () => ({
  useTelemetry: () => ({ emit: vi.fn() })
}));

vi.mock("@/lib/data/research", async () => {
  const actual = await vi.importActual<typeof import("@/lib/data/research")>("@/lib/data/research");
  return {
    ...actual,
    startResearchRun: vi.fn()
  };
});

describe("useResearchRun", () => {
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const basePlan: ResearchPlan = {
    id: "plan_1",
    title: "Plan",
    jurisdiction: "FR",
    riskLevel: "LOW",
    riskSummary: "",
    steps: [
      { id: "step-1", title: "Collect", summary: "", status: "pending", tool: "lookup" }
    ]
  };

  beforeEach(() => {
    queryClient.clear();
    queryClient.setQueryData(researchDeskContextQueryOptions().queryKey, {
      plan: basePlan,
      defaultCitations: [],
      filters: { publicationDates: [], entryIntoForce: [] },
      suggestions: ["Propose un plan"]
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("streams assistant tokens into the active message", async () => {
    const startResearchRun = vi.mocked((await import("@/lib/data/research")).startResearchRun);
    startResearchRun.mockImplementation((_input, onEvent) => {
      onEvent({ type: "token", data: { token: "Bonjour" } } as any);
      onEvent({ type: "done", data: {} } as any);
      return vi.fn();
    });

    const onRunStart = vi.fn();
    const { result } = renderHook(() => useResearchRun({ jurisdiction: null, onRunStart }), { wrapper });

    await act(async () => {
      result.current.setComposer("Bonjour agent");
    });

    await act(async () => {
      result.current.submit();
    });

    expect(onRunStart).toHaveBeenCalled();
    expect(startResearchRun).toHaveBeenCalled();
    const assistantMessages = result.current.messages.filter((message) => message.role === "assistant");
    expect(assistantMessages[assistantMessages.length - 1]?.content).toContain("Bonjour");
    expect(result.current.isStreaming).toBe(false);
  });

  it("disables web search when confidential mode is toggled", async () => {
    const { result } = renderHook(() => useResearchRun({ jurisdiction: null }), { wrapper });

    expect(result.current.webSearchMode).toBe("allowlist");

    await act(async () => {
      result.current.setConfidentialMode(true);
    });

    expect(result.current.webSearchMode).toBe("disabled");
    expect(result.current.effectiveWebSearchDisabled).toBe(true);
  });
});
