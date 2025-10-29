import type { IRACPayload } from '@avocat-ai/shared';
interface JurisdictionFlag {
    country: string;
    eu: boolean;
    ohada: boolean;
}
interface ComplianceInput {
    question: string;
    payload: IRACPayload;
    primaryJurisdiction: JurisdictionFlag | null;
}
interface ComplianceAssessment {
    fria: {
        required: boolean;
        reasons: string[];
    };
    cepej: {
        passed: boolean;
        violations: string[];
    };
}
export declare function evaluateCompliance(input: ComplianceInput): ComplianceAssessment;
export type { ComplianceAssessment };
//# sourceMappingURL=compliance.d.ts.map