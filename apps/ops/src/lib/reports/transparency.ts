export interface TransparencyReportOptions {
  orgId: string;
  userId: string;
  apiBaseUrl: string;
  periodStart?: string;
  periodEnd?: string;
  dryRun?: boolean;
}

export async function generateTransparencyReport(options: TransparencyReportOptions): Promise<unknown> {
  const payload = {
    orgId: options.orgId,
    periodStart: options.periodStart,
    periodEnd: options.periodEnd,
    dryRun: options.dryRun ?? false,
  };

  const response = await fetch(`${options.apiBaseUrl}/reports/transparency`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': options.userId,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`transparency_report_failed:${response.status}:${body}`);
  }

  return response.json();
}
