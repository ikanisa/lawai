/// <reference types="cypress" />

describe("Chat research smoke", () => {
  it("streams IRAC answers and exposes plan drawer", () => {
    cy.visit("/research");
    cy.get("textarea[aria-label='Demande à l’agent']").type("Analyse clause compétence {enter}");
    cy.contains("Plan agent").should("exist");
  });
});
