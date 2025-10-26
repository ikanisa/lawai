import type { FinanceDirectorPlan } from '@avocat-ai/shared';

type BudgetLogger = {
  warn?: (entry: Record<string, unknown>, message: string) => void;
};

export const MAX_STEP_TOOL_BUDGET_TOKENS = 32;
export const MAX_PLAN_TOOL_BUDGET_TOKENS = 128;

export function validateDirectorPlanBudget(plan: FinanceDirectorPlan, logger?: BudgetLogger): void {
  let totalTokens = 0;

  for (const step of plan.steps ?? []) {
    const tokens = step.envelope?.budget?.tokens;
    if (typeof tokens === 'number') {
      if (tokens > MAX_STEP_TOOL_BUDGET_TOKENS) {
        logger?.warn?.(
          { stepId: step.id, tokens, limit: MAX_STEP_TOOL_BUDGET_TOKENS },
          'director_plan_budget_exceeded',
        );
        throw new Error('director_plan_budget_exceeded');
      }
      totalTokens += tokens;
    }
  }

  if (totalTokens > MAX_PLAN_TOOL_BUDGET_TOKENS) {
    logger?.warn?.(
      { totalTokens, limit: MAX_PLAN_TOOL_BUDGET_TOKENS },
      'director_plan_budget_total_exceeded',
    );
    throw new Error('director_plan_budget_total_exceeded');
  }
}
