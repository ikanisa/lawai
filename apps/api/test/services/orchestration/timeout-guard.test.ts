import { describe, expect, it } from 'vitest';
import { TimeoutGuard } from '../../../src/services/orchestration/timeout-guard.js';

describe('TimeoutGuard', () => {
  it('resolves when the operation completes within the timeout', async () => {
    const guard = new TimeoutGuard({ timeoutMs: 50 });
    const result = await guard.run(async () => 'ok');
    expect(result).toBe('ok');
  });

  it('rejects with a timeout_guard error when the operation exceeds the deadline', async () => {
    const guard = new TimeoutGuard({ timeoutMs: 10 });
    await expect(
      guard.run(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve('late'), 25);
          }),
      ),
    ).rejects.toThrowError(/timeout_guard/);
  });
});
