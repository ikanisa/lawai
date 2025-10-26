import type { Messages } from '@/lib/i18n';
import type { AdminTelemetryDashboardProps } from '@/features/admin/components/telemetry-dashboard';
import messagesFr from '../../messages/fr.json';

const defaultAdminMessages = (messagesFr as Messages).admin;

const baseProps: AdminTelemetryDashboardProps = {
  messages: defaultAdminMessages,
  overview: {
    runsLast30Days: 1280,
    totalRuns: 9821,
    allowlistedCitationRatio: 0.96,
    highRiskRuns: 2,
    hitlPending: 1,
    hitlMedianResponseMinutes: 42,
    confidentialRuns: 14,
    avgLatencyMs: 210,
    documentsReady: 4200,
    documentsTotal: 5000,
    documentsPending: 200,
    documentsFailed: 15,
    documentsSkipped: 40,
    documentsChunked: 3800,
    ingestionSuccessLast7Days: 86,
    ingestionFailedLast7Days: 3,
    allowlistedCitationRatioP95: 0.94,
  },
  manifest: {
    manifestName: 'manifest.jsonl',
    fileCount: 120,
    validCount: 118,
    warningCount: 2,
    errorCount: 0,
    createdAt: '2024-05-12T09:00:00Z',
    status: 'warnings',
  },
  loading: false,
  thresholds: { runsHigh: 1000, runsMedium: 500 },
};

export function createAdminTelemetryDashboardProps(
  overrides: Partial<AdminTelemetryDashboardProps> = {},
): AdminTelemetryDashboardProps {
  return {
    messages: overrides.messages ?? baseProps.messages,
    overview: overrides.overview ?? baseProps.overview,
    manifest: overrides.manifest ?? baseProps.manifest,
    loading: overrides.loading ?? baseProps.loading,
    thresholds: overrides.thresholds ?? baseProps.thresholds,
  } satisfies AdminTelemetryDashboardProps;
}
