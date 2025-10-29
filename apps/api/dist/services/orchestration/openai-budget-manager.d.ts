export interface OpenAIBudgetConfig {
    totalTokens: number;
    minimum?: number;
}
export declare class OpenAIBudgetManager {
    private readonly config;
    private remaining;
    constructor(config: OpenAIBudgetConfig);
    reset(): void;
    estimatePromptTokens(input: string | null | undefined): number;
    consume(tokens: number): void;
    getRemaining(): number;
}
//# sourceMappingURL=openai-budget-manager.d.ts.map