declare module './agent.js' {
  // Minimal runtime-only surface to avoid importing heavy agent types
  // during API typecheck. Implementation is dynamically imported.
  export const runLegalAgent: Function;
  export const getHybridRetrievalContext: Function;
}

