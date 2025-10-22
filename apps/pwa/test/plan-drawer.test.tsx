import { Fragment, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PlanDrawer, type ToolLogEntry } from "@/components/agent/PlanDrawer";
import type { ResearchPlan } from "@/lib/data/research";

vi.mock("@/lib/state/ui-store", async () => {
  const mockState = {
    planDrawerOpen: true,
    setPlanDrawerOpen: vi.fn()
  };

  return {
    useUIState: (selector: (state: typeof mockState) => unknown) => selector(mockState),
    UIStateProvider: ({ children }: { children: ReactNode }) => <Fragment>{children}</Fragment>
  };
});

const plan: ResearchPlan = {
  id: "plan-1",
  title: "Analyse IRAC complète",
  jurisdiction: "FR",
  riskLevel: "MED",
  riskSummary: "Vérifier la jurisprudence opposée avant de conclure",
  steps: [
    {
      id: "step-1",
      title: "Identifier la règle applicable",
      tool: "file_search",
      status: "done",
      summary: "Les articles 1103 et 1104 du Code civil s'appliquent à l'obligation."
    },
    {
      id: "step-2",
      title: "Comparer les précédents",
      tool: "web_search",
      status: "active",
      summary: "Recherche en cours sur les décisions de la Cour de cassation."
    }
  ]
};

const toolLogs: ToolLogEntry[] = [
  {
    id: "tool-1",
    name: "file_search",
    status: "success",
    detail: "3 passages consolidés alignés sur la requête",
    startedAt: "10:12"
  },
  {
    id: "tool-2",
    name: "web_search",
    status: "running",
    detail: "Analyse des sources autorisées",
    startedAt: "10:16"
  }
];

describe("PlanDrawer", () => {
  it("renders the active plan with risk badges and tool logs", () => {
    render(<PlanDrawer plan={plan} toolLogs={toolLogs} />);

    expect(screen.getByRole("dialog", { name: /plan d'investigation de l'agent/i })).toBeInTheDocument();
    expect(screen.getByText("Analyse IRAC complète")).toBeInTheDocument();
    expect(screen.getByText(/risque : modéré/i)).toBeInTheDocument();
    expect(screen.getAllByText("file_search")).toHaveLength(2);
    expect(screen.getByText(/Les articles 1103/)).toBeInTheDocument();
    expect(screen.getByText("Analyse des sources autorisées")).toBeInTheDocument();
  });
});
