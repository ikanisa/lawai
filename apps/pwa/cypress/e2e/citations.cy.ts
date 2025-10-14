/// <reference types="cypress" />

describe("Citations browser smoke", () => {
  it("shows OHADA featured documents and metadata", () => {
    cy.visit("/citations");
    cy.contains("Citations officielles").should("exist");
    cy.contains("OHADA en priorité").should("exist");
  });
});
