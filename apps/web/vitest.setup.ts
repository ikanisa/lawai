import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';
import { mockSessionValue, resetMockAppSession } from './test/utils/mock-session';

vi.mock('./src/components/providers', async () => {
  const actual = await vi.importActual<typeof import('./src/components/providers')>('./src/components/providers');
  return {
    ...actual,
    useAppSession: () => mockSessionValue,
  };
});

beforeEach(() => {
  resetMockAppSession();
  if (typeof window !== 'undefined') {
    window.localStorage.clear();
  }
});
