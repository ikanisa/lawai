import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

vi.mock('server-only', () => ({}));

beforeEach(() => {
  if (typeof window !== 'undefined') {
    window.localStorage.clear();
  }
});
