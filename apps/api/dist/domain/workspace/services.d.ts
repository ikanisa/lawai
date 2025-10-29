import type { SupabaseClient } from '@supabase/supabase-js';
import { type WorkspaceFetchErrors, type WorkspaceOverview } from './overview.js';
export declare function fetchWorkspaceOverview(supabase: SupabaseClient, orgId: string): Promise<{
    data: WorkspaceOverview;
    errors: WorkspaceFetchErrors;
}>;
export interface WorkspaceCitationsResponse {
    entries: Array<{
        id: string;
        title: string;
        sourceType: string | null;
        jurisdiction: string | null;
        url: string | null;
        publisher: string | null;
        bindingLanguage: string | null;
        consolidated: boolean | null;
        languageNote: string | null;
        effectiveDate: string | null;
        capturedAt: string | null;
        checksum: string | null;
    }>;
}
export declare function fetchWorkspaceCitations(supabase: SupabaseClient, orgId: string): Promise<{
    data: WorkspaceCitationsResponse;
    error?: unknown;
}>;
export interface WorkspaceCaseScoresResponse {
    scores: Array<{
        id: string;
        sourceId: string;
        jurisdiction: string | null;
        score: number | null;
        axes: unknown;
        hardBlock: boolean | null;
        version: string | null;
        modelRef: string | null;
        notes: string | null;
        computedAt: string | null;
        source: {
            title: string | null;
            url: string | null;
            trustTier: string | null;
            courtRank: string | null;
        } | null;
    }>;
}
export declare function fetchWorkspaceCaseScores(supabase: SupabaseClient, orgId: string, sourceId?: string): Promise<{
    data: WorkspaceCaseScoresResponse;
    error?: unknown;
}>;
//# sourceMappingURL=services.d.ts.map