import { AgentPlanNotice, AgentPlanStep, IRACPayload } from '@avocat-ai/shared';
import { type CaseScoreAxis } from './case-quality.js';
import { OrgAccessContext } from './access-control.js';
type ToolInvocationLog = {
    name: string;
    args: unknown;
    output: unknown;
};
export declare const TOOL_NAMES: {
    readonly routeJurisdiction: "route_jurisdiction";
    readonly lookupCodeArticle: "lookup_code_article";
    readonly deadlineCalculator: "deadline_calculator";
    readonly ohadaUniformAct: "ohada_uniform_act";
    readonly limitationCheck: "limitation_check";
    readonly interestCalculator: "interest_calculator";
    readonly checkBindingLanguage: "check_binding_language";
    readonly validateCitation: "validate_citation";
    readonly redlineContract: "redline_contract";
    readonly snapshotAuthority: "snapshot_authority";
    readonly generatePleadingTemplate: "generate_pleading_template";
    readonly evaluateCaseAlignment: "evaluate_case_alignment";
};
export type ToolName = (typeof TOOL_NAMES)[keyof typeof TOOL_NAMES];
type VerificationSeverity = 'info' | 'warning' | 'critical';
export type VerificationStatus = 'passed' | 'hitl_escalated';
export interface VerificationNote {
    code: string;
    message: string;
    severity: VerificationSeverity;
}
export interface VerificationResult {
    status: VerificationStatus;
    notes: VerificationNote[];
    allowlistViolations: string[];
}
export interface AgentRunInput {
    question: string;
    context?: string;
    orgId: string;
    userId: string;
    confidentialMode?: boolean;
    userLocationOverride?: string | null;
}
export interface AgentRunResult {
    runId: string;
    payload: IRACPayload;
    allowlistViolations: string[];
    toolLogs: ToolInvocationLog[];
    plan?: AgentPlanStep[];
    reused?: boolean;
    notices?: AgentPlanNotice[];
    verification?: VerificationResult;
    trustPanel?: TrustPanelPayload;
}
export interface AgentPlatformToolDefinition {
    name: string;
    description: string;
    paramsSummary: string;
    category: 'hosted' | 'custom';
}
export interface AgentPlatformDefinition {
    name: string;
    description: string;
    instructions: string;
    tools: AgentPlatformToolDefinition[];
    hostedTools: string[];
    resources: {
        vectorStoreEnv?: string;
    };
}
interface TrustPanelCitationSummary {
    total: number;
    allowlisted: number;
    ratio: number;
    nonAllowlisted: Array<{
        title: string;
        url: string;
    }>;
    translationWarnings: string[];
    bindingNotes: Record<string, number>;
    rules: {
        total: number;
        binding: number;
        nonBinding: number;
    };
}
interface TrustPanelCaseItem {
    url: string;
    score: number;
    hardBlock: boolean;
    notes: string[];
    axes: Record<CaseScoreAxis, number>;
}
interface TrustPanelCaseQualitySummary {
    items: TrustPanelCaseItem[];
    minScore: number | null;
    maxScore: number | null;
    forceHitl: boolean;
}
interface TrustPanelRetrievalSummary {
    snippetCount: number;
    fileSearch: number;
    local: number;
    topHosts: Array<{
        host: string;
        count: number;
    }>;
}
interface TrustPanelRiskSummary {
    level: IRACPayload['risk']['level'];
    hitlRequired: boolean;
    reason: string;
    verification: {
        status: VerificationStatus;
        notes: VerificationNote[];
    };
}
interface TrustPanelProvenanceSummary {
    totalSources: number;
    withEli: number;
    withEcli: number;
    residencyBreakdown: Array<{
        zone: string;
        count: number;
    }>;
    bindingLanguages: Array<{
        language: string;
        count: number;
    }>;
    akomaArticles: number;
}
export interface TrustPanelPayload {
    citationSummary: TrustPanelCitationSummary;
    retrievalSummary: TrustPanelRetrievalSummary;
    caseQuality: TrustPanelCaseQualitySummary;
    risk: TrustPanelRiskSummary;
    provenance: TrustPanelProvenanceSummary;
}
export interface HybridSnippet {
    content: string;
    similarity: number;
    weight: number;
    origin: 'local' | 'file_search';
    sourceId?: string | null;
    documentId?: string | null;
    fileId?: string | null;
    url?: string | null;
    title?: string | null;
    publisher?: string | null;
    trustTier?: 'T1' | 'T2' | 'T3' | 'T4';
    eli?: string | null;
    ecli?: string | null;
    bindingLanguage?: string | null;
    residencyZone?: string | null;
    akomaArticleCount?: number | null;
}
type BindingLanguageInfo = {
    jurisdiction: string;
    bindingLang: string;
    translationNotice?: string;
    requiresBanner: boolean;
    source: string;
};
declare function determineBindingLanguage(jurisdictionHint: string | null, url?: string): BindingLanguageInfo & {
    rationale: string;
};
export declare function getHybridRetrievalContext(orgId: string, question: string, jurisdiction: string | null): Promise<HybridSnippet[]>;
export declare function runLegalAgent(input: AgentRunInput, accessContext?: OrgAccessContext): Promise<AgentRunResult>;
export declare function getAgentPlatformDefinition(): AgentPlatformDefinition;
export type { IRACPayload } from '@avocat-ai/shared';
export { determineBindingLanguage };
//# sourceMappingURL=agent.d.ts.map