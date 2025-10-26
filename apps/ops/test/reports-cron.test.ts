import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runScheduledReports } from '../src/lib/reports/scheduler.js';
import { buildReportFeatureFlags } from '../src/lib/reports/config.js';

const { mockTransparency, mockSlo, mockRegulator, mockAuditLog } = vi.hoisted(() => ({
  mockTransparency: vi.fn(),
  mockSlo: vi.fn(),
  mockRegulator: vi.fn(),
  mockAuditLog: vi.fn(),
}));

vi.mock('../src/lib/reports/transparency.js', () => ({
  generateTransparencyReport: mockTransparency,
}));

vi.mock('../src/lib/reports/slo.js', () => ({
  listSloSnapshots: mockSlo,
}));

vi.mock('../src/lib/reports/regulator.js', () => ({
  enqueueRegulatorDigest: mockRegulator,
}));

vi.mock('../src/lib/supabase.js', () => ({
  createOpsAuditLogger: () => ({ log: mockAuditLog }),
}));

function createSupabaseStub() {
  const maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'run-id' }, error: null });
  const select = vi.fn(() => ({ maybeSingle }));
  const insert = vi.fn(() => ({ select }));
  const from = vi.fn(() => ({ insert }));
  const client = { from } as unknown as SupabaseClient;
  return { client, from, insert, select, maybeSingle };
}

describe('buildReportFeatureFlags', () => {
  it('parses booleans from environment variables', () => {
    const flags = buildReportFeatureFlags({
      OPS_REPORT_TRANSPARENCY_ENABLED: '0',
      OPS_REPORT_TRANSPARENCY_DRY_RUN: '1',
      OPS_REPORT_SLO_ENABLED: 'false',
      OPS_REPORT_REGULATOR_ENABLED: 'no',
      OPS_REPORT_REGULATOR_VERIFY_PARITY: '0',
    });

    expect(flags.transparency?.enabled).toBe(false);
    expect(flags.transparency?.dryRun).toBe(true);
    expect(flags.slo?.enabled).toBe(false);
    expect(flags.regulator?.enabled).toBe(false);
    expect(flags.regulator?.verifyParity).toBe(false);
  });
});

describe('runScheduledReports feature flags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips disabled tasks entirely', async () => {
    const { client, from } = createSupabaseStub();

    const results = await runScheduledReports(
      {
        supabase: client,
        orgId: 'org-1',
        userId: 'user-1',
        apiBaseUrl: 'https://api.test',
      },
      {
        transparency: { enabled: false },
        slo: { enabled: false },
        regulator: { enabled: false },
      },
    );

    expect(mockTransparency).not.toHaveBeenCalled();
    expect(mockSlo).not.toHaveBeenCalled();
    expect(mockRegulator).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
    expect(mockAuditLog).toHaveBeenCalledTimes(3);
    expect(results).toHaveLength(3);
    expect(results.every((report) => report.status === 'skipped')).toBe(true);
  });

  it('forwards dry-run and parity flags to downstream reports', async () => {
    const { client, from } = createSupabaseStub();

    mockTransparency.mockResolvedValue({ transparency: true });
    mockSlo.mockResolvedValue([]);
    mockRegulator.mockResolvedValue({ regulator: true });

    await runScheduledReports(
      {
        supabase: client,
        orgId: 'org-1',
        userId: 'user-1',
        apiBaseUrl: 'https://api.test',
      },
      {
        transparency: { enabled: true, dryRun: true },
        slo: { enabled: false },
        regulator: { enabled: true, verifyParity: false },
      },
    );

    expect(mockTransparency).toHaveBeenCalledWith(
      expect.objectContaining({ dryRun: true, periodStart: expect.any(String), periodEnd: expect.any(String) }),
    );
    expect(mockRegulator).toHaveBeenCalledWith(
      expect.objectContaining({ verifyParity: false, periodStart: expect.any(String), periodEnd: expect.any(String) }),
    );
    expect(mockSlo).not.toHaveBeenCalled();
    expect(from).toHaveBeenCalled();
  });
});
