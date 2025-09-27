import { differenceInHours, parseISO } from 'date-fns';

export type CoverageSummary = {
  coverage: Record<string, number>;
  missing: string[];
};

export function summariseJurisdictionCoverage(
  rows: Array<{ jurisdiction_code: string | null }>,
  required: readonly string[],
): CoverageSummary {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    if (!row?.jurisdiction_code) continue;
    const code = row.jurisdiction_code.toUpperCase();
    counts[code] = (counts[code] ?? 0) + 1;
  }

  const missing: string[] = [];
  for (const code of required) {
    if (!counts[code] || counts[code] <= 0) {
      missing.push(code);
    }
  }

  return { coverage: counts, missing };
}

export interface AdapterRunRecord {
  adapter_id: string;
  finished_at: string | null;
}

export interface AdapterFreshnessSummary {
  latest: Record<string, string | null>;
  missing: string[];
  stale: Array<{ adapterId: string; lastRun: string | null; ageHours: number | null }>;
}

export function summariseAdapterFreshness(
  runs: AdapterRunRecord[],
  required: readonly string[],
  freshnessHours = 48,
): AdapterFreshnessSummary {
  const latest: Record<string, string | null> = {};

  for (const run of runs) {
    const id = run.adapter_id;
    if (!id) continue;
    const existing = latest[id];
    if (!existing) {
      latest[id] = run.finished_at;
      continue;
    }
    if (!run.finished_at) {
      continue;
    }
    if (!existing) {
      latest[id] = run.finished_at;
      continue;
    }
    if (!existing || (run.finished_at && existing && run.finished_at > existing)) {
      latest[id] = run.finished_at;
    }
  }

  const missing: string[] = [];
  const stale: Array<{ adapterId: string; lastRun: string | null; ageHours: number | null }> = [];

  for (const adapter of required) {
    const last = latest[adapter] ?? null;
    if (!last) {
      missing.push(adapter);
      continue;
    }
    let ageHours: number | null = null;
    try {
      const finished = parseISO(last);
      if (!Number.isNaN(finished.getTime())) {
        ageHours = differenceInHours(new Date(), finished);
      }
    } catch (error) {
      ageHours = null;
    }
    if (ageHours !== null && ageHours > freshnessHours) {
      stale.push({ adapterId: adapter, lastRun: last, ageHours });
    }
  }

  return { latest, missing, stale };
}
