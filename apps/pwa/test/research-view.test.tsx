import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";

import { ResearchView } from "@/components/research/ResearchView";
import { startResearchRun, type ResearchDeskContext } from "@/lib/data/research";
import { useUIState } from "@/lib/state/ui-store";

const telemetryEmitMock = vi.fn();
const mockUseQuery = vi.fn();
const setPlanDrawerOpenMock = vi.fn();
const setJurisdictionMock = vi.fn();

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: (...args: unknown[]) => mockUseQuery(...args)
  };
});

vi.mock("@/lib/telemetry", () => ({
  useTelemetry: () => ({
    emit: telemetryEmitMock
  })
}));

vi.mock("@/components/agent/PlanDrawer", () => ({
  PlanDrawer: () => <div data-testid="plan-drawer" />
}));

vi.mock("@/components/agent/ToolChip", () => ({
  ToolChip: ({ name }: { name: string }) => <span>{name}</span>
}));

vi.mock("@/components/evidence/EvidencePane", () => ({
  EvidencePane: () => <aside data-testid="evidence-pane" />
}));

vi.mock("@/lib/state/ui-store", () => {
  const state = {
    commandPaletteOpen: false,
    setCommandPaletteOpen: vi.fn(),
    sidebarCollapsed: false,
    toggleSidebar: vi.fn(),
    planDrawerOpen: false,
    setPlanDrawerOpen: (open: boolean) => setPlanDrawerOpenMock(open),
    theme: "dark" as const,
    setTheme: vi.fn(),
    jurisdiction: "FR" as const,
    setJurisdiction: (value: string) => setJurisdictionMock(value)
  };
  const mockedUseUIState = <T,>(selector: (state: typeof state) => T) => selector(state);
  (mockedUseUIState as unknown as { __state: typeof state }).__state = state;
  return {
    jurisdictionOptions: ["Automatique", "FR", "OHADA"] as const,
    useUIState: mockedUseUIState
  };
});

vi.mock("@/lib/data/research", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data/research")>();
  return {
    ...actual,
    startResearchRun: vi.fn()
  };
});

const mockContext: ResearchDeskContext = {
  plan: {
    id: "plan_1",
    title: "Plan de recherche OHADA",
    jurisdiction: "OHADA",
    riskLevel: "MED",
    riskSummary: "Synthèse initiale du risque",
    steps: [
      {
        id: "step-1",
        title: "Analyser le traité",
        summary: "Identifier les obligations applicables.",
        status: "active",
        tool: "lookupCodeArticle"
      },
      {
        id: "step-2",
        title: "Comparer la jurisprudence",
        summary: "Évaluer la compatibilité OHADA.",
        status: "pending",
        tool: "web_search"
      }
    ]
  },
  defaultCitations: [
    {
      id: "cit-1",
      label: "Acte uniforme révisé",
      href: "https://ohada.org/acte",
      type: "Officiel",
      snippet: "Article 1 : Dispositions générales",
      score: 92,
      date: "2020-01-01T00:00:00.000Z"
    }
  ],
  filters: {
    publicationDates: [
      { id: "5y", label: "Moins de 5 ans", description: "" }
    ],
    entryIntoForce: [
      { id: "current", label: "En vigueur", description: "" }
    ]
  },
  suggestions: [
    "Analyse transfrontière OHADA",
    "Focus sur l'exécution"
  ],
  guardrails: ["Mode confidentiel disponible"],
  quickIntents: [
    { id: "intent-1", name: "Plan IRAC" }
  ]
};

const startResearchRunMock = vi.mocked(startResearchRun);

function resetUIState() {
  const state = (useUIState as unknown as { __state: { planDrawerOpen: boolean; jurisdiction: string } }).__state;
  state.planDrawerOpen = false;
  state.jurisdiction = "FR";
}

describe("ResearchView", () => {
  beforeEach(() => {
    telemetryEmitMock.mockClear();
    mockUseQuery.mockReturnValue({ data: mockContext, isLoading: false });
    setPlanDrawerOpenMock.mockClear();
    setJurisdictionMock.mockClear();
    startResearchRunMock.mockReset();
    resetUIState();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the research workspace with suggestions and risk banner", async () => {
    await act(async () => {
      render(<ResearchView />);
    });

    expect(await screen.findByText("Synthèse initiale du risque")).toBeInTheDocument();
    expect(screen.getAllByText("Analyse transfrontière OHADA").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Flux de réponses de l’agent")).toBeInTheDocument();

    await waitFor(() => {
      expect(telemetryEmitMock).toHaveBeenCalledWith(
        "citations_ready",
        expect.objectContaining({ total: 1, highConfidence: 1 })
      );
    });

    expect(telemetryEmitMock).toHaveBeenCalledWith(
      "retrieval_recall_scored",
      expect.objectContaining({ expected: 2, retrieved: 0 })
    );
  });

  it("submits input, streams updates, and clears the streaming state on completion", async () => {
    const events: Array<(event: unknown) => void> = [];
    startResearchRunMock.mockImplementation((_input, onEvent) => {
      events.push(onEvent);
      return vi.fn();
    });

    await act(async () => {
      render(<ResearchView />);
    });

    const textarea = screen.getByLabelText("Message à l’agent");
    fireEvent.change(textarea, { target: { value: "Veuillez analyser le dossier" } });

    const sendButton = screen.getByRole("button", { name: "Envoyer" });
    await act(async () => {
      fireEvent.click(sendButton);
    });

    expect(setPlanDrawerOpenMock).toHaveBeenCalledWith(true);
    expect(startResearchRunMock).toHaveBeenCalledWith(
      "Veuillez analyser le dossier",
      expect.any(Function),
      expect.objectContaining({ toolsEnabled: expect.arrayContaining(["lookupCodeArticle"]) })
    );

    expect(sendButton).toBeDisabled();
    expect(await screen.findByText("Veuillez analyser le dossier")).toBeInTheDocument();

    const streamHandler = events[0]!;

    streamHandler({ type: "token", data: { token: "Réponse partielle" } });
    expect(await screen.findByText(/Réponse partielle/)).toBeInTheDocument();

    const newCitation = {
      id: "cit-2",
      label: "Code de commerce",
      href: "https://ohada.org/code",
      type: "Doctrine",
      snippet: "Article 12",
      score: 80,
      date: "2021-05-01T00:00:00.000Z"
    };
    streamHandler({ type: "citation", data: { citation: newCitation } });

    await waitFor(() => {
      expect(telemetryEmitMock).toHaveBeenCalledWith(
        "citations_ready",
        expect.objectContaining({ total: 2 })
      );
    });

    streamHandler({ type: "risk", data: { risk: { level: "HIGH", summary: "Escalade nécessaire" } } });
    expect(await screen.findByText("Escalade nécessaire")).toBeInTheDocument();

    streamHandler({ type: "done", data: {} });
    await waitFor(() => {
      expect(sendButton).not.toBeDisabled();
    });
  });
});
