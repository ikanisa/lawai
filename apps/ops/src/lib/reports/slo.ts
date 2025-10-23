export interface SloSnapshotOptions {
  orgId: string;
  userId: string;
  apiBaseUrl: string;
  apiUptime?: number | null;
  hitlP95?: number | null;
  retrievalP95?: number | null;
  citationP95?: number | null;
  notes?: string;
}

export async function listSloSnapshots(options: { orgId: string; userId: string; apiBaseUrl: string; limit?: number; exportCsv?: boolean }) {
  const params = new URLSearchParams({ orgId: options.orgId });
  if (options.limit) params.set('limit', String(options.limit));
  if (options.exportCsv) params.set('format', 'csv');

  const path = options.exportCsv ? '/metrics/slo/export' : '/metrics/slo';
  const response = await fetch(`${options.apiBaseUrl}${path}?${params.toString()}`, {
    headers: { 'x-user-id': options.userId },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`slo_snapshot_list_failed:${response.status}:${body}`);
  }

  return options.exportCsv ? response.text() : response.json();
}

export async function createSloSnapshot(options: SloSnapshotOptions) {
  const payload = {
    orgId: options.orgId,
    apiUptimePercent: options.apiUptime ?? null,
    hitlResponseP95Seconds: options.hitlP95 ?? null,
    retrievalLatencyP95Seconds: options.retrievalP95 ?? null,
    citationPrecisionP95: options.citationP95 ?? null,
    notes: options.notes,
  };

  const response = await fetch(`${options.apiBaseUrl}/metrics/slo`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': options.userId,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`slo_snapshot_failed:${response.status}:${body}`);
  }

  return response.json();
}
