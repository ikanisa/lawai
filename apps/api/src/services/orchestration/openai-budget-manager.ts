export interface OpenAIBudgetConfig {
  totalTokens: number;
  minimum?: number;
}

export class OpenAIBudgetManager {
  private remaining: number;

  constructor(private readonly config: OpenAIBudgetConfig) {
    if (!Number.isFinite(config.totalTokens) || config.totalTokens <= 0) {
      throw new Error('openai_budget_invalid');
    }
    this.remaining = config.totalTokens;
  }

  reset(): void {
    this.remaining = this.config.totalTokens;
  }

  estimatePromptTokens(input: string | null | undefined): number {
    if (!input) {
      return 0;
    }
    const chars = Array.isArray(input) ? input.join(' ').length : String(input).length;
    const estimate = Math.ceil(chars / 4);
    return Math.max(this.config.minimum ?? 0, estimate);
  }

  consume(tokens: number): void {
    if (!Number.isFinite(tokens) || tokens <= 0) {
      return;
    }
    this.remaining -= tokens;
    if (this.remaining < 0) {
      const error = new Error('openai_budget_exceeded');
      (error as Error & { statusCode?: number }).statusCode = 429;
      throw error;
    }
  }

  getRemaining(): number {
    return Math.max(0, this.remaining);
  }
}
