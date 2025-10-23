export const SEMANTIC_SEARCH_MODES = ['semantic', 'keyword', 'hybrid'] as const;

export type SemanticSearchMode = (typeof SEMANTIC_SEARCH_MODES)[number];
