import type { FastifyBaseLogger, FastifyRequest } from 'fastify';
import type { OrgAccessContext } from '../../access-control.js';
import type { AppContext } from '../../types/context';
import type { ComplianceAcknowledgementBody } from './schemas.js';
export declare const COMPLIANCE_ACK_TYPES: {
    readonly consent: "ai_assist";
    readonly councilOfEurope: "council_of_europe_disclosure";
};
export declare class WorkspaceServiceError extends Error {
    statusCode: number;
    constructor(message: string, statusCode?: number);
}
export type AcknowledgementEvent = {
    type: string;
    version: string;
    created_at: string | null;
};
export declare function fetchAcknowledgementEvents(ctx: AppContext, orgId: string, userId: string): Promise<AcknowledgementEvent[]>;
type ConsentEventInsert = {
    org_id: string | null;
    user_id: string;
    consent_type: string;
    version: string;
};
export declare function recordAcknowledgementEvents(ctx: AppContext, request: FastifyRequest, orgId: string, userId: string, records: ConsentEventInsert[]): Promise<void>;
export declare function summariseAcknowledgements(access: OrgAccessContext, events: AcknowledgementEvent[]): {
    consent: {
        requiredVersion: string | null;
        acknowledgedVersion: string | null;
        acknowledgedAt: string | null;
        satisfied: boolean;
    };
    councilOfEurope: {
        requiredVersion: string | null;
        acknowledgedVersion: string | null;
        acknowledgedAt: string | null;
        satisfied: boolean;
    };
};
type ComplianceAssessment = {
    fria: {
        required: boolean;
        reasons: string[];
    };
    cepej: {
        passed: boolean;
        violations: string[];
    };
    statute: {
        passed: boolean;
        violations: string[];
    };
    disclosures: {
        consentSatisfied: boolean;
        councilSatisfied: boolean;
        missing: string[];
        requiredConsentVersion: string | null;
        acknowledgedConsentVersion: string | null;
        requiredCoeVersion: string | null;
        acknowledgedCoeVersion: string | null;
    };
};
export declare function mergeDisclosuresWithAcknowledgements(assessment: ComplianceAssessment, acknowledgements: ReturnType<typeof summariseAcknowledgements>): ComplianceAssessment['disclosures'];
export declare function getWorkspaceOverview(ctx: AppContext, { orgId, logger, }: {
    orgId: string;
    logger: FastifyBaseLogger;
}): Promise<{
    jurisdictions: {
        code: string | undefined;
        name: string | undefined;
        eu: boolean | null | undefined;
        ohada: boolean | null | undefined;
        matterCount: number;
    }[];
    matters: {
        id: string | undefined;
        question: string | null | undefined;
        status: string | null | undefined;
        riskLevel: string | null | undefined;
        hitlRequired: boolean | null | undefined;
        startedAt: string | null | undefined;
        finishedAt: string | null | undefined;
        jurisdiction: string | null;
    }[];
    complianceWatch: {
        id: string | undefined;
        title: string | null | undefined;
        publisher: string | null | undefined;
        url: string | null | undefined;
        jurisdiction: string | null | undefined;
        consolidated: boolean | null | undefined;
        effectiveDate: string | null | undefined;
        createdAt: string | null | undefined;
    }[];
    hitlInbox: {
        items: {
            id: string | undefined;
            runId: string | null | undefined;
            reason: string | null | undefined;
            status: string | null | undefined;
            createdAt: string | null | undefined;
        }[];
        pendingCount: number;
    };
    desk: any;
    navigator: any[];
}>;
export declare function getComplianceStatus(ctx: AppContext, { orgId, userId, limit, access, logger, }: {
    orgId: string;
    userId: string;
    limit: number;
    access: OrgAccessContext;
    logger: FastifyBaseLogger;
}): Promise<{
    acknowledgements: {
        consent: {
            requiredVersion: string | null;
            acknowledgedVersion: string | null;
            acknowledgedAt: string | null;
            satisfied: boolean;
        };
        councilOfEurope: {
            requiredVersion: string | null;
            acknowledgedVersion: string | null;
            acknowledgedAt: string | null;
            satisfied: boolean;
        };
    };
    latest: any;
    history: any;
    totals: any;
}>;
export declare function acknowledgeCompliance(ctx: AppContext, { request, orgId, userId, access, payload, }: {
    request: FastifyRequest;
    orgId: string;
    userId: string;
    access: OrgAccessContext;
    payload: ComplianceAcknowledgementBody;
}): Promise<{
    consent: {
        requiredVersion: string | null;
        acknowledgedVersion: string | null;
        acknowledgedAt: string | null;
        satisfied: boolean;
    };
    councilOfEurope: {
        requiredVersion: string | null;
        acknowledgedVersion: string | null;
        acknowledgedAt: string | null;
        satisfied: boolean;
    };
}>;
export {};
//# sourceMappingURL=service.d.ts.map