import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DeadlineWizard } from "@/components/procedure/DeadlineWizard";
import type { DeadlineComputation } from "@/lib/data/procedure";

const deadlines: DeadlineComputation[] = [
  {
    id: "deadline-1",
    label: "Signification assignation",
    rule: "+10 jours calendrier",
    baseDate: "2024-05-01T08:00:00.000Z",
    computedDate: "2024-05-11T08:00:00.000Z",
    daysUntilDue: 5
  },
  {
    id: "deadline-2",
    label: "Conclusions adverses",
    rule: "+30 jours ouvrés",
    baseDate: "2024-05-15T08:00:00.000Z",
    computedDate: "2024-06-26T08:00:00.000Z",
    daysUntilDue: 21
  }
];

describe("DeadlineWizard", () => {
  it("lists computed deadlines and triggers verification", () => {
    const onCompute = vi.fn();
    render(
      <DeadlineWizard
        deadlines={deadlines}
        onCompute={onCompute}
        formatDate={(value) => new Date(value).toLocaleDateString("fr-FR")}
      />
    );

    expect(screen.getByRole("heading", { name: /deadlines calculés/i })).toBeInTheDocument();
    expect(screen.getByText(/Signification assignation/)).toBeInTheDocument();
    const verifyButtons = screen.getAllByRole("button", { name: /vérifier/i });
    expect(verifyButtons).toHaveLength(2);

    fireEvent.click(verifyButtons[0]);
    expect(onCompute).toHaveBeenCalledWith(deadlines[0]);
  });
});
