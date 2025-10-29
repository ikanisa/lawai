import type { FinanceDirectorPlan } from '@avocat-ai/shared';
type BudgetLogger = {
    warn?: (entry: Record<string, unknown>, message: string) => void;
};
export declare const MAX_STEP_TOOL_BUDGET_TOKENS = 32;
export declare const MAX_PLAN_TOOL_BUDGET_TOKENS = 128;
export declare function validateDirectorPlanBudget(plan: FinanceDirectorPlan, logger?: BudgetLogger): void;
export {};
//# sourceMappingURL=director-plan-budget.d.ts.map