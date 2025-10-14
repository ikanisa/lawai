/// <reference types="cypress" />

describe("Drafting studio smoke", () => {
  it("loads template gallery and export controls", () => {
    cy.visit("/drafting");
    cy.contains("Galerie de modèles").should("exist");
    cy.contains("Export & conformité").should("exist");
  });
});
