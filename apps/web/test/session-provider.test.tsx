import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionProvider, useSession } from '../src/components/auth/session-provider';
import type { SessionPayload } from '../src/types/session';
import { DEMO_ORG_ID, DEMO_USER_ID } from '../src/lib/api';

function mockResponse(status: number, body: unknown = '') {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  } as Response;
}

const fetchMock = vi.fn();

function SessionConsumer() {
  const session = useSession();
  return (
    <div>
      <span data-testid="org">{session.orgId}</span>
      <span data-testid="user">{session.userId}</span>
      <span data-testid="is-demo">{session.isDemo ? 'true' : 'false'}</span>
      <span data-testid="loading">{session.loading ? 'true' : 'false'}</span>
      <span data-testid="error">{session.error ?? ''}</span>
      <button data-testid="refresh" onClick={() => session.refresh()}>
        refresh
      </button>
    </div>
  );
}

describe('SessionProvider', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(mockResponse(401));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('hydrates from initial session without fetching', async () => {
    const initialSession: SessionPayload = {
      session: { orgId: 'org-initial', userId: 'user-initial' },
      isDemo: false,
    };

    render(
      <SessionProvider initialSession={initialSession}>
        <SessionConsumer />
      </SessionProvider>,
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByTestId('org')).toHaveTextContent('org-initial');
    expect(screen.getByTestId('user')).toHaveTextContent('user-initial');
    expect(screen.getByTestId('is-demo')).toHaveTextContent('false');
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
  });

  it('falls back to the demo identity when the session endpoint returns 401', async () => {
    fetchMock.mockResolvedValue(mockResponse(401));

    render(
      <SessionProvider>
        <SessionConsumer />
      </SessionProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('org')).toHaveTextContent(DEMO_ORG_ID);
    expect(screen.getByTestId('user')).toHaveTextContent(DEMO_USER_ID);
    expect(screen.getByTestId('is-demo')).toHaveTextContent('true');
    expect(screen.getByTestId('error')).toHaveTextContent('');
  });

  it('surfaces supabase errors and keeps the demo identity', async () => {
    fetchMock.mockResolvedValue(mockResponse(500, 'Failed to fetch'));

    render(
      <SessionProvider>
        <SessionConsumer />
      </SessionProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('Failed to fetch'));
    expect(screen.getByTestId('org')).toHaveTextContent(DEMO_ORG_ID);
    expect(screen.getByTestId('is-demo')).toHaveTextContent('true');
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
  });

  it('refreshes the session when requested', async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse(401))
      .mockResolvedValueOnce(
        mockResponse(200, {
          session: { orgId: 'org-refresh', userId: 'user-refresh' },
          isDemo: false,
        } satisfies SessionPayload),
      );

    render(
      <SessionProvider>
        <SessionConsumer />
      </SessionProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await screen.findByTestId('refresh');
    screen.getByTestId('refresh').click();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByTestId('org')).toHaveTextContent('org-refresh'));
    expect(screen.getByTestId('user')).toHaveTextContent('user-refresh');
    expect(screen.getByTestId('is-demo')).toHaveTextContent('false');
  });
});
