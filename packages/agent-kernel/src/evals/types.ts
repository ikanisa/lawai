export interface ClauseDetectionScenario {
  id: string;
  document: string;
  clauses: Array<{ name: string; trigger: string }>;
  expected: string[];
}

export interface RedliningScenario {
  id: string;
  original: string;
  revised: string;
  expectedRemoved: string[];
  expectedAdded: string[];
}

export interface HallucinationScenario {
  id: string;
  query: string;
  facts: string[];
  response: string;
  disallowedPhrases: string[];
}

export interface EvaluationSuite<TScenario> {
  suite: string;
  scenarios: TScenario[];
}

export type KernelEvaluationScenario =
  | EvaluationSuite<ClauseDetectionScenario>
  | EvaluationSuite<RedliningScenario>
  | EvaluationSuite<HallucinationScenario>;
