import { afterEach, expect, it, vi } from 'vitest';
import {
  createRestClient,
  fetchLaunchDigests,
} from '../src/rest/client.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

it('requires configuration before use', async () => {
  await expect(fetchLaunchDigests('org')).rejects.toThrow('REST client not configured');
});

it('invokes configured base URL for launch digests', async () => {
  const fetchMock = vi.fn(async () =>
    new Response(JSON.stringify({ digests: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
  globalThis.fetch = fetchMock;
  createRestClient({ baseUrl: 'https://example.test/api', defaultUserId: 'user-123' });
  await fetchLaunchDigests('org-123');
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0]?.[0]).toBe('https://example.test/api/launch/digests?orgId=org-123&limit=25');
});
