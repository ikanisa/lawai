import type { PostgrestSingleResponse, SupabaseClient } from '@supabase/supabase-js';
import { buildPhaseCProcessNavigator, buildPhaseCWorkspaceDesk } from '../../workspace.js';
import { type HitlInbox, type HitlQueueRow, type HitlQueryResult } from './hitl.js';
export interface JurisdictionRow {
    code: string;
    name: string;
    eu: boolean;
    ohada: boolean;
}
export interface MatterRow {
    id: string;
    question: string;
    risk_level: string | null;
    hitl_required: boolean | null;
    status: string | null;
    started_at: string | null;
    finished_at: string | null;
    jurisdiction_json: unknown;
}
export interface ComplianceRow {
    id: string;
    title: string;
    publisher: string | null;
    source_url: string;
    jurisdiction_code: string | null;
    consolidated: boolean | null;
    effective_date: string | null;
    created_at: string | null;
}
export interface WorkspaceOverviewCore {
    jurisdictions: Array<{
        code: string;
        name: string;
        eu: boolean;
        ohada: boolean;
        matterCount: number;
    }>;
    matters: Array<{
        id: string;
        question: string;
        status: string | null;
        riskLevel: string | null;
        hitlRequired: boolean | null;
        startedAt: string | null;
        finishedAt: string | null;
        jurisdiction: string | null;
    }>;
    complianceWatch: Array<{
        id: string;
        title: string;
        publisher: string | null;
        url: string;
        jurisdiction: string | null;
        consolidated: boolean | null;
        effectiveDate: string | null;
        createdAt: string | null;
    }>;
    hitlInbox: HitlInbox;
}
export interface WorkspaceOverview extends WorkspaceOverviewCore {
    desk: ReturnType<typeof buildPhaseCWorkspaceDesk>;
}
export interface WorkspaceOverviewWithNavigator extends WorkspaceOverview {
    navigator: ReturnType<typeof buildPhaseCProcessNavigator>;
}
export interface WorkspaceFetchErrors {
    jurisdictions?: unknown;
    matters?: unknown;
    compliance?: unknown;
    hitl?: unknown;
}
export interface WorkspaceOverviewQueryResults {
    jurisdictionsResult: PostgrestSingleResponse<JurisdictionRow>;
    mattersResult: PostgrestSingleResponse<MatterRow>;
    complianceResult: PostgrestSingleResponse<ComplianceRow>;
    hitlResult: HitlQueryResult;
}
export declare const JURISDICTION_OVERVIEW_FIELDS = "code, name, eu, ohada";
export declare const MATTER_OVERVIEW_FIELDS = "id, question, risk_level, hitl_required, status, started_at, finished_at, jurisdiction_json";
export declare const COMPLIANCE_OVERVIEW_FIELDS = "id, title, publisher, source_url, jurisdiction_code, consolidated, effective_date, created_at";
export declare function extractCountry(value: unknown): string | null;
export declare function normalizeWorkspaceOverview({ jurisdictions, matters, compliance, hitl, }: {
    jurisdictions: JurisdictionRow[];
    matters: MatterRow[];
    compliance: ComplianceRow[];
    hitl: HitlQueueRow[];
}): WorkspaceOverviewCore;
export declare function collectWorkspaceFetchErrors({ jurisdictionsResult, mattersResult, complianceResult, hitlResult, }: WorkspaceOverviewQueryResults): WorkspaceFetchErrors;
export declare function queryWorkspaceOverview(supabase: SupabaseClient, orgId: string): Promise<WorkspaceOverviewQueryResults>;
export declare function getWorkspaceOverview(supabase: SupabaseClient, orgId: string): Promise<{
    overview: WorkspaceOverviewWithNavigator;
    errors: WorkspaceFetchErrors;
}>;
//# sourceMappingURL=overview.d.ts.map