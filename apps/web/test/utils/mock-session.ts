import { vi } from 'vitest';

type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'demo';

export interface MockSessionValue {
  status: SessionStatus;
  orgId: string | null;
  userId: string | null;
  supabaseSession: unknown;
  error: Error | null;
  isDemo: boolean;
  refresh: () => Promise<void>;
}

function createDefaultSession(): MockSessionValue {
  return {
    status: 'authenticated',
    orgId: 'org-123',
    userId: 'user-456',
    supabaseSession: null,
    error: null,
    isDemo: false,
    refresh: vi.fn().mockResolvedValue(undefined),
  };
}

export const mockSessionValue: MockSessionValue = createDefaultSession();

export function resetMockAppSession() {
  Object.assign(mockSessionValue, createDefaultSession());
}

export function setMockAppSession(overrides: Partial<MockSessionValue>) {
  Object.assign(mockSessionValue, overrides);
}
