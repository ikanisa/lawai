import { webcrypto } from 'node:crypto';
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, beforeAll, beforeEach, afterEach, expect, it, vi } from 'vitest';
import { useOutbox } from '../src/hooks/use-outbox';
import { submitResearchQuestion } from '../src/lib/api';

vi.mock('../src/lib/api', async () => {
  const actual = await vi.importActual<typeof import('../src/lib/api')>('../src/lib/api');
  return {
    ...actual,
    submitResearchQuestion: vi.fn(),
  };
});

const submitResearchQuestionMock = submitResearchQuestion as unknown as ReturnType<typeof vi.fn>;

let online = true;

vi.mock('../src/hooks/use-online-status', () => ({
  useOnlineStatus: () => online,
}));

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
    submitResearchQuestionMock.mockReset();
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
    submitResearchQuestionMock.mockImplementation(async (payload: { question: string }) => {
      if (payload.question === 'Send me') {
        return {};
      }
      throw new Error('simulate failure');
    });
    const { result } = renderHook(() => useOutbox());

    act(() => {
      result.current.enqueue({ question: 'Send me', context: 'A', confidentialMode: false });
      result.current.enqueue({ question: 'Keep me', context: 'B', confidentialMode: false });
    });

    await act(async () => {
      await result.current.flush();
    });

    await waitFor(() => {
      expect(result.current.items).toHaveLength(1);
    });
    expect(result.current.items[0]?.question).toBe('Keep me');
    expect(result.current.items[0]?.resumedAt).toBeTruthy();
    const stored = JSON.parse(localStorage.getItem('avocat-ai-outbox') ?? '[]');
    expect(stored).toHaveLength(1);
  });

  it('automatically flushes when coming back online', async () => {
    submitResearchQuestionMock.mockResolvedValue({});
    const { result, rerender } = renderHook(() => useOutbox());

    act(() => {
      result.current.enqueue({ question: 'Offline question', confidentialMode: false });
    });

    expect(result.current.items).toHaveLength(1);

    online = false;
    rerender();

    online = true;
    rerender();

    await waitFor(() => {
      expect(submitResearchQuestionMock).toHaveBeenCalledTimes(1);
      expect(result.current.items).toHaveLength(0);
    });
  });
});
