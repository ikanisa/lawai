export type CaseScoreAxis = 'PW' | 'ST' | 'SA' | 'PI' | 'JF' | 'LB' | 'RC' | 'CQ';
export interface TreatmentSignal {
    treatment: string;
    weight?: number | null;
    decidedAt?: string | null;
}
export interface StatuteAlignmentSignal {
    alignmentScore?: number | null;
}
export interface RiskSignal {
    flag: string;
    note?: string | null;
}
export interface CaseQualitySignals {
    trustTier: 'T1' | 'T2' | 'T3' | 'T4';
    courtRank?: string | null;
    jurisdiction: string;
    bindingJurisdiction?: string | null;
    politicalRiskFlag?: boolean | null;
    bindingLanguage?: string | null;
    effectiveDate?: string | null;
    createdAt?: string | null;
    treatments: TreatmentSignal[];
    statuteAlignments: StatuteAlignmentSignal[];
    riskOverlays: RiskSignal[];
    override?: {
        score: number;
        reason?: string | null;
    } | null;
}
export interface CaseQualityResult {
    axes: Record<CaseScoreAxis, number>;
    score: number;
    hardBlock: boolean;
    notes: string[];
}
export declare const CASE_TRUST_WEIGHTS: Record<'T1' | 'T2' | 'T3' | 'T4', number>;
export declare function evaluateCaseQuality(signals: CaseQualitySignals): CaseQualityResult;
//# sourceMappingURL=case-quality.d.ts.map