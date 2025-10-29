import type { SupabaseClient } from '@supabase/supabase-js';
import type { WorkspaceRepository, WorkspaceRunSummary } from '../../repositories/workspace-repository.js';
export declare class SupabaseWorkspaceRepository implements WorkspaceRepository {
    private readonly client;
    constructor(client: SupabaseClient);
    listRecentRuns(orgId: string, limit?: number): Promise<WorkspaceRunSummary[]>;
}
//# sourceMappingURL=workspace-repository.d.ts.map