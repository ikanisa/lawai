type OrgRole = 'owner' | 'admin' | 'member' | 'reviewer' | 'viewer' | 'compliance_officer' | 'auditor';
type PolicyRecord = Record<string, unknown>;
type ConsentRequirement = {
    type: string;
    version: string;
};
type CouncilOfEuropeRequirement = {
    version: string;
    documentUrl?: string | null;
};
type OrgPolicyFlags = {
    confidentialMode: boolean;
    franceJudgeAnalyticsBlocked: boolean;
    mfaRequired: boolean;
    ipAllowlistEnforced: boolean;
    consentRequirement: ConsentRequirement | null;
    councilOfEuropeRequirement: CouncilOfEuropeRequirement | null;
    sensitiveTopicHitl: boolean;
    residencyZone: string | null;
    residencyZones: string[] | null;
};
export type OrgAccessContext = {
    orgId: string;
    userId: string;
    role: OrgRole;
    policies: OrgPolicyFlags;
    rawPolicies: PolicyRecord;
    entitlements: Map<string, {
        canRead: boolean;
        canWrite: boolean;
    }>;
    ipAllowlistCidrs: string[];
    consent: {
        requirement: ConsentRequirement | null;
        latest?: {
            type: string;
            version: string;
        } | null;
    };
    councilOfEurope: {
        requirement: CouncilOfEuropeRequirement | null;
        acknowledgedVersion?: string | null;
    };
};
type PermissionKey = 'runs:execute' | 'metrics:view' | 'metrics:baseline' | 'metrics:slo' | 'governance:cepej' | 'governance:transparency' | 'governance:dispatch' | 'workspace:view' | 'citations:view' | 'cases:view' | 'templates:view' | 'hitl:view' | 'hitl:act' | 'corpus:view' | 'corpus:manage' | 'search-local' | 'search-hybrid' | 'telemetry:record' | 'admin:manage' | 'admin:audit' | 'admin:security' | 'governance:red-team' | 'governance:go-no-go' | 'governance:go-no-go-signoff' | 'orchestrator:command' | 'orchestrator:admin';
export declare function authorizeAction(action: PermissionKey, orgId: string, userId: string): Promise<OrgAccessContext>;
export declare function isJurisdictionAllowed(entitlements: Map<string, {
    canRead: boolean;
    canWrite: boolean;
}>, jurisCode: string): boolean;
type RequestContext = {
    ip: string;
    headers: Record<string, unknown>;
};
export declare function ensureOrgAccessCompliance(access: OrgAccessContext, request: RequestContext): void;
export {};
//# sourceMappingURL=access-control.d.ts.map