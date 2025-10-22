import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useReadingMode } from '../src/features/platform/hooks/use-reading-mode';

const STORAGE_KEY = 'avocat-reading-mode';

describe('useReadingMode', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('defaults to research mode when nothing is stored', () => {
    const { result } = renderHook(() => useReadingMode());
    expect(result.current.mode).toBe('research');
  });

  it('restores the stored mode on mount', () => {
    window.localStorage.setItem(STORAGE_KEY, 'evidence');
    const { result } = renderHook(() => useReadingMode());
    expect(result.current.mode).toBe('evidence');
  });

  it('persists mode changes to localStorage', () => {
    const { result } = renderHook(() => useReadingMode());
    act(() => {
      result.current.setMode('brief');
    });
    expect(result.current.mode).toBe('brief');
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('brief');
  });
});
