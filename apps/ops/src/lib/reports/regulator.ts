export interface RegulatorDigestOptions {
  orgId: string;
  userId: string;
  apiBaseUrl: string;
  periodStart?: string;
  periodEnd?: string;
  verifyParity?: boolean;
}

export async function fetchRegulatorDispatches(options: { orgId: string; userId: string; apiBaseUrl: string; limit?: number }) {
  const params = new URLSearchParams({ orgId: options.orgId, limit: String(options.limit ?? 25) });
  const response = await fetch(`${options.apiBaseUrl}/launch/digests?${params.toString()}`, {
    headers: { 'x-user-id': options.userId },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`regulator_dispatch_list_failed:${response.status}:${body}`);
  }

  const json = (await response.json()) as { digests?: unknown };
  return Array.isArray(json.digests) ? json.digests : [];
}

export async function enqueueRegulatorDigest(options: RegulatorDigestOptions) {
  const payload = {
    orgId: options.orgId,
    periodStart: options.periodStart,
    periodEnd: options.periodEnd,
    verifyParity: options.verifyParity ?? true,
  };

  const response = await fetch(`${options.apiBaseUrl}/launch/digests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': options.userId,
      'x-org-id': options.orgId,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`regulator_digest_failed:${response.status}:${body}`);
  }

  return response.json();
}
