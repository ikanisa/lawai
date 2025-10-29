import type { SupabaseClient } from '@supabase/supabase-js';
import type { FastifyRequest } from 'fastify';
import type { authorizeRequestWithGuards } from '../../http/authorization.js';
export declare const COMPLIANCE_ACK_TYPES: {
    readonly consent: "ai_assist";
    readonly councilOfEurope: "council_of_europe_disclosure";
};
export type ComplianceAcknowledgementSummary = ReturnType<typeof summariseAcknowledgements>;
export type ConsentEventInsert = {
    org_id: string | null;
    user_id: string;
    consent_type: string;
    version: string;
};
type AcknowledgementEvent = {
    type: string;
    version: string;
    created_at: string | null;
};
type AuthorizationContext = Awaited<ReturnType<typeof authorizeRequestWithGuards>>;
export declare const toStringArray: (input: unknown) => string[];
export declare function fetchAcknowledgementEvents(supabase: SupabaseClient, orgId: string, userId: string): Promise<AcknowledgementEvent[]>;
export declare function recordAcknowledgementEvents(request: FastifyRequest, supabase: SupabaseClient, orgId: string, userId: string, records: ConsentEventInsert[]): Promise<void>;
export declare function summariseAcknowledgements(access: AuthorizationContext, events: AcknowledgementEvent[]): {
    readonly consent: {
        readonly requiredVersion: string | null;
        readonly acknowledgedVersion: string | null;
        readonly acknowledgedAt: string | null;
        readonly satisfied: boolean;
    };
    readonly councilOfEurope: {
        readonly requiredVersion: string | null;
        readonly acknowledgedVersion: string | null;
        readonly acknowledgedAt: string | null;
        readonly satisfied: boolean;
    };
};
export type ComplianceAssessment = {
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
export declare function mergeDisclosuresWithAcknowledgements(assessment: ComplianceAssessment, acknowledgements: ComplianceAcknowledgementSummary): ComplianceAssessment['disclosures'];
export {};
//# sourceMappingURL=compliance.d.ts.map