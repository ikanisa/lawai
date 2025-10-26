import { Fragment, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PlanDrawer } from "@/components/agent/PlanDrawer";
import type { PlanDrawerToolLogEntry } from "@avocat-ai/shared";
import type { ResearchPlan } from "@/lib/data/research";

const { setPlanDrawerOpen } = vi.hoisted(() => ({
  setPlanDrawerOpen: vi.fn()
}));

vi.mock("@/lib/state/ui-store", async () => {
  const mockState = {
    planDrawerOpen: true,
    setPlanDrawerOpen
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

const toolLogs: PlanDrawerToolLogEntry[] = [
  {
    id: "tool-1",
    name: "file_search",
    status: "success",
    description: "3 passages consolidés alignés sur la requête",
    timestamp: "10:12"
  },
  {
    id: "tool-2",
    name: "web_search",
    status: "running",
    description: "Analyse des sources autorisées",
    timestamp: "10:16"
  }
];

describe("PlanDrawer", () => {
  it("closes the drawer when the action is triggered", async () => {
    const user = userEvent.setup();
    setPlanDrawerOpen.mockClear();
    render(<PlanDrawer plan={plan} toolLogs={toolLogs} />);

    expect(screen.getByRole("dialog", { name: /plan d'investigation de l'agent/i })).toBeInTheDocument();
    expect(screen.getByText(/Risque : Modéré/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /fermer le plan/i }));

    expect(setPlanDrawerOpen).toHaveBeenCalledWith(false);
  });
});
