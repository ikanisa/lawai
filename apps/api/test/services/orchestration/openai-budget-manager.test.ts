import { describe, expect, it } from 'vitest';
import { OpenAIBudgetManager } from '../../../src/services/orchestration/openai-budget-manager.js';

describe('OpenAIBudgetManager', () => {
  it('estimates prompt tokens conservatively', () => {
    const manager = new OpenAIBudgetManager({ totalTokens: 100 });
    const estimate = manager.estimatePromptTokens('Hello world');
    expect(estimate).toBeGreaterThan(0);
  });

  it('throws when the budget would be exceeded', () => {
    const manager = new OpenAIBudgetManager({ totalTokens: 10 });
    expect(() => manager.consume(4)).not.toThrow();
    expect(() => manager.consume(10)).toThrowError(/openai_budget_exceeded/);
  });
});
