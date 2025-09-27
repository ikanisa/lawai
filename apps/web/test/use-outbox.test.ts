import { webcrypto } from 'node:crypto';
import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';
import { useOutbox } from '../src/hooks/use-outbox';

describe('useOutbox', () => {
  let uuidSpy: ReturnType<typeof vi.spyOn> | undefined;
  let counter = 0;

  beforeAll(() => {
    if (!globalThis.crypto) {
      Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
    }
  });

  beforeEach(() => {
    localStorage.clear();
    counter = 0;
    uuidSpy = vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(() => `outbox-id-${++counter}`);
  });

  afterEach(() => {
    uuidSpy?.mockRestore();
  });

  it('queues items and persists them to localStorage', () => {
    const { result } = renderHook(() => useOutbox());

    act(() => {
      result.current.enqueue({ question: 'Test question', context: 'Context', confidentialMode: false });
    });

    expect(result.current.items).toHaveLength(1);
    expect(localStorage.getItem('avocat-ai-outbox')).not.toBeNull();
  });

  it('flush removes processed items while retaining failures', async () => {
    const { result } = renderHook(() => useOutbox());

    act(() => {
      result.current.enqueue({ question: 'Send me', context: 'A', confidentialMode: false });
      result.current.enqueue({ question: 'Keep me', context: 'B', confidentialMode: false });
    });

    await act(async () => {
      await result.current.flush(async (item) => item.question === 'Send me');
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]?.question).toBe('Keep me');
    const stored = JSON.parse(localStorage.getItem('avocat-ai-outbox') ?? '[]');
    expect(stored).toHaveLength(1);
  });
});
