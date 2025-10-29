import type { WorkspaceRepository, WorkspaceRunSummary } from '../repositories/workspace-repository.js';
export interface GetWorkspaceSnapshotInput {
    orgId: string;
    limit?: number;
}
export interface WorkspaceSnapshot {
    runs: WorkspaceRunSummary[];
}
export declare class WorkspaceService {
    private readonly repository;
    constructor(repository: WorkspaceRepository);
    getWorkspaceSnapshot(input: GetWorkspaceSnapshotInput): Promise<WorkspaceSnapshot>;
}
//# sourceMappingURL=workspace-service.d.ts.map