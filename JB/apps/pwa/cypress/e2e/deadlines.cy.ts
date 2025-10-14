/// <reference types="cypress" />

describe("Deadline wizard smoke", () => {
  it("verifies computed deadlines", () => {
    cy.visit("/agent/procedure");
    cy.contains("Deadlines calculés").should("exist");
    cy.contains("Vérifier").first().click();
  });
});
