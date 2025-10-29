import { type SloSnapshotRecord, type SloSummary } from './reports.js';
export interface LaunchCollateral {
    pilotOnboarding: Array<{
        title: string;
        summary: string;
        url: string;
    }>;
    pricingPacks: Array<{
        name: string;
        tiers: string[];
        url: string;
    }>;
    transparency: Array<{
        label: string;
        url: string;
        jurisdiction: string;
    }>;
}
export interface RegulatorDigestRequest {
    orgId: string;
    requestedBy: string;
    jurisdiction: string;
    channel: 'email' | 'slack' | 'teams';
    frequency: 'weekly' | 'monthly';
    recipients: string[];
    topics?: string[];
    sloSnapshots?: SloSnapshotRecord[];
}
export interface RegulatorDigestEntry extends RegulatorDigestRequest {
    id: string;
    createdAt: string;
    sloSummary: SloSummary;
}
export declare function getLaunchCollateral(): LaunchCollateral;
export declare function listRegulatorDigests(): RegulatorDigestEntry[];
export declare function listRegulatorDigestsForOrg(orgId: string): RegulatorDigestEntry[];
export declare function enqueueRegulatorDigest(request: RegulatorDigestRequest): RegulatorDigestEntry;
export declare function __resetLaunchStateForTests(): void;
//# sourceMappingURL=launch.d.ts.map