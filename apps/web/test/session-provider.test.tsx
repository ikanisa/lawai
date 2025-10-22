import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { Session } from '@supabase/supabase-js';

import { SessionProvider, useSession } from '../src/components/session-provider';

function Consumer() {
  const { status, isDemo, error, orgId, userId } = useSession();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="is-demo">{String(isDemo)}</span>
      <span data-testid="org-id">{orgId ?? 'none'}</span>
      <span data-testid="user-id">{userId ?? 'none'}</span>
      <span data-testid="error">{error ?? ''}</span>
    </div>
  );
}

function createSession(overrides?: Partial<Session>): Session {
  const base = {
    access_token: 'access-token',
    refresh_token: 'refresh-token',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    provider_token: null,
    provider_refresh_token: null,
    user: {
      id: 'user-123',
      aud: 'authenticated',
      app_metadata: {},
      user_metadata: { org_id: 'org-123', user_id: 'user-123' },
    },
  } satisfies Partial<Session>;
  return { ...base, ...overrides } as Session;
}

describe('SessionProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('hydrates authenticated session from initial payload', () => {
    const session = createSession();

    render(
      <SessionProvider
        initialSession={{ session, orgId: 'org-123', userId: 'user-123', error: null }}
      >
        <Consumer />
      </SessionProvider>,
    );

    expect(screen.getByTestId('status').textContent).toBe('authenticated');
    expect(screen.getByTestId('is-demo').textContent).toBe('false');
    expect(screen.getByTestId('org-id').textContent).toBe('org-123');
    expect(screen.getByTestId('user-id').textContent).toBe('user-123');
    expect(screen.getByTestId('error').textContent).toBe('');
  });

  it('falls back to demo mode when session endpoint returns 401', async () => {
    const fetchMock = vi.fn(async () => ({
      status: 401,
      ok: false,
      json: async () => ({}),
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <SessionProvider>
        <Consumer />
      </SessionProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('unauthenticated');
    });
    expect(screen.getByTestId('is-demo').textContent).toBe('true');
    expect(screen.getByTestId('org-id').textContent).toBe('none');
    expect(screen.getByTestId('user-id').textContent).toBe('none');
    expect(screen.getByTestId('error').textContent).toBe('');
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/session', { credentials: 'include' });
  });
});
