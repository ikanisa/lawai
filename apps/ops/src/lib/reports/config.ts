import type { ScheduledReportFeatureFlags } from './scheduler.js';

export function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value == null) {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) {
    return false;
  }

  return defaultValue;
}

export function buildReportFeatureFlags(env: Record<string, string | undefined>): ScheduledReportFeatureFlags {
  return {
    transparency: {
      enabled: parseBoolean(env.OPS_REPORT_TRANSPARENCY_ENABLED, true),
      dryRun: parseBoolean(env.OPS_REPORT_TRANSPARENCY_DRY_RUN, false),
    },
    slo: {
      enabled: parseBoolean(env.OPS_REPORT_SLO_ENABLED, true),
    },
    regulator: {
      enabled: parseBoolean(env.OPS_REPORT_REGULATOR_ENABLED, true),
      verifyParity: parseBoolean(env.OPS_REPORT_REGULATOR_VERIFY_PARITY, true),
    },
  };
}

export function hasEnabledReports(flags: ScheduledReportFeatureFlags): boolean {
  return (
    (flags.transparency?.enabled ?? true) ||
    (flags.slo?.enabled ?? true) ||
    (flags.regulator?.enabled ?? true)
  );
}
