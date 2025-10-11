export type LaunchReadinessSeverity = 'info' | 'warning' | 'critical';
export type LaunchOfflineChannel = 'export' | 'filing' | 'message';
export type LaunchOfflineStatus = 'queued' | 'syncing';
export interface LaunchOfflineOutboxItem {
    id: string;
    orgId: string;
    channel: LaunchOfflineChannel;
    label: string;
    locale: string | null;
    status: LaunchOfflineStatus;
    queuedAt: string;
    lastAttemptAt: string | null;
}
export interface LaunchReadinessAction {
    id: string;
    label: string;
    description: string;
    severity: LaunchReadinessSeverity;
    href?: string;
}
export interface LaunchReadinessVitalsSummary {
    total: number;
    good: number;
    needsImprovement: number;
    poor: number;
    lastSampleAt: string | null;
}
export interface LaunchReadinessOfflineSummary {
    queued: number;
    syncing: number;
    lastQueuedAt: string | null;
    oldestQueuedAt: string | null;
}
export interface LaunchReadinessDigestSummary {
    total: number;
    weekly: number;
    monthly: number;
    lastCreatedAt: string | null;
}
export interface LaunchReadinessCollateralSummary {
    pilotOnboarding: number;
    pricingPacks: number;
    transparency: number;
}
export interface LaunchReadinessSnapshot {
    orgId: string;
    readinessScore: number;
    vitals: LaunchReadinessVitalsSummary;
    offlineOutbox: LaunchReadinessOfflineSummary;
    digests: LaunchReadinessDigestSummary;
    collateral: LaunchReadinessCollateralSummary;
    actions: LaunchReadinessAction[];
    notes: string[];
}
//# sourceMappingURL=launch-readiness.d.ts.map